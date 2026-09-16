import { spawnSync } from "node:child_process";
import type Database from "better-sqlite3";
import { getHandle } from "./store.js";
import type { RuntimeHandle } from "./types.js";

export type CapKind = "fs.list" | "shell.exec";

export type CapResult = {
  ok: boolean;
  kind: CapKind;
  stdout: string;
  stderr: string;
  exitCode: number;
};

function runHost(cmd: string, args: string[]): CapResult & { kind: CapKind } {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 10_000 });
  return {
    ok: (r.status ?? 1) === 0,
    kind: "shell.exec",
    stdout: (r.stdout ?? "").slice(0, 4000),
    stderr: (r.stderr ?? "").slice(0, 1000),
    exitCode: r.status ?? 1,
  };
}

function dockerExec(containerId: string, shellCmd: string): CapResult {
  const r = spawnSync(
    "docker",
    ["exec", containerId, "sh", "-c", shellCmd],
    { encoding: "utf8", timeout: 10_000 }
  );
  return {
    ok: (r.status ?? 1) === 0,
    kind: "shell.exec",
    stdout: (r.stdout ?? "").slice(0, 4000),
    stderr: (r.stderr ?? "").slice(0, 1000),
    exitCode: r.status ?? 1,
  };
}

/** Allowlist only — no arbitrary user shell for Wow gate demo. */
const ALLOWED_SHELL: Record<string, string> = {
  "uname -a": "uname -a",
  "echo oss-bot-capability-ok": "echo oss-bot-capability-ok",
  "ls /": "ls /",
};

const ALLOWED_FS_PATHS = new Set(["/", "/tmp", "/workspace", "."]);

export function listCapabilities(handle: RuntimeHandle) {
  return [
    { kind: "fs" as const, name: "FS.list", status: "granted" as const },
    { kind: "shell" as const, name: "Shell.exec", status: "granted" as const },
  ];
}

export function execCapability(
  db: Database.Database,
  runtimeId: string,
  input: { kind: CapKind; command?: string; path?: string }
): { ok: true; result: CapResult } | { ok: false; error: string; status: number } {
  const handle = getHandle(db, runtimeId);
  if (!handle) return { ok: false, error: "not found", status: 404 };
  if (handle.status !== "running") {
    return { ok: false, error: "runtime_not_running", status: 409 };
  }

  if (input.kind === "fs.list") {
    const p = input.path ?? "/";
    if (!ALLOWED_FS_PATHS.has(p)) {
      return { ok: false, error: "path_not_allowed", status: 400 };
    }
    if (handle.mode === "docker" && handle.container_id) {
      const r = dockerExec(handle.container_id, `ls -la ${p}`);
      return { ok: true, result: { ...r, kind: "fs.list" } };
    }
    const r = runHost("ls", ["-la", p]);
    return { ok: true, result: { ...r, kind: "fs.list" } };
  }

  // shell.exec — allowlisted one-shot only
  const cmd = (input.command ?? "echo oss-bot-capability-ok").trim();
  const mapped = ALLOWED_SHELL[cmd];
  if (!mapped) {
    return { ok: false, error: "command_not_allowed", status: 400 };
  }

  if (handle.mode === "docker" && handle.container_id) {
    const r = dockerExec(handle.container_id, mapped);
    return { ok: true, result: { ...r, kind: "shell.exec" } };
  }

  // local runtime: execute allowlisted command on host (CapabilityHost)
  const parts = mapped.split(" ");
  const r = runHost(parts[0]!, parts.slice(1));
  return { ok: true, result: { ...r, kind: "shell.exec" } };
}
