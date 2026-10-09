import { db, schema } from "@/db/index";
import { and, eq, ne, sql, inArray } from "drizzle-orm";
import { allocateToPurchases, statusFromAllocated } from "@/lib/payment-allocation";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeFinancialStatus(
  totalPaid: number,
  price: number
): "pending" | "partial" | "paid" {
  if (totalPaid >= price - 0.004) return "paid";
  if (totalPaid > 0.004) return "partial";
  return "pending";
}

export function sumClientPaid(userId: string): number {
  const row = db
    .select({ total: sql<number>`coalesce(sum(${schema.payments.amountUsd}), 0)` })
    .from(schema.payments)
    .where(eq(schema.payments.userId, userId))
    .get();
  return round2(row?.total ?? 0);
}

export function getOpenPurchases(userId: string) {
  return db
    .select({
      id: schema.servicePurchases.id,
      servicePrice: schema.servicePurchases.servicePrice,
      financialStatus: schema.servicePurchases.financialStatus,
      completionDate: schema.servicePurchases.completionDate,
      createdAt: schema.servicePurchases.createdAt,
      appointmentId: schema.servicePurchases.appointmentId,
    })
    .from(schema.servicePurchases)
    .where(
      and(
        eq(schema.servicePurchases.userId, userId),
        ne(schema.servicePurchases.financialStatus, "void")
      )
    )
    .all();
}

export function setPurchaseFinancialStatus(
  purchaseId: string,
  status: "pending" | "partial" | "paid" | "void"
): void {
  db.update(schema.servicePurchases)
    .set({ financialStatus: status })
    .where(eq(schema.servicePurchases.id, purchaseId))
    .run();
}

export function voidPurchase(purchaseId: string): void {
  setPurchaseFinancialStatus(purchaseId, "void");
}

/**
 * Reconstruye las asignaciones pago↔servicio de una clienta y deriva de ahí
 * el `financial_status` de cada compra.
 *
 * El estado por servicio ya NO se calcula comparando el total pagado contra el
 * precio de cada compra por separado (eso marcaba todas como `paid` en cuanto
 * el total pagado superaba un precio individual). Ahora cada pago se reparte
 * en FIFO entre las compras no-void y cada compra queda `paid`/`partial`/
 * `pending` según lo que realmente la cubre.
 *
 * El saldo agregado no cambia: `clientDueUsd` sigue siendo
 * `Σ precios no-void − Σ pagos`.
 */
export function recomputeFinancialStatus(userId: string): void {
  const purchases = getOpenPurchases(userId);
  const payments = db
    .select({
      id: schema.payments.id,
      amountUsd: schema.payments.amountUsd,
      paidAt: schema.payments.paidAt,
      createdAt: schema.payments.createdAt,
      appointmentId: schema.payments.appointmentId,
    })
    .from(schema.payments)
    .where(eq(schema.payments.userId, userId))
    .all();

  const { allocations } = allocateToPurchases(
    purchases.map((p) => ({
      id: p.id,
      priceUsd: p.servicePrice,
      completionDate: p.completionDate,
      createdAt: p.createdAt,
      appointmentId: p.appointmentId,
    })),
    payments.map((p) => ({
      id: p.id,
      amountUsd: p.amountUsd,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
      appointmentId: p.appointmentId,
    }))
  );

  const allocatedByPurchase = new Map<string, number>();
  for (const a of allocations) {
    allocatedByPurchase.set(
      a.purchaseId,
      round2((allocatedByPurchase.get(a.purchaseId) ?? 0) + a.amountUsd)
    );
  }

  const now = Math.floor(Date.now() / 1000);

  db.transaction((tx) => {
    // Borra por pago (no por compra): así también limpia las asignaciones de
    // compras que luego quedaron `void` y ya no aparecen en `purchases`.
    if (payments.length > 0) {
      tx.delete(schema.paymentAllocations)
        .where(
          inArray(
            schema.paymentAllocations.paymentId,
            payments.map((p) => p.id)
          )
        )
        .run();
    }
    for (const a of allocations) {
      tx.insert(schema.paymentAllocations)
        .values({
          id: crypto.randomUUID(),
          paymentId: a.paymentId,
          purchaseId: a.purchaseId,
          amountUsd: a.amountUsd,
          createdAt: now,
        })
        .run();
    }
    for (const p of purchases) {
      const status = statusFromAllocated(allocatedByPurchase.get(p.id) ?? 0, p.servicePrice);
      if ((p.financialStatus ?? "pending") !== status) {
        tx.update(schema.servicePurchases)
          .set({ financialStatus: status })
          .where(eq(schema.servicePurchases.id, p.id))
          .run();
      }
    }
  });

  applyPaidToClient(userId);
}

export function applyPaidToClient(userId: string): void {
  const total = sumClientPaid(userId);
  db.update(schema.users)
    .set({ totalRevenue: total })
    .where(eq(schema.users.id, userId))
    .run();
}
