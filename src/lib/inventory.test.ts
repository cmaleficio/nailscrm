import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/db/index", async () => {
  const { createInventoryTestDb } = await import("./inventory.test-helpers");
  const schema = await import("@/db/schema");
  return { db: createInventoryTestDb(), schema };
});

import { db, schema } from "@/db/index";
import { createInventoryIn, recordUsage, setExhausted } from "@/lib/inventory";
import { eq } from "drizzle-orm";

const ADMIN_ID = "test-admin-id";
const CLIENT_ID = "test-client-id";

beforeEach(() => {
  db.delete(schema.appointmentUsage).run();
  db.delete(schema.inventoryMovements).run();
  db.delete(schema.inventoryItems).run();
  db.delete(schema.appointments).run();
  db.delete(schema.services).run();
  db.delete(schema.users).run();

  db.insert(schema.users).values({
    id: ADMIN_ID,
    name: "Test Admin",
    email: "admin@test.com",
    role: "admin",
  }).run();
  db.insert(schema.users).values({
    id: CLIENT_ID,
    name: "Test Client",
    email: "client@test.com",
    role: "client",
  }).run();
  db.insert(schema.services).values({
    id: "svc-1",
    name: "Test Service",
    price: 10,
    durationMins: 30,
  }).run();
  for (const apptId of ["appt-1", "appt-2", "appt-3"]) {
    db.insert(schema.appointments).values({
      id: apptId,
      clientId: CLIENT_ID,
      serviceId: "svc-1",
    }).run();
  }
});

describe("createInventoryIn with maxUses", () => {
  it("increments maxUses by qty and resets usesConsumed", () => {
    const itemId = "TEST-001";
    db.insert(schema.inventoryItems).values({
      id: itemId,
      name: "Test Product",
      unit: "ml",
      stock: 0,
      avgCost: 0,
      minStock: 0,
      maxUses: 30,
      usesConsumed: 25,
      totalUses: 50,
      isExhausted: 0,
    }).run();

    createInventoryIn(itemId, 10, 5.0, "manual", null, "Test entry", ADMIN_ID);

    const item = db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.id, itemId)).get();
    expect(item?.maxUses).toBe(40);
    expect(item?.usesConsumed).toBe(0);
    expect(item?.totalUses).toBe(50);
    expect(item?.isExhausted).toBe(0);
  });

  it("preserves totalUses when adding stock", () => {
    const itemId = "TEST-002";
    db.insert(schema.inventoryItems).values({
      id: itemId,
      name: "Test Product 2",
      unit: "ml",
      stock: 0,
      avgCost: 0,
      minStock: 0,
      maxUses: 20,
      usesConsumed: 15,
      totalUses: 100,
      isExhausted: 0,
    }).run();

    createInventoryIn(itemId, 5, 3.0, "manual", null, "Test entry", ADMIN_ID);

    const item = db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.id, itemId)).get();
    expect(item?.totalUses).toBe(100);
  });
});

describe("recordUsage", () => {
  it("increments both usesConsumed and totalUses", () => {
    const itemId = "TEST-003";
    db.insert(schema.inventoryItems).values({
      id: itemId,
      name: "Test Product 3",
      unit: "ml",
      stock: 10,
      avgCost: 0,
      minStock: 0,
      maxUses: 30,
      usesConsumed: 5,
      totalUses: 10,
      isExhausted: 0,
    }).run();

    recordUsage("appt-1", [{ inventoryItemId: itemId, quantity: 1 }], ADMIN_ID);

    const item = db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.id, itemId)).get();
    expect(item?.usesConsumed).toBe(6);
    expect(item?.totalUses).toBe(11);
  });

  it("adjusts maxUses up when usesConsumed exceeds it", () => {
    const itemId = "TEST-004";
    db.insert(schema.inventoryItems).values({
      id: itemId,
      name: "Test Product 4",
      unit: "ml",
      stock: 10,
      avgCost: 0,
      minStock: 0,
      maxUses: 5,
      usesConsumed: 5,
      totalUses: 5,
      isExhausted: 1,
    }).run();

    recordUsage("appt-2", [{ inventoryItemId: itemId, quantity: 1 }], ADMIN_ID);

    const item = db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.id, itemId)).get();
    expect(item?.usesConsumed).toBe(6);
    expect(item?.maxUses).toBe(6);
    expect(item?.isExhausted).toBe(1);
  });

  it("sets isExhausted to 0 when usesConsumed is below maxUses", () => {
    const itemId = "TEST-005";
    db.insert(schema.inventoryItems).values({
      id: itemId,
      name: "Test Product 5",
      unit: "ml",
      stock: 10,
      avgCost: 0,
      minStock: 0,
      maxUses: 10,
      usesConsumed: 3,
      totalUses: 3,
      isExhausted: 0,
    }).run();

    recordUsage("appt-3", [{ inventoryItemId: itemId, quantity: 1 }], ADMIN_ID);

    const item = db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.id, itemId)).get();
    expect(item?.isExhausted).toBe(0);
  });
});

describe("setExhausted", () => {
  it("resets usesConsumed to 0 when reopening but preserves totalUses", () => {
    const itemId = "TEST-006";
    db.insert(schema.inventoryItems).values({
      id: itemId,
      name: "Test Product 6",
      unit: "ml",
      stock: 0,
      avgCost: 0,
      minStock: 0,
      maxUses: 30,
      usesConsumed: 30,
      totalUses: 100,
      isExhausted: 1,
    }).run();

    setExhausted(itemId, false, ADMIN_ID);

    const item = db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.id, itemId)).get();
    expect(item?.isExhausted).toBe(0);
    expect(item?.usesConsumed).toBe(0);
    expect(item?.totalUses).toBe(100);
  });
});
