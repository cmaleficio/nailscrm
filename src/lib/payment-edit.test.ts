import { describe, it, expect } from "vitest";
import { resolvePaymentAmount } from "./payment-edit";

/**
 * Un pago en Bs guarda tres cifras que tienen que ser coherentes entre sí:
 * lo que reportó la clienta (`amountVes`), la tasa del día (`rate`) y el
 * equivalente en dólares (`amountUsd`). El saldo de la clienta se calcula
 * sobre `amountUsd`, así que esa es la verdad contable, pero `amountVes` y
 * `rate` son el reporte de origen y no se deben perder al editar.
 *
 * Al editar hay dos caminos legítimos y a veces compiten:
 *
 * - el admin corrige el Bs o la tasa, y el dólar se recalcula (lo normal);
 * - el admin conoce el total en dólares que realmente entró (porque una parte
 *   entró por otro medio, o porque cobró una diferencia) y lo escribe directo.
 *
 * El helper solo decide las tres cifras. Nada de BD ni de permisos: la ruta ya
 * validó que el body trae los tipos correctos y que la cita es de la clienta.
 */

const vesPayment = {
  amountUsd: 105.88,
  amountVes: 900,
  rate: 8.5,
  currency: "VES" as const,
};

const usdPayment = {
  amountUsd: 35,
  amountVes: null,
  rate: null,
  currency: "USD" as const,
};

describe("resolvePaymentAmount", () => {
  it("deja las cifras como están cuando no viene nada", () => {
    expect(resolvePaymentAmount(vesPayment, {})).toEqual({
      ok: true,
      amountUsd: 105.88,
      amountVes: 900,
      rate: 8.5,
    });
  });

  it("recalcula el dólar cuando cambia el monto en Bs", () => {
    // 1000 Bs / 8.5
    expect(resolvePaymentAmount(vesPayment, { amountVes: 1000 })).toEqual({
      ok: true,
      amountUsd: 117.65,
      amountVes: 1000,
      rate: 8.5,
    });
  });

  it("recalcula el dólar cuando cambia la tasa", () => {
    // 900 Bs a 9 Bs/US$
    expect(resolvePaymentAmount(vesPayment, { rate: 9 })).toEqual({
      ok: true,
      amountUsd: 100,
      amountVes: 900,
      rate: 9,
    });
  });

  it("recalcula con el monto y la tasa nuevos cuando vienen los dos", () => {
    expect(resolvePaymentAmount(vesPayment, { amountVes: 500, rate: 10 })).toEqual({
      ok: true,
      amountUsd: 50,
      amountVes: 500,
      rate: 10,
    });
  });

  it("redondea a dos decimales", () => {
    const r = resolvePaymentAmount(vesPayment, { amountVes: 100, rate: 3 });
    expect(r.ok && r.amountUsd).toBe(33.33);
  });

  it("redondea también el dólar que viene explícito", () => {
    const r = resolvePaymentAmount(vesPayment, { amountUsd: 20.567 });
    expect(r.ok && r.amountUsd).toBe(20.57);
  });

  it("deja que el dólar explícito gane, sin perder el Bs ni la tasa reportados", () => {
    const r = resolvePaymentAmount(vesPayment, {
      amountUsd: 100,
      amountVes: 900,
      rate: 8.5,
    });
    expect(r).toEqual({ ok: true, amountUsd: 100, amountVes: 900, rate: 8.5 });
  });

  it("ignora Bs y tasa en un pago que ya está en dólares", () => {
    const r = resolvePaymentAmount(usdPayment, { amountUsd: 50, amountVes: 400, rate: 8 });
    expect(r).toEqual({ ok: true, amountUsd: 50, amountVes: null, rate: null });
  });

  it.each([
    ["cero", 0],
    ["negativo", -10],
    ["NaN", Number.NaN],
    ["infinito", Number.POSITIVE_INFINITY],
  ])("rechaza un monto en dólares %s", (_label, amountUsd) => {
    expect(resolvePaymentAmount(vesPayment, { amountUsd }).ok).toBe(false);
  });

  it("rechaza una tasa no positiva", () => {
    expect(resolvePaymentAmount(vesPayment, { rate: 0 }).ok).toBe(false);
    expect(resolvePaymentAmount(vesPayment, { rate: -3 }).ok).toBe(false);
  });

  it("rechaza borrar el monto en Bs de un pago que está en Bs", () => {
    expect(resolvePaymentAmount(vesPayment, { amountVes: null })).toEqual({
      ok: false,
      error: "amountVes es requerido para pagos en Bs",
    });
  });

  it("rechaza borrar la tasa de un pago que está en Bs", () => {
    expect(resolvePaymentAmount(vesPayment, { rate: null })).toEqual({
      ok: false,
      error: "rate es requerido para pagos en Bs",
    });
  });

  it("rellena una tasa que faltaba y recalcula", () => {
    expect(resolvePaymentAmount({ ...vesPayment, rate: null }, { rate: 9 })).toEqual({
      ok: true,
      amountUsd: 100,
      amountVes: 900,
      rate: 9,
    });
  });
});