/**
 * Aritmetica de una correccion de pago, aislada de la ruta.
 *
 * Un pago en Bs guarda tres cifras que ideally son coherentes entre si: lo que
 * reporto la clienta (`amountVes`), la tasa del dia (`rate`) y el equivalente en
 * dolares (`amountUsd`). El saldo se calcula sobre `amountUsd`, asi que esa es
 * la verdad contable, pero `amountVes` y `rate` son el reporte de origen y no se
 * deben perder al editar: saber que una clienta reporto 900 Bs a 8,5 sigue siendo
 * informacion, aunque despues el admin acredite otra cifra.
 *
 * Reglas:
 *
 * - `amountUsd` explicito gana. Es el caso de "el total real que entro fue otro"
 *   (una parte cobro por otro medio, una diferencia pactada, una correccion).
 * - Si no viene `amountUsd` y si cambia `amountVes` o `rate` en un pago en Bs, el
 *   dolar se recalcula: `amountVes / rate`. Es el caso normal.
 * - Si no viene nada, se conservan las cifras.
 *
 * La moneda no se toca. Un pago en dolares se queda en dolares con `amountVes` y
 * `rate` en null, que es como lo creo `POST /api/payments`: convertir un pago de
 * una moneda a otra cambiaria el saldo historico de la clienta.
 */

export const round2 = (n: number) => Math.round(n * 100) / 100;

export type PaymentCurrency = "USD" | "VES";

export interface PaymentAmounts {
  amountUsd: number;
  amountVes: number | null;
  rate: number | null;
}

/** Estado actual de las tres cifras de un pago. */
export interface CurrentAmounts extends PaymentAmounts {
  currency: PaymentCurrency;
}

/** Lo que llega del formulario de edicion: cada campo ausente es "no lo toques". */
export interface AmountPatch {
  amountUsd?: number;
  amountVes?: number | null;
  rate?: number | null;
}

export type ResolveAmounts =
  | ({ ok: true } & PaymentAmounts)
  | { ok: false; error: string };

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function resolvePaymentAmount(
  current: CurrentAmounts,
  patch: AmountPatch
): ResolveAmounts {
  // En dólares las cifras en Bs no existen: se ignoran para que un formulario que
  // las enviara no invente datos ni reviente el CHECK de la columna.
  if (current.currency === "USD") {
    const amountUsd = patch.amountUsd ?? current.amountUsd;
    if (!isPositiveNumber(amountUsd)) {
      return { ok: false, error: "amountUsd es requerido" };
    }
    return { ok: true, amountUsd: round2(amountUsd), amountVes: null, rate: null };
  }

  // El dolar explicito manda sobre lo que se.reporto en Bs.
  if (patch.amountUsd !== undefined) {
    if (!isPositiveNumber(patch.amountUsd)) {
      return { ok: false, error: "amountUsd es requerido" };
    }
    const amountVes = patch.amountVes !== undefined ? patch.amountVes : current.amountVes;
    const rate = patch.rate !== undefined ? patch.rate : current.rate;
    if (amountVes !== null && !isPositiveNumber(amountVes)) {
      return { ok: false, error: "amountVes es requerido para pagos en Bs" };
    }
    if (rate !== null && !isPositiveNumber(rate)) {
      return { ok: false, error: "rate es requerido para pagos en Bs" };
    }
    return { ok: true, amountUsd: round2(patch.amountUsd), amountVes, rate };
  }

  const amountVes = patch.amountVes !== undefined ? patch.amountVes : current.amountVes;
  const rate = patch.rate !== undefined ? patch.rate : current.rate;

  if (!isPositiveNumber(amountVes)) {
    return { ok: false, error: "amountVes es requerido para pagos en Bs" };
  }
  if (!isPositiveNumber(rate)) {
    return { ok: false, error: "rate es requerido para pagos en Bs" };
  }

  return {
    ok: true,
    amountUsd: round2(amountVes / rate),
    amountVes,
    rate,
  };
}