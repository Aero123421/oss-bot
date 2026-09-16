#!/usr/bin/env node
/** oss-bot doctor — SQLite + Docker bot runtime. Exit 0/1/2 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

type Status = "PASS" | "WARN" | "FAIL";
type Finding = { id: string; status: Status; message: string; hint?: string };

const args = new Set(process.argv.slice(2));
const ci = args.has("--ci");
const strict = args.has("--strict");
const requireDocker = args.has("--require-docker");
const requireRunning = args.has("--require-running");
const jsonOut = args.has("--json");
const findings: Finding[] = [];

function add(id: string, status: Status, message: string, hint?: string) {
  findings.push({ id, status, message, hint });
}
function which(cmd: string): boolean {
  return spawnSync("sh", ["-c", `command -v ${cmd}`], { encoding: "utf8" }).status === 0;
}
function run(cmd: string, argv: string[]) {
  const r = spawnSync(cmd, argv, { encoding: "utf8" });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}
function loadEnvFile() {
  const p = path.resolve(".env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnvFile();

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor >= 22) add("H1", "PASS", `Node ${process.versions.node}`);
else add("H1", "FAIL", `Node ${process.versions.node} < 22`, "Install Node 22+");

if (which("npm") && fs.existsSync("package.json")) add("H2", "PASS", "npm + package.json");
else add("H2", "FAIL", "npm or package.json missing", "Run from repo root");

if (fs.existsSync("package-lock.json")) add("H2b", "PASS", "package-lock.json present");
else add("H2b", "FAIL", "package-lock.json missing", "Run npm install && commit the lockfile");

const dockerOk = run("docker", ["info"]).ok;
const composeOk = run("docker", ["compose", "version"]).ok;
if (dockerOk) add("D1", "PASS", "docker daemon reachable");
else
  add("D1", requireDocker ? "FAIL" : "WARN", "docker daemon not reachable", "Start Docker");
if (composeOk) add("D2", "PASS", "docker compose available");
else add("D2", requireDocker ? "FAIL" : "WARN", "docker compose missing");

const hasCompose =
  fs.existsSync("Dockerfile") && fs.existsSync("docker-compose.yml");
if (hasCompose) add("D3", "PASS", "Dockerfile + docker-compose.yml present");
else add("D3", "FAIL", "Dockerfile or docker-compose.yml missing");

if (hasCompose && composeOk) {
  const cfg = run("docker", ["compose", "-f", "docker-compose.yml", "config", "-q"]);
  if (cfg.ok) add("D4", "PASS", "compose config valid");
  else add("D4", "FAIL", "compose config invalid", cfg.out.slice(0, 200));
}

// No Postgres/Redis drift
for (const f of ["docker-compose.yml", "docker-compose.dev.yml", ".env.example"]) {
  if (!fs.existsSync(f)) continue;
  const text = fs.readFileSync(f, "utf8");
  if (/postgres|redis/i.test(text) && !/No Postgres|no Redis|No Redis|やらない/i.test(text)) {
    // allow negation comments only — still fail on service-like lines
    if (/image:\s*postgres|image:\s*redis|REDIS_URL|POSTGRES|DATABASE_URL:\s*postgres/i.test(text)) {
      add("D5", "FAIL", `${f} still references Postgres/Redis`, "Remove — stack is SQLite only");
    }
  }
}
if (!findings.some((f) => f.id === "D5"))
  add("D5", "PASS", "compose/env have no Postgres/Redis services");

const dbPath = process.env.DATABASE_PATH ?? "./data/oss-bot.sqlite";
if (process.env.DATABASE_PATH || fs.existsSync(".env.example"))
  add("Q1", "PASS", `DATABASE_PATH=${dbPath}`);
else add("Q1", "WARN", "DATABASE_PATH unset");

const parent = path.dirname(path.resolve(dbPath));
try {
  fs.mkdirSync(parent, { recursive: true });
  fs.accessSync(parent, fs.constants.W_OK);
  add("Q2", "PASS", `writable dir ${parent}`);
} catch {
  add("Q2", "FAIL", `cannot write ${parent}`);
}
if (fs.existsSync(dbPath)) add("Q3", "PASS", `sqlite exists: ${dbPath}`);
else add("Q3", "WARN", `sqlite missing (ok before first boot): ${dbPath}`);

const token = process.env.OSS_BOT_TOKEN ?? "";
if (token) add("T1", "PASS", "OSS_BOT_TOKEN is set");
else add("T1", "FAIL", "OSS_BOT_TOKEN empty", "cp .env.example .env && set token");

const isProd = process.env.NODE_ENV === "production";
if (isProd && (!token || token.startsWith("change-me")))
  add("T2", "FAIL", "default/empty token in production");
else add("T2", "PASS", "token policy ok for NODE_ENV");

if (token && token.length >= 16) add("T3", "PASS", "token length >= 16");
else if (token) add("T3", "WARN", "token length < 16");
else add("T3", "WARN", "skip length — token empty");

const envTracked = run("git", ["ls-files", "--error-unmatch", ".env"]);
if (envTracked.ok) add("T4", "FAIL", ".env tracked by git", "git rm --cached .env");
else add("T4", "PASS", ".env not tracked");

const botRuntime = process.env.BOT_RUNTIME ?? "docker";
if (botRuntime === "docker") add("B1", "PASS", "BOT_RUNTIME=docker");
else add("B1", "WARN", `BOT_RUNTIME=${botRuntime} (P0 expects docker)`);

const composeFiles = (process.env.COMPOSE_FILE ?? "").split(path.delimiter).filter(Boolean);
const usingSockOverlay =
  process.env.DOCKER_SOCK_OVERLAY === "1" ||
  composeFiles.some((f) => f.includes("docker-compose.dev.yml"));

if (fs.existsSync("docker-compose.dev.yml"))
  add("B3", "PASS", "docker-compose.dev.yml present (sock overlay)");
else add("B3", "WARN", "missing docker-compose.dev.yml for sock mount");

if (isProd && usingSockOverlay) {
  add(
    "B4",
    "FAIL",
    "production + sock overlay",
    "Do not use docker-compose.dev.yml when NODE_ENV=production"
  );
} else if (isProd && process.env.DOCKER_HOST) {
  add("B4", "FAIL", "DOCKER_HOST set in production", "Keep DOCKER_HOST in dev overlay only");
} else {
  add("B4", "PASS", "prod/sock policy ok");
}

if (!isProd && usingSockOverlay) {
  const gid = process.env.DOCKER_GID ?? "";
  if (!gid || gid === "0")
    add("B5", "FAIL", "DOCKER_GID missing or 0", "export DOCKER_GID=$(getent group docker | cut -d: -f3)");
  else add("B5", "PASS", `DOCKER_GID=${gid}`);
} else {
  add("B5", "PASS", "DOCKER_GID check skipped (no sock overlay)");
}

if (process.env.DOCKER_HOST && !usingSockOverlay && !isProd)
  add("B2", "WARN", "DOCKER_HOST set without sock overlay");
else if (usingSockOverlay && process.env.DOCKER_HOST)
  add("B2", "PASS", "DOCKER_HOST set for sock overlay");
else add("B2", "PASS", "DOCKER_HOST not required for base compose");

// CredBridge — all required providers (IF v4.1). Distinguish install vs auth.
// Paths MUST match .env.example / docker-compose.dev.yml. Never read secret file contents.
const home = process.env.HOME ?? "";
type ProviderSpec = {
  id: string;
  provider_id: string;
  bins: string[];
  hostEnv: string;
  defaultRel: string[];
  authMarkers: string[]; // relative to host dir; existence only
  envAuthKeys?: string[]; // official token env names; presence only
};
const providers: ProviderSpec[] = [
  {
    id: "P-CLAUDE",
    provider_id: "claude-code",
    bins: ["claude"],
    hostEnv: "CLAUDE_CONFIG_HOST",
    defaultRel: [".claude"],
    authMarkers: [".credentials.json", "credentials.json"],
  },
  {
    id: "P-CODEX",
    provider_id: "codex",
    bins: ["codex"],
    hostEnv: "CODEX_HOME_HOST",
    defaultRel: [".codex"],
    authMarkers: ["auth.json"],
  },
  {
    id: "P-OPENCODE",
    provider_id: "opencode",
    bins: ["opencode"],
    hostEnv: "OPENCODE_DATA_HOST",
    defaultRel: [".local", "share", "opencode"],
    authMarkers: ["auth.json"],
  },
  {
    id: "P-AGY",
    provider_id: "agy",
    bins: ["agy"],
    hostEnv: "AGY_CONFIG_HOST",
    defaultRel: [".agy"],
    authMarkers: ["auth.json", "credentials.json", "config.json"],
  },
  {
    id: "P-PI",
    provider_id: "pi",
    bins: ["pi"],
    hostEnv: "PI_CONFIG_HOST",
    defaultRel: [".pi"],
    authMarkers: ["auth.json", "credentials.json", "config.json"],
  },
  {
    id: "P-KIMI",
    provider_id: "kimi",
    bins: ["kimi"],
    hostEnv: "KIMI_CONFIG_HOST",
    defaultRel: [".kimi"],
    authMarkers: ["auth.json", "credentials.json", "config.json"],
  },
  {
    id: "P-GROK",
    provider_id: "grok",
    bins: ["grok"],
    hostEnv: "GROK_CONFIG_HOST",
    defaultRel: [".grok"],
    authMarkers: ["auth.json", "credentials.json", "config.json"],
    envAuthKeys: ["XAI_API_KEY"],
  },
];

function resolveHostDir(hostEnv: string, defaultRel: string[]): string {
  const fromEnv = process.env[hostEnv]?.trim();
  if (fromEnv) return fromEnv;
  if (!home) return "";
  return path.join(home, ...defaultRel);
}

function binInstalled(bins: string[]): string | null {
  for (const b of bins) {
    if (which(b)) return b;
  }
  return null;
}

function authReady(hostDir: string, markers: string[]): boolean {
  if (!hostDir || !fs.existsSync(hostDir)) return false;
  for (const m of markers) {
    if (fs.existsSync(path.join(hostDir, m))) return true;
  }
  // dir exists but no known marker → treat as weak/unknown auth (not Ready)
  return false;
}

let anyProviderReady = false;
for (const p of providers) {
  const hostDir = resolveHostDir(p.hostEnv, p.defaultRel);
  const bin = binInstalled(p.bins);
  if (bin) add(`${p.id}-INSTALL`, "PASS", `${p.provider_id} installed (${bin})`);
  else
    add(
      `${p.id}-INSTALL`,
      "WARN",
      `${p.provider_id} not installed (PATH missing: ${p.bins.join("|")})`,
      `Install CLI then keep UI row (state=未インストール)`
    );

  if (!hostDir) {
    add(`${p.id}-AUTH`, "WARN", `${p.provider_id} CredBridge path unknown (${p.hostEnv})`);
    continue;
  }
  const mountedPathNote = `${p.hostEnv}=${hostDir}`;
  if (!bin) {
    add(`${p.id}-AUTH`, "WARN", `${p.provider_id} auth skipped (not installed) · ${mountedPathNote}`);
    continue;
  }
  const envKeys = (p as { envAuthKeys?: string[] }).envAuthKeys ?? [];
  const envAuth = envKeys.some((k) => Boolean(process.env[k]?.trim()));
  // grok: host login (`grok login`) or XAI_API_KEY — never print key values
  if (authReady(hostDir, p.authMarkers) || envAuth) {
    const via = envAuth && !authReady(hostDir, p.authMarkers) ? "env" : "host-dir";
    add(`${p.id}-AUTH`, "PASS", `${p.provider_id} auth Ready (${via}) · ${mountedPathNote}`);
    anyProviderReady = true;
  } else if (fs.existsSync(hostDir)) {
    add(
      `${p.id}-AUTH`,
      "WARN",
      `${p.provider_id} config dir exists but auth marker missing · ${mountedPathNote}`,
      "Log in on the host (CredBridge); doctor never reads secret contents"
    );
  } else {
    add(
      `${p.id}-AUTH`,
      "WARN",
      `${p.provider_id} 未ログイン (path missing) · ${mountedPathNote}`,
      "Log in on the host first"
    );
  }
}

if (anyProviderReady) add("CB-READY", "PASS", "at least one provider install+auth Ready");
else
  add(
    "CB-READY",
    "WARN",
    "no provider fully Ready (install+auth)",
    "Host-login at least one of: claude-code|codex|opencode|agy|pi|kimi|grok"
  );

const requiredEnvKeys = [
  "CLAUDE_CONFIG_HOST",
  "CODEX_HOME_HOST",
  "OPENCODE_DATA_HOST",
  "AGY_CONFIG_HOST",
  "PI_CONFIG_HOST",
  "KIMI_CONFIG_HOST",
  "GROK_CONFIG_HOST",
];
if (fs.existsSync(".env.example")) {
  const ex = fs.readFileSync(".env.example", "utf8");
  const missing = requiredEnvKeys.filter((k) => !ex.includes(k));
  if (missing.length)
    add("CB-ENV", "FAIL", `.env.example missing CredBridge keys: ${missing.join(",")}`);
  else add("CB-ENV", "PASS", ".env.example lists all CredBridge host path keys");
} else add("CB-ENV", "FAIL", ".env.example missing");

if (process.env.CRED_BRIDGE_MOUNTS === "1" || usingSockOverlay)
  add("CB-MOUNT", "PASS", "dev overlay expects CredBridge RO mounts for all providers");
else add("CB-MOUNT", "WARN", "CredBridge mounts active only with docker-compose.dev.yml");

if (requireRunning) {
  const port = process.env.PORT ?? "3000";
  try {
    const res = await fetch(`http://127.0.0.1:${port}/healthz`);
    if (res.ok) add("P2", "PASS", `/healthz → ${res.status}`);
    else add("P2", "FAIL", `/healthz → ${res.status}`);
  } catch (e) {
    add("P2", "FAIL", `healthz unreachable: ${e}`);
  }
  if (token) {
    try {
      const denied = await fetch(`http://127.0.0.1:${port}/api/v1/me`);
      if (denied.status === 401) add("P3", "PASS", "protected route denies missing token");
      else add("P3", "FAIL", `expected 401 without token, got ${denied.status}`);
      const ok = await fetch(`http://127.0.0.1:${port}/api/v1/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (ok.ok) add("P4", "PASS", "protected route accepts token");
      else add("P4", "FAIL", `expected 2xx with token, got ${ok.status}`);
    } catch (e) {
      add("P3", "FAIL", String(e));
      add("P4", "FAIL", String(e));
    }
  } else {
    add("P3", "WARN", "skip P3/P4 — OSS_BOT_TOKEN empty");
    add("P4", "WARN", "skip P3/P4 — OSS_BOT_TOKEN empty");
  }
}

if (ci) {
  if (!fs.existsSync(".env.example")) add("CI2", "FAIL", ".env.example missing");
  else {
    const ex = fs.readFileSync(".env.example", "utf8");
    const need = ["OSS_BOT_TOKEN", "DATABASE_PATH", "PORT", "BOT_RUNTIME"];
    const missing = need.filter((k) => !ex.includes(k));
    if (missing.length) add("CI2", "FAIL", `missing keys: ${missing.join(", ")}`);
    else add("CI2", "PASS", ".env.example has required keys");
  }
  if (fs.existsSync("Dockerfile")) {
    const df = fs.readFileSync("Dockerfile", "utf8");
    if (/^USER\s+/m.test(df)) add("CI3", "PASS", "Dockerfile sets USER");
    else add("CI3", "WARN", "Dockerfile has no USER");
    if (/HEALTHCHECK/i.test(df)) add("CI4", "PASS", "HEALTHCHECK present");
    else add("CI4", "WARN", "HEALTHCHECK missing");
  }
  if (!fs.existsSync("src/index.ts"))
    add("CI5", "FAIL", "src/index.ts missing — empty scaffold");
  else add("CI5", "PASS", "src/index.ts entrypoint present");
}

const failed = findings.filter((f) => f.status === "FAIL").length;
const warned = findings.filter((f) => f.status === "WARN").length;
if (jsonOut) console.log(JSON.stringify({ failed, warned, findings }, null, 2));
else {
  for (const f of findings) {
    console.log(`${f.status}\t${f.id}\t${f.message}${f.hint ? ` → ${f.hint}` : ""}`);
  }
  console.log(`---\nFAIL=${failed} WARN=${warned}`);
}
if (failed > 0) process.exit(2);
if (warned > 0 && strict) process.exit(1);
process.exit(0);
