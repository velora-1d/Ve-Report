import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ||
  "mysql://root:password@localhost:3306/ve_report";

const globalQueryClient = globalThis as unknown as {
  queryClient: mysql.Pool | undefined;
};

if (!globalQueryClient.queryClient) {
  globalQueryClient.queryClient = mysql.createPool({
    uri: connectionString,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 60000,
    queueLimit: 0,
  });
}

export const db = drizzle(globalQueryClient.queryClient, { schema });
