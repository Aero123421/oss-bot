import { spawn, spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { getDb, newId, nowIso } from "../db.js";
import { credBroker } from "../cred/broker.js";
import { agentBus } from "../bus.js";
import type { ProviderId, StreamEvent } from "../types.js";

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

function emit(threadId: string, ev: StreamEvent): void {
  threadEvents(threadId).emit("event", ev);
}

function scrub(s: string): string {
  return s
    .replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]")
    .replace(/eyJ[a-zA-Z0-9._-]+/g, "[redacted]");
}

function resolveBinary(hints: string[], envKey?: string): string | null {
  const override = envKey ? process.env[envKey]?.trim() : undefined;
  if (override) return override;
  for (const name of hints) {
    const r = spawnSync("sh", ["-c", `command -v ${name}`], { encoding: "utf8" });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  return null;
}

export type ProviderRunInput = {
  threadId: string;
  botId: string;
  content: string;
};

export type CliProviderDef = {
  id: ProviderId;
  purpose: string;
  binaryHints: string[];
  binEnvKey?: string;
  buildArgs: (content: string) => string[];
};

/** Shared real-CLI runner used by every Provider Adapter registration */
export function createCliProvider(def: CliProviderDef) {
  return {
    id: def.id,
    async run(input: ProviderRunInput): Promise<void> {
      const { threadId, botId, content } = input;
      emit(threadId, { type: "status", threadId, status: "starting" });

      if (process.env.OSS_BOT_PROVIDER_MODE === "mock") {
        const messageId = newId("msg");
        const text = `[test-mock:${def.id}] ${content.slice(0, 240)}`;
        emit(threadId, { type: "token", threadId, text });
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
        const grant = credBroker.issue(def.purpose, `local-${threadId}`);
        childEnv = { ...process.env, ...grant.env };
      } catch (err) {
        const st = (err as { status?: { status_code?: string; hint?: string } }).status;
        emit(threadId, {
          type: "error",
          threadId,
          error: `NotReady: ${def.id} cred_${st?.status_code ?? "missing"}. ${st?.hint ?? ""}`.trim(),
        });
        emit(threadId, { type: "done", threadId });
        return;
      }

      const binary = resolveBinary(def.binaryHints, def.binEnvKey);
      if (!binary) {
        emit(threadId, {
          type: "error",
          threadId,
          error: `NotReady: ${def.id}_cli_missing. Install CLI on host; see doctor.`,
        });
        emit(threadId, { type: "done", threadId });
        return;
      }

      emit(threadId, {
        type: "status",
        threadId,
        status: "streaming",
        detail: def.id,
      });

      await new Promise<void>((resolve) => {
        const child = spawn(binary, def.buildArgs(content), {
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
              error: scrub(err.trim() || `${def.id}_exit_${code}`),
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
    },
  };
}
