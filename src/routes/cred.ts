import { Hono } from "hono";
import { credBroker } from "../cred/broker.js";
import { REQUIRED_PROVIDER_IDS } from "../types.js";

export const credRoutes = new Hono();

/** GET /api/v1/cred/status?purpose=provider:claude — no secrets */
credRoutes.get("/status", (c) => {
  const purpose = c.req.query("purpose") || "provider:claude";
  const status = credBroker.status(purpose);
  return c.json({ status });
});

/** GET /api/v1/cred/providers — all BYO statuses (no secrets) */
credRoutes.get("/providers", (c) => {
  const providers = REQUIRED_PROVIDER_IDS.map((id) =>
    credBroker.status(`provider:${id}`)
  );
  return c.json({ providers });
});
