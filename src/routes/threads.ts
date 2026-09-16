import { Hono } from "hono";
import { getDb, newId, nowIso } from "../db.js";
import type { Message, Thread } from "../types.js";
import { sseThreadEvents } from "../ws.js";

export const threadsRoutes = new Hono();

threadsRoutes.get("/", (c) => {
  const threads = getDb()
    .prepare("SELECT * FROM threads ORDER BY updated_at DESC")
    .all() as Thread[];
  return c.json({ threads });
});

threadsRoutes.post("/", async (c) => {
  const body = await c.req.json<{ title?: string; active_bot_id?: string; group_id?: string }>();
  const id = newId("thr");
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO threads (id, title, active_bot_id, group_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(id, body.title?.trim() ?? "", body.active_bot_id ?? null, body.group_id ?? null, now, now);
  const thread = getDb().prepare("SELECT * FROM threads WHERE id = ?").get(id) as Thread;
  return c.json({ thread }, 201);
});

threadsRoutes.get("/:id/events", (c) => sseThreadEvents(c));
threadsRoutes.get("/:id/stream", (c) => sseThreadEvents(c));

threadsRoutes.get("/:id", (c) => {
  const id = c.req.param("id");
  const thread = getDb().prepare("SELECT * FROM threads WHERE id = ?").get(id) as Thread | undefined;
  if (!thread) return c.json({ error: "not_found" }, 404);
  const messages = getDb()
    .prepare("SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC")
    .all(id) as Message[];
  return c.json({ thread, messages });
});

threadsRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = getDb().prepare("SELECT * FROM threads WHERE id = ?").get(id) as Thread | undefined;
  if (!existing) return c.json({ error: "not_found" }, 404);
  const body = await c.req.json<{ title?: string; active_bot_id?: string | null; group_id?: string | null }>();
  const now = nowIso();
  if (body.active_bot_id !== undefined) {
    getDb()
      .prepare("UPDATE threads SET active_bot_id = ?, updated_at = ? WHERE id = ?")
      .run(body.active_bot_id, now, id);
  }
  if (body.title !== undefined) {
    getDb()
      .prepare("UPDATE threads SET title = ?, updated_at = ? WHERE id = ?")
      .run(body.title, now, id);
  }
  if (body.group_id !== undefined) {
    getDb()
      .prepare("UPDATE threads SET group_id = ?, updated_at = ? WHERE id = ?")
      .run(body.group_id, now, id);
  }
  const thread = getDb().prepare("SELECT * FROM threads WHERE id = ?").get(id) as Thread;
  return c.json({ thread });
});

threadsRoutes.get("/:id/messages", (c) => {
  const id = c.req.param("id");
  const thread = getDb().prepare("SELECT id FROM threads WHERE id = ?").get(id);
  if (!thread) return c.json({ error: "not_found" }, 404);
  const messages = getDb()
    .prepare("SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC")
    .all(id) as Message[];
  return c.json({ messages });
});
