import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { PILOT_TENANT } from "../domain/workspace";
import { MemoryStore } from "./store";
import { PostgresStore } from "./postgres-store";
import { WorkspaceRepository } from "./repository";
import * as schema from "./schema";

let pool: Pool | undefined;
export async function getWorkspaceRepository(env: { DATABASE_URL?: string } = { DATABASE_URL: process.env.DATABASE_URL }) {
  if (!env.DATABASE_URL?.trim()) {
    const repository = new WorkspaceRepository(new MemoryStore(), PILOT_TENANT, "fixture");
    await repository.seedFixture();
    return repository;
  }
  pool ??= new Pool({ connectionString: env.DATABASE_URL, max: 4, connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000, statement_timeout: 10000 });
  return new WorkspaceRepository(new PostgresStore(drizzle(pool, { schema })), PILOT_TENANT, "connected-read-only");
}
