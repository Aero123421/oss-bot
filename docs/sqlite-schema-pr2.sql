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

-- ---------------------------------------------------------------------------
-- COMMENT ONLY (do NOT CREATE yet) — CredBroker public meta for later PR
-- cred_grants: id, purpose, runtime_handle_id, ready INTEGER, status_code TEXT,
--   created_at — NEVER store mounts env secret values
-- cred_broker_status: purpose PK, ready INTEGER, status_code TEXT, updated_at
-- ready + status_code only; never store secrets
-- ---------------------------------------------------------------------------
