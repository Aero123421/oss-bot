import { Hono } from "hono";
import { getDb, newId, nowIso } from "../db.js";
import type { Bot } from "../types.js";

export const botsRoutes = new Hono();

botsRoutes.get("/", (c) => {
  const rows = getDb()
    .prepare("SELECT * FROM bots ORDER BY created_at ASC")
    .all() as Bot[];
  return c.json({ bots: rows });
});

botsRoutes.get("/:id", (c) => {
  const bot = getDb()
    .prepare("SELECT * FROM bots WHERE id = ?")
    .get(c.req.param("id")) as Bot | undefined;
  if (!bot) return c.json({ error: "not_found" }, 404);
  return c.json({ bot });
});

botsRoutes.post("/", async (c) => {
  const body = await c.req.json<{ 
    name?: string;
    title?: string;
    role_memo?: string;
    provider?: string;
    runtime?: "docker" | "local";
    workdir?: string;
    system_prompt?: string;
    model?: string;
    docker_image?: string;
  }>();
  if (!body.name?.trim() || !body.provider?.trim()) {
    return c.json({ error: "name_and_provider_required" }, 400);
  }
  const runtime = body.runtime === "local" ? "local" : "docker";
  const id = newId("bot");
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO bots (id, name, title, role_memo, provider, runtime, workdir, system_prompt, model, docker_image, env_json, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', 1, ?, ?)`
    )
    .run(
      id,
      body.name.trim(),
      body.title?.trim() ?? "",
      body.role_memo?.trim() ?? "",
      body.provider.trim(),
      runtime,
      body.workdir ?? null,
      body.system_prompt ?? null,
      body.model ?? null,
      body.docker_image ?? null,
      now,
      now
    );
  const bot = getDb().prepare("SELECT * FROM bots WHERE id = ?").get(id) as Bot;
  return c.json({ bot }, 201);
});

botsRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = getDb().prepare("SELECT * FROM bots WHERE id = ?").get(id) as Bot | undefined;
  if (!existing) return c.json({ error: "not_found" }, 404);
  const body = await c.req.json<Partial<Bot>>();
  const now = nowIso();
  getDb()
    .prepare(
      `UPDATE bots SET
         name = COALESCE(?, name),
         title = COALESCE(?, title),
         role_memo = COALESCE(?, role_memo),
         provider = COALESCE(?, provider),
         runtime = COALESCE(?, runtime),
         workdir = COALESCE(?, workdir),
         system_prompt = COALESCE(?, system_prompt),
         model = COALESCE(?, model),
         docker_image = COALESCE(?, docker_image),
         enabled = COALESCE(?, enabled),
         updated_at = ?
       WHERE id = ?`
    )
    .run(
      body.name ?? null,
      body.title ?? null,
      body.role_memo ?? null,
      body.provider ?? null,
      body.runtime ?? null,
      body.workdir ?? null,
      body.system_prompt ?? null,
      body.model ?? null,
      body.docker_image ?? null,
      body.enabled ?? null,
      now,
      id
    );
  const bot = getDb().prepare("SELECT * FROM bots WHERE id = ?").get(id) as Bot;
  return c.json({ bot });
});

botsRoutes.delete("/:id", (c) => {
  const id = c.req.param("id");
  const r = getDb().prepare("DELETE FROM bots WHERE id = ?").run(id);
  if (r.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});
