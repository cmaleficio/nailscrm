import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

/**
 * BD de memoria con las tablas que toca la fusión de
 * clientas (mismo DDL que src/db/schema.ts, simplificado
 * a lo que importa: PK, FK y unique indexes).
 */
export function createMergeTestDb(): TestDb {
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
      is_group INTEGER DEFAULT 0,
      is_complementary INTEGER DEFAULT 0
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
    CREATE TABLE account (
      userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      provider TEXT NOT NULL,
      providerAccountId TEXT NOT NULL,
      refresh_token TEXT,
      access_token TEXT,
      expires_at INTEGER,
      token_type TEXT,
      scope TEXT,
      id_token TEXT,
      session_state TEXT,
      PRIMARY KEY (provider, providerAccountId)
    );
    CREATE TABLE session (
      sessionToken TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires INTEGER NOT NULL
    );
    CREATE TABLE payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
      amount_usd REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      amount_ves REAL,
      rate REAL,
      reference TEXT,
      photo_url TEXT,
      paid_at INTEGER,
      notes TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER
    );
    CREATE TABLE service_purchases (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      appointment_id TEXT REFERENCES appointments(id) ON DELETE CASCADE,
      service_id TEXT REFERENCES services(id),
      service_name TEXT NOT NULL,
      service_description TEXT,
      service_price REAL NOT NULL,
      service_duration_mins INTEGER NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 1,
      financial_status TEXT NOT NULL DEFAULT 'pending',
      completion_date INTEGER,
      created_at INTEGER
    );
    CREATE TABLE payment_receipts (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES users(id),
      appointment_id TEXT REFERENCES appointments(id),
      amount_ves REAL NOT NULL,
      rate REAL NOT NULL,
      amount_usd REAL NOT NULL,
      photo_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by TEXT REFERENCES users(id),
      reviewed_at INTEGER,
      review_notes TEXT,
      payment_id TEXT REFERENCES payments(id),
      created_at INTEGER
    );
    CREATE TABLE waitlist (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES users(id),
      preferred_date INTEGER,
      notified INTEGER DEFAULT 0,
      created_at INTEGER
    );
    CREATE TABLE cancelled_appointments (
      id TEXT PRIMARY KEY,
      appointment_id TEXT,
      client_id TEXT NOT NULL REFERENCES users(id),
      service_id TEXT REFERENCES services(id),
      service_name TEXT NOT NULL,
      service_price REAL NOT NULL DEFAULT 0,
      service_items TEXT,
      start_time INTEGER,
      end_time INTEGER,
      reference_photo_urls TEXT,
      cancelled_by TEXT NOT NULL REFERENCES users(id),
      cancelled_at INTEGER NOT NULL,
      reason TEXT
    );
    CREATE TABLE course_enrollments (
      id TEXT PRIMARY KEY,
      appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL,
      UNIQUE (appointment_id, client_id)
    );
    CREATE TABLE activity_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT REFERENCES users(id),
      actor_name TEXT,
      entity TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_id TEXT,
      label TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      updated_by TEXT REFERENCES users(id)
    );
  `);

  return drizzle(sqlite, { schema });
}
