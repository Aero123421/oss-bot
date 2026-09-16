import { spawn, spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { getDb, newId, nowIso } from "../db.js";
import { credBroker } from "../cred/broker.js";
import { agentBus } from "../bus.js";
import type { StreamEvent } from "../types.js";

const emitters = new Map<string, EventEmitter>();

export function threadEvents(threadId: string): EventEmitter {
  let e = emitters.get(threadId);
  if (!e) {
    e = new EventEmitter();
    e.setMaxListeners(50);
    emitters.set(threadId, e);
  }
  return e;
}

export function detectClaudeBinary(): { ok: boolean; binary?: string; reason?: string } {
  const override = process.env.CLAUDE_BIN?.trim();
  if (override) return { ok: true, binary: override };
  for (const name of ["claude", "claude-code"]) {
    const r = spawnSync("sh", ["-c", `command -v ${name}`], { encoding: "utf8" });
    if (r.status === 0 && r.stdout.trim()) {
      return { ok: true, binary: r.stdout.trim() };
    }
  }
  return { ok: false, reason: "claude_cli_missing" };
}

function emit(threadId: string, ev: StreamEvent): void {
  threadEvents(threadId).emit("event", ev);
}

function scrub(s: string): string {
  return s
    .replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]")
    .replace(/eyJ[a-zA-Z0-9._-]+/g, "[redacted]");
}

export type ClaudeRunInput = {
  threadId: string;
  botId: string;
  content: string;
};

/**
 * Run Claude Code for a thread. CredBroker.issue() injects env in-memory only —
 * never serialize grant.env to HTTP/logs/Bus.
 * Mock only when OSS_BOT_PROVIDER_MODE=mock (tests/CI).
 */
export async function runClaudeForThread(
  opts: ClaudeRunInput
): Promise<void> {
  const { threadId, botId, content } = opts;
  emit(threadId, { type: "status", threadId, status: "starting" });

  const useMock = process.env.OSS_BOT_PROVIDER_MODE === "mock";
  if (useMock) {
    const messageId = newId("msg");
    const text = `[test-mock] ${content.slice(0, 240)}`;
    for (const part of text.split(/(\s+)/)) {
      if (part) emit(threadId, { type: "token", threadId, text: part });
    }
    const now = nowIso();
    getDb()
      .prepare(
        `INSERT INTO messages (id, thread_id, bot_id, role, content, created_at)
         VALUES (?, ?, ?, 'assistant', ?, ?)`
      )
      .run(messageId, threadId, botId, text, now);
    emit(threadId, {
      type: "message",
      threadId,
      messageId,
      role: "assistant",
      content: text,
    });
    emit(threadId, { type: "done", threadId });
    return;
  }

  let childEnv: NodeJS.ProcessEnv = { ...process.env };
  try {
    const grant = credBroker.issue("provider:claude", `local-${threadId}`);
    childEnv = { ...process.env, ...grant.env };
    // drop grant reference; never log env values
  } catch (err) {
    const st = (err as { status?: { status_code?: string } }).status;
    emit(threadId, {
      type: "error",
      threadId,
      error: `NotReady: cred_${st?.status_code ?? "missing"}. Host login ~/.claude or CLAUDE_CODE_OAUTH_TOKEN; npm run doctor`,
    });
    emit(threadId, { type: "done", threadId });
    return;
  }

  const detected = detectClaudeBinary();
  if (!detected.ok || !detected.binary) {
    emit(threadId, {
      type: "error",
      threadId,
      error: `NotReady: ${detected.reason ?? "claude_cli_missing"}. Install Claude Code on host; CredBridge RO mounts via docker-compose.dev.yml. npm run doctor`,
    });
    emit(threadId, { type: "done", threadId });
    return;
  }

  emit(threadId, { type: "status", threadId, status: "streaming", detail: "claude_code" });

  await new Promise<void>((resolve) => {
    const child = spawn(detected.binary!, ["-p", content, "--output-format", "text"], {
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout?.on("data", (buf: Buffer) => {
      const s = buf.toString("utf8");
      out += s;
      emit(threadId, { type: "token", threadId, text: s });
    });
    child.stderr?.on("data", (buf: Buffer) => {
      err += buf.toString("utf8");
    });
    child.on("error", (e) => {
      emit(threadId, { type: "error", threadId, error: scrub(e.message) });
      emit(threadId, { type: "done", threadId });
      resolve();
    });
    child.on("close", (code) => {
      if (code !== 0) {
        emit(threadId, {
          type: "error",
          threadId,
          error: scrub(err.trim() || `claude_exit_${code}`),
        });
        emit(threadId, { type: "done", threadId });
        resolve();
        return;
      }
      const messageId = newId("msg");
      const now = nowIso();
      getDb()
        .prepare(
          `INSERT INTO messages (id, thread_id, bot_id, role, content, created_at)
           VALUES (?, ?, ?, 'assistant', ?, ?)`
        )
        .run(messageId, threadId, botId, out, now);
      getDb()
        .prepare(`UPDATE threads SET updated_at = ? WHERE id = ?`)
        .run(now, threadId);
      emit(threadId, {
        type: "message",
        threadId,
        messageId,
        role: "assistant",
        content: out,
      });
      emit(threadId, { type: "done", threadId });
      agentBus.publish({
        threadId,
        botId,
        content: out.slice(0, 500),
        priority: false,
      });
      resolve();
    });
  });
}
