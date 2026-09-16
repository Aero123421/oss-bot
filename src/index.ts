import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const port = Number(process.env.PORT ?? 3000);
const dbPath = process.env.DATABASE_PATH ?? "./data/oss-bot.sqlite";
const token = process.env.OSS_BOT_TOKEN ?? "";

if (process.env.NODE_ENV === "production") {
  if (!token || token.startsWith("change-me")) {
    console.error("OSS_BOT_TOKEN must be a non-default value in production");
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
    return c.json({ ok, db: ok, schema_version: schema?.value ?? null });
  } catch (err) {
    console.error("healthz failed", err);
    return c.json({ ok: false, error: "unavailable" }, 503);
  }
});

app.get("/api/v1/me", tokenGate, (c) => c.json({ ok: true, auth: "token" }));

serve({ fetch: app.fetch, port }, () => {
  console.log(`oss-bot listening on :${port} (sqlite=${dbPath})`);
});
