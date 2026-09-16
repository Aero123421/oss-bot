import { Hono } from "hono";
import { getDb, newId, nowIso } from "../db.js";
import type { Message, StreamEvent, Thread } from "../types.js";
import { threadEvents } from "../providers/claude.js";

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

/** SSE stream for Claude/provider tokens — real path (not mock). */
threadsRoutes.get("/:id/events", (c) => {
  const id = c.req.param("id");
  const thread = getDb().prepare("SELECT id FROM threads WHERE id = ?").get(id);
  if (!thread) return c.json({ error: "not_found" }, 404);

  const encoder = new TextEncoder();
  let ping: ReturnType<typeof setInterval> | undefined;
  let onEvent: ((ev: StreamEvent) => void) | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const ee = threadEvents(id);
      onEvent = (ev: StreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
      };
      ee.on("event", onEvent);
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "status", threadId: id, status: "subscribed" })}\n\n`
        )
      );
      ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* closed */
        }
      }, 15000);
    },
    cancel() {
      if (ping) clearInterval(ping);
      if (onEvent) threadEvents(id).off("event", onEvent);
    },
  });

  c.req.raw.signal.addEventListener("abort", () => {
    if (ping) clearInterval(ping);
    if (onEvent) threadEvents(id).off("event", onEvent);
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});

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
