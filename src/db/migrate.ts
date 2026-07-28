import Database from "better-sqlite3";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const db = new Database("dev.db");
db.pragma("journal_mode = WAL");

const migrationsDir = join(process.cwd(), "drizzle");

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const file of files) {
  const sql = readFileSync(join(migrationsDir, file), "utf-8");
  console.log(`Running migration: ${file}`);
  db.exec(sql);
}

console.log("✅ Migrations complete!");
db.close();
