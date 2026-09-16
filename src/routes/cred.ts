import { Hono } from "hono";
import { credBroker } from "../cred/broker.js";

export const credRoutes = new Hono();

/** GET /api/v1/cred/status?purpose=provider:claude — no secrets */
credRoutes.get("/status", (c) => {
  const purpose = c.req.query("purpose") || "provider:claude";
  const status = credBroker.status(purpose);
  return c.json({ status });
});
