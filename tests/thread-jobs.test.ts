import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setImmediate as turn } from "node:timers/promises";
import { test } from "node:test";
import Database from "better-sqlite3";
import { Hono } from "hono";
import { tokenGate } from "../src/auth.js";
import { openDb } from "../src/db.js";
import { ThreadJobs } from "../src/jobs/threadJobs.js";
import { createThreadJobRoutes } from "../src/routes/threadJobs.js";

test("thread-job API persists terminal results and interrupts unfinished work across restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "thread-jobs-test-"));
  const file = join(dir, "fixture.sqlite");
  const db = openDb(file);
  let reopened: Database.Database | undefined;
  const savedToken = process.env.OSS_BOT_TOKEN;
  const token = "synthetic-test-token";
  process.env.OSS_BOT_TOKEN = token;

  const firstRoom = "room_fixture_a";
  const secondRoom = "room_fixture_b";
  const now = new Date().toISOString();
  const insert = db.prepare("INSERT INTO threads (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)");
  insert.run(firstRoom, "Fixture room A", now, now);
  insert.run(secondRoom, "Fixture room B", now, now);

  const deferred: Array<{ resolve: (r: { checked: number }) => void; reject: () => void }> = [];
  const store = new ThreadJobs(db, () => new Promise((resolve, reject) => {
    deferred.push({ resolve, reject: () => reject(new Error("synthetic internal error")) });
  }));

  function client(jobs: ThreadJobs) {
    const app = new Hono();
    app.use("/api/v1/*", tokenGate);
    app.route("/api/v1/threads", createThreadJobRoutes(jobs));
    const api = async (method: string, path: string, payload?: object, auth = token) => {
      const response = await app.request(`/api/v1/threads/${path}`, {
        method, headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      return { status: response.status, json: await response.json() };
    };
    return {
      api,
      submit: (room: string, requestKey: string) => api("POST", `${room}/jobs`, { kind: "fixture_check", requestKey }),
      get: (room: string, id: string) => api("GET", `${room}/jobs/${id}`),
      cancel: (room: string, id: string) => api("POST", `${room}/jobs/${id}/cancel`),
    };
  }

  const a = client(store);
  const b = client(store);
  try {
    for (const invalid of [
      { kind: "other", requestKey: "fixture" },
      { kind: "fixture_check", requestKey: "x".repeat(81) },
      { kind: "fixture_check", requestKey: "newline\n" },
      { kind: "fixture_check", requestKey: "fixture", extra: true },
    ]) assert.equal((await a.api("POST", `${firstRoom}/jobs`, invalid)).status, 400);
    assert.equal((await a.api("POST", `${firstRoom}/jobs`, { kind: "fixture_check", requestKey: "x".repeat(1024) })).status, 413);
    assert.equal((await b.api("GET", `${firstRoom}/jobs`, undefined, "wrong")).status, 401);
    assert.equal((await a.api("POST", `${firstRoom}/jobs`, { kind: "fixture_check", requestKey: "fixture" }, "")).status, 401);
    assert.equal((await a.submit("room_missing", "missing")).status, 404);

    const pair = await Promise.all([a.submit(firstRoom, "same_request"), b.submit(firstRoom, "same_request")]);
    assert.deepEqual(pair.map((x) => x.status).sort(), [200, 201]);
    const idA = pair[0].json.job.id;
    assert.equal(pair[1].json.job.id, idA);
    assert.equal((await b.submit(firstRoom, "second_request")).status, 409);

    const independent = await b.submit(secondRoom, "same_request");
    assert.equal(independent.status, 201);
    const idB = independent.json.job.id;
    assert.notEqual(idB, idA);
    assert.equal((await b.get(secondRoom, idA)).status, 404);
    assert.equal((await a.cancel(firstRoom, idB)).status, 404);
    assert.deepEqual((await b.api("GET", `${secondRoom}/jobs`)).json.jobs.map((j: { id: string }) => j.id), [idB]);

    await turn();
    assert.equal(deferred.length, 2);
    assert.equal((await a.get(firstRoom, idA)).json.job.status, "running");
    assert.equal((await b.cancel(secondRoom, idB)).json.job.status, "cancelled");
    deferred[0].resolve({ checked: 3 });
    deferred[1].resolve({ checked: 3 });
    await turn();
    const finished = (await a.get(firstRoom, idA)).json.job;
    assert.equal(finished.status, "succeeded");
    assert.deepEqual(finished.result, { checked: 3 });
    assert.equal((await b.cancel(secondRoom, idB)).json.job.result, null);
    assert.equal((await b.get(secondRoom, idB)).json.job.status, "cancelled");
    assert.deepEqual((await a.cancel(firstRoom, idA)).json.job, finished);
    assert.deepEqual((await b.submit(firstRoom, "same_request")).json.job, finished);
    assert.equal(deferred.length, 2);

    const failure = await a.submit(firstRoom, "failure_fixture");
    await turn();
    deferred[2].reject();
    await turn();
    const failed = (await a.get(firstRoom, failure.json.job.id)).json.job;
    assert.equal(failed.status, "failed");
    assert.equal(failed.error, "fixture_failed");
    assert.equal(failed.result, null);

    const unfinished = await a.submit(firstRoom, "unfinished_fixture");
    await turn();
    assert.equal((await a.get(firstRoom, unfinished.json.job.id)).json.job.status, "running");
    const queued = await b.submit(secondRoom, "queued_fixture");
    // Reopen the same database and run the actual restart guard; do not replay either fixture.
    reopened = new Database(file);
    reopened.pragma("foreign_keys = ON");
    let restartRuns = 0;
    const restarted = new ThreadJobs(reopened, async () => { restartRuns += 1; return { checked: 3 }; });
    restarted.markInterrupted();
    const fresh = client(restarted);
    const after = (await fresh.get(firstRoom, unfinished.json.job.id)).json.job;
    assert.equal(after.status, "interrupted");
    assert.equal(after.error, "process_restarted");
    assert.equal(after.result, null);
    assert.equal((await fresh.get(secondRoom, queued.json.job.id)).json.job.status, "interrupted");
    assert.deepEqual((await fresh.get(firstRoom, idA)).json.job, finished);
    assert.deepEqual((await fresh.submit(firstRoom, "unfinished_fixture")).json.job, after);
    deferred[3].resolve({ checked: 3 });
    await turn();
    assert.equal(deferred.length, 4);
    assert.equal(restartRuns, 0);
    assert.deepEqual((await fresh.get(firstRoom, unfinished.json.job.id)).json.job, after);
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM messages").get() as { n: number }).n, 0);
  } finally {
    if (savedToken === undefined) delete process.env.OSS_BOT_TOKEN;
    else process.env.OSS_BOT_TOKEN = savedToken;
    reopened?.close();
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
