// ponytail: Migrasi koneksi database ke PostgreSQL menggunakan node-postgres (pg.Pool)
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:password@localhost:5432/ve_report";

const globalQueryClient = globalThis as unknown as {
  queryClient: pg.Pool | undefined;
};

if (!globalQueryClient.queryClient) {
  globalQueryClient.queryClient = new pg.Pool({
    connectionString,
    ssl: connectionString.includes("localhost")
      ? false
      : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 60000,
  });
}

export const db = drizzle(globalQueryClient.queryClient, { schema });

