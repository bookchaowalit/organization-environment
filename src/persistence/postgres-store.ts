import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { WorkspaceRecords } from "../domain/types";
import { validateRecords } from "../domain/workspace";
import type { WorkspaceStore } from "./store";
import * as schema from "./schema";

type Database = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
const tables = {
  rooms: schema.rooms, actors: schema.actors, workItems: schema.workItems,
  meetings: schema.meetings, decisions: schema.decisions, tasks: schema.tasks,
  activityEvents: schema.activityEvents, sourceEntities: schema.sourceEntities,
  entityLinks: schema.entityLinks, syncRuns: schema.syncRuns,
};

async function readRecords(db: Transaction, tenantId: string): Promise<WorkspaceRecords | null> {
  const [organization] = await db.select().from(schema.organizations).where(eq(schema.organizations.tenantId, tenantId));
  if (!organization) return null;
  const records = { organization: organization.data } as WorkspaceRecords;
  for (const key of Object.keys(tables) as Array<keyof typeof tables>) {
    const table = tables[key];
    const rows = await db.select({ data: table.data }).from(table).where(eq(table.tenantId, tenantId)).orderBy(table.id);
    // The table map is the canonical mapping for this bounded aggregate.
    Object.assign(records, { [key]: rows.map((row) => row.data) });
  }
  return records;
}

export class PostgresStore implements WorkspaceStore {
  constructor(private readonly db: Database) {}
  async read(tenantId: string) {
    return this.db.transaction((tx) => readRecords(tx, tenantId),
      { isolationLevel: "repeatable read", accessMode: "read only" });
  }
  async transaction<T>(tenantId: string, change: (records: WorkspaceRecords | null) =>
    { records: WorkspaceRecords; result: T }): Promise<T> {
    return this.db.transaction(async (tx) => {
      // Serializes seed/import/approval for one tenant, including separate app processes.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${tenantId}, 0))`);
      const next = change(await readRecords(tx, tenantId));
      validateRecords(tenantId, next.records);
      await tx.insert(schema.organizations).values({ tenantId, data: next.records.organization })
        .onConflictDoNothing();
      const entityIds = new Set([tenantId, ...(Object.keys(tables) as Array<keyof typeof tables>).flatMap((key) => next.records[key].map((record) => record.id))]);
      for (const id of entityIds) await tx.insert(schema.entities).values({ tenantId, id }).onConflictDoNothing();
      for (const data of next.records.sourceEntities) {
        await tx.insert(schema.sourceEntities).values({ tenantId, id: data.id,
          provider: data.provider, externalId: data.externalId, data })
          .onConflictDoUpdate({ target: [schema.sourceEntities.tenantId, schema.sourceEntities.id], set: { data } });
      }
      // Individual canonical tables, never a serialized EngineeringRoom snapshot.
      for (const key of ["rooms", "actors", "workItems", "meetings", "decisions", "tasks", "activityEvents"] as const) {
        const table = tables[key];
        for (const data of next.records[key]) {
          const insert = tx.insert(table).values({ tenantId, id: data.id, data });
          if (key === "activityEvents") await insert.onConflictDoNothing();
          else await insert.onConflictDoUpdate({ target: [table.tenantId, table.id], set: { data } });
        }
      }
      for (const data of next.records.entityLinks) {
        await tx.insert(schema.entityLinks).values({ tenantId, id: data.id, fromId: data.from, toId: data.to, data })
          .onConflictDoNothing();
      }
      for (const data of next.records.syncRuns) {
        await tx.insert(schema.syncRuns).values({ tenantId, id: data.id, provider: data.provider, eventId: data.eventId, data })
          .onConflictDoNothing();
      }
      for (const entity of [...next.records.workItems, ...next.records.decisions, ...next.records.tasks, ...next.records.activityEvents]) {
        for (const citation of entity.citations ?? []) {
          await tx.insert(schema.citations).values({ tenantId, entityId: entity.id, sourceId: citation.sourceId, excerpt: citation.excerpt })
            .onConflictDoNothing();
        }
      }
      return next.result;
    });
  }
}
