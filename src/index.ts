import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { assertProductionToken, tokenGate } from "./auth.js";
import { openDb, getDb } from "./db.js";
import { botsRoutes } from "./routes/bots.js";
import { groupsRoutes } from "./routes/groups.js";
import { threadsRoutes } from "./routes/threads.js";
import { dispatcherRoutes } from "./routes/dispatcher.js";
import { credRoutes } from "./routes/cred.js";
import { capabilitiesRoutes } from "./routes/capabilities.js";
import { sseThreadEvents } from "./ws.js";
// Ensure Claude ProviderCredAdapter is registered via broker side-effect
import "./cred/broker.js";

const port = Number(process.env.PORT ?? 3000);
const dbPath = process.env.DATABASE_PATH ?? "./data/oss-bot.sqlite";
const botRuntime = process.env.BOT_RUNTIME ?? "docker";
const dockerHostConfigured = Boolean(process.env.DOCKER_HOST);
const sockOverlay = process.env.DOCKER_SOCK_OVERLAY === "1";

assertProductionToken();
if (process.env.NODE_ENV === "production" && sockOverlay) {
  console.error("DOCKER_SOCK_OVERLAY must not be enabled in production");
  process.exit(1);
}

openDb(dbPath);

const app = new Hono();

app.get("/healthz", (c) => {
  try {
    const db = getDb();
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
    });
  } catch (err) {
    console.error("healthz failed", err);
    return c.json({ ok: false, error: "unavailable" }, 503);
  }
});

const api = new Hono();
api.use("/*", tokenGate);

api.get("/me", (c) =>
  c.json({ ok: true, auth: "token", bot_runtime: botRuntime })
);

api.get("/runtime", (c) =>
  c.json({
    ok: true,
    runtime: botRuntime,
    docker_host_configured: dockerHostConfigured,
    sock_overlay: sockOverlay,
    note: "sock overlay via docker-compose.dev.yml only (dev); never expose DOCKER_HOST value",
  })
);

api.route("/bots", botsRoutes);
api.route("/groups", groupsRoutes);
api.route("/threads", threadsRoutes);
api.route("/dispatcher", dispatcherRoutes);
api.route("/cred", credRoutes);
api.route("/runtimes", capabilitiesRoutes);

// SSE stream for Session events (UI uses HTTP + SSE only in PR1)
api.get("/threads/:id/events", (c) => sseThreadEvents(c));
api.get("/threads/:id/stream", (c) => sseThreadEvents(c));

app.route("/api/v1", api);

serve({ fetch: app.fetch, port }, () => {
  console.log(
    `oss-bot listening on :${port} (sqlite=${dbPath}, bot_runtime=${botRuntime}, sock_overlay=${sockOverlay}, schema=2)`
  );
});
