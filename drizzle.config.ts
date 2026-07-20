// ponytail: Migrasi konfigurasi drizzle-kit dari MySQL ke PostgreSQL
import { defineConfig } from "drizzle-kit";

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://postgres:password@localhost:5432/ve_report";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
    ssl: {
      rejectUnauthorized: false,
    },
  },
});

