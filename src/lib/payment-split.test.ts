import { describe, it, expect } from "vitest";
import { allocatePayments, previewPayment, paymentKindLabel, type PaymentInput } from "./payment-split";

/**
 * El reparto es presentación pura: el saldo de la clienta no cambia, lo que
 * cambia es cómo se explica. Por eso los tests solo miran tres cosas:
 * cuánto cubre de cada pago, cuánto queda como anticipo, y la etiqueta.
 */

const pay = (id: string, amountUsd: number, paidAt: number, createdAt?: number): PaymentInput => ({
  id,
  amountUsd,
  paidAt,
  createdAt: createdAt ?? paidAt,
});

describe("allocatePayments", () => {
  it("abono: un pago menor que la deuda cubre lo que puede", () => {
    const [a] = allocatePayments(100, [pay("p1", 40, 1000)]);
    expect(a).toMatchObject({ amountUsd: 40, appliedUsd: 40, creditUsd: 0, kind: "abono" });
  });

  it("completo: el pago que deja la deuda en cero se etiqueta pago completo", () => {
    const allocs = allocatePayments(100, [pay("p1", 60, 1000), pay("p2", 40, 2000)]);
    expect(allocs[0]).toMatchObject({ kind: "abono", appliedUsd: 60, creditUsd: 0 });
    expect(allocs[1]).toMatchObject({ kind: "completo", appliedUsd: 40, creditUsd: 0 });
  });

  it("anticipo: lo que sobra de un pago que excede la deuda", () => {
    const [a] = allocatePayments(10, [pay("p1", 1000, 1000)]);
    expect(a).toMatchObject({ appliedUsd: 10, creditUsd: 990, kind: "anticipo" });
  });

  it("sin deuda: el pago entero es anticipo (incluye la deuda en cero)", () => {
    const [a] = allocatePayments(0, [pay("p1", 50, 1000)]);
    expect(a).toMatchObject({ appliedUsd: 0, creditUsd: 50, kind: "anticipo" });
  });

  it("la deuda ya cubierta convierte a los pagos siguientes en anticipo", () => {
    const allocs = allocatePayments(10, [pay("p1", 20, 1000), pay("p2", 30, 2000)]);
    expect(allocs[1]).toMatchObject({ appliedUsd: 0, creditUsd: 30, kind: "anticipo" });
  });

  it("el orden cronológico manda: el pago más viejo cubre primero", () => {
    // El de $90 es el más reciente pero llega primero en el array (paso de BD),
    // y aun así no debe agotar la deuda antes que el de $10.
    const allocs = allocatePayments(50, [
      pay("nuevo", 90, 2000, 2000),
      pay("viejo", 10, 1000, 1000),
    ]);
    expect(allocs.find((a) => a.id === "viejo")).toMatchObject({ appliedUsd: 10, kind: "abono" });
    expect(allocs.find((a) => a.id === "nuevo")).toMatchObject({
      appliedUsd: 40,
      creditUsd: 50,
      kind: "anticipo",
    });
    // y la respuesta conserva el orden de entrada
    expect(allocs.map((a) => a.id)).toEqual(["nuevo", "viejo"]);
  });

  it("empata por createdAt y luego por id para ser determinista", () => {
    const allocs = allocatePayments(30, [
      pay("b", 10, 1000, 5),
      pay("a", 10, 1000, 5),
      pay("c", 10, 1000, 5),
    ]);
    expect(allocs.map((a) => a.id)).toEqual(["b", "a", "c"]);
    expect(allocs.map((a) => a.appliedUsd)).toEqual([10, 10, 10]);
  });

  it("la suma aplicada nunca supera la deuda ni el total pagado", () => {
    const due = 33.33;
    const payments = [pay("p1", 10, 1000), pay("p2", 11.11, 2000), pay("p3", 12.22, 3000)];
    const allocs = allocatePayments(due, payments);
    const applied = allocs.reduce((s, a) => s + a.appliedUsd, 0);
    expect(Math.abs(applied - due)).toBeLessThanOrEqual(0.004);
    for (const a of allocs) expect(a.appliedUsd).toBeLessThanOrEqual(a.amountUsd + 0.004);
  });

  it("suma exacta con decimales: el último pago es completo", () => {
    const allocs = allocatePayments(33.33, [
      pay("p1", 10, 1000),
      pay("p2", 11.11, 2000),
      pay("p3", 12.22, 3000),
    ]);
    expect(allocs[2].kind).toBe("completo");
  });

  it("lista vacía y deuda en cero no revientan", () => {
    expect(allocatePayments(0, [])).toEqual([]);
    expect(allocatePayments(55.5, [])).toEqual([]);
  });

  it("montos no positivos se tratan como cero", () => {
    const [a] = allocatePayments(100, [pay("p1", -50, 1000)]);
    expect(a).toMatchObject({ amountUsd: 0, appliedUsd: 0, creditUsd: 0, kind: "abono" });
  });
});

describe("previewPayment", () => {
  it("abono normal", () => {
    expect(previewPayment(100, 0, 25)).toEqual({
      remainingUsd: 100,
      appliedUsd: 25,
      creditUsd: 0,
      kind: "abono",
      nextBalanceUsd: 75,
    });
  });

  it("pago completo exacto", () => {
    expect(previewPayment(100, 40, 60)).toMatchObject({
      appliedUsd: 60,
      creditUsd: 0,
      kind: "completo",
      nextBalanceUsd: 0,
    });
  });

  it("excedente: anticipo y el saldo queda en cero", () => {
    expect(previewPayment(10, 0, 1000)).toMatchObject({
      remainingUsd: 10,
      appliedUsd: 10,
      creditUsd: 990,
      kind: "anticipo",
      nextBalanceUsd: 0,
    });
  });

  it("todo anticipo cuando no se debe nada (sobrepago previo)", () => {
    expect(previewPayment(10, 30, 20)).toMatchObject({
      remainingUsd: 0,
      appliedUsd: 0,
      creditUsd: 20,
      kind: "anticipo",
      nextBalanceUsd: 0,
    });
  });

  it("deuda en cero", () => {
    expect(previewPayment(0, 0, 45)).toMatchObject({
      appliedUsd: 0,
      creditUsd: 45,
      kind: "anticipo",
    });
  });

  it("redondea a dos decimales", () => {
    const p = previewPayment(100, 0, 33.3333333);
    expect(p.appliedUsd).toBe(33.33);
    expect(p.nextBalanceUsd).toBe(66.67);
  });

  it("mismo resultado que el reparto histórico si es el único pago", () => {
    const [a] = allocatePayments(100, [pay("p1", 30, 1000)]);
    const p = previewPayment(100, 0, 30);
    expect(p.appliedUsd).toBe(a.appliedUsd);
    expect(p.creditUsd).toBe(a.creditUsd);
    expect(p.kind).toBe(a.kind);
  });
});

describe("paymentKindLabel", () => {
  it("español de la UI", () => {
    expect(paymentKindLabel("abono")).toBe("Abono");
    expect(paymentKindLabel("anticipo")).toBe("Anticipo");
    expect(paymentKindLabel("completo")).toBe("Pago completo");
  });
});
