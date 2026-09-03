import Database from "better-sqlite3";
import { readFileSync } from "fs";

const db = new Database("dev.db");
const sql = readFileSync("drizzle/0020_risc_events.sql", "utf8");

const statements = sql
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);

for (const stmt of statements) {
  const firstLine = stmt.split("\n")[0].trim();
  if (stmt.startsWith("CREATE TABLE")) {
    const tableName = firstLine.match(/CREATE TABLE `(\w+)`/)?.[1];
    if (!tableName) throw new Error(`Cannot parse table: ${firstLine}`);
    const exists = db
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
      .get(tableName);
    if (exists) {
      console.log(`skip: table ${tableName} already exists`);
      continue;
    }
    console.log(`create table: ${tableName}`);
  } else if (stmt.startsWith("ALTER TABLE")) {
    const match = stmt.match(/ALTER TABLE `(\w+)` ADD `(\w+)`/);
    if (!match) throw new Error(`Cannot parse alter: ${firstLine}`);
    const [, tableName, colName] = match;
    const cols = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
    if (cols.some((c) => c.name === colName)) {
      console.log(`skip: column ${tableName}.${colName} already exists`);
      continue;
    }
    console.log(`add column: ${tableName}.${colName}`);
  }
  db.exec(stmt);
}

db.close();
console.log("done");