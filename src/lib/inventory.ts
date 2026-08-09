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
