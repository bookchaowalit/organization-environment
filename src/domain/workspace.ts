import { createEngineeringRoom } from "./engineering-room";
import type { EngineeringRoom, WorkspaceRecords, IntegrationState } from "./types";

export const PILOT_TENANT = "org-solo-labs";
export const FIXTURE_TIME = "2026-09-06T09:00:00.000Z";
export const STALE_AFTER_MS = 30 * 60 * 1000;

export function fixtureRecords(tenantId = PILOT_TENANT): WorkspaceRecords {
  const room = createEngineeringRoom();
  const sourceEntities: WorkspaceRecords["sourceEntities"] = [
    { id: room.decision.source.id, provider: "meeting", externalId: room.decision.source.id,
      label: room.decision.source.label, updatedAt: FIXTURE_TIME, origin: "local_fixture" },
    ...room.workItems.map((item) => ({
      id: `source-${item.id}`, provider: item.source, externalId: item.externalKey,
      label: `${item.externalKey} · local fixture`, updatedAt: FIXTURE_TIME, origin: "local_fixture" as const,
    })),
  ];
  const meetingCitation = { sourceId: room.decision.source.id, label: room.decision.source.label,
    excerpt: room.decision.context };
  const { tasks, ...decision } = room.decision;
  return {
    organization: { ...room.organization, id: tenantId },
    rooms: [room.room], actors: room.actors,
    workItems: room.workItems.map((item) => ({ ...item, citations: [{
      sourceId: `source-${item.id}`, label: `${item.externalKey} · local fixture`, excerpt: item.title,
    }] })),
    meetings: [{ id: room.decision.source.id, title: room.decision.source.label,
      sourceId: room.decision.source.id, occurredAt: room.decision.proposedAt }],
    decisions: [{ ...decision, citations: [meetingCitation] }],
    tasks: tasks.map((task) => ({ ...task, decisionId: decision.id, citations: [meetingCitation],
      verification: { status: "pending" } })),
    activityEvents: room.activity.map((event) => ({ ...event, citations: [meetingCitation] })),
    sourceEntities, entityLinks: room.edges, syncRuns: [],
  };
}

export function sourceHealth(records: WorkspaceRecords, now: Date): IntegrationState[] {
  return (["github", "linear"] as const).map((provider) => {
    const runs = records.syncRuns.filter((run) => run.provider === provider)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt) || b.id.localeCompare(a.id));
    const latest = runs[0];
    const success = runs.find((run) => run.status === "succeeded");
    const sourceUpdatedAt = success?.sourceUpdatedAt ?? null;
    const stale = !success || !sourceUpdatedAt ||
      now.getTime() - Date.parse(success.completedAt) > STALE_AFTER_MS ||
      now.getTime() - Date.parse(sourceUpdatedAt) > STALE_AFTER_MS;
    return { provider, sourceMode: "local_fixture", label: `${provider} · local payloads only`,
      status: latest?.status === "failed" ? "failed" : !latest ? "not_configured" : stale ? "stale" : "fresh",
      lastSuccessfulSync: success?.completedAt ?? null, sourceUpdatedAt,
      ...(latest?.error ? { error: latest.error } : {}) };
  });
}

export function projectRoom(records: WorkspaceRecords, mode: EngineeringRoom["mode"], now = new Date()): EngineeringRoom {
  const decision = records.decisions[0];
  if (!records.rooms[0] || !decision) throw new Error("workspace_not_initialized");
  return {
    schemaVersion: "organization-environment.room.v1", mode, externalWritesEnabled: false,
    externalWrite: "disabled", persistence: mode === "fixture" ? "ephemeral" : "postgres",
    approvalAvailable: mode === "fixture",
    organization: records.organization, room: records.rooms[0], actors: records.actors,
    workItems: records.workItems, decision: { ...decision,
      tasks: records.tasks.filter((task) => task.decisionId === decision.id) },
    activity: [...records.activityEvents].sort((a, b) => b.at.localeCompare(a.at)),
    edges: records.entityLinks, integrations: sourceHealth(records, now), sources: records.sourceEntities,
  };
}

/** Validate references before every commit; tenant identity lives in the repository envelope. */
export function validateRecords(tenantId: string, records: WorkspaceRecords) {
  if (!tenantId || records.organization.id !== tenantId) throw new Error("tenant_mismatch");
  const actors = new Set(records.actors.map((actor) => actor.id));
  const sources = new Set(records.sourceEntities.map((source) => source.id));
  const decisions = new Set(records.decisions.map((decision) => decision.id));
  const meetings = new Set(records.meetings.map((meeting) => meeting.id));
  const entities = new Set([records.organization.id, ...records.rooms.map((room) => room.id),
    ...actors, ...sources, ...decisions, ...meetings, ...records.tasks.map((task) => task.id),
    ...records.workItems.map((item) => item.id), ...records.activityEvents.map((event) => event.id)]);
  for (const item of [...records.workItems, ...records.tasks]) {
    if (!actors.has(item.ownerId)) throw new Error("owner_not_in_tenant");
  }
  for (const task of records.tasks) {
    if (!["proposed", "approved_for_sync", "synced"].includes(task.status)) throw new Error("invalid_task_state");
    if (!decisions.has(task.decisionId)) throw new Error("decision_not_in_tenant");
    if (task.verification?.sourceId && !sources.has(task.verification.sourceId)) throw new Error("missing_verification_source");
  }
  for (const decision of records.decisions) {
    if (!["proposed", "approved_for_sync", "synced"].includes(decision.status)) throw new Error("invalid_decision_state");
    if (!meetings.has(decision.source.id)) throw new Error("meeting_not_in_tenant");
  }
  for (const meeting of records.meetings) {
    if (!sources.has(meeting.sourceId)) throw new Error("source_not_in_tenant");
  }
  for (const item of [...records.workItems, ...records.decisions, ...records.tasks, ...records.activityEvents]) {
    if (!item.citations?.length || item.citations.some((citation) => !sources.has(citation.sourceId))) {
      throw new Error("citation_not_in_tenant");
    }
  }
  for (const event of records.activityEvents) {
    if (!actors.has(event.actorId)) throw new Error("actor_not_in_tenant");
  }
  for (const edge of records.entityLinks) {
    if (!entities.has(edge.from) || !entities.has(edge.to)) throw new Error("link_not_in_tenant");
  }
}
