import type Database from "better-sqlite3";
import {
  createHandle,
  getHandle,
  listHandles,
  updateHandle,
} from "./store.js";
import type { RuntimeHandle, RuntimeMode, StartRuntimeInput } from "./types.js";
import { dockerAvailable, dockerRun, dockerStatus, dockerStop } from "./docker.js";
import { localStart, localStatus, localStop } from "./local.js";

const defaultImage = () => process.env.RUNTIME_IMAGE || "busybox:1.36";

function preferMode(requested?: RuntimeMode): RuntimeMode {
  if (requested === "local") return "local";
  if (requested === "docker") return "docker";
  // default docker when sock/daemon available, else local fallback
  if (dockerAvailable()) return "docker";
  return "local";
}

export function startRuntime(
  db: Database.Database,
  input: StartRuntimeInput = {}
): { ok: true; handle: RuntimeHandle } | { ok: false; error: string; status: number } {
  const mode = preferMode(input.mode);
  if (mode === "docker" && !dockerAvailable()) {
    return {
      ok: false,
      error: "docker unavailable; use mode=local or enable docker-compose.dev.yml",
      status: 503,
    };
  }

  const image = input.image || defaultImage();
  const handle = createHandle(db, {
    mode,
    bot_id: input.bot_id ?? null,
    image: mode === "docker" ? image : null,
    status: "starting",
  });

  if (mode === "docker") {
    const name = `oss-bot-rt-${handle.id.slice(0, 8)}`;
    const r = dockerRun({ name, image });
    if (!r.ok || !r.containerId) {
      updateHandle(db, handle.id, { status: "error", error: "start_failed" });
      console.error("runtime docker start failed", r.error);
      return { ok: false, error: "runtime start failed", status: 500 };
    }
    const next = updateHandle(db, handle.id, {
      status: "running",
      container_id: r.containerId,
      error: null,
    });
    return { ok: true, handle: next! };
  }

  const r = localStart();
  if (!r.ok || !r.pid) {
    updateHandle(db, handle.id, { status: "error", error: "start_failed" });
    console.error("runtime local start failed", r.error);
    return { ok: false, error: "runtime start failed", status: 500 };
  }
  const next = updateHandle(db, handle.id, {
    status: "running",
    local_pid: r.pid,
    error: null,
  });
  return { ok: true, handle: next! };
}

export function stopRuntime(
  db: Database.Database,
  id: string
): { ok: true; handle: RuntimeHandle } | { ok: false; error: string; status: number } {
  const handle = getHandle(db, id);
  if (!handle) return { ok: false, error: "not found", status: 404 };

  updateHandle(db, id, { status: "stopping" });

  if (handle.mode === "docker") {
    const target = handle.container_id || `oss-bot-rt-${handle.id.slice(0, 8)}`;
    const r = dockerStop(target);
    if (!r.ok) {
      console.error("runtime docker stop failed", r.error);
      updateHandle(db, id, { status: "error", error: "stop_failed" });
      return { ok: false, error: "runtime stop failed", status: 500 };
    }
    const next = updateHandle(db, id, {
      status: "stopped",
      container_id: null,
      error: null,
    });
    return { ok: true, handle: next! };
  }

  if (handle.local_pid != null) {
    const r = localStop(handle.local_pid);
    if (!r.ok) {
      console.error("runtime local stop failed", r.error);
      updateHandle(db, id, { status: "error", error: "stop_failed" });
      return { ok: false, error: "runtime stop failed", status: 500 };
    }
  }
  const next = updateHandle(db, id, {
    status: "stopped",
    local_pid: null,
    error: null,
  });
  return { ok: true, handle: next! };
}

export function statusRuntime(
  db: Database.Database,
  id: string
): { ok: true; handle: RuntimeHandle } | { ok: false; error: string; status: number } {
  const handle = getHandle(db, id);
  if (!handle) return { ok: false, error: "not found", status: 404 };

  if (handle.mode === "docker" && handle.container_id) {
    const st = dockerStatus(handle.container_id);
    if (!st.ok) {
      const next = updateHandle(db, id, { status: "unknown", error: "inspect_failed" });
      return { ok: true, handle: next! };
    }
    const next = updateHandle(db, id, {
      status: st.running ? "running" : "stopped",
      error: null,
    });
    return { ok: true, handle: next! };
  }

  if (handle.mode === "local" && handle.local_pid != null) {
    const st = localStatus(handle.local_pid);
    const next = updateHandle(db, id, {
      status: st.running ? "running" : "stopped",
      error: null,
    });
    return { ok: true, handle: next! };
  }

  return { ok: true, handle };
}

export function listRuntimes(db: Database.Database): RuntimeHandle[] {
  return listHandles(db);
}

export function runtimeMeta() {
  const docker = dockerAvailable();
  return {
    default_mode: docker ? "docker" : "local",
    docker_available: docker,
    sock_overlay: process.env.DOCKER_SOCK_OVERLAY === "1",
    docker_host_configured: Boolean(process.env.DOCKER_HOST),
    runtime_image: defaultImage(),
  };
}
