import type Database from "better-sqlite3";
import type { RuntimeHandle, RuntimeMode, RuntimeStatus } from "./types.js";
import { randomUUID } from "node:crypto";

export function migrateRuntime(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS runtime_handles (
      id TEXT PRIMARY KEY,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      bot_id TEXT,
      container_id TEXT,
      local_pid INTEGER,
      image TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function rowToHandle(row: Record<string, unknown>): RuntimeHandle {
  return {
    id: String(row.id),
    mode: row.mode as RuntimeMode,
    status: row.status as RuntimeStatus,
    bot_id: row.bot_id != null ? String(row.bot_id) : null,
    container_id: row.container_id != null ? String(row.container_id) : null,
    local_pid: row.local_pid != null ? Number(row.local_pid) : null,
    image: row.image != null ? String(row.image) : null,
    error: row.error != null ? String(row.error) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function createHandle(
  db: Database.Database,
  partial: {
    mode: RuntimeMode;
    bot_id?: string | null;
    image?: string | null;
    status?: RuntimeStatus;
  }
): RuntimeHandle {
  const now = new Date().toISOString();
  const handle: RuntimeHandle = {
    id: randomUUID(),
    mode: partial.mode,
    status: partial.status ?? "starting",
    bot_id: partial.bot_id ?? null,
    container_id: null,
    local_pid: null,
    image: partial.image ?? null,
    error: null,
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO runtime_handles
      (id, mode, status, bot_id, container_id, local_pid, image, error, created_at, updated_at)
     VALUES (@id, @mode, @status, @bot_id, @container_id, @local_pid, @image, @error, @created_at, @updated_at)`
  ).run(handle);
  return handle;
}

export function getHandle(db: Database.Database, id: string): RuntimeHandle | null {
  const row = db.prepare(`SELECT * FROM runtime_handles WHERE id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToHandle(row) : null;
}

export function listHandles(db: Database.Database): RuntimeHandle[] {
  const rows = db.prepare(`SELECT * FROM runtime_handles ORDER BY created_at DESC`).all() as Record<
    string,
    unknown
  >[];
  return rows.map(rowToHandle);
}

export function updateHandle(
  db: Database.Database,
  id: string,
  patch: Partial<
    Pick<
      RuntimeHandle,
      "status" | "container_id" | "local_pid" | "image" | "error" | "bot_id"
    >
  >
): RuntimeHandle | null {
  const cur = getHandle(db, id);
  if (!cur) return null;
  const next: RuntimeHandle = {
    ...cur,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  db.prepare(
    `UPDATE runtime_handles SET
      status=@status, container_id=@container_id, local_pid=@local_pid,
      image=@image, error=@error, bot_id=@bot_id, updated_at=@updated_at
     WHERE id=@id`
  ).run(next);
  return next;
}
