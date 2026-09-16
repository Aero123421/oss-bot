import { Hono } from "hono";
import { getDb, newId, nowIso } from "../db.js";
import type { Group, Membership } from "../types.js";

export const groupsRoutes = new Hono();

groupsRoutes.get("/", (c) => {
  const groups = getDb().prepare("SELECT * FROM groups ORDER BY created_at ASC").all() as Group[];
  const memberships = getDb().prepare("SELECT * FROM memberships").all() as Membership[];
  return c.json({ groups, memberships });
});

groupsRoutes.post("/", async (c) => {
  const body = await c.req.json<{ name?: string; botIds?: string[] }>();
  if (!body.name?.trim()) return c.json({ error: "name_required" }, 400);
  const id = newId("grp");
  const now = nowIso();
  const db = getDb();
  db.prepare("INSERT INTO groups (id, name, created_at) VALUES (?, ?, ?)").run(
    id,
    body.name.trim(),
    now
  );
  for (const botId of body.botIds ?? []) {
    db.prepare(
      "INSERT OR IGNORE INTO memberships (group_id, bot_id) VALUES (?, ?)"
    ).run(id, botId);
  }
  const group = db.prepare("SELECT * FROM groups WHERE id = ?").get(id) as Group;
  const memberships = db
    .prepare("SELECT * FROM memberships WHERE group_id = ?")
    .all(id) as Membership[];
  return c.json({ group, memberships }, 201);
});

groupsRoutes.get("/:id", (c) => {
  const id = c.req.param("id");
  const group = getDb().prepare("SELECT * FROM groups WHERE id = ?").get(id) as Group | undefined;
  if (!group) return c.json({ error: "not_found" }, 404);
  const memberships = getDb()
    .prepare("SELECT * FROM memberships WHERE group_id = ?")
    .all(id) as Membership[];
  return c.json({ group, memberships });
});

groupsRoutes.post("/:id/memberships", async (c) => {
  const id = c.req.param("id");
  const group = getDb().prepare("SELECT * FROM groups WHERE id = ?").get(id);
  if (!group) return c.json({ error: "not_found" }, 404);
  const body = await c.req.json<{ botId?: string }>();
  if (!body.botId) return c.json({ error: "botId_required" }, 400);
  getDb()
    .prepare("INSERT OR IGNORE INTO memberships (group_id, bot_id) VALUES (?, ?)")
    .run(id, body.botId);
  const memberships = getDb()
    .prepare("SELECT * FROM memberships WHERE group_id = ?")
    .all(id) as Membership[];
  return c.json({ memberships }, 201);
});

groupsRoutes.delete("/:id/memberships/:botId", (c) => {
  const groupId = c.req.param("id");
  const botId = c.req.param("botId");
  getDb()
    .prepare("DELETE FROM memberships WHERE group_id = ? AND bot_id = ?")
    .run(groupId, botId);
  return c.json({ ok: true });
});

groupsRoutes.delete("/:id", (c) => {
  const id = c.req.param("id");
  const r = getDb().prepare("DELETE FROM groups WHERE id = ?").run(id);
  if (r.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});
