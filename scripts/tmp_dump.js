import Database from "better-sqlite3";

const db = new Database("C:\\Users\\Cmarffisis\\CODE\\nails\\dev.db", { readonly: true });
const tables = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
).all();
for (const t of tables) {
  const name = String(t.name);
  const rows = db.prepare(`SELECT * FROM "${name}"`).all();
  console.log(`\n=== TABLE ${name} (${rows.length}) ===`);
  for (const r of rows) {
    console.log(Object.values(r).map((v) => (v === null ? "NULL" : typeof v === "object" ? JSON.stringify(v) : String(v))).join(" | "));
  }
}
db.close();
