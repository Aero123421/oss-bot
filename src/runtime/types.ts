export type RuntimeMode = "docker" | "local";

export type RuntimeStatus =
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "error"
  | "unknown";

export type RuntimeHandle = {
  id: string;
  mode: RuntimeMode;
  status: RuntimeStatus;
  bot_id: string | null;
  container_id: string | null;
  local_pid: number | null;
  image: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export type StartRuntimeInput = {
  bot_id?: string;
  mode?: RuntimeMode;
  image?: string;
};
