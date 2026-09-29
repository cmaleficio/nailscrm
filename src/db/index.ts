import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";
import { foldSearchText } from "@/lib/production-photos";

const sqlite = new Database("dev.db");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// LIKE de SQLite no ignora diacríticos, así que el buscador de clientas del
// archivo de producción compara contra esta función y no contra la columna.
sqlite.function("fold", { deterministic: true }, foldSearchText);

export const db = drizzle(sqlite, { schema });
export { schema };
