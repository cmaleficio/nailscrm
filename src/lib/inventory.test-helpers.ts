import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

/**
 * BD de memoria con las tablas que toca inventario (mismo DDL que
 * src/db/schema.ts, simplificado a lo que importa: PK, FK y unique indexes).
 *
 * Se usa con vi.mock("@/db/index") en inventory.test.ts para que los tests
 * nunca toquen dev.db: el beforeEach borra tablas enteras, lo que contra la
 * BD real reventaría con FK (y sin FK borraría los productos del salón).
 */
export function createInventoryTestDb(): TestDb {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");

  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      emailVerified INTEGER,
      image TEXT,
      phone TEXT,
      address TEXT,
      password_hash TEXT,
      google_id TEXT,
      tech_notes TEXT,
      total_visits INTEGER DEFAULT 0,
      total_revenue REAL DEFAULT 0,
      role TEXT NOT NULL DEFAULT 'client',
      permissions TEXT,
      locked_at INTEGER,
      locked_reason TEXT,
      created_at INTEGER
    );
    CREATE TABLE services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      duration_mins INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      is_group INTEGER NOT NULL DEFAULT 0,
      is_complementary INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE appointments (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES users(id),
      service_id TEXT NOT NULL REFERENCES services(id),
      start_time INTEGER,
      end_time INTEGER,
      status TEXT DEFAULT 'pending',
      reference_photo_url TEXT,
      final_photo_url TEXT,
      shared_to_gallery INTEGER DEFAULT 0,
      review_rating INTEGER,
      review_text TEXT,
      google_event_id_client TEXT,
      google_event_id_admin TEXT,
      created_at INTEGER
    );
    CREATE TABLE inventory_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT 'unidad',
      stock REAL NOT NULL DEFAULT 0,
      avg_cost REAL NOT NULL DEFAULT 0,
      min_stock REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      barcode TEXT,
      photo_url TEXT,
      category TEXT,
      subcategory TEXT,
      max_uses INTEGER,
      uses_consumed INTEGER NOT NULL DEFAULT 0,
      total_uses INTEGER NOT NULL DEFAULT 0,
      is_exhausted INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER
    );
    CREATE TABLE inventory_movements (
      id TEXT PRIMARY KEY,
      inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id),
      kind TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_cost_usd REAL,
      ref_type TEXT NOT NULL DEFAULT 'manual',
      ref_id TEXT,
      notes TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER
    );
    CREATE INDEX inventory_movements_item_idx ON inventory_movements (inventory_item_id);
    CREATE TABLE appointment_usage (
      id TEXT PRIMARY KEY,
      appointment_id TEXT REFERENCES appointments(id) ON DELETE CASCADE,
      inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id),
      quantity REAL NOT NULL DEFAULT 1
    );
    CREATE UNIQUE INDEX appointment_usage_unique_idx ON appointment_usage (appointment_id, inventory_item_id);
  `);

  return drizzle(sqlite, { schema });
}
