import { PAYMENT_EPS } from "@/lib/payment-split";

const round2 = (n: number) => Math.round(n * 100) / 100;

export type AllocationPurchase = {
  id: string;
  priceUsd: number;
  completionDate: number | null;
  createdAt: number | null;
  appointmentId: string | null;
};

export type AllocationPayment = {
  id: string;
  amountUsd: number;
  paidAt: number | null;
  createdAt: number | null;
  appointmentId: string | null;
};

export type PurchaseAllocation = {
  paymentId: string;
  purchaseId: string;
  amountUsd: number;
};

function comparePurchases(a: AllocationPurchase, b: AllocationPurchase): number {
  const ca = a.completionDate ?? Number.MAX_SAFE_INTEGER;
  const cb = b.completionDate ?? Number.MAX_SAFE_INTEGER;
  if (ca !== cb) return ca - cb;
  const ta = a.createdAt ?? 0;
  const tb = b.createdAt ?? 0;
  if (ta !== tb) return ta - tb;
  return a.id.localeCompare(b.id);
}

// Mismo criterio que `allocatePayments` (payment-split.ts): `paid_at ?? 0`,
// luego `created_at ?? 0`, luego id. No cambiar sin cambiar el otro, o el
// invariante "aplicado por pago == allocatePayments" se rompe.
function comparePayments(a: AllocationPayment, b: AllocationPayment): number {
  const pa = a.paidAt ?? 0;
  const pb = b.paidAt ?? 0;
  if (pa !== pb) return pa - pb;
  const ca = a.createdAt ?? 0;
  const cb = b.createdAt ?? 0;
  if (ca !== cb) return ca - cb;
  return a.id.localeCompare(b.id);
}

export function statusFromAllocated(
  allocatedUsd: number,
  priceUsd: number
): "pending" | "partial" | "paid" {
  if (allocatedUsd >= priceUsd - PAYMENT_EPS) return "paid";
  if (allocatedUsd > PAYMENT_EPS) return "partial";
  return "pending";
}

export function allocateToPurchases(
  purchases: AllocationPurchase[],
  payments: AllocationPayment[]
): {
  allocations: PurchaseAllocation[];
  byPayment: Map<string, { appliedUsd: number; creditUsd: number }>;
} {
  const orderedPurchases = [...purchases].filter((p) => p.priceUsd > 0).sort(comparePurchases);
  const orderedPayments = [...payments].sort(comparePayments);

  const remainingByPurchase = new Map<string, number>();
  for (const p of orderedPurchases) remainingByPurchase.set(p.id, round2(p.priceUsd));

  const allocations: PurchaseAllocation[] = [];
  const byPayment = new Map<string, { appliedUsd: number; creditUsd: number }>();

  for (const payment of orderedPayments) {
    const amount = round2(Math.max(0, payment.amountUsd));
    let remaining = amount;
    let appliedThisPayment = 0;

    const order =
      payment.appointmentId != null
        ? [
            ...orderedPurchases.filter((x) => x.appointmentId === payment.appointmentId),
            ...orderedPurchases.filter((x) => x.appointmentId !== payment.appointmentId),
          ]
        : orderedPurchases;

    for (const purchase of order) {
      if (remaining <= PAYMENT_EPS) break;
      const pending = remainingByPurchase.get(purchase.id) ?? 0;
      if (pending <= PAYMENT_EPS) continue;
      const applied = round2(Math.min(remaining, pending));
      if (applied <= 0) continue;
      allocations.push({ paymentId: payment.id, purchaseId: purchase.id, amountUsd: applied });
      remainingByPurchase.set(purchase.id, round2(pending - applied));
      remaining = round2(remaining - applied);
      appliedThisPayment = round2(appliedThisPayment + applied);
    }

    byPayment.set(payment.id, {
      appliedUsd: appliedThisPayment,
      creditUsd: round2(Math.max(0, amount - appliedThisPayment)),
    });
  }

  return { allocations, byPayment };
}
