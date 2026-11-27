import { setTimeout as delay } from "node:timers/promises";
import { newId, nowIso, type Db } from "../db.js";

export const FIXTURE_KIND = "fixture_check";

type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "interrupted";
type FixtureResult = { checked: number };
type JobRow = {
  id: string;
  thread_id: string;
  request_key: string;
  kind: typeof FIXTURE_KIND;
  status: JobStatus;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  result_json: string | null;
  error: string | null;
};

function publicJob(row: JobRow) {
  return {
    id: row.id,
    threadId: row.thread_id,
    requestKey: row.request_key,
    kind: row.kind,
    status: row.status,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    result: row.result_json === null ? null : JSON.parse(row.result_json) as FixtureResult,
    error: row.error,
  };
}

async function runFixture(): Promise<FixtureResult> {
  // Deliberately long enough to observe cancellation in this first API slice.
  await delay(1000);
  const checks = [1 + 1 === 2, "sample".length === 6, [2, 4, 6].every((n) => n % 2 === 0)];
  if (!checks.every(Boolean)) throw new Error("fixture_failed");
  return { checked: checks.length };
}

export class ThreadJobs {
  constructor(
    private readonly db: Db,
    private readonly fixture: () => Promise<FixtureResult> = runFixture,
  ) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS thread_jobs (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        request_key TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind = 'fixture_check'),
        status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'interrupted')),
        created_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        result_json TEXT,
        error TEXT,
        UNIQUE (thread_id, request_key),
        CHECK ((status = 'succeeded') = (result_json IS NOT NULL)),
        CHECK ((status IN ('queued', 'running')) = (finished_at IS NULL))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_thread_jobs_one_active
        ON thread_jobs (thread_id) WHERE status IN ('queued', 'running');
      CREATE INDEX IF NOT EXISTS idx_thread_jobs_recent
        ON thread_jobs (thread_id, created_at DESC, id DESC);
    `);
  }

  /** Used once at startup. Only one API process may own a given SQLite file. */
  markInterrupted(): void {
    this.db.prepare(`
      UPDATE thread_jobs
      SET status = 'interrupted', finished_at = ?, error = 'process_restarted'
      WHERE status IN ('queued', 'running')
    `).run(nowIso());
  }

  threadExists(threadId: string): boolean {
    return Boolean(this.db.prepare("SELECT 1 FROM threads WHERE id = ?").get(threadId));
  }

  private find(threadId: string, id: string): JobRow | undefined {
    return this.db.prepare("SELECT * FROM thread_jobs WHERE thread_id = ? AND id = ?")
      .get(threadId, id) as JobRow | undefined;
  }

  get(threadId: string, id: string) {
    const row = this.find(threadId, id);
    return row ? publicJob(row) : undefined;
  }

  list(threadId: string) {
    if (!this.threadExists(threadId)) return undefined;
    const rows = this.db.prepare(`
      SELECT * FROM thread_jobs WHERE thread_id = ?
      ORDER BY created_at DESC, id DESC LIMIT 20
    `).all(threadId) as JobRow[];
    return rows.map(publicJob);
  }

  submit(threadId: string, requestKey: string) {
    const result = this.db.transaction(() => {
      if (!this.threadExists(threadId)) return { type: "not_found" } as const;
      const old = this.db.prepare("SELECT * FROM thread_jobs WHERE thread_id = ? AND request_key = ?")
        .get(threadId, requestKey) as JobRow | undefined;
      if (old) return { type: "replayed", job: publicJob(old) } as const;
      const active = this.db.prepare(`
        SELECT id FROM thread_jobs WHERE thread_id = ? AND status IN ('queued', 'running')
      `).get(threadId) as { id: string } | undefined;
      if (active) return { type: "busy", jobId: active.id } as const;

      const row: JobRow = {
        id: newId("job"),
        thread_id: threadId,
        request_key: requestKey,
        kind: FIXTURE_KIND,
        status: "queued",
        created_at: nowIso(),
        started_at: null,
        finished_at: null,
        result_json: null,
        error: null,
      };
      this.db.prepare(`
        INSERT INTO thread_jobs (id, thread_id, request_key, kind, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(row.id, threadId, requestKey, row.kind, row.status, row.created_at);
      return { type: "created", job: publicJob(row) } as const;
    }).immediate();

    if (result.type === "created") {
      const id = result.job.id;
      setImmediate(() => {
        void this.execute(threadId, id).catch(() => {
          // On storage failure keep the database's last state; startup can interrupt it.
          console.error("background fixture could not persist its state");
        });
      });
    }
    return result;
  }

  cancel(threadId: string, id: string) {
    return this.db.transaction(() => {
      this.db.prepare(`
        UPDATE thread_jobs SET status = 'cancelled', finished_at = ?
        WHERE thread_id = ? AND id = ? AND status IN ('queued', 'running')
      `).run(nowIso(), threadId, id);
      return this.get(threadId, id);
    }).immediate();
  }

  private async execute(threadId: string, id: string): Promise<void> {
    const claimed = this.db.prepare(`
      UPDATE thread_jobs SET status = 'running', started_at = ?
      WHERE thread_id = ? AND id = ? AND status = 'queued'
    `).run(nowIso(), threadId, id);
    if (claimed.changes === 0) return;

    let status: "succeeded" | "failed" = "succeeded";
    let result: string | null = null;
    try {
      result = JSON.stringify(await this.fixture());
    } catch {
      status = "failed";
    }
    // One atomic transition publishes the result. If cancellation/interruption won, it stays terminal.
    this.db.prepare(`
      UPDATE thread_jobs SET status = ?, finished_at = ?, result_json = ?, error = ?
      WHERE thread_id = ? AND id = ? AND status = 'running'
    `).run(status, nowIso(), result, status === "failed" ? "fixture_failed" : null, threadId, id);
  }
}
