import { spawn } from "node:child_process";

/** Local fallback: long-lived sleep process as a stand-in RuntimeHandle. */
export function localStart(): { ok: boolean; pid?: number; error?: string } {
  try {
    const child = spawn("sleep", ["infinity"], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    if (!child.pid) return { ok: false, error: "no pid" };
    return { ok: true, pid: child.pid };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export function localStop(pid: number): { ok: boolean; error?: string } {
  try {
    process.kill(pid, "SIGTERM");
    return { ok: true };
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ESRCH") return { ok: true };
    return { ok: false, error: String(err) };
  }
}

export function localStatus(pid: number): { running: boolean } {
  try {
    process.kill(pid, 0);
    return { running: true };
  } catch {
    return { running: false };
  }
}
