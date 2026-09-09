import nextEnv from "@next/env";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../src/persistence/schema";
import { OfficeService } from "../src/office/service";

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL_required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
try {
  const service = new OfficeService(drizzle(pool, { schema }));
  if (await service.initialized()) throw new Error("already_initialized");
  await service.register({ username: process.env.NODAL_OWNER_USERNAME,
    name: process.env.NODAL_OWNER_NAME, password: process.env.NODAL_OWNER_PASSWORD }, true);
  console.log("First owner created. Sign in through /office. No credentials printed.");
} catch {
  console.error("Bootstrap refused or failed. Check migration, empty membership and private owner environment values.");
  process.exitCode = 1;
} finally { await pool.end(); }
