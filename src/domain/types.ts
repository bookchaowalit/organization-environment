export type ActorType = "human" | "agent" | "service";

export type WorkStatus = "in_progress" | "review" | "blocked" | "ready" | "done";

export type DecisionStatus = "proposed" | "approved_for_sync" | "synced";

export interface Citation {
  sourceId: string;
  label: string;
  url?: string;
  excerpt: string;
}

export type DecisionTaskStatus = "proposed" | "approved_for_sync" | "synced";

export interface Actor {
  id: string;
  name: string;
  type: ActorType;
  role: string;
  status: "active" | "observing" | "away";
  accent: "cyan" | "lime" | "amber" | "violet";
  position: { x: string; y: string };
  capabilities: string[];
}

export interface Space {
  id: string;
  name: string;
  kind: "room";
  status: "healthy" | "attention" | "incident";
  description: string;
}

export interface WorkItem {
  citations?: Citation[];
  id: string;
  title: string;
  kind: "task" | "pull_request" | "deployment";
  status: WorkStatus;
  ownerId: string;
  source: "github" | "linear" | "system";
  externalKey: string;
}

export interface DecisionTask {
  citations?: Citation[];
  verification?: { status: "pending" | "passed" | "failed"; sourceId?: string };
  id: string;
  title: string;
  ownerId: string;
  externalSystem: "linear";
  externalKey: string;
  status: DecisionTaskStatus;
  dependsOn: string[];
}

export interface Decision {
  citations?: Citation[];
  id: string;
  title: string;
  context: string;
  status: DecisionStatus;
  proposedAt: string;
  source: {
    type: "meeting";
    id: string;
    label: string;
  };
  dependencies: string[];
  tasks: DecisionTask[];
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  relation: "contains" | "assigned_to" | "creates" | "depends_on" | "observes";
}

export interface ActivityEvent {
  citations?: Citation[];
  id: string;
  actorId: string;
  kind: "observation" | "proposal" | "approval";
  text: string;
  at: string;
}

export interface IntegrationState {
  provider: "github" | "linear" | "livekit";
  status: "fixture" | "simulator" | "not_configured" | "fresh" | "stale" | "failed";
  label: string;
  sourceMode?: "local_fixture";
  lastSuccessfulSync?: string | null;
  sourceUpdatedAt?: string | null;
  error?: string;
}

export interface EngineeringRoom {
  schemaVersion: "organization-environment.room.v1";
  mode: "fixture" | "connected-read-only";
  externalWrite?: "disabled";
  persistence?: "ephemeral" | "postgres";
  approvalAvailable?: boolean;
  sources?: SourceEntity[];
  externalWritesEnabled: false;
  organization: {
    id: string;
    name: string;
    focus: string;
  };
  room: Space;
  actors: Actor[];
  workItems: WorkItem[];
  decision: Decision;
  edges: GraphEdge[];
  activity: ActivityEvent[];
  integrations: IntegrationState[];
}

export interface SourceEntity {
  id: string;
  provider: "github" | "linear" | "meeting" | "system";
  externalId: string;
  label: string;
  url?: string;
  updatedAt: string;
  origin: "local_fixture";
}

export interface Meeting { id: string; title: string; sourceId: string; occurredAt: string }
export interface SyncRun {
  id: string;
  provider: "github" | "linear";
  eventId: string;
  status: "succeeded" | "failed";
  completedAt: string;
  sourceUpdatedAt?: string;
  error?: "invalid_source_payload";
}

export interface WorkspaceRecords {
  organization: EngineeringRoom["organization"];
  rooms: Space[];
  actors: Actor[];
  workItems: WorkItem[];
  meetings: Meeting[];
  decisions: Array<Omit<Decision, "tasks">>;
  tasks: Array<DecisionTask & { decisionId: string }>;
  activityEvents: ActivityEvent[];
  sourceEntities: SourceEntity[];
  entityLinks: GraphEdge[];
  syncRuns: SyncRun[];
}
