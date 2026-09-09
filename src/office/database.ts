import { Pool } from "pg";
import { drizzle as postgres } from "drizzle-orm/node-postgres";
import { drizzle as embedded } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { PGlite } from "@electric-sql/pglite";
import { mkdir } from "node:fs/promises";
import * as schema from "../persistence/schema";

export type OfficeDatabase = ReturnType<typeof postgres<typeof schema>> | ReturnType<typeof embedded<typeof schema>>;
const cache = globalThis as typeof globalThis & { nodalOfficeDb?: Promise<OfficeDatabase> };
export function officeEnabled() { return Boolean(process.env.DATABASE_URL || process.env.NODAL_LOCAL_PILOT === "1"); }
export function officeDatabase(): Promise<OfficeDatabase> {
  if (!officeEnabled()) throw new Error("office_not_configured");
  cache.nodalOfficeDb ??= (async () => {
    if (process.env.DATABASE_URL) return postgres(new Pool({
      connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 5000,
      statement_timeout: 10000,
    }), { schema });
    // Explicit opt-in local office mode: durable local data, single Node process.
    const directory = process.env.NODAL_LOCAL_DATA_DIR ?? ".nodal/office";
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const db = embedded(new PGlite(directory), { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    return db;
  })();
  return cache.nodalOfficeDb;
}
