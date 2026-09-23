import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;
export type UserRow = typeof schema.users.$inferSelect;

export function createTestDb(): TestDb {
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
  `);

  return drizzle(sqlite, { schema });
}

export function seedUser(
  db: TestDb,
  overrides: Partial<UserRow> & { id: string; email: string; name: string },
): UserRow {
  const now = Date.now();
  const row: UserRow = {
    emailVerified: null,
    image: null,
    phone: null,
    address: null,
    passwordHash: null,
    googleId: null,
    techNotes: null,
    totalVisits: 0,
    totalRevenue: 0,
    role: "client",
    permissions: null,
    lockedAt: null,
    lockedReason: null,
    createdAt: now,
    ...overrides,
  };
  db.insert(schema.users).values(row).run();
  return row;
}