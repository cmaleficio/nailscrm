import { db, schema } from "./index";
import { recomputeFinancialStatus } from "@/lib/financial-status";

/**
 * Reconstruye `payment_allocations` y el `financial_status` derivado para
 * todas las clientas con compras o pagos. Idempotente: se puede correr las
 * veces que haga falta (cada `recomputeFinancialStatus` reconstruye la tabla
 * de esa clienta desde cero).
 */
function distinctUserIds(): string[] {
  const ids = new Set<string>();
  for (const row of db
    .select({ id: schema.servicePurchases.userId })
    .from(schema.servicePurchases)
    .all()) {
    if (row.id) ids.add(row.id);
  }
  for (const row of db.select({ id: schema.payments.userId }).from(schema.payments).all()) {
    if (row.id) ids.add(row.id);
  }
  return [...ids];
}

const userIds = distinctUserIds();
for (const userId of userIds) {
  recomputeFinancialStatus(userId);
}
console.log(`✅ Allocations reconstruidas para ${userIds.length} clienta(s).`);
