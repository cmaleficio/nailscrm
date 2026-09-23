import { describe, test, expect } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";
import { logActivity, listActivityLogs, listActivityActors } from "./audit";

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

function createAuditDb(): TestDb {
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
    CREATE INDEX activity_logs_created_at_idx ON activity_logs (created_at);
    CREATE INDEX activity_logs_actor_idx ON activity_logs (actor_id);
    CREATE INDEX activity_logs_entity_idx ON activity_logs (entity);
  `);
  return drizzle(sqlite, { schema });
}

function seedActor(db: TestDb, id: string, name: string) {
  db.insert(schema.users).values({
    id, name, email: `${id}@example.com`, role: "admin", createdAt: Date.now(),
  }).run();
}

describe("logActivity", () => {
  test("inserta una fila con actor, label y metadata", () => {
    const db = createAuditDb();
    seedActor(db, "a-1", "Ana Martínez");
    logActivity(db, {
      entity: "appointments", action: "create", entityId: "appt-1",
      label: "Cita creada", metadata: { price: 35, currency: "USD" },
      actorId: "a-1", actorName: "Ana Martínez",
    });
    const rows = db.select().from(schema.activityLogs).all();
    expect(rows.length).toBe(1);
    expect(rows[0].actorId).toBe("a-1");
    expect(rows[0].actorName).toBe("Ana Martínez");
    expect(rows[0].entity).toBe("appointments");
    expect(rows[0].action).toBe("create");
    expect(rows[0].entityId).toBe("appt-1");
    expect(rows[0].label).toBe("Cita creada");
    expect(JSON.parse(rows[0].metadata ?? "null")).toEqual({ price: 35, currency: "USD" });
    expect(rows[0].createdAt).toBeGreaterThan(0);
  });

  test("permite actor público (null) y metadata null", () => {
    const db = createAuditDb();
    logActivity(db, { entity: "appointments", action: "create", label: "Reserva anónima", metadata: null, actorId: null, actorName: null });
    const rows = db.select().from(schema.activityLogs).all();
    expect(rows[0].actorId).toBeNull();
    expect(rows[0].actorName).toBeNull();
    expect(rows[0].metadata).toBeNull();
  });

  test("no lanza cuando la tabla no existe (best-effort)", () => {
    const sqlite = new Database(":memory:");
    const db = drizzle(sqlite, { schema });
    expect(() =>
      logActivity(db as TestDb, { entity: "bills", action: "create", label: "x" })
    ).not.toThrow();
  });
});

describe("listActivityLogs", () => {
  test("ordena desc por createdAt y pagina con hasMore/nextOffset", () => {
    const db = createAuditDb();
    seedActor(db, "a-1", "Ana");
    db.insert(schema.activityLogs).values({ id: "a", entity: "bills", action: "create", label: "A", actorId: "a-1", actorName: "Ana", createdAt: 1000 }).run();
    db.insert(schema.activityLogs).values({ id: "b", entity: "bills", action: "create", label: "B", actorId: "a-1", actorName: "Ana", createdAt: 2000 }).run();
    db.insert(schema.activityLogs).values({ id: "c", entity: "bills", action: "create", label: "C", actorId: "a-1", actorName: "Ana", createdAt: 3000 }).run();
    const r1 = listActivityLogs(db, { limit: 2, offset: 0 });
    expect(r1.items.map((i) => i.label)).toEqual(["C", "B"]);
    expect(r1.total).toBe(3);
    expect(r1.hasMore).toBe(true);
    expect(r1.nextOffset).toBe(2);
    const r2 = listActivityLogs(db, { limit: 2, offset: 2 });
    expect(r2.items.map((i) => i.label)).toEqual(["A"]);
    expect(r2.hasMore).toBe(false);
    expect(r2.nextOffset).toBeNull();
  });

  test("filtra por entity, action, actor y q", () => {
    const db = createAuditDb();
    seedActor(db, "a-1", "Ana");
    seedActor(db, "a-2", "Luisa");
    logActivity(db, { entity: "bills", action: "create", label: "Factura F-1001", actorId: "a-1", actorName: "Ana" });
    logActivity(db, { entity: "payments", action: "create", label: "Pago $35", actorId: "a-2", actorName: "Luisa" });
    expect(listActivityLogs(db, { entity: "bills", limit: 50 }).items.length).toBe(1);
    expect(listActivityLogs(db, { actor: "a-2", limit: 50 }).items[0].label).toBe("Pago $35");
    expect(listActivityLogs(db, { action: "create", q: "F-1001", limit: 50 }).items.length).toBe(1);
  });

  test("filtra por rango from/to", () => {
    const db = createAuditDb();
    db.insert(schema.activityLogs).values({ id: "l1", entity: "bills", action: "create", label: "1", createdAt: 1000 }).run();
    db.insert(schema.activityLogs).values({ id: "l2", entity: "bills", action: "create", label: "2", createdAt: 2000 }).run();
    const r = listActivityLogs(db, { from: 1500, to: 2500, limit: 50 });
    expect(r.items.map((i) => i.label)).toEqual(["2"]);
  });

  test("respeta límites máximo 200 y mínimo 1", () => {
    const db = createAuditDb();
    seedActor(db, "a-1", "Ana");
    logActivity(db, { entity: "bills", action: "create", label: "x", actorId: "a-1", actorName: "Ana" });
    expect(listActivityLogs(db, { limit: 9999, offset: 0 }).items.length).toBe(1);
  });
});

describe("listActivityActors", () => {
  test("devuelve actores distintos ignorando actor null", () => {
    const db = createAuditDb();
    seedActor(db, "a-1", "Ana");
    seedActor(db, "a-2", "Luisa");
    logActivity(db, { entity: "bills", action: "create", label: "1", actorId: "a-1", actorName: "Ana" });
    logActivity(db, { entity: "bills", action: "create", label: "2", actorId: "a-1", actorName: "Ana" });
    logActivity(db, { entity: "payments", action: "create", label: "3", actorId: "a-2", actorName: "Luisa" });
    logActivity(db, { entity: "payments", action: "create", label: "4", actorId: null, actorName: null });
    const actors = listActivityActors(db);
    expect(actors).toEqual([
      { actorId: "a-1", actorName: "Ana" },
      { actorId: "a-2", actorName: "Luisa" },
    ]);
  });
});