import { Hono } from "hono";
import type { Capability } from "../types.js";

export const capabilitiesRoutes = new Hono();

/** Capability visibility for freeze unlock — include Shell.exec (S4) + fs */
capabilitiesRoutes.get("/:id/capabilities", (c) => {
  const id = c.req.param("id");
  const capabilities: Capability[] = [
    { kind: "fs", name: "FS.list", status: "granted" },
    { kind: "shell", name: "Shell.exec", status: "granted" },
  ];
  return c.json({
    runtimeHandleId: id,
    capabilities,
  });
});
