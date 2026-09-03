import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";

export function createInventoryIn(
  itemId: string,
  qty: number,
  unitCostUsd: number,
  refType: "bill" | "manual",
  refId: string | null,
  notes: string | null,
  createdBy: string
): { stock: number; avgCost: number } {
  const item = db
    .select()
    .from(schema.inventoryItems)
    .where(eq(schema.inventoryItems.id, itemId))
    .get();
  if (!item) throw new Error("Item de inventario no encontrado");
  const newStock = item.stock + qty;
  const newAvg =
    newStock > 0
      ? Math.round(((item.stock * item.avgCost + qty * unitCostUsd) / newStock) * 10000) / 10000
      : unitCostUsd;
  db.update(schema.inventoryItems)
    .set({ stock: newStock, avgCost: newAvg })
    .where(eq(schema.inventoryItems.id, itemId))
    .run();
  db.insert(schema.inventoryMovements)
    .values({
      id: crypto.randomUUID(),
      inventoryItemId: itemId,
      kind: "in",
      quantity: qty,
      unitCostUsd,
      refType,
      refId,
      notes,
      createdBy,
      createdAt: Math.floor(Date.now() / 1000),
    })
    .run();
  return { stock: newStock, avgCost: newAvg };
}

export function applyManualMovement(
  itemId: string,
  kind: "out" | "adjust",
  param: number,
  notes: string,
  createdBy: string
): { stock: number; delta: number } {
  const item = db
    .select()
    .from(schema.inventoryItems)
    .where(eq(schema.inventoryItems.id, itemId))
    .get();
  if (!item) throw new Error("Item de inventario no encontrado");
  let delta = 0;
  let newStock = item.stock;
  if (kind === "out") {
    if (param <= 0) throw new Error("La cantidad debe ser mayor a 0");
    if (item.stock - param < 0) throw new Error("Stock insuficiente");
    delta = -param;
    newStock = item.stock - param;
  } else {
    if (param < 0) throw new Error("El stock objetivo no puede ser negativo");
    delta = Math.round((param - item.stock) * 100) / 100;
    newStock = param;
  }
  db.update(schema.inventoryItems)
    .set({ stock: newStock })
    .where(eq(schema.inventoryItems.id, itemId))
    .run();
  db.insert(schema.inventoryMovements)
    .values({
      id: crypto.randomUUID(),
      inventoryItemId: itemId,
      kind,
      quantity: delta,
      unitCostUsd: null,
      refType: "manual",
      refId: null,
      notes,
      createdBy,
      createdAt: Math.floor(Date.now() / 1000),
    })
    .run();
  return { stock: newStock, delta };
}

export function reverseBillMovements(billId: string, createdBy: string): void {
  const items = db
    .select()
    .from(schema.billItems)
    .where(eq(schema.billItems.billId, billId))
    .all();
  const now = Math.floor(Date.now() / 1000);
  for (const it of items) {
    if (!it.inventoryItemId) continue;
    const item = db
      .select()
      .from(schema.inventoryItems)
      .where(eq(schema.inventoryItems.id, it.inventoryItemId))
      .get();
    if (!item) continue;
    const newStock = Math.max(0, item.stock - it.quantity);
    db.update(schema.inventoryItems)
      .set({ stock: newStock })
      .where(eq(schema.inventoryItems.id, it.inventoryItemId))
      .run();
    db.insert(schema.inventoryMovements)
      .values({
        id: crypto.randomUUID(),
        inventoryItemId: it.inventoryItemId,
        kind: "out",
        quantity: -it.quantity,
        unitCostUsd: null,
        refType: "bill",
        refId: billId,
        notes: "Reversión de factura",
        createdBy,
        createdAt: now,
      })
      .run();
  }
}

export function setExhausted(itemId: string, exhausted: boolean, createdBy: string): void {
  const item = db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.id, itemId)).get();
  if (!item) throw new Error("Item de inventario no encontrado");
  if (exhausted && !item.isExhausted) {
    db.update(schema.inventoryItems).set({ isExhausted: 1, stock: 0 }).where(eq(schema.inventoryItems.id, itemId)).run();
    if (item.stock > 0.004) {
      applyManualMovement(itemId, "adjust", 0, "Agotado (stock a 0)", createdBy);
    }
  } else if (!exhausted && item.isExhausted) {
    db.update(schema.inventoryItems).set({ isExhausted: 0 }).where(eq(schema.inventoryItems.id, itemId)).run();
  }
}

export function applyCostAdjustment(
  itemId: string,
  newAvgCost: number,
  notes: string,
  createdBy: string
): { avgCost: number } {
  if (newAvgCost < 0) throw new Error("El costo no puede ser negativo");
  if (!notes.trim()) throw new Error("El motivo es obligatorio");
  const rounded = Math.round(newAvgCost * 10000) / 10000;
  db.update(schema.inventoryItems)
    .set({ avgCost: rounded })
    .where(eq(schema.inventoryItems.id, itemId))
    .run();
  db.insert(schema.inventoryMovements)
    .values({
      id: crypto.randomUUID(),
      inventoryItemId: itemId,
      kind: "cost_adjust",
      quantity: 0,
      unitCostUsd: rounded,
      refType: "manual",
      refId: null,
      notes: notes.trim(),
      createdBy,
      createdAt: Math.floor(Date.now() / 1000),
    })
    .run();
  return { avgCost: rounded };
}

export function recordUsage(
  appointmentId: string,
  usage: { inventoryItemId: string; quantity: number }[],
  createdBy: string
): void {
  const now = Math.floor(Date.now() / 1000);
  for (const u of usage) {
    const item = db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.id, u.inventoryItemId)).get();
    if (!item) throw new Error("Item de inventario no encontrado");
    const qty = Number(u.quantity);
    if (!Number.isFinite(qty) || qty < 0) throw new Error("Cantidad inválida");

    db.insert(schema.appointmentUsage)
      .values({ id: crypto.randomUUID(), appointmentId, inventoryItemId: u.inventoryItemId, quantity: qty })
      .onConflictDoUpdate({
        target: [schema.appointmentUsage.appointmentId, schema.appointmentUsage.inventoryItemId],
        set: { quantity: qty },
      })
      .run();

    const newUses = (item.usesConsumed ?? 0) + 1;
    const hasMaxUses = item.maxUses != null;
    const exhaustedNow = item.maxUses != null && newUses >= item.maxUses;

    let newStock = item.stock;
    let movementQty = 0;
    if (!hasMaxUses) {
      newStock = Math.max(0, Math.round((item.stock - qty) * 100) / 100);
      movementQty = qty > 0 ? -qty : 0;
    } else {
      if (exhaustedNow) {
        newStock = Math.max(0, Math.round((item.stock - 1) * 100) / 100);
      }
      movementQty = -1;
    }

    db.update(schema.inventoryItems)
      .set({
        stock: newStock,
        usesConsumed: newUses,
        isExhausted: exhaustedNow ? 1 : item.isExhausted,
      })
      .where(eq(schema.inventoryItems.id, u.inventoryItemId))
      .run();

    db.insert(schema.inventoryMovements)
      .values({
        id: crypto.randomUUID(),
        inventoryItemId: u.inventoryItemId,
        kind: "out",
        quantity: movementQty,
        unitCostUsd: null,
        refType: "usage",
        refId: appointmentId,
        notes: "Uso en cita",
        createdBy,
        createdAt: now,
      })
      .run();
  }
}
