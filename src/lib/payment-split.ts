/**
 * Reparto de un pago entre "cubre deuda" y "anticipo".
 *
 * Regla de negocio (acordada con el salón, sin tope duro):
 *
 *   deuda   = Σ service_purchases.service_price (financial_status != 'void')
 *   saldo   = deuda − Σ payments.amount_usd
 *   P ≤ saldo → abono  (o "pago completo" si deja el saldo en cero)
 *   P > saldo → el excedente es un anticipo / saldo a favor
 *   deuda = 0 → el pago entero es anticipo
 *
 * El reparto se **deriva al leer**: no hay columna nueva ni migración, así que
 * dos pagos de $5 sobre una deuda de $10 siguen sumando $10 de "aplicado" sin
 * importar cuándo se registraron ni en qué orden existen en la tabla. Por eso
 * `allocatePayments` ordena cronológicamente (el pago más viejo cubre primero):
 * es la misma convención que usa la UI para listar los pagos.
 *
 * Nada de esto cambia el saldo: `deuda − pagado` es idéntico con o sin reparto.
 * El reparto es presentación pura.
 */

/** Tolerancia monetaria: las cifras son USD con dos decimales. */
export const PAYMENT_EPS = 0.004;

export type PaymentKind = "abono" | "anticipo" | "completo";

export type PaymentInput = {
  id: string;
  amountUsd: number;
  /** Inicio del día en el que se pagó (cronología real del dinero). */
  paidAt: number | null;
  /** Desempate cuando dos pagos caen el mismo día. */
  createdAt?: number | null;
};

export type PaymentAllocation = {
  id: string;
  amountUsd: number;
  /** Cuánto de este pago cubre deuda. */
  appliedUsd: number;
  /** Cuánto queda como anticipo / saldo a favor. */
  creditUsd: number;
  kind: PaymentKind;
};

export type SplitPreview = {
  /** deuda − pagado antes de este pago. */
  remainingUsd: number;
  appliedUsd: number;
  creditUsd: number;
  kind: PaymentKind;
  /** saldo que queda después de aplicar el pago. */
  nextBalanceUsd: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function kindFor(appliedUsd: number, creditUsd: number, remainingAfter: number): PaymentKind {
  if (creditUsd > PAYMENT_EPS) return "anticipo";
  if (remainingAfter <= PAYMENT_EPS && appliedUsd > 0) return "completo";
  return "abono";
}

/**
 * Reparte cada pago de una clienta contra su deuda, en orden cronológico.
 * Devuelve las filas en el mismo orden recibido (más reciente primero), para
 * que quien llama no tenga que re-ordenar nada.
 */
export function allocatePayments(
  dueUsd: number,
  payments: PaymentInput[]
): PaymentAllocation[] {
  const due = Math.max(0, round2(dueUsd));

  const ordered = [...payments].sort((a, b) => {
    const ta = a.paidAt ?? 0;
    const tb = b.paidAt ?? 0;
    if (ta !== tb) return ta - tb;
    const ca = a.createdAt ?? 0;
    const cb = b.createdAt ?? 0;
    if (ca !== cb) return ca - cb;
    return a.id.localeCompare(b.id);
  });

  let remaining = due;
  const byId = new Map<string, PaymentAllocation>();

  for (const p of ordered) {
    const amount = Math.max(0, round2(p.amountUsd));
    const applied = round2(Math.min(amount, remaining));
    const credit = round2(amount - applied);
    remaining = round2(Math.max(0, remaining - applied));
    byId.set(p.id, {
      id: p.id,
      amountUsd: amount,
      appliedUsd: applied,
      creditUsd: credit,
      kind: kindFor(applied, credit, remaining),
    });
  }

  return payments.map((p) => byId.get(p.id)!);
}

/**
 * Reparto de UN pago que se va a registrar/editar, contra la deuda actual.
 * Igual que `allocatePayments` pero sin necesidad de listar la historia:
 * lo que sobra del saldo viejo es exactamente lo que este pago puede cubrir.
 */
export function previewPayment(
  dueUsd: number,
  paidUsd: number,
  amountUsd: number
): SplitPreview {
  const due = Math.max(0, round2(dueUsd));
  const paid = Math.max(0, round2(paidUsd));
  const amount = Math.max(0, round2(amountUsd));

  const remaining = round2(Math.max(0, due - paid));
  const applied = round2(Math.min(amount, remaining));
  const credit = round2(amount - applied);
  const nextBalance = round2(remaining - applied);

  return {
    remainingUsd: remaining,
    appliedUsd: applied,
    creditUsd: credit,
    kind: kindFor(applied, credit, nextBalance),
    nextBalanceUsd: nextBalance,
  };
}

/** Rótulo corto para la UI (misma caja que los estados financieros). */
export function paymentKindLabel(kind: PaymentKind): string {
  switch (kind) {
    case "abono":
      return "Abono";
    case "anticipo":
      return "Anticipo";
    case "completo":
      return "Pago completo";
  }
}
