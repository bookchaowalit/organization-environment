import nextEnv from "@next/env";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { PostgresStore } from "../src/persistence/postgres-store";
import { WorkspaceRepository } from "../src/persistence/repository";
import { PILOT_TENANT } from "../src/domain/workspace";
import * as schema from "../src/persistence/schema";
import github from "../src/adapters/fixtures/github.json";
import linear from "../src/adapters/fixtures/linear.json";

nextEnv.loadEnvConfig(process.cwd());
const action = process.argv[2];
if (!["migrate", "seed", "import-fixtures"].includes(action)) throw new Error("unsupported_database_command");
const url = action === "migrate" ? process.env.DATABASE_URL_UNPOOLED : process.env.DATABASE_URL;
if (!url) throw new Error(action === "migrate" ? "DATABASE_URL_UNPOOLED_required" : "DATABASE_URL_required");
const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 5000 });
try {
  const db = drizzle(pool, { schema });
  const repository = new WorkspaceRepository(new PostgresStore(db), PILOT_TENANT, "connected-read-only");
  if (action === "migrate") await migrate(db, { migrationsFolder: "./drizzle" });
  if (action === "seed") await repository.seedFixture();
  if (action === "import-fixtures") {
    await repository.importSource("github", github);
    await repository.importSource("linear", linear);
  }
  console.log(`${action} completed · local source fixtures only · externalWrite: disabled`);
} catch {
  console.error("Database command failed. Check connection, migration and seed setup locally.");
  process.exitCode = 1;
} finally { await pool.end(); }
