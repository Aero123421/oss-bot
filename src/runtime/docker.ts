import { spawnSync } from "node:child_process";

function docker(args: string[]): { ok: boolean; out: string; code: number } {
  const r = spawnSync("docker", args, { encoding: "utf8" });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
  return { ok: r.status === 0, out, code: r.status ?? 1 };
}

export function dockerAvailable(): boolean {
  return docker(["info"]).ok;
}

export function dockerRun(opts: {
  name: string;
  image: string;
}): { ok: boolean; containerId?: string; error?: string } {
  const r = docker([
    "run",
    "-d",
    "--rm",
    "--name",
    opts.name,
    opts.image,
    "sleep",
    "infinity",
  ]);
  if (!r.ok) return { ok: false, error: r.out.slice(0, 500) };
  const id = r.out.split("\n").pop()?.trim();
  return id ? { ok: true, containerId: id } : { ok: false, error: "empty container id" };
}

export function dockerStop(containerIdOrName: string): { ok: boolean; error?: string } {
  const r = docker(["stop", containerIdOrName]);
  if (!r.ok) return { ok: false, error: r.out.slice(0, 500) };
  return { ok: true };
}

export function dockerStatus(
  containerIdOrName: string
): { ok: boolean; running: boolean; status: string; error?: string } {
  const r = docker([
    "inspect",
    "-f",
    "{{.State.Status}}|{{.State.Running}}",
    containerIdOrName,
  ]);
  if (!r.ok) return { ok: false, running: false, status: "unknown", error: r.out.slice(0, 500) };
  const [status, running] = r.out.split("|");
  return {
    ok: true,
    running: running === "true",
    status: status || "unknown",
  };
}
