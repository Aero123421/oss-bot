import type { Context } from "hono";
import type { StreamEvent } from "./types.js";
import { threadEvents } from "./providers/registry.js";

/** SSE — GET /api/v1/threads/:id/events (and /stream alias). Subscribes to Claude provider emitter. */
export async function sseThreadEvents(c: Context): Promise<Response> {
  const threadId = c.req.param("id");
  const encoder = new TextEncoder();
  let closed = false;
  let onEvent: ((evt: StreamEvent) => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (evt: StreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`)
          );
        } catch {
          /* client gone */
        }
      };
      onEvent = send;
      threadEvents(threadId).on("event", onEvent);
      send({ type: "status", threadId, status: "subscribed" });

      const heartbeat = setInterval(() => {
        if (closed) {
          clearInterval(heartbeat);
          return;
        }
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      c.req.raw.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(heartbeat);
        if (onEvent) threadEvents(threadId).off("event", onEvent);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      closed = true;
      if (onEvent) threadEvents(threadId).off("event", onEvent);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
