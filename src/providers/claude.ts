import { spawn, execFileSync } from "node:child_process";
import { getDb, newId, nowIso } from "../db.js";
import { credBroker } from "../cred/broker.js";
import { agentBus } from "../bus.js";
import { emitStreamEvent } from "../ws.js";
import type { StreamEvent } from "../types.js";

function whichClaude(): string | null {
  try {
    const out = execFileSync("which", ["claude"], { encoding: "utf8" }).trim();
    return out || null;
  } catch {
    return null;
  }
}

/**
 * Spawn `claude` CLI with CredBroker-issued env (never log env values).
 * RO mounts are declarative for docker runtime layer; local runtime passes env only.
 */
export async function runClaudeForThread(opts: {
  threadId: string;
  botId: string;
  content: string;
}): Promise<void> {
  const { threadId, botId, content } = opts;
  const purpose = "provider:claude";

  // Consume bus message path (S5: publish→consume)
  agentBus.consume(botId);

  const claudePath = whichClaude();
  if (!claudePath) {
    const errEvt: StreamEvent = {
      type: "error",
      threadId,
      error:
        "claude_cli_unavailable: install Claude Code CLI and ensure `claude` is on PATH (host login required)",
    };
    emitStreamEvent(threadId, errEvt);
    emitStreamEvent(threadId, { type: "done", threadId });
    return;
  }

  let grant;
  try {
    grant = credBroker.issue(purpose, `local:${botId}`);
  } catch (err) {
    const e = err as { message?: string };
    emitStreamEvent(threadId, {
      type: "error",
      threadId,
      error: e.message ?? "cred_not_ready",
    });
    emitStreamEvent(threadId, { type: "done", threadId });
    return;
  }

  // Note: grant.mounts are for docker RO bind-mount layer; local uses env only.
  emitStreamEvent(threadId, {
    type: "status",
    threadId,
    status: "spawning",
    detail: "claude_cli",
  });

  const childEnv = { ...process.env, ...grant.env };
  // NEVER log childEnv / grant.env values

  await new Promise<void>((resolve) => {
    const child = spawn(
      claudePath,
      ["-p", content, "--output-format", "text"],
      {
        env: childEnv,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let assistant = "";
    child.stdout?.on("data", (buf: Buffer) => {
      const text = buf.toString("utf8");
      assistant += text;
      emitStreamEvent(threadId, { type: "token", threadId, text });
    });

    child.stderr?.on("data", (buf: Buffer) => {
      const text = buf.toString("utf8");
      if (/token|oauth|key|secret|credential/i.test(text)) {
        console.error("claude stderr: [redacted]");
      } else {
        console.error("claude stderr:", text.slice(0, 500));
      }
    });

    child.on("error", (err) => {
      emitStreamEvent(threadId, {
        type: "error",
        threadId,
        error: `claude_spawn_error: ${err.message}`,
      });
      emitStreamEvent(threadId, { type: "done", threadId });
      resolve();
    });

    child.on("close", (code) => {
      const db = getDb();
      const now = nowIso();
      if (assistant.trim()) {
        const messageId = newId("msg");
        db.prepare(
          `INSERT INTO messages (id, thread_id, bot_id, role, content, created_at)
           VALUES (?, ?, ?, 'assistant', ?, ?)`
        ).run(messageId, threadId, botId, assistant, now);
        db.prepare("UPDATE threads SET updated_at = ? WHERE id = ?").run(now, threadId);
        emitStreamEvent(threadId, {
          type: "message",
          threadId,
          messageId,
          role: "assistant",
          content: assistant,
        });
      } else if (code !== 0) {
        emitStreamEvent(threadId, {
          type: "error",
          threadId,
          error: `claude_exit_${code ?? "unknown"}`,
        });
      }
      emitStreamEvent(threadId, { type: "done", threadId });
      resolve();
    });
  });
}
