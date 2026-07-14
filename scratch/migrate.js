import mysql from "mysql2/promise";
import fs from "fs";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

function loadDatabaseUrl() {
  const envContent = fs.readFileSync(".env", "utf8");
  const lines = envContent.split("\n");
  for (const line of lines) {
    if (line.trim().startsWith("DATABASE_URL=")) {
      let url = line.trim().substring("DATABASE_URL=".length);
      if (url.startsWith('"') && url.endsWith('"')) {
        url = url.substring(1, url.length - 1);
      } else if (url.startsWith("'") && url.endsWith("'")) {
        url = url.substring(1, url.length - 1);
      }
      return url;
    }
  }
  return null;
}

const connectionString = loadDatabaseUrl();
if (!connectionString) {
  console.error("DATABASE_URL is not defined in .env");
  process.exit(1);
}

async function run() {
  console.log("Connecting...");
  const connection = await mysql.createConnection({
    uri: connectionString,
    ssl: { rejectUnauthorized: false },
  });
  const db = drizzle(connection);

  try {
    console.log("Migrating...");
    await migrate(db, { migrationsFolder: "./drizzle/migrations" });
    console.log("Migration complete!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await connection.end();
  }
}

run();
