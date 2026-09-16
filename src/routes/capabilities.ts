import { Hono } from "hono";
import { getDb } from "../db.js";
import { getHandle } from "../runtime/store.js";
import {
  execCapability,
  listCapabilities,
  type CapKind,
} from "../runtime/capability.js";

export const capabilitiesRoutes = new Hono();

/** GET — Capability visibility (S4 Wow: Shell.exec + FS.list granted) */
capabilitiesRoutes.get("/:id/capabilities", (c) => {
  const id = c.req.param("id");
  const db = getDb();
  const handle = getHandle(db, id);
  if (!handle) return c.json({ error: "not_found" }, 404);
  return c.json({
    runtimeHandleId: id,
    status: handle.status,
    capabilities: listCapabilities(handle),
  });
});

/**
 * POST — one-shot Capability exec on Runtime (not sleep-only).
 * Body: { kind: "shell.exec" | "fs.list", command?, path? }
 * Secrets never returned.
 */
capabilitiesRoutes.post("/:id/capabilities/exec", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as {
    kind?: CapKind;
    command?: string;
    path?: string;
  };
  const kind = body.kind ?? "shell.exec";
  if (kind !== "shell.exec" && kind !== "fs.list") {
    return c.json({ error: "invalid_kind" }, 400);
  }
  const result = execCapability(getDb(), id, {
    kind,
    command: body.command,
    path: body.path,
  });
  if (!result.ok) {
    return c.json({ ok: false, error: result.error }, result.status as 400 | 404 | 409);
  }
  return c.json({
    ok: result.result.ok,
    kind: result.result.kind,
    exitCode: result.result.exitCode,
    stdout: result.result.stdout,
    stderr: result.result.stderr,
  });
});
