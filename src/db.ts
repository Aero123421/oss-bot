import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type Db = Database.Database;

let _db: Db | null = null;

const EMBEDDED_SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  role_memo TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL,
  runtime TEXT NOT NULL DEFAULT 'docker' CHECK (runtime IN ('docker', 'local')),
  workdir TEXT,
  system_prompt TEXT,
  model TEXT,
  docker_image TEXT,
  env_json TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bots_enabled ON bots(enabled);
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memberships (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, bot_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_bot ON memberships(bot_id);
CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  active_bot_id TEXT REFERENCES bots(id) ON DELETE SET NULL,
  group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_threads_updated ON threads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_active_bot ON threads(active_bot_id);
CREATE INDEX IF NOT EXISTS idx_threads_group ON threads(group_id);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  bot_id TEXT REFERENCES bots(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_thread_created ON messages(thread_id, created_at ASC);
CREATE TABLE IF NOT EXISTS auth_gates (
  id TEXT PRIMARY KEY,
  token_hash TEXT,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  updated_at TEXT NOT NULL
);
`;

export function openDb(dbPath?: string): Db {
  if (_db) return _db;
  const resolved = path.resolve(dbPath ?? process.env.DATABASE_PATH ?? "./data/oss-bot.sqlite");
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const db = new Database(resolved);
  db.pragma("foreign_keys = ON");

  let schemaSql = EMBEDDED_SCHEMA;
  const schemaFile = path.resolve(__dirname, "../docs/sqlite-schema-pr2.sql");
  if (fs.existsSync(schemaFile)) {
    schemaSql = fs.readFileSync(schemaFile, "utf8");
  }
  db.exec(schemaSql);

  db.prepare(
    `INSERT INTO meta (key, value) VALUES ('schema_version', '2')
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run();

  seedIfEmpty(db);
  _db = db;
  return db;
}

function seedIfEmpty(db: Db): void {
  const row = db.prepare("SELECT COUNT(*) AS n FROM bots").get() as { n: number };
  if (row.n > 0) return;
  const now = new Date().toISOString();
  const insertBot = db.prepare(
    `INSERT INTO bots (id, name, title, role_memo, provider, runtime, env_json, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, '{}', 1, ?, ?)`
  );
  // Dispatcher window (参謀) + personal + research — WOW #2 role bots ≥ 2
  insertBot.run("bot_dispatcher", "参謀", "窓口", "Dispatcher entry window", "claude", "local", now, now);
  insertBot.run("bot_personal", "自分用Bot", "個人", "Personal assistant", "claude", "local", now, now);
  insertBot.run("bot_research", "リサーチ", "調査", "Research role", "claude", "local", now, now);

  db.prepare(`INSERT INTO groups (id, name, created_at) VALUES (?, ?, ?)`).run(
    "grp_general",
    "知的生産",
    now
  );
  for (const botId of ["bot_dispatcher", "bot_personal", "bot_research"]) {
    db.prepare(`INSERT INTO memberships (group_id, bot_id) VALUES (?, ?)`).run("grp_general", botId);
  }

  const insertThr = db.prepare(
    `INSERT INTO threads (id, title, active_bot_id, group_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  insertThr.run("thr_dm_dispatcher", "参謀（窓口）", "bot_dispatcher", null, now, now);
  insertThr.run("thr_dm_personal", "自分用Bot", "bot_personal", null, now, now);
  insertThr.run("thr_dm_research", "リサーチ", "bot_research", null, now, now);
  insertThr.run("thr_room_general", "知的生産", "bot_dispatcher", "grp_general", now, now);
}

export function getDb(): Db {
  if (!_db) return openDb();
  return _db;
}

export function newId(prefix = ""): string {
  const id = crypto.randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}

export function nowIso(): string {
  return new Date().toISOString();
}
