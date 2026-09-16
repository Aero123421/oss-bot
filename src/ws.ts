import type { Context } from "hono";
import type { StreamEvent } from "./types.js";

type Listener = (evt: StreamEvent) => void;

const listeners = new Map<string, Set<Listener>>();

export function emitStreamEvent(threadId: string, evt: StreamEvent): void {
  const set = listeners.get(threadId);
  if (!set) return;
  for (const fn of set) {
    try {
      fn(evt);
    } catch (err) {
      console.error("sse listener error", err);
    }
  }
}

export function subscribeThread(threadId: string, fn: Listener): () => void {
  let set = listeners.get(threadId);
  if (!set) {
    set = new Set();
    listeners.set(threadId, set);
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) listeners.delete(threadId);
  };
}

/** SSE stream for UI — GET /api/v1/threads/:id/events */
export async function sseThreadEvents(c: Context): Promise<Response> {
  const threadId = c.req.param("id");
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let closed = false;

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
      unsubscribe = subscribeThread(threadId, send);
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
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      closed = true;
      unsubscribe?.();
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
