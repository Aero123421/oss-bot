import { Hono } from "hono";
import { acceptMessage } from "../dispatcher.js";
import { runClaudeForThread } from "../providers/claude.js";
import { getDb } from "../db.js";
import type { Bot } from "../types.js";

export const dispatcherRoutes = new Hono();

dispatcherRoutes.post("/messages", async (c) => {
  const body = await c.req.json<{
    content?: string;
    threadId?: string;
    botId?: string;
    groupId?: string;
    run?: boolean;
  }>();
  try {
    const result = acceptMessage({
      content: body.content ?? "",
      threadId: body.threadId,
      botId: body.botId,
      groupId: body.groupId,
    });

    // Optionally kick Claude spawn (S4); default true for local path visibility
    const shouldRun = body.run !== false;
    let runNote: string | undefined;
    if (shouldRun) {
      const thread = getDb()
        .prepare("SELECT * FROM threads WHERE id = ?")
        .get(result.threadId) as { active_bot_id: string | null };
      const bot = thread?.active_bot_id
        ? (getDb().prepare("SELECT * FROM bots WHERE id = ?").get(thread.active_bot_id) as Bot)
        : undefined;
      if (bot?.provider === "claude") {
        // fire-and-forget; events go to SSE subscribers
        void runClaudeForThread({
          threadId: result.threadId,
          botId: bot.id,
          content: body.content ?? "",
        }).catch((err) => {
          console.error("claude run failed", err instanceof Error ? err.message : "error");
        });
        runNote = "claude_spawn_started";
      }
    }

    return c.json({ ...result, runNote }, 201);
  } catch (err) {
    const e = err as { code?: string; status?: unknown; message?: string };
    if (e.code === "not_ready") {
      return c.json({ error: "not_ready", cred: e.status }, 503);
    }
    if (e.code === "bad_request") return c.json({ error: e.message }, 400);
    if (e.code === "not_found") return c.json({ error: e.message }, 404);
    console.error("dispatcher error", e.message ?? "unknown");
    return c.json({ error: "internal" }, 500);
  }
});
