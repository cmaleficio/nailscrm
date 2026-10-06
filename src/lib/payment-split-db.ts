import { db, schema } from "@/db/index";
import { and, eq, ne, sql } from "drizzle-orm";
import { allocatePayments, type PaymentKind } from "@/lib/payment-split";

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Deuda de una clienta: **el** criterio de "cuánto se debe".
 *
 * Servicios no anulados (los de la cita futura también cuentan, igual que en
 * `/api/balances` y en el portal del cliente). Cualquier pantalla que muestre o
 * reparta dinero tiene que pasar por acá, si no el mismo pago sale con dos
 * etiquetas distintas según dónde se mire.
 */
export function clientDueUsd(userId: string): number {
  const row = db
    .select({ due: sql<number>`coalesce(sum(${schema.servicePurchases.servicePrice}), 0)` })
    .from(schema.servicePurchases)
    .where(
      and(eq(schema.servicePurchases.userId, userId), ne(schema.servicePurchases.financialStatus, "void"))
    )
    .get();
  return round2(row?.due ?? 0);
}

/**
 * Reparto de UN pago (el recién creado o editado) contra la historia completa
 * de la clienta en orden cronológico, para que la etiqueta que devuelve la
 * mutación sea exactamente la que luego verá el admin en `GET /api/payments`.
 */
export function splitForPayment(
  userId: string,
  paymentId: string
): { appliedUsd: number; creditUsd: number; kind: PaymentKind } {
  const rows = db
    .select({
      id: schema.payments.id,
      amountUsd: schema.payments.amountUsd,
      paidAt: schema.payments.paidAt,
      createdAt: schema.payments.createdAt,
    })
    .from(schema.payments)
    .where(eq(schema.payments.userId, userId))
    .all();

  const alloc = allocatePayments(clientDueUsd(userId), rows).find((a) => a.id === paymentId);
  return alloc
    ? { appliedUsd: alloc.appliedUsd, creditUsd: alloc.creditUsd, kind: alloc.kind }
    : { appliedUsd: 0, creditUsd: 0, kind: "abono" };
}
