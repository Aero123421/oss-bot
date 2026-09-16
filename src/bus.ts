import type { BusMessage } from "./types.js";
import { newId, nowIso } from "./db.js";

type Subscriber = (msg: BusMessage) => void;

/** In-memory AgentBus: Dispatcher → Bot publish/subscribe path (S5) */
export class AgentBus {
  private messages: BusMessage[] = [];
  private byBot = new Map<string, Subscriber[]>();
  private byThread = new Map<string, BusMessage[]>();

  publish(input: {
    threadId: string;
    botId: string;
    content: string;
    priority?: boolean;
  }): BusMessage {
    const msg: BusMessage = {
      id: newId("bus"),
      threadId: input.threadId,
      botId: input.botId,
      content: input.content,
      priority: Boolean(input.priority),
      createdAt: nowIso(),
    };
    this.messages.push(msg);
    const list = this.byThread.get(msg.threadId) ?? [];
    list.push(msg);
    this.byThread.set(msg.threadId, list);

    const subs = this.byBot.get(msg.botId) ?? [];
    for (const sub of subs) {
      try {
        sub(msg);
      } catch (err) {
        console.error("bus subscriber error", err);
      }
    }
    return msg;
  }

  subscribe(botId: string, fn: Subscriber): () => void {
    const list = this.byBot.get(botId) ?? [];
    list.push(fn);
    this.byBot.set(botId, list);
    return () => {
      const cur = this.byBot.get(botId) ?? [];
      this.byBot.set(
        botId,
        cur.filter((s) => s !== fn)
      );
    };
  }

  /** Consume next pending message for bot (FIFO; priority first) */
  consume(botId: string): BusMessage | null {
    const pending = this.messages.filter(
      (m) => m.botId === botId && !(m as BusMessage & { _consumed?: boolean })._consumed
    );
    pending.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority ? -1 : 1;
      return a.createdAt.localeCompare(b.createdAt);
    });
    const next = pending[0];
    if (!next) return null;
    (next as BusMessage & { _consumed?: boolean })._consumed = true;
    return next;
  }

  listByThread(threadId: string): BusMessage[] {
    return [...(this.byThread.get(threadId) ?? [])];
  }
}

export const agentBus = new AgentBus();
