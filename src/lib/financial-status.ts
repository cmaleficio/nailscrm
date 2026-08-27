import { db, schema } from "@/db/index";
import { and, eq, ne, sql } from "drizzle-orm";

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

export function recomputeFinancialStatus(userId: string): void {
  const totalPaid = sumClientPaid(userId);
  for (const p of getOpenPurchases(userId)) {
    const status = computeFinancialStatus(totalPaid, p.servicePrice);
    if ((p.financialStatus ?? "pending") !== status) {
      setPurchaseFinancialStatus(p.id, status);
    }
  }
  applyPaidToClient(userId);
}

export function applyPaidToClient(userId: string): void {
  const total = sumClientPaid(userId);
  db.update(schema.users)
    .set({ totalRevenue: total })
    .where(eq(schema.users.id, userId))
    .run();
}
