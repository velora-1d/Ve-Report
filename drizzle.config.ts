import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL || "mysql://root:password@localhost:3306/ve_report";

// Parse URL manually to extract host, user, password, port, database for strict SSL handling
const urlPattern = /^mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/;
const match = databaseUrl.match(urlPattern);

const dbCredentials = match
  ? {
      user: match[1],
      password: match[2],
      host: match[3],
      port: parseInt(match[4], 10),
      database: match[5],
      ssl: {
        rejectUnauthorized: false,
      },
    }
  : {
      url: databaseUrl,
      ssl: {
        rejectUnauthorized: false,
      },
    };

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "mysql",
  dbCredentials,
});
