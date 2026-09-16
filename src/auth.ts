import { createMiddleware } from "hono/factory";

const token = () => process.env.OSS_BOT_TOKEN ?? "";

export const tokenGate = createMiddleware(async (c, next) => {
  const header =
    c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ??
    c.req.header("x-oss-bot-token") ??
    "";
  const expected = token();
  if (!expected || header !== expected) {
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
    console.warn("WARN: OSS_BOT_TOKEN is empty — protected routes will return 401");
  }
}
