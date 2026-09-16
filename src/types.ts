export type AdapterId = string;
export type ProviderId = "claude" | "codex" | "opencode" | string;

export type StreamEvent =
  | { type: "token"; threadId: string; text: string }
  | { type: "message"; threadId: string; messageId: string; role: string; content: string }
  | { type: "status"; threadId: string; status: string; detail?: string }
  | { type: "error"; threadId: string; error: string }
  | { type: "done"; threadId: string };

export type Bot = {
  id: string;
  name: string;
  title: string;
  role_memo: string;
  provider: ProviderId;
  runtime: "docker" | "local";
  workdir: string | null;
  system_prompt: string | null;
  model: string | null;
  docker_image: string | null;
  env_json: string;
  enabled: number;
  created_at: string;
  updated_at: string;
};

export type Group = {
  id: string;
  name: string;
  created_at: string;
};

export type Membership = {
  group_id: string;
  bot_id: string;
};

export type Thread = {
  id: string;
  title: string;
  active_bot_id: string | null;
  group_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  thread_id: string;
  bot_id: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

/** Public CredGrant status — no secret fields */
export type CredGrantStatus = {
  purpose: string;
  present: boolean;
  mountsOk: boolean;
  envOk: boolean;
  status_code: "ready" | "missing" | "partial" | "not_registered";
  hint?: string;
};

/** Issued grant for runtime injection — in-memory only; never log env values */
export type CredGrant = {
  purpose: string;
  runtimeHandleId: string;
  mounts: Array<{ host: string; container: string; mode: "ro" | "rw" }>;
  env: Record<string, string>;
};

export type BusMessage = {
  id: string;
  threadId: string;
  botId: string;
  content: string;
  priority: boolean;
  createdAt: string;
};

export type CapabilityKind = "fs" | "shell" | "browser" | "cred";

export type Capability = {
  kind: CapabilityKind;
  name?: string;
  status: "granted" | "denied" | "pending";
};

export type RuntimeHandleStatus = "idle" | "starting" | "running" | "stopped" | "error";

export type ProviderCredSpec = {
  provider: ProviderId;
  purpose: string;
  mounts: Array<{ host: string; container: string; mode: "ro" | "rw" }>;
  envKeys: string[];
};
