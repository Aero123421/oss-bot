import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { FIXTURE_KIND, type ThreadJobs } from "../jobs/threadJobs.js";

export function createThreadJobRoutes(jobs: ThreadJobs) {
  const routes = new Hono();

  routes.post("/:threadId/jobs", bodyLimit({
    maxSize: 1024,
    onError: (c) => c.json({ error: "job_request_too_large" }, 413),
  }), async (c) => {
    const body: unknown = await c.req.json().catch(() => undefined);
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return c.json({ error: "invalid_job_request" }, 400);
    }
    const { kind, requestKey } = body as Record<string, unknown>;
    if (Object.keys(body).length !== 2 || kind !== FIXTURE_KIND ||
        typeof requestKey !== "string" || requestKey.length < 1 || requestKey.length > 80 ||
        /[^a-zA-Z0-9_-]/.test(requestKey)) {
      return c.json({ error: "invalid_job_request" }, 400);
    }

    const result = jobs.submit(c.req.param("threadId"), requestKey);
    if (result.type === "not_found") return c.json({ error: "not_found" }, 404);
    if (result.type === "busy") return c.json({ error: "job_already_active", jobId: result.jobId }, 409);
    return c.json({ job: result.job }, result.type === "created" ? 201 : 200);
  });

  routes.get("/:threadId/jobs", (c) => {
    c.header("Cache-Control", "no-store");
    const result = jobs.list(c.req.param("threadId"));
    return result ? c.json({ jobs: result }) : c.json({ error: "not_found" }, 404);
  });

  routes.get("/:threadId/jobs/:jobId", (c) => {
    c.header("Cache-Control", "no-store");
    const job = jobs.get(c.req.param("threadId"), c.req.param("jobId"));
    return job ? c.json({ job }) : c.json({ error: "not_found" }, 404);
  });

  routes.post("/:threadId/jobs/:jobId/cancel", (c) => {
    const job = jobs.cancel(c.req.param("threadId"), c.req.param("jobId"));
    return job ? c.json({ job }) : c.json({ error: "not_found" }, 404);
  });

  return routes;
}
