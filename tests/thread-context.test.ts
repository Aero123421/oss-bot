import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { test } from "node:test";
import { Hono } from "hono";
import { tokenGate } from "../src/auth.js";
import { agentBus } from "../src/bus.js";
import { credBroker } from "../src/cred/broker.js";
import { openDb } from "../src/db.js";
import { threadEvents } from "../src/providers/cliProvider.js";
import { buildThreadPrompt, recordPromptRecipient } from "../src/providers/threadPrompt.js";
import { dispatcherRoutes } from "../src/routes/dispatcher.js";

const roomA = "thr_dm_dispatcher";
const roomB = "thr_room_general";

function decode(prompt: string) {
  return JSON.parse(prompt.slice(prompt.indexOf("\n") + 1)) as {
    previous_turns: { role: string; content: string }[];
    current_message: string;
  };
}

test("authenticated dispatcher passes one bounded prompt to a local fake CLI", { timeout: 20000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "oss-bot-context-test-"));
  const token = "synthetic-local-fixture-token";
  const capture = join(dir, "capture.jsonl");
  const fakeCli = join(dir, "fake-cli");
  const envBefore = { ...process.env };
  const db = openDb(join(dir, "fixture.sqlite"));
  const insert = db.prepare(
    "INSERT INTO messages (id, thread_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)"
  );
  const app = new Hono();
  app.use("/api/v1/*", tokenGate);
  app.route("/api/v1/dispatcher", dispatcherRoutes);
  try {
    writeFileSync(fakeCli,
      `#!${process.execPath}\n` +
      `const fs = require("node:fs");\n` +
      `fs.appendFileSync(${JSON.stringify(capture)}, JSON.stringify(process.argv.slice(2)) + "\\n");\n` +
      `process.stdout.write("synthetic answer");\n`, { mode: 0o700 });
    process.env.OSS_BOT_TOKEN = token;
    process.env.CLAUDE_BIN = fakeCli;
    process.env.CODEX_BIN = fakeCli;
    delete process.env.OSS_BOT_PROVIDER_MODE;
    delete process.env.OSS_BOT_THREAD_CONTEXT;
    for (const provider of ["claude", "codex"] as const) {
      credBroker.register({
        provider, purpose: `provider:${provider}`, mounts: [], envKeys: [],
        binaryHints: ["sh"], missingHint: "local fake CLI fixture only",
      });
    }
    function request(body: { threadId: string; content: string; botId?: string; run?: boolean }, authorized = true) {
      return app.request("/api/v1/dispatcher/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authorized ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
    }
    function rows(threadId: string) {
      return db.prepare(
        "SELECT id, role, content FROM messages WHERE thread_id = ? ORDER BY rowid"
      ).all(threadId) as { id: string; role: string; content: string }[];
    }
    function lastArgs(): string[] {
      return JSON.parse(readFileSync(capture, "utf8").trimEnd().split("\n").at(-1)!);
    }
    async function send(threadId: string, content: string, botId?: string) {
      const done = AbortSignal.timeout(4000);
      const events = threadEvents(threadId);
      const seen: string[] = [];
      const listener = (e: { type: string }) => {
        seen.push(e.type);
        if (e.type === "done") events.emit("test-done");
      };
      events.on("event", listener);
      try {
        const finish = once(events, "test-done", { signal: done });
        const response = await request({ threadId, content, botId });
        await finish;
        assert.equal(response.status, 201);
        assert.deepEqual(seen.filter((e) => e === "message"), ["message"]);
        assert.ok(!seen.includes("error"));
        const json = await response.json();
        assert.deepEqual(Object.keys(json).sort(), ["busMessageId", "messageId", "runNote", "threadId"]);
        return json as { messageId: string; threadId: string };
      } finally {
        events.off("event", listener);
      }
    }

    assert.equal((await request({ threadId: roomA, content: "not authorized" }, false)).status, 401);
    assert.deepEqual(rows(roomA), []);
    await send(roomA, "legacy before enabling");
    assert.deepEqual(lastArgs(), ["-p", "legacy before enabling", "--output-format", "text"]);

    process.env.OSS_BOT_THREAD_CONTEXT = "1";
    await send(roomA, "first room A, \"quotes\" and newline\nsecond line");
    assert.equal(lastArgs()[1], "first room A, \"quotes\" and newline\nsecond line");
    await send(roomB, "other room private fact");
    const bCount = rows(roomB).length;
    insert.run("system", roomA, "system", "private administrative row", "2026-01-01");
    const unsubscribe = agentBus.subscribe("bot_dispatcher", (msg) => {
      if (msg.content !== "second room A question") return;
      // A later insertion must stay out even if its timestamp is earlier.
      insert.run("later", roomA, "user", "later room A row", "2000-01-01");
      recordPromptRecipient(db, "later", "bot_dispatcher", "claude");
    });
    const aCount = rows(roomA).length;
    const second = await send(roomA, "  second room A question  ");
    unsubscribe();
    const aArgs = lastArgs();
    assert.equal(aArgs.length, 4);
    assert.deepEqual(aArgs.slice(0, 1), ["-p"]);
    assert.deepEqual(aArgs.slice(2), ["--output-format", "text"]);
    assert.deepEqual(decode(aArgs[1]), {
      previous_turns: [
        { role: "user", content: "first room A, \"quotes\" and newline\nsecond line" },
        { role: "assistant", content: "synthetic answer" },
      ],
      current_message: "second room A question",
    });
    assert.equal(rows(roomB).length, bCount);
    assert.deepEqual(rows(roomA).slice(aCount).map(({ id, role, content }) => [role, content]), [
      ["user", "second room A question"],
      ["user", "later room A row"],
      ["assistant", "synthetic answer"],
    ]);
    assert.ok(!rows(roomA).find((r) => r.id === second.messageId)!.content.includes("previous_turns"));

    await send(roomA, "different bot starting", "bot_personal");
    assert.equal(lastArgs()[1], "different bot starting");
    await send(roomA, "different bot follow-up", "bot_personal");
    assert.deepEqual(decode(lastArgs()[1]).previous_turns.map((x) => x.content), [
      "different bot starting", "synthetic answer",
    ]);
    db.prepare("UPDATE bots SET provider = 'codex' WHERE id = 'bot_personal'").run();
    await send(roomA, "same bot different provider", "bot_personal");
    assert.deepEqual(lastArgs(), ["exec", "same bot different provider"]);
    assert.equal((await request({ threadId: roomA, content: "not sent to any provider", run: false })).status, 201);
    await send(roomA, "after unrecorded message");
    assert.deepEqual(lastArgs(), ["exec", "after unrecorded message"]);

    delete process.env.OSS_BOT_THREAD_CONTEXT;
    await send(roomA, "opted out again");
    assert.deepEqual(lastArgs(), ["exec", "opted out again"]);

    // Exercise caps and deterministic ties with actual stored rows.
    const room = "thr_dm_research";
    function add(id: string, material: string) {
      insert.run(id, room, "user", material, "2026-01-01");
      recordPromptRecipient(db, id, "bot_research", "codex");
    }
    for (let i = 0; i < 15; i++) add(`tie-${i}`, `turn-${i}`);
    add("current-count", "current count case");
    assert.deepEqual(
      decode(buildThreadPrompt(db, room, "current-count", "bot_research", "codex").contextPrompt)
        .previous_turns.map((r) => r.content),
      Array.from({ length: 12 }, (_, i) => `turn-${i + 3}`)
    );
    add("large-first", "あ".repeat(4000));
    add("large-second", "い".repeat(4000));
    add("highest", "current Unicode case");
    const capped = buildThreadPrompt(db, room, "highest", "bot_research", "codex").contextPrompt;
    assert.ok(Buffer.byteLength(capped, "utf8") <= 16 * 1024);
    assert.deepEqual(decode(capped).previous_turns.map((r) => r.content), ["い".repeat(4000)]);
    add("escaped-large", "\n".repeat(9000));
    add("second-highest", "safe current");
    assert.equal(buildThreadPrompt(db, room, "second-highest", "bot_research", "codex").contextPrompt, "safe current");
    assert.throws(() => buildThreadPrompt(db, roomB, "second-highest", "bot_research", "codex"), /accepted_message_missing/);
    add("large-current", "あ".repeat(6000));
    assert.equal(buildThreadPrompt(db, room, "large-current", "bot_research", "codex").contextPrompt, "あ".repeat(6000));
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in envBefore)) delete process.env[key];
    Object.assign(process.env, envBefore);
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
