import { sql } from "drizzle-orm";
import { pgTable, text, jsonb, primaryKey, foreignKey, check, unique, timestamp, integer } from "drizzle-orm/pg-core";
import type { WorkspaceRecords } from "../domain/types";

export const organizations = pgTable("organizations", {
  tenantId: text("tenant_id").primaryKey(),
  data: jsonb("data").$type<WorkspaceRecords["organization"]>().notNull(),
}, (t) => [check("organization_identity", sql`${t.data}->>'id' = ${t.tenantId}`)]);

// Registry makes polymorphic links and citations enforceable with composite FKs.
export const entities = pgTable("entities", {
  tenantId: text("tenant_id").notNull().references(() => organizations.tenantId),
  id: text("id").notNull(),
}, (t) => [primaryKey({ columns: [t.tenantId, t.id] })]);

function recordTable<T extends { id: string }>(name: string) {
  return pgTable(name, {
    tenantId: text("tenant_id").notNull(),
    id: text("id").notNull(),
    data: jsonb("data").$type<T>().notNull(),
  }, (t) => [
    primaryKey({ columns: [t.tenantId, t.id] }),
    foreignKey({ columns: [t.tenantId, t.id], foreignColumns: [entities.tenantId, entities.id] }),
    check(`${name}_identity`, sql`${t.data}->>'id' = ${t.id}`),
    ...(name === "decisions" || name === "tasks" ? [
      check(`${name}_state`, sql`${t.data}->>'status' IN ('proposed', 'approved_for_sync', 'synced')`),
    ] : []),
  ]);
}
export const rooms = recordTable<WorkspaceRecords["rooms"][number]>("rooms");
export const actors = recordTable<WorkspaceRecords["actors"][number]>("actors");
export const workItems = pgTable("work_items", {
  tenantId: text("tenant_id").notNull(), id: text("id").notNull(),
  data: jsonb("data").$type<WorkspaceRecords["workItems"][number]>().notNull(),
  ownerId: text("owner_id").generatedAlwaysAs(sql`data->>'ownerId'`).notNull(),
}, (t) => [
  primaryKey({ columns: [t.tenantId, t.id] }),
  foreignKey({ columns: [t.tenantId, t.id], foreignColumns: [entities.tenantId, entities.id] }),
  foreignKey({ columns: [t.tenantId, t.ownerId], foreignColumns: [actors.tenantId, actors.id] }),
  check("work_items_identity", sql`${t.data}->>'id' = ${t.id}`),
]);
export const meetings = pgTable("meetings", {
  tenantId: text("tenant_id").notNull(), id: text("id").notNull(),
  data: jsonb("data").$type<WorkspaceRecords["meetings"][number]>().notNull(),
  sourceId: text("source_id").generatedAlwaysAs(sql`data->>'sourceId'`).notNull(),
}, (t) => [
  primaryKey({ columns: [t.tenantId, t.id] }),
  foreignKey({ columns: [t.tenantId, t.id], foreignColumns: [entities.tenantId, entities.id] }),
  foreignKey({ columns: [t.tenantId, t.sourceId], foreignColumns: [sourceEntities.tenantId, sourceEntities.id] }),
  check("meetings_identity", sql`${t.data}->>'id' = ${t.id}`),
]);
export const decisions = pgTable("decisions", {
  tenantId: text("tenant_id").notNull(), id: text("id").notNull(),
  data: jsonb("data").$type<WorkspaceRecords["decisions"][number]>().notNull(),
  meetingId: text("meeting_id").generatedAlwaysAs(sql`data->'source'->>'id'`).notNull(),
  state: text("state").generatedAlwaysAs(sql`data->>'status'`).notNull(),
}, (t) => [
  primaryKey({ columns: [t.tenantId, t.id] }),
  foreignKey({ columns: [t.tenantId, t.id], foreignColumns: [entities.tenantId, entities.id] }),
  foreignKey({ columns: [t.tenantId, t.meetingId], foreignColumns: [meetings.tenantId, meetings.id] }),
  check("decisions_identity", sql`${t.data}->>'id' = ${t.id}`),
  check("decisions_state", sql`${t.state} IN ('proposed', 'approved_for_sync', 'synced')`),
]);
export const tasks = pgTable("tasks", {
  tenantId: text("tenant_id").notNull(), id: text("id").notNull(),
  data: jsonb("data").$type<WorkspaceRecords["tasks"][number]>().notNull(),
  ownerId: text("owner_id").generatedAlwaysAs(sql`data->>'ownerId'`).notNull(),
  decisionId: text("decision_id").generatedAlwaysAs(sql`data->>'decisionId'`).notNull(),
  state: text("state").generatedAlwaysAs(sql`data->>'status'`).notNull(),
}, (t) => [
  primaryKey({ columns: [t.tenantId, t.id] }),
  foreignKey({ columns: [t.tenantId, t.id], foreignColumns: [entities.tenantId, entities.id] }),
  foreignKey({ columns: [t.tenantId, t.ownerId], foreignColumns: [actors.tenantId, actors.id] }),
  foreignKey({ columns: [t.tenantId, t.decisionId], foreignColumns: [decisions.tenantId, decisions.id] }),
  check("tasks_identity", sql`${t.data}->>'id' = ${t.id}`),
  check("tasks_state", sql`${t.state} IN ('proposed', 'approved_for_sync', 'synced')`),
]);
export const activityEvents = pgTable("activity_events", {
  tenantId: text("tenant_id").notNull(), id: text("id").notNull(),
  data: jsonb("data").$type<WorkspaceRecords["activityEvents"][number]>().notNull(),
  actorId: text("actor_id").generatedAlwaysAs(sql`data->>'actorId'`).notNull(),
}, (t) => [
  primaryKey({ columns: [t.tenantId, t.id] }),
  foreignKey({ columns: [t.tenantId, t.id], foreignColumns: [entities.tenantId, entities.id] }),
  foreignKey({ columns: [t.tenantId, t.actorId], foreignColumns: [actors.tenantId, actors.id] }),
  check("activity_events_identity", sql`${t.data}->>'id' = ${t.id}`),
]);
export const sourceEntities = pgTable("source_entities", {
  tenantId: text("tenant_id").notNull(),
  id: text("id").notNull(),
  provider: text("provider").notNull(),
  externalId: text("external_id").notNull(),
  data: jsonb("data").$type<WorkspaceRecords["sourceEntities"][number]>().notNull(),
}, (t) => [
  primaryKey({ columns: [t.tenantId, t.id] }),
  foreignKey({ columns: [t.tenantId, t.id], foreignColumns: [entities.tenantId, entities.id] }),
  unique("source_identity").on(t.tenantId, t.provider, t.externalId),
  check("source_data_identity", sql`${t.data}->>'id' = ${t.id} AND ${t.data}->>'provider' = ${t.provider} AND ${t.data}->>'externalId' = ${t.externalId}`),
]);
export const entityLinks = pgTable("entity_links", {
  tenantId: text("tenant_id").notNull(),
  id: text("id").notNull(),
  fromId: text("from_id").notNull(),
  toId: text("to_id").notNull(),
  data: jsonb("data").$type<WorkspaceRecords["entityLinks"][number]>().notNull(),
}, (t) => [
  primaryKey({ columns: [t.tenantId, t.id] }),
  foreignKey({ columns: [t.tenantId, t.fromId], foreignColumns: [entities.tenantId, entities.id] }),
  foreignKey({ columns: [t.tenantId, t.toId], foreignColumns: [entities.tenantId, entities.id] }),
  check("link_identity", sql`${t.data}->>'id' = ${t.id} AND ${t.data}->>'from' = ${t.fromId} AND ${t.data}->>'to' = ${t.toId}`),
]);
export const syncRuns = pgTable("sync_runs", {
  tenantId: text("tenant_id").notNull().references(() => organizations.tenantId),
  id: text("id").notNull(),
  provider: text("provider").notNull(),
  eventId: text("event_id").notNull(),
  data: jsonb("data").$type<WorkspaceRecords["syncRuns"][number]>().notNull(),
}, (t) => [
  primaryKey({ columns: [t.tenantId, t.id] }),
  unique("sync_delivery_identity").on(t.tenantId, t.provider, t.eventId),
  check("sync_identity", sql`${t.data}->>'id' = ${t.id} AND ${t.data}->>'provider' = ${t.provider} AND ${t.data}->>'eventId' = ${t.eventId}`),
]);
export const citations = pgTable("citations", {
  tenantId: text("tenant_id").notNull(), entityId: text("entity_id").notNull(),
  sourceId: text("source_id").notNull(), excerpt: text("excerpt").notNull(),
}, (t) => [
  primaryKey({ columns: [t.tenantId, t.entityId, t.sourceId] }),
  foreignKey({ columns: [t.tenantId, t.entityId], foreignColumns: [entities.tenantId, entities.id] }),
  foreignKey({ columns: [t.tenantId, t.sourceId], foreignColumns: [sourceEntities.tenantId, sourceEntities.id] }),
]);

