import { Hono } from "hono";
import { acceptMessage } from "../dispatcher.js";
import { getProvider } from "../providers/registry.js";
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

    const shouldRun = body.run !== false;
    let runNote: string | undefined;
    if (shouldRun) {
      const thread = getDb()
        .prepare("SELECT * FROM threads WHERE id = ?")
        .get(result.threadId) as { active_bot_id: string | null };
      const bot = thread?.active_bot_id
        ? (getDb().prepare("SELECT * FROM bots WHERE id = ?").get(thread.active_bot_id) as Bot)
        : undefined;
      const adapter = bot ? getProvider(bot.provider) : undefined;
      if (adapter) {
        void adapter
          .run({
            threadId: result.threadId,
            botId: bot!.id,
            content: body.content ?? "",
          })
          .catch((err) => {
            console.error(
              "provider run failed",
              bot!.provider,
              err instanceof Error ? err.message : "error"
            );
          });
        runNote = `${bot!.provider}_spawn_started`;
      } else if (bot) {
        runNote = `provider_not_registered:${bot.provider}`;
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
