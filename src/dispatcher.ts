import { getDb, newId, nowIso } from "./db.js";
import { agentBus } from "./bus.js";
import { credBroker } from "./cred/broker.js";
import type { Bot } from "./types.js";

export type AcceptMessageInput = {
  content: string;
  threadId?: string;
  botId?: string;
  groupId?: string;
};

export type AcceptMessageResult = {
  threadId: string;
  messageId: string;
  busMessageId: string;
};

/**
 * Dispatcher window: persist user message, require CredBroker ready,
 * publish priority BusMessage to target bot (S1 + S3 + S5).
 */
export function acceptMessage(input: AcceptMessageInput): AcceptMessageResult {
  const db = getDb();
  const content = input.content?.trim();
  if (!content) {
    throw Object.assign(new Error("content_required"), { code: "bad_request" });
  }

  let bot: Bot | undefined;
  if (input.botId) {
    bot = db.prepare("SELECT * FROM bots WHERE id = ?").get(input.botId) as Bot | undefined;
  } else if (input.threadId) {
    const t = db
      .prepare("SELECT * FROM threads WHERE id = ?")
      .get(input.threadId) as { active_bot_id: string | null } | undefined;
    if (t?.active_bot_id) {
      bot = db.prepare("SELECT * FROM bots WHERE id = ?").get(t.active_bot_id) as Bot | undefined;
    }
  }
  if (!bot) {
    bot = db
      .prepare("SELECT * FROM bots WHERE enabled = 1 ORDER BY created_at ASC LIMIT 1")
      .get() as Bot | undefined;
  }
  if (!bot) {
    throw Object.assign(new Error("no_bot"), { code: "not_found" });
  }

  const purpose = `provider:${bot.provider || "claude"}`;
  const st = credBroker.status(purpose);
  if (st.status_code !== "ready") {
    throw Object.assign(new Error("cred_not_ready"), {
      code: "not_ready",
      status: st,
    });
  }

  const now = nowIso();
  let threadId = input.threadId;
  if (threadId) {
    const existing = db.prepare("SELECT id FROM threads WHERE id = ?").get(threadId);
    if (!existing) {
      throw Object.assign(new Error("thread_not_found"), { code: "not_found" });
    }
    db.prepare(
      `UPDATE threads SET active_bot_id = ?, group_id = COALESCE(?, group_id), updated_at = ? WHERE id = ?`
    ).run(bot.id, input.groupId ?? null, now, threadId);
  } else {
    threadId = newId("thr");
    db.prepare(
      `INSERT INTO threads (id, title, active_bot_id, group_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(threadId, content.slice(0, 80), bot.id, input.groupId ?? null, now, now);
  }

  const messageId = newId("msg");
  db.prepare(
    `INSERT INTO messages (id, thread_id, bot_id, role, content, created_at)
     VALUES (?, ?, NULL, 'user', ?, ?)`
  ).run(messageId, threadId, content, now);

  const busMsg = agentBus.publish({
    threadId,
    botId: bot.id,
    content,
    priority: true,
  });

  return { threadId, messageId, busMessageId: busMsg.id };
}
