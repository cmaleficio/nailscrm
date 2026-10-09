import { describe, test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { mergeClientInto, MergeClientsError } from "./merge-clients";
import {
  createMergeTestDb,
  type TestDb,
} from "./merge-clients.test-helpers";
import * as schema from "@/db/schema";

function seedClient(
  db: TestDb,
  overrides: Partial<typeof schema.users.$inferSelect> & {
    id: string;
    email: string;
    name: string;
  }
) {
  const now = Date.now();
  const row: typeof schema.users.$inferSelect = {
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

function seedService(db: TestDb, id: string) {
  db.insert(schema.services)
    .values({
      id,
      name: "Acrílicas Full",
      price: 35,
      durationMins: 90,
      isActive: 1,
      isGroup: 0,
      isComplementary: 0,
    })
    .run();
}

function setup(db: TestDb) {
  const admin = seedClient(db, {
    id: "admin-1",
    email: "admin@salon.com",
    name: "Dueña del Salón",
    role: "admin",
  });
  const absorbed = seedClient(db, {
    id: "old-1",
    email: "ana.martinez@old.com",
    name: "Ana Martínez",
    phone: "+58 412 111 2222",
    address: "Calle vieja 123",
    passwordHash: "old-hash",
    techNotes: "Prefiere esmalte rosado",
    totalVisits: 7,
    totalRevenue: 245,
    createdAt: 1000,
  });
  const surviving = seedClient(db, {
    id: "new-1",
    email: "ana.martinez@gmail.com",
    name: "Ana Martínez",
    totalVisits: 0,
    totalRevenue: 0,
    createdAt: 2000,
  });
  seedService(db, "svc-1");

  // Cita + fotos de la absorbida
  db.insert(schema.appointments)
    .values({
      id: "appt-1",
      clientId: absorbed.id,
      serviceId: "svc-1",
      startTime: 1700000000,
      endTime: 1700000540,
      status: "completed",
    })
    .run();

  // Pago hecho por el admin (created_by debe quedar intacto)
  db.insert(schema.payments)
    .values({
      id: "pay-1",
      userId: absorbed.id,
      appointmentId: "appt-1",
      amountUsd: 35,
      currency: "USD",
      paidAt: 1700000100,
      createdBy: admin.id,
      createdAt: 1700000000,
    })
    .run();

  // Compra de servicio
  db.insert(schema.servicePurchases)
    .values({
      id: "pur-1",
      userId: absorbed.id,
      appointmentId: "appt-1",
      serviceId: "svc-1",
      serviceName: "Acrílicas Full",
      servicePrice: 35,
      serviceDurationMins: 90,
      isPrimary: 1,
      financialStatus: "paid",
      createdAt: 1700000000,
    })
    .run();

  // Captura de pago reportada por la clienta
  db.insert(schema.paymentReceipts)
    .values({
      id: "rec-1",
      clientId: absorbed.id,
      appointmentId: "appt-1",
      amountVes: 3500,
      rate: 100,
      amountUsd: 35,
      photoUrl: "/api/media/receipt/rec.jpg",
      status: "approved",
      reviewedBy: admin.id,
      createdAt: 1700000000,
    })
    .run();

  // Lista de espera
  db.insert(schema.waitlist)
    .values({
      id: "wait-1",
      clientId: absorbed.id,
      preferredDate: 1700000000,
      createdAt: 1700000000,
    })
    .run();

  // Cita cancelada archivada
  db.insert(schema.cancelledAppointments)
    .values({
      id: "canc-1",
      appointmentId: "appt-old",
      clientId: absorbed.id,
      serviceId: "svc-1",
      serviceName: "Acrílicas Full",
      servicePrice: 35,
      startTime: 1690000000,
      endTime: 1690000540,
      cancelledBy: admin.id,
      cancelledAt: 1690000000,
      reason: "No asistió",
    })
    .run();

  // Inscripción de curso
  db.insert(schema.appointments)
    .values({
      id: "course-1",
      clientId: admin.id,
      serviceId: "svc-1",
      status: "confirmed",
    })
    .run();
  db.insert(schema.courseEnrollments)
    .values({
      id: "enr-1",
      appointmentId: "course-1",
      clientId: absorbed.id,
      createdAt: 1700000000,
    })
    .run();

  // Sesión y vínculo Google de la absorbida
  db.insert(schema.sessions)
    .values({
      sessionToken: "session-old",
      userId: absorbed.id,
      expires: new Date(9999999999999),
    })
    .run();
  db.insert(schema.accounts)
    .values({
      userId: absorbed.id,
      type: "oauth",
      provider: "google",
      providerAccountId: "google-old-sub",
      access_token: "old-token",
    })
    .run();

  return { admin, absorbed, surviving };
}

describe("mergeClientInto", () => {
  test("moves all history to the surviving client and deletes the absorbed row", () => {
    const db = createMergeTestDb();
    const { absorbed, surviving } = setup(db);

    const result = mergeClientInto(db, {
      absorbedId: absorbed.id,
      survivingId: surviving.id,
      actorId: surviving.id,
      actorName: "Ana Martínez",
    });

    expect(result.movedAppointments).toBe(1);
    expect(result.movedPayments).toBe(1);
    expect(result.movedPurchases).toBe(1);
    expect(result.movedReceipts).toBe(1);
    expect(result.movedWaitlist).toBe(1);
    expect(result.movedCancelled).toBe(1);
    expect(result.movedEnrollments).toBe(1);

    // FK movidas
    expect(
      db
        .select()
        .from(schema.appointments)
        .where(eq(schema.appointments.clientId, surviving.id))
        .all()
    ).toHaveLength(1);
    expect(
      db
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.userId, surviving.id))
        .all()
    ).toHaveLength(1);
    expect(
      db
        .select()
        .from(schema.servicePurchases)
        .where(eq(schema.servicePurchases.userId, surviving.id))
        .all()
    ).toHaveLength(1);
    expect(
      db
        .select()
        .from(schema.paymentReceipts)
        .where(eq(schema.paymentReceipts.clientId, surviving.id))
        .all()
    ).toHaveLength(1);
    expect(
      db
        .select()
        .from(schema.waitlist)
        .where(eq(schema.waitlist.clientId, surviving.id))
        .all()
    ).toHaveLength(1);
    expect(
      db
        .select()
        .from(schema.cancelledAppointments)
        .where(eq(schema.cancelledAppointments.clientId, surviving.id))
        .all()
    ).toHaveLength(1);
    expect(
      db
        .select()
        .from(schema.courseEnrollments)
        .where(eq(schema.courseEnrollments.clientId, surviving.id))
        .all()
    ).toHaveLength(1);

    // Sesiones y vínculo OAuth siguen vivos, ahora en la fila que sobrevive
    expect(
      db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.userId, surviving.id))
        .all()
    ).toHaveLength(1);
    const account = db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.providerAccountId, "google-old-sub"))
      .get();
    expect(account?.userId).toBe(surviving.id);

    // Fila absorbida eliminada
    expect(
      db.select().from(schema.users).where(eq(schema.users.id, absorbed.id)).get()
    ).toBeUndefined();

    // Totales sumados
    const merged = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, surviving.id))
      .get();
    expect(merged?.totalVisits).toBe(7);
    expect(merged?.totalRevenue).toBe(245);

    // Datos copiados (la sobreviviente no los tenía)
    expect(merged?.phone).toBe("+58 412 111 2222");
    expect(merged?.address).toBe("Calle vieja 123");
    expect(merged?.passwordHash).toBe("old-hash");
    expect(merged?.techNotes).toBe("Prefiere esmalte rosado");
    expect(merged?.createdAt).toBe(1000); // created_at más antiguo

    // created_by del pago sigue siendo el admin, no la clienta
    const payment = db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.id, "pay-1"))
      .get();
    expect(payment?.createdBy).toBe("admin-1");

    // Log de auditoría
    const log = db
      .select()
      .from(schema.activityLogs)
      .where(eq(schema.activityLogs.entityId, absorbed.id))
      .get();
    expect(log?.entity).toBe("clients");
    expect(log?.action).toBe("merge");
  });

  test("keeps surviving data when both have it and appends tech notes", () => {
    const db = createMergeTestDb();
    const { absorbed, surviving } = setup(db);
    db.update(schema.users)
      .set({
        phone: "+58 424 333 4444",
        techNotes: "Prefiere uñas cortas",
        totalVisits: 3,
        totalRevenue: 100,
      })
      .where(eq(schema.users.id, surviving.id))
      .run();

    mergeClientInto(db, {
      absorbedId: absorbed.id,
      survivingId: surviving.id,
    });

    const merged = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, surviving.id))
      .get();
    // No sobrescribe el teléfono de la sobreviviente
    expect(merged?.phone).toBe("+58 424 333 4444");
    // Suma totales
    expect(merged?.totalVisits).toBe(10);
    expect(merged?.totalRevenue).toBe(345);
    // Notas concatenadas con separador fechado
    expect(merged?.techNotes).toContain("Prefiere uñas cortas");
    expect(merged?.techNotes).toContain("[Fusionado");
    expect(merged?.techNotes).toContain("Prefiere esmalte rosado");
  });

  test("drops the absorbed enrollment when both are in the same course session", () => {
    const db = createMergeTestDb();
    const { absorbed, surviving, admin } = setup(db);
    // La sobreviviente ya está inscrita en el mismo curso
    db.insert(schema.courseEnrollments)
      .values({
        id: "enr-2",
        appointmentId: "course-1",
        clientId: surviving.id,
        createdAt: 1700000001,
      })
      .run();

    const result = mergeClientInto(db, {
      absorbedId: absorbed.id,
      survivingId: surviving.id,
      actorId: admin.id,
    });

    // La inscripción absorbida se descartó (único appointment+client)
    expect(result.movedEnrollments).toBe(0);
    const enrollments = db
      .select()
      .from(schema.courseEnrollments)
      .where(eq(schema.courseEnrollments.appointmentId, "course-1"))
      .all();
    expect(enrollments).toHaveLength(1);
    expect(enrollments[0].clientId).toBe(surviving.id);
  });

  test("rejects merging a client with herself", () => {
    const db = createMergeTestDb();
    const { absorbed } = setup(db);
    expect(() =>
      mergeClientInto(db, {
        absorbedId: absorbed.id,
        survivingId: absorbed.id,
      })
    ).toThrow(MergeClientsError);
  });

  test("rejects missing rows", () => {
    const db = createMergeTestDb();
    const { absorbed } = setup(db);
    expect(() =>
      mergeClientInto(db, {
        absorbedId: absorbed.id,
        survivingId: "no-existe",
      })
    ).toThrow(MergeClientsError);
    expect(() =>
      mergeClientInto(db, {
        absorbedId: "no-existe",
        survivingId: absorbed.id,
      })
    ).toThrow(MergeClientsError);
  });

  test("rejects admin rows", () => {
    const db = createMergeTestDb();
    const { admin, absorbed } = setup(db);
    expect(() =>
      mergeClientInto(db, {
        absorbedId: absorbed.id,
        survivingId: admin.id,
      })
    ).toThrow(MergeClientsError);
    expect(() =>
      mergeClientInto(db, {
        absorbedId: admin.id,
        survivingId: absorbed.id,
      })
    ).toThrow(MergeClientsError);
  });

  test("rejects locked rows", () => {
    const db = createMergeTestDb();
    const { absorbed, surviving } = setup(db);
    db.update(schema.users)
      .set({ lockedAt: 123 })
      .where(eq(schema.users.id, absorbed.id))
      .run();
    expect(() =>
      mergeClientInto(db, {
        absorbedId: absorbed.id,
        survivingId: surviving.id,
      })
    ).toThrow(MergeClientsError);
  });

  test("requireSimilarity blocks different names", () => {
    const db = createMergeTestDb();
    const { absorbed, surviving } = setup(db);
    db.update(schema.users)
      .set({ name: "Carla Pérez" })
      .where(eq(schema.users.id, surviving.id))
      .run();

    expect(() =>
      mergeClientInto(db, {
        absorbedId: absorbed.id,
        survivingId: surviving.id,
        requireSimilarity: true,
      })
    ).toThrow(MergeClientsError);
  });

  test("admin merge works without name similarity", () => {
    const db = createMergeTestDb();
    const { absorbed, surviving, admin } = setup(db);
    db.update(schema.users)
      .set({ name: "Carla Pérez" })
      .where(eq(schema.users.id, surviving.id))
      .run();

    const result = mergeClientInto(db, {
      absorbedId: absorbed.id,
      survivingId: surviving.id,
      actorId: admin.id,
      actorName: "Dueña",
      requireSimilarity: false,
    });

    expect(result.movedAppointments).toBe(1);
    expect(
      db.select().from(schema.users).where(eq(schema.users.id, absorbed.id)).get()
    ).toBeUndefined();
  });

  test("self-claim accepts similar names with typos", () => {
    const db = createMergeTestDb();
    const { absorbed, surviving } = setup(db);
    db.update(schema.users)
      .set({ name: "Ana Marínez" }) // typo de 1 carácter
      .where(eq(schema.users.id, surviving.id))
      .run();

    const result = mergeClientInto(db, {
      absorbedId: absorbed.id,
      survivingId: surviving.id,
      requireSimilarity: true,
    });
    expect(result.movedPayments).toBe(1);
  });
});
