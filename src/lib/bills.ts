import { db, schema } from "@/db/index";
import { eq, sql } from "drizzle-orm";

export function recomputeBillStatus(billId: string): void {
  const bill = db.select().from(schema.bills).where(eq(schema.bills.id, billId)).get();
  if (!bill) return;
  const paid =
    db
      .select({ s: sql<number>`coalesce(sum(${schema.supplierPayments.amountUsd}), 0)` })
      .from(schema.supplierPayments)
      .where(eq(schema.supplierPayments.billId, billId))
      .get()?.s ?? 0;
  const status: "pending" | "partial" | "paid" =
    paid >= bill.totalUsd - 0.004 ? "paid" : paid > 0.004 ? "partial" : "pending";
  db.update(schema.bills).set({ status }).where(eq(schema.bills.id, billId)).run();
}
