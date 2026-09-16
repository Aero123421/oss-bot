import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { migrateRuntime } from "./runtime/store.js";
import {
  listRuntimes,
  runtimeMeta,
  startRuntime,
  statusRuntime,
  stopRuntime,
} from "./runtime/service.js";

const port = Number(process.env.PORT ?? 3000);
const dbPath = process.env.DATABASE_PATH ?? "./data/oss-bot.sqlite";
const token = process.env.OSS_BOT_TOKEN ?? "";
const botRuntime = process.env.BOT_RUNTIME ?? "docker";
const dockerHostConfigured = Boolean(process.env.DOCKER_HOST);
const sockOverlay = process.env.DOCKER_SOCK_OVERLAY === "1";
const credBridgeMounts = process.env.CRED_BRIDGE_MOUNTS === "1";

if (process.env.NODE_ENV === "production") {
  if (!token || token.startsWith("change-me")) {
    console.error("OSS_BOT_TOKEN must be a non-default value in production");
    process.exit(1);
  }
  if (sockOverlay) {
    console.error("DOCKER_SOCK_OVERLAY must not be enabled in production");
    process.exit(1);
  }
} else if (!token) {
  console.warn("WARN: OSS_BOT_TOKEN is empty — protected routes will return 401");
}

fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
const db = new Database(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);
db.prepare(
  `INSERT INTO meta (key, value) VALUES ('schema_version', '1')
   ON CONFLICT(key) DO NOTHING`
).run();
migrateRuntime(db);

const tokenGate = createMiddleware(async (c, next) => {
  const header =
    c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ??
    c.req.header("x-oss-bot-token") ??
    "";
  if (!token || header !== token) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
});

const app = new Hono();

app.get("/healthz", (c) => {
  try {
    const ok = (db.prepare("SELECT 1 AS ok").get() as { ok: number }).ok === 1;
    const schema = db
      .prepare("SELECT value FROM meta WHERE key = ?")
      .get("schema_version") as { value: string } | undefined;
    return c.json({
      ok,
      db: ok,
      schema_version: schema?.value ?? null,
      bot_runtime: botRuntime,
      docker_host_configured: dockerHostConfigured,
      sock_overlay: sockOverlay,
      cred_bridge_mounts: credBridgeMounts,
    });
  } catch (err) {
    console.error("healthz failed", err);
    return c.json({ ok: false, error: "unavailable" }, 503);
  }
});

app.get("/api/v1/me", tokenGate, (c) =>
  c.json({ ok: true, auth: "token", bot_runtime: botRuntime })
);

/** Runtime adapter summary (CP-aligned flags; no secret paths/values). */
app.get("/api/v1/runtime", tokenGate, (c) =>
  c.json({
    ok: true,
    ...runtimeMeta(),
    bot_runtime: botRuntime,
    cred_bridge_mounts: credBridgeMounts,
    handles: listRuntimes(db),
  })
);

app.post("/api/v1/runtime/start", tokenGate, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    bot_id?: string;
    mode?: "docker" | "local";
    image?: string;
  };
  const result = startRuntime(db, body);
  if (!result.ok) return c.json({ ok: false, error: result.error }, result.status as 400 | 404 | 500 | 503);
  return c.json({ ok: true, handle: result.handle }, 201);
});

app.post("/api/v1/runtime/:id/stop", tokenGate, (c) => {
  const result = stopRuntime(db, c.req.param("id"));
  if (!result.ok) return c.json({ ok: false, error: result.error }, result.status as 400 | 404 | 500 | 503);
  return c.json({ ok: true, handle: result.handle });
});

app.get("/api/v1/runtime/:id/status", tokenGate, (c) => {
  const result = statusRuntime(db, c.req.param("id"));
  if (!result.ok) return c.json({ ok: false, error: result.error }, result.status as 400 | 404 | 500 | 503);
  return c.json({ ok: true, handle: result.handle });
});

serve({ fetch: app.fetch, port }, () => {
  console.log(
    `oss-bot listening on :${port} (sqlite=${dbPath}, bot_runtime=${botRuntime}, sock_overlay=${sockOverlay})`
  );
});
