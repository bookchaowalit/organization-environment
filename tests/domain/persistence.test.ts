import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../../src/persistence/schema";
import { MemoryStore, type WorkspaceStore } from "../../src/persistence/store";
import { PostgresStore } from "../../src/persistence/postgres-store";
import { WorkspaceRepository } from "../../src/persistence/repository";
import { getWorkspaceRepository } from "../../src/persistence/runtime";
import { fixtureRecords, projectRoom } from "../../src/domain/workspace";
import { approveDecision, canTransition } from "../../src/domain/commands";
import { githubAdapter, linearAdapter } from "../../src/adapters/sources";
import { handleApproval } from "../../src/server/approval";
import github from "../../src/adapters/fixtures/github.json";
import linear from "../../src/adapters/fixtures/linear.json";

const database = new PGlite();
const db = drizzle(database, { schema });
beforeAll(async () => { await migrate(db, { migrationsFolder: "./drizzle" }); }, 30000);
afterAll(async () => { await database.close(); });
let sequence = 0;
const request = { action: "approve" as const, decisionId: "decision-checkout-staging" };

for (const backend of ["memory", "postgres"] as const) {
  describe(`${backend} repository contract`, () => {
    async function setup() {
      const store: WorkspaceStore = backend === "memory" ? new MemoryStore() : new PostgresStore(db);
      const tenant = `${backend}-tenant-${++sequence}`;
      let now = new Date("2026-09-06T09:25:00.000Z");
      const repo = new WorkspaceRepository(store, tenant, backend === "memory" ? "fixture" : "connected-read-only", () => now);
      await repo.seedFixture();
      return { store, tenant, repo, tick: (value: string) => { now = new Date(value); },
        principal: { tenantId: tenant, actorId: "actor-book", verifiedHuman: true as const } };
    }

    it("isolates tenants with identical entity IDs during reads, imports and approvals", async () => {
      const { store, repo, principal, tenant } = await setup();
      const other = new WorkspaceRepository(store, `${tenant}-other`, "connected-read-only");
      await other.seedFixture();
      await repo.importSource("github", github);
      expect((await other.records()).workItems).toHaveLength(3);
      expect((await other.approve(request, principal)).ok).toBe(false);
      expect((await other.room()).decision.status).toBe("proposed");
      expect((await repo.approve(request, principal)).ok).toBe(true);
      expect((await other.records()).activityEvents).toHaveLength(3);
      expect(await store.read("missing-tenant")).toBeNull();
    });

    it("deduplicates concurrent deliveries and persists stable entities across new repository instances", async () => {
      const { store, repo, tenant } = await setup();
      const results = await Promise.all([repo.importSource("github", github), repo.importSource("github", github)]);
      expect(results.filter((result) => result.ok && result.duplicate)).toHaveLength(1);
      const reloaded = new WorkspaceRepository(store, tenant, repo.mode);
      const records = await reloaded.records();
      expect(records.workItems).toHaveLength(4);
      expect(records.activityEvents).toHaveLength(4);
      expect(records.syncRuns).toHaveLength(1);
      await reloaded.seedFixture();
      expect((await reloaded.records()).workItems).toHaveLength(4);
    });

    it("updates a source entity without duplication and ignores older payloads", async () => {
      const { repo } = await setup();
      await repo.importSource("linear", linear);
      await repo.importSource("linear", { ...linear, eventId: "newer", updatedAt: "2026-09-06T10:00:00Z",
        issue: { ...linear.issue, title: "New title", state: "completed" } });
      await repo.importSource("linear", { ...linear, eventId: "older" });
      const records = await repo.records();
      expect(records.workItems).toHaveLength(4);
      expect(records.workItems.find((item) => item.id.startsWith("work:linear:"))).toMatchObject({ title: "New title", status: "done" });
      expect(records.activityEvents.find((event) => event.text.includes("New title"))?.citations?.[0].excerpt).toBe("New title");
    });

    it("preserves meeting citations, task states and audit evidence through atomic human approval", async () => {
      const { repo, principal } = await setup();
      const before = await repo.room();
      const results = await Promise.all([repo.approve(request, principal), repo.approve(request, principal)]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      const after = await repo.room();
      expect(after.decision.status).toBe("approved_for_sync");
      expect(after.decision.citations).toEqual(before.decision.citations);
      expect(after.decision.tasks.every((task) => task.status === "approved_for_sync" && task.verification?.status === "pending")).toBe(true);
      expect(after.decision.tasks.every((task) => task.citations?.[0].sourceId === before.decision.source.id)).toBe(true);
      expect(after.activity.filter((event) => event.kind === "approval")).toHaveLength(1);
      expect(after.externalWrite).toBe("disabled");
    });

    it("fails closed for absent, cross-tenant, agent and unprivileged human authority", async () => {
      const { repo, principal } = await setup();
      for (const identity of [null, { ...principal, tenantId: "wrong" },
        { ...principal, actorId: "agent-engineering" }, { ...principal, actorId: "actor-alice" }]) {
        expect((await repo.approve(request, identity)).ok).toBe(false);
      }
      expect((await repo.room()).decision.status).toBe("proposed");
      expect((await repo.records()).activityEvents).toHaveLength(3);
    });

    it("rolls back invalid tenant references without a partial import", async () => {
      const { store, tenant, repo } = await setup();
      await expect(store.transaction(tenant, (records) => {
        records!.workItems[0].citations = [{ sourceId: "other-tenant-source", label: "bad", excerpt: "bad" }];
        return { records: records!, result: undefined };
      })).rejects.toThrow("citation_not_in_tenant");
      expect((await repo.records()).workItems[0].citations?.[0].sourceId).not.toBe("other-tenant-source");
    });

    it("reports fresh, stale, failed and last-successful-sync independently", async () => {
      const { repo, tick } = await setup();
      expect((await repo.room()).integrations[0].lastSuccessfulSync).toBeNull();
      await repo.importSource("github", github);
      expect((await repo.room()).integrations[0].status).toBe("fresh");
      tick("2026-09-06T11:00:00Z");
      await repo.importSource("github", github);
      expect((await repo.room()).integrations[0]).toMatchObject({ status: "stale", lastSuccessfulSync: "2026-09-06T09:25:00.000Z" });
      await repo.importSource("github", { invalid: "not recorded" });
      expect((await repo.room()).integrations[0]).toMatchObject({ status: "failed", lastSuccessfulSync: "2026-09-06T09:25:00.000Z" });
      expect(JSON.stringify((await repo.records()).syncRuns)).not.toContain("not recorded");
    });
  });
}

describe("source normalization and command boundary", () => {
  it("normalizes both providers into cited domain objects with unknown owners explicitly unassigned", () => {
    const gh = githubAdapter.normalize(githubAdapter.parse(github));
    const ln = linearAdapter.normalize(linearAdapter.parse(linear));
    expect(gh.workItem).toMatchObject({ kind: "pull_request", status: "review", ownerId: "source-unassigned" });
    expect(ln.workItem).toMatchObject({ kind: "task", status: "in_progress" });
    expect(gh.workItem.citations?.[0]).toMatchObject({ url: github.pullRequest.url, sourceId: gh.source.id });
    expect(ln.workItem.citations?.[0].url).toBe(linear.issue.url);
  });
  it("rejects malformed dates, unknown fields and unsafe citation URLs", () => {
    expect(() => githubAdapter.parse({ ...github, updatedAt: "yesterday" })).toThrow();
    expect(() => githubAdapter.parse({ ...github, approve: true })).toThrow();
    for (const url of ["javascript:alert(1)", "https://github.com.evil.test/pr", "https://user:pass@github.com/pr"]) {
      expect(() => githubAdapter.parse({ ...github, pullRequest: { ...github.pullRequest, url } })).toThrow();
    }
  });
  it("allows only proposed to approved_for_sync with human approval; synced remains unreachable", () => {
    for (const current of ["proposed", "approved_for_sync", "synced"] as const) {
      for (const next of ["proposed", "approved_for_sync", "synced"] as const) {
        expect(canTransition(current, next, false)).toBe(false);
        expect(canTransition(current, next, true)).toBe(current === "proposed" && next === "approved_for_sync");
      }
    }
    const room = projectRoom(fixtureRecords(), "fixture");
    expect(approveDecision(room.decision, request).ok).toBe(false);
  });
  it("falls back only without DATABASE_URL and explicitly resets fixture approvals on refresh", async () => {
    const first = await getWorkspaceRepository({});
    await first.approve(request, { tenantId: first.tenantId, actorId: "actor-book", verifiedHuman: true });
    const refreshed = await getWorkspaceRepository({ DATABASE_URL: " " });
    expect(await refreshed.room()).toMatchObject({ mode: "fixture", persistence: "ephemeral",
      externalWrite: "disabled", decision: { status: "proposed" } });
  });
  it("rejects HTTP approval in database mode even with forged human headers", async () => {
    const store = new MemoryStore();
    const repo = new WorkspaceRepository(store, "http-test", "connected-read-only");
    await repo.seedFixture();
    const result = await handleApproval(new Request("http://localhost/api/decisions", {
      method: "POST", body: JSON.stringify(request), headers: { "x-actor-id": "actor-book", origin: "http://localhost" },
    }), repo);
    expect(result.status).toBe(403);
    expect((await repo.room()).decision.status).toBe("proposed");
  });
  it("has no provider network calls even during valid imports and human approval", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network forbidden"));
    try {
      const repo = await getWorkspaceRepository({});
      await repo.importSource("github", github);
      await repo.importSource("linear", linear);
      await repo.approve(request, { tenantId: repo.tenantId, actorId: "actor-book", verifiedHuman: true });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { fetchSpy.mockRestore(); }
  });
  it("accepts a browser-facing Host for fixture simulation and rejects cross-origin requests", async () => {
    const repo = await getWorkspaceRepository({});
    const send = (origin: string) => handleApproval(new Request("http://localhost:3411/api/decisions", {
      method: "POST", headers: { origin, host: "127.0.0.1:3411" }, body: JSON.stringify(request),
    }), repo);
    expect((await send("https://evil.example")).status).toBe(403);
    const approved = await send("http://127.0.0.1:3411");
    expect(approved.status).toBe(200);
    expect(await approved.json()).toMatchObject({ simulation: true, persistence: "ephemeral", externalWrite: "disabled" });
  });
});

describe("database constraints", () => {
  it("rolls back database constraint failures after canonical writes have started", async () => {
    const store = new PostgresStore(db);
    const repo = new WorkspaceRepository(store, "rollback-db", "connected-read-only");
    await repo.seedFixture();
    const before = await repo.records();
    await expect(store.transaction("rollback-db", (records) => {
      records!.workItems[0].title = "Must not persist";
      records!.sourceEntities.push({ ...records!.sourceEntities[0], id: "conflicting-source-identity" });
      return { records: records!, result: undefined };
    })).rejects.toThrow();
    expect(await repo.records()).toEqual(before);
  });
  it("enforces same-tenant owners and legal states even for direct SQL writes", async () => {
    const store = new PostgresStore(db);
    const repo = new WorkspaceRepository(store, "state-db", "connected-read-only");
    await repo.seedFixture();
    const record = (await repo.records()).tasks[0];
    await expect(db.update(schema.tasks).set({ data: { ...record, ownerId: "unknown-owner" } })
      .where(eq(schema.tasks.tenantId, "state-db"))).rejects.toThrow();
    await expect(db.execute(
      // Deliberately invalid JSON state; no user input or credentials involved.
      "UPDATE tasks SET data = jsonb_set(data, '{status}', '\"invalid\"') WHERE tenant_id = 'state-db'",
    )).rejects.toThrow();
  });
  it("enforces composite tenant foreign keys for citations and links", async () => {
    const store = new PostgresStore(db);
    const a = new WorkspaceRepository(store, "fk-a", "connected-read-only");
    const b = new WorkspaceRepository(store, "fk-b", "connected-read-only");
    await a.seedFixture(); await b.seedFixture(); await b.importSource("github", github);
    const sourceId = githubAdapter.normalize(githubAdapter.parse(github)).source.id;
    await expect(db.insert(schema.citations).values({ tenantId: "fk-a", entityId: request.decisionId, sourceId, excerpt: "blocked" })).rejects.toThrow();
    await expect(db.insert(schema.entityLinks).values({ tenantId: "fk-a", id: "cross", fromId: request.decisionId, toId: sourceId,
      data: { id: "cross", from: request.decisionId, to: sourceId, relation: "observes" } })).rejects.toThrow();
    expect(await db.select().from(schema.citations).where(eq(schema.citations.tenantId, "fk-a"))).not.toHaveLength(0);
  });
});
