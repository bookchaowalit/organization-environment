import { createHash, randomUUID } from "node:crypto";
import { githubAdapter, linearAdapter } from "../adapters/sources";
import type { NormalizedSignal } from "../adapters/sources";
import { approveDecision, type ApprovalPrincipal, type ApproveDecisionRequest, type ApprovalResult } from "../domain/commands";
import type { EngineeringRoom } from "../domain/types";
import { fixtureRecords, projectRoom } from "../domain/workspace";
import type { WorkspaceStore } from "./store";

export class WorkspaceRepository {
  readonly externalWrite = "disabled" as const;
  constructor(private readonly store: WorkspaceStore, readonly tenantId: string,
    readonly mode: EngineeringRoom["mode"], private readonly clock = () => new Date()) {
    if (!tenantId.trim()) throw new Error("tenant_required");
  }
  async seedFixture() {
    return this.store.transaction(this.tenantId, (existing) => ({
      records: existing ?? fixtureRecords(this.tenantId), result: undefined,
    }));
  }
  async records() {
    const records = await this.store.read(this.tenantId);
    if (!records) throw new Error("workspace_not_initialized");
    return records;
  }
  async room() { return projectRoom(await this.records(), this.mode, this.clock()); }

  async importSource(provider: "github" | "linear", payload: unknown) {
    let signal: NormalizedSignal;
    try {
      if (provider === "github") signal = githubAdapter.normalize(githubAdapter.parse(payload));
      else if (provider === "linear") signal = linearAdapter.normalize(linearAdapter.parse(payload));
      else throw new Error("unsupported_provider");
    } catch {
      if (provider !== "github" && provider !== "linear") throw new Error("unsupported_provider");
      await this.store.transaction(this.tenantId, (records) => {
        if (!records) throw new Error("workspace_not_initialized");
        const id = randomUUID();
        records.syncRuns.push({ id, eventId: `rejected:${id}`, provider, status: "failed",
          completedAt: this.clock().toISOString(), error: "invalid_source_payload" });
        return { records, result: undefined };
      });
      return { ok: false as const, error: "invalid_source_payload", externalWrite: this.externalWrite };
    }
    return this.store.transaction(this.tenantId, (records) => {
      if (!records) throw new Error("workspace_not_initialized");
      const previous = records.syncRuns.find((run) => run.provider === provider && run.eventId === signal.eventId);
      if (previous) return { records, result: { ok: true as const, duplicate: true, externalWrite: this.externalWrite } };
      const id = createHash("sha256").update(JSON.stringify([provider, signal.eventId])).digest("hex");
      const oldSource = records.sourceEntities.find((source) => source.id === signal.source.id);
      const newer = !oldSource || Date.parse(signal.source.updatedAt) > Date.parse(oldSource.updatedAt);
      if (!records.actors.some((actor) => actor.id === "source-unassigned")) records.actors.push({
        id: "source-unassigned", name: "ยังไม่ได้กำหนด owner", type: "service", role: "Needs human assignment",
        status: "away", accent: "amber", position: { x: "48%", y: "78%" }, capabilities: [],
      });
      if (newer) {
        upsert(records.sourceEntities, signal.source);
        upsert(records.workItems, signal.workItem);
      }
      records.activityEvents.push({
        id: `import:${id}`, actorId: "source-unassigned", kind: "observation",
        text: `${signal.workItem.externalKey}: ${signal.workItem.title}`,
        at: this.clock().toISOString(), citations: signal.workItem.citations,
      });
      upsert(records.entityLinks, { id: `contains:${signal.workItem.id}`,
        from: records.rooms[0].id, to: signal.workItem.id, relation: "contains" });
      records.syncRuns.push({ id, provider, eventId: signal.eventId, status: "succeeded",
        completedAt: this.clock().toISOString(), sourceUpdatedAt: signal.source.updatedAt });
      return { records, result: { ok: true as const, duplicate: false, externalWrite: this.externalWrite } };
    });
  }

  async approve(request: ApproveDecisionRequest, principal: ApprovalPrincipal | null) {
    return this.store.transaction<ApprovalResult | { ok: false; reason: "decision_not_found" }>(this.tenantId, (records) => {
      if (!records) throw new Error("workspace_not_initialized");
      const decision = records.decisions.find((candidate) => candidate.id === request.decisionId);
      if (!decision) return { records, result: { ok: false, reason: "decision_not_found" } };
      const result = approveDecision({ ...decision, tasks: records.tasks.filter((task) => task.decisionId === decision.id) },
        request, { tenantId: this.tenantId, principal, actor: records.actors.find((actor) => actor.id === principal?.actorId) });
      if (result.ok) {
        const { tasks, ...approved } = result.decision;
        upsert(records.decisions, approved);
        for (const task of tasks) upsert(records.tasks, { ...task, decisionId: decision.id });
        records.activityEvents.push({ id: `approval:${decision.id}`, actorId: principal!.actorId,
          kind: "approval", text: "Human approved decision and task proposals; external writes remain disabled.",
          at: this.clock().toISOString(), citations: decision.citations });
      }
      return { records, result };
    });
  }
}

function upsert<T extends { id: string }>(records: T[], value: T) {
  const index = records.findIndex((record) => record.id === value.id);
  if (index === -1) records.push(value);
  else records[index] = value;
}
