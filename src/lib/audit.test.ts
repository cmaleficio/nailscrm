import { describe, expect, test } from "vitest";
import { createTestDb } from "@/lib/account-link.test-helpers";
import * as schema from "@/db/schema";
import { logActivity, listActivityActors, listActivityLogs } from "@/lib/audit";

describe("audit", () => {
  function createAuditDb() {
    const db = createTestDb();
    db.$client.exec(`CREATE TABLE activity_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT,
      actor_name TEXT,
      entity TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_id TEXT,
      label TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL
    )`);
    return db;
  }

  const seedActor = (db: ReturnType<typeof createTestDb>) =>
    db
      .insert(schema.users)
      .values({ id: "u-1", name: "Ana Admin", email: "ana@admin.com" })
      .run();

  test("logActivity inserta una fila con timestamp unix", () => {
    const db = createAuditDb();
    seedActor(db);
    logActivity(db, { entity: "appointment", action: "create", entityId: "appt-1", label: "Creaste una cita para Ana", actorId: "u-1", actorName: "Ana Admin" });
    const rows = db.select().from(schema.activityLogs).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].entity).toBe("appointment");
    expect(rows[0].action).toBe("create");
    expect(rows[0].entityId).toBe("appt-1");
    expect(rows[0].label).toBe("Creaste una cita para Ana");
    expect(rows[0].metadata).toBeNull();
    expect(rows[0].createdAt).toBeGreaterThan(1_700_000_000);
  });

  test("logActivity NO lanza aunque la tabla no exista (best-effort)", () => {
    const db = createTestDb();
    expect(() => logActivity(db, { entity: "service", action: "delete", label: "Borraste un servicio" })).not.toThrow();
  });

  test("logActivity serializa metadata a JSON", () => {
    const db = createAuditDb();
    seedActor(db);
    logActivity(db, { entity: "payment", action: "mark_payed", entityId: "pay-1", label: "Registraste un pago", metadata: { amountUsd: 35, currency: "USD" }, actorId: "u-1" });
    const row = db.select().from(schema.activityLogs).get()!;
    expect(JSON.parse(row.metadata!)).toEqual({ amountUsd: 35, currency: "USD" });
  });

  test("listActivityLogs filtra por entidad, acción y actor", () => {
    const db = createAuditDb();
    seedActor(db);
    logActivity(db, { entity: "appointment", action: "create", entityId: "a1", label: "Creaste una cita", actorId: "u-1", actorName: "Ana Admin" });
    logActivity(db, { entity: "service", action: "delete", entityId: "s1", label: "Borraste un servicio", actorId: "u-1", actorName: "Ana Admin" });
    logActivity(db, { entity: "appointment", action: "complete", entityId: "a2", label: "Completaste una cita", actorName: "Walk-in" });

    const byEntity = listActivityLogs(db, { entity: "appointment" });
    expect(byEntity.total).toBe(2);
    expect(byEntity.hasMore).toBe(false);

    const byActor = listActivityLogs(db, { actorId: "u-1" });
    expect(byActor.total).toBe(2);

    const byAction = listActivityLogs(db, { action: "delete" });
    expect(byAction.total).toBe(1);
    expect(byAction.items[0].entity).toBe("service");
  });

  test("listActivityLogs pagina con limit y nextOffset", () => {
    const db = createAuditDb();
    seedActor(db);
    for (let i = 0; i < 5; i++) {
      logActivity(db, { entity: "appointment", action: "create", entityId: `a${i}`, label: `Cita ${i}`, actorId: "u-1" });
    }
    const page1 = listActivityLogs(db, { limit: 2, offset: 0 });
    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBe(5);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextOffset).toBe(2);

    const page3 = listActivityLogs(db, { limit: 2, offset: 4 });
    expect(page3.items).toHaveLength(1);
    expect(page3.hasMore).toBe(false);
    expect(page3.nextOffset).toBeNull();
  });

  test("listActivityActors agrupa por actor y ordena por última actividad desc", async () => {
    const db = createAuditDb();
    db.$client.exec(`INSERT INTO users (id, name, email) VALUES ('u-1', 'Ana', 'a@x.com'), ('u-2', 'Betty', 'b@x.com')`);
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    logActivity(db, { entity: "appointment", action: "create", label: "x", actorId: "u-1", actorName: "Ana" });
    await sleep(5);
    logActivity(db, { entity: "payment", action: "mark_payed", label: "y", actorId: "u-1", actorName: "Ana" });
    await sleep(5);
    logActivity(db, { entity: "service", action: "update", label: "z", actorId: "u-2", actorName: "Betty" });

    const actors = listActivityActors(db) as Array<{ actorId: string; actorName: string | null }>;
    expect(actors.map((a) => a.actorId)).toEqual(["u-1", "u-2"]);
  });
});