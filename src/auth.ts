import { createMiddleware } from "hono/factory";

const token = () => process.env.OSS_BOT_TOKEN ?? "";

/** True when shared token is set and not the example default. */
export function isAuthGateOpen(): boolean {
  const t = token();
  return Boolean(t) && !t.startsWith("change-me");
}

export const tokenGate = createMiddleware(async (c, next) => {
  if (!isAuthGateOpen()) {
    return c.json(
      {
        error: "auth_gate_closed",
        hint: "Set OSS_BOT_TOKEN in .env (non-default), then restart. Run: npm run doctor",
      },
      401
    );
  }
  const header =
    c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ??
    c.req.header("x-oss-bot-token") ??
    "";
  if (header !== token()) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
});

export function assertProductionToken(): void {
  const t = token();
  if (process.env.NODE_ENV === "production") {
    if (!t || t.startsWith("change-me")) {
      console.error("OSS_BOT_TOKEN must be a non-default value in production");
      process.exit(1);
    }
  } else if (!t) {
    console.warn("WARN: OSS_BOT_TOKEN is empty — AuthGate closed; /api/v1/* → 401");
  } else if (t.startsWith("change-me")) {
    console.warn("WARN: OSS_BOT_TOKEN is still the example default — AuthGate closed");
  }
}
