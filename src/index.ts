import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { assertProductionToken, isAuthGateOpen, tokenGate } from "./auth.js";
import { openDb, getDb } from "./db.js";
import { migrateRuntime } from "./runtime/store.js";
import {
  listRuntimes,
  runtimeMeta,
  startRuntime,
  statusRuntime,
  stopRuntime,
} from "./runtime/service.js";
import { botsRoutes } from "./routes/bots.js";
import { groupsRoutes } from "./routes/groups.js";
import { threadsRoutes } from "./routes/threads.js";
import { dispatcherRoutes } from "./routes/dispatcher.js";
import { credRoutes } from "./routes/cred.js";
import { capabilitiesRoutes } from "./routes/capabilities.js";
import "./providers/registry.js";

assertProductionToken();

const port = Number(process.env.PORT ?? 3000);
const dbPath = process.env.DATABASE_PATH ?? "./data/oss-bot.sqlite";
const botRuntime = process.env.BOT_RUNTIME ?? "docker";
const dockerHostConfigured = Boolean(process.env.DOCKER_HOST);
const sockOverlay = process.env.DOCKER_SOCK_OVERLAY === "1";
const credBridgeMounts = process.env.CRED_BRIDGE_MOUNTS === "1";

if (process.env.NODE_ENV === "production" && sockOverlay) {
  console.error("DOCKER_SOCK_OVERLAY must not be enabled in production");
  process.exit(1);
}

const db = openDb(dbPath);
migrateRuntime(db);

const app = new Hono();

const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  "*",
  cors({
    origin: corsOrigins,
    allowHeaders: ["Authorization", "Content-Type", "X-Oss-Bot-Token"],
  })
);

function authGatePublic() {
  return {
    configured: isAuthGateOpen(),
    gate: isAuthGateOpen() ? ("open" as const) : ("closed" as const),
  };
}

/** Public health only — no /api/v1 without AuthGate */
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
      auth_gate: authGatePublic().gate,
    });
  } catch (err) {
    console.error("healthz failed", err);
    return c.json({ ok: false, error: "unavailable" }, 503);
  }
});

/**
 * AuthGate: ALL /api/v1/* require shared token (OSS_BOT_TOKEN).
 * CredBroker.issue() env must never appear in HTTP responses — status only.
 */
app.use("/api/v1/*", tokenGate);

app.get("/api/v1/me", (c) =>
  c.json({ ok: true, auth: "token", bot_runtime: botRuntime })
);

app.get("/api/v1/runtime", (c) =>
  c.json({
    ok: true,
    ...runtimeMeta(),
    bot_runtime: botRuntime,
    cred_bridge_mounts: credBridgeMounts,
    handles: listRuntimes(getDb()),
  })
);

app.post("/api/v1/runtime/start", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    bot_id?: string;
    mode?: "docker" | "local";
    image?: string;
  };
  const result = startRuntime(getDb(), body);
  if (!result.ok) {
    return c.json({ ok: false, error: result.error }, result.status as 400 | 404 | 500 | 503);
  }
  return c.json({ ok: true, handle: result.handle }, 201);
});

app.post("/api/v1/runtime/:id/stop", (c) => {
  const result = stopRuntime(getDb(), c.req.param("id"));
  if (!result.ok) {
    return c.json({ ok: false, error: result.error }, result.status as 400 | 404 | 500 | 503);
  }
  return c.json({ ok: true, handle: result.handle });
});

app.get("/api/v1/runtime/:id/status", (c) => {
  const result = statusRuntime(getDb(), c.req.param("id"));
  if (!result.ok) {
    return c.json({ ok: false, error: result.error }, result.status as 400 | 404 | 500 | 503);
  }
  return c.json({ ok: true, handle: result.handle });
});

// Control plane — gated by app.use('/api/v1/*', tokenGate) above
app.route("/api/v1/bots", botsRoutes);
app.route("/api/v1/groups", groupsRoutes);
app.route("/api/v1/threads", threadsRoutes);
app.route("/api/v1/dispatcher", dispatcherRoutes);
app.route("/api/v1/cred", credRoutes);
// Capability exec: both paths for FE + prior evidence URLs
app.route("/api/v1/runtime", capabilitiesRoutes);
app.route("/api/v1/runtimes", capabilitiesRoutes);

serve({ fetch: app.fetch, port }, () => {
  console.log(
    `oss-bot listening on :${port} (sqlite=${dbPath}, auth_gate=${authGatePublic().gate}, bot_runtime=${botRuntime})`
  );
});
