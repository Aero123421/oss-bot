#!/usr/bin/env node
/**
 * oss-bot doctor — environment checks (read-only).
 * Exit: 0 OK / 1 WARN / 2 FAIL
 */
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
  const r = spawnSync("sh", ["-c", `command -v ${cmd}`], { encoding: "utf8" });
  return r.status === 0;
}

function run(cmd: string, argv: string[]): { ok: boolean; out: string } {
  const r = spawnSync(cmd, argv, { encoding: "utf8" });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

// Load .env lightly (KEY=VALUE) if present — do not print secrets
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
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnvFile();

// H: host
const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor >= 22) add("H1", "PASS", `Node ${process.versions.node}`);
else add("H1", "FAIL", `Node ${process.versions.node} < 22`, "Install Node 22+");

if (which("npm") && fs.existsSync("package.json"))
  add("H2", "PASS", "npm + package.json");
else add("H2", "FAIL", "npm or package.json missing", "Run from repo root");

if (fs.existsSync("package-lock.json")) add("H2b", "PASS", "package-lock.json present");
else add("H2b", "FAIL", "package-lock.json missing", "Run npm install && commit the lockfile");

if (which("git")) add("H4", "PASS", "git present");
else add("H4", "WARN", "git not found");

// D: docker
const dockerOk = run("docker", ["info"]).ok;
const composeOk = run("docker", ["compose", "version"]).ok;
if (dockerOk) add("D1", "PASS", "docker daemon reachable");
else
  add(
    "D1",
    requireDocker ? "FAIL" : "WARN",
    "docker daemon not reachable",
    "Start Docker or omit --require-docker for local npm"
  );
if (composeOk) add("D2", "PASS", "docker compose available");
else
  add(
    "D2",
    requireDocker ? "FAIL" : "WARN",
    "docker compose missing",
    "Install Docker Compose v2"
  );

const hasDockerfiles =
  fs.existsSync("Dockerfile") && fs.existsSync("docker-compose.yml");
if (hasDockerfiles) add("D3", "PASS", "Dockerfile + docker-compose.yml present");
else add("D3", "FAIL", "Dockerfile or docker-compose.yml missing");

if (hasDockerfiles && composeOk) {
  const cfg = run("docker", ["compose", "config", "-q"]);
  if (cfg.ok) add("D4", "PASS", "compose config valid");
  else add("D4", "FAIL", "compose config invalid", cfg.out.slice(0, 200));
}

// Q: sqlite
const dbPath = process.env.DATABASE_PATH ?? "./data/oss-bot.sqlite";
if (process.env.DATABASE_PATH || fs.existsSync(".env.example"))
  add("Q1", "PASS", `DATABASE_PATH=${dbPath}`);
else add("Q1", "WARN", "DATABASE_PATH unset — default ./data/oss-bot.sqlite");

const parent = path.dirname(path.resolve(dbPath));
try {
  fs.mkdirSync(parent, { recursive: true });
  fs.accessSync(parent, fs.constants.W_OK);
  add("Q2", "PASS", `writable dir ${parent}`);
} catch {
  add("Q2", "FAIL", `cannot write ${parent}`, `mkdir -p ${parent} && fix permissions`);
}

if (fs.existsSync(dbPath)) add("Q3", "PASS", `sqlite file exists: ${dbPath}`);
else
  add("Q3", "WARN", `sqlite file missing (ok before first boot): ${dbPath}`, "npm run start");

// T: token
const token = process.env.OSS_BOT_TOKEN ?? "";
if (token) add("T1", "PASS", "OSS_BOT_TOKEN is set");
else add("T1", "FAIL", "OSS_BOT_TOKEN empty", "Copy .env.example → .env and set token");

const isProd = process.env.NODE_ENV === "production";
if (isProd && (!token || token.startsWith("change-me")))
  add("T2", "FAIL", "default/empty token in production", "Set a long random OSS_BOT_TOKEN");
else add("T2", "PASS", "token policy ok for current NODE_ENV");

if (token && token.length >= 16) add("T3", "PASS", "token length >= 16");
else if (token) add("T3", "WARN", "token length < 16", "Use a longer random token");
else add("T3", "WARN", "skip length check — token empty");

const envTracked = run("git", ["ls-files", "--error-unmatch", ".env"]);
if (envTracked.ok) add("T4", "FAIL", ".env is tracked by git", "git rm --cached .env");
else add("T4", "PASS", ".env not tracked (or not a git repo / absent)");

// P: http (optional)
if (requireRunning) {
  const port = process.env.PORT ?? "3000";
  try {
    const res = await fetch(`http://127.0.0.1:${port}/healthz`);
    if (res.ok) add("P2", "PASS", `/healthz → ${res.status}`);
    else add("P2", "FAIL", `/healthz → ${res.status}`);
  } catch (e) {
    add("P2", "FAIL", `healthz unreachable: ${e}`, "docker compose up -d --build");
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
  }
}

// CI static
if (ci) {
  if (!fs.existsSync(".env.example"))
    add("CI2", "FAIL", ".env.example missing");
  else {
    const ex = fs.readFileSync(".env.example", "utf8");
    const need = ["OSS_BOT_TOKEN", "DATABASE_PATH", "PORT"];
    const missing = need.filter((k) => !ex.includes(k));
    if (missing.length)
      add("CI2", "FAIL", `.env.example missing keys: ${missing.join(", ")}`);
    else add("CI2", "PASS", ".env.example has required keys");
  }
  if (fs.existsSync("Dockerfile")) {
    const df = fs.readFileSync("Dockerfile", "utf8");
    if (/^USER\s+/m.test(df)) add("CI3", "PASS", "Dockerfile sets USER");
    else add("CI3", "WARN", "Dockerfile has no USER", "Run as non-root");
    if (/HEALTHCHECK/i.test(df)) add("CI4", "PASS", "HEALTHCHECK present");
    else add("CI4", "WARN", "HEALTHCHECK missing");
  }
}

const failed = findings.filter((f) => f.status === "FAIL").length;
const warned = findings.filter((f) => f.status === "WARN").length;

if (jsonOut) {
  console.log(JSON.stringify({ failed, warned, findings }, null, 2));
} else {
  for (const f of findings) {
    const line = `${f.status}\t${f.id}\t${f.message}${f.hint ? ` → ${f.hint}` : ""}`;
    console.log(line);
  }
  console.log(`---\nFAIL=${failed} WARN=${warned}`);
}

if (failed > 0) process.exit(2);
if (warned > 0 && strict) process.exit(1);
process.exit(0);