export const members = pgTable("office_members", {
  tenantId: text("tenant_id").notNull().references(() => organizations.tenantId),
  id: text("id").notNull(),
  username: text("username").notNull(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<"owner" | "member">().notNull(),
}, (t) => [primaryKey({ columns: [t.tenantId, t.id] }),
  unique("office_username").on(t.tenantId, t.username),
  check("office_role", sql`${t.role} IN ('owner','member')`),
]);
export const sessions = pgTable("office_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  tenantId: text("tenant_id").notNull(), memberId: text("member_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => [foreignKey({ columns: [t.tenantId, t.memberId], foreignColumns: [members.tenantId, members.id] })]);
export const invites = pgTable("office_invites", {
  tokenHash: text("token_hash").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => organizations.tenantId),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});
export const presence = pgTable("office_presence", {
  tenantId: text("tenant_id").notNull(), memberId: text("member_id").notNull(),
  roomId: text("room_id").notNull(),
  x: integer("x").notNull(), y: integer("y").notNull(),
  status: text("status").$type<"available" | "focus" | "away">().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
}, (t) => [primaryKey({ columns: [t.tenantId, t.memberId] }),
  foreignKey({ columns: [t.tenantId, t.memberId], foreignColumns: [members.tenantId, members.id] }),
  foreignKey({ columns: [t.tenantId, t.roomId], foreignColumns: [rooms.tenantId, rooms.id] }),
  check("presence_coordinates", sql`${t.x} BETWEEN 5 AND 95 AND ${t.y} BETWEEN 5 AND 95`),
  check("presence_status", sql`${t.status} IN ('available','focus','away')`),
]);
export const messages = pgTable("office_messages", {
  tenantId: text("tenant_id").notNull(), id: text("id").notNull(),
  memberId: text("member_id").notNull(), roomId: text("room_id").notNull(),
  body: text("body").notNull(), requestId: text("request_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}, (t) => [primaryKey({ columns: [t.tenantId, t.id] }),
  unique("message_request_identity").on(t.tenantId, t.memberId, t.requestId),
  foreignKey({ columns: [t.tenantId, t.memberId], foreignColumns: [members.tenantId, members.id] }),
  foreignKey({ columns: [t.tenantId, t.roomId], foreignColumns: [rooms.tenantId, rooms.id] }),
]);
