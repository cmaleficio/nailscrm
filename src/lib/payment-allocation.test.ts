import { describe, it, expect } from "vitest";
import {
  allocateToPurchases,
  statusFromAllocated,
  type AllocationPurchase,
  type AllocationPayment,
} from "./payment-allocation";
import { allocatePayments } from "./payment-split";

const p = (
  id: string,
  priceUsd: number,
  extra: Partial<AllocationPurchase> = {}
): AllocationPurchase => ({
  id,
  priceUsd,
  completionDate: extra.completionDate === undefined ? 1 : extra.completionDate,
  createdAt: extra.createdAt === undefined ? 1 : extra.createdAt,
  appointmentId: extra.appointmentId ?? null,
});

const pay = (
  id: string,
  amountUsd: number,
  extra: Partial<AllocationPayment> = {}
): AllocationPayment => ({
  id,
  amountUsd,
  paidAt: extra.paidAt === undefined ? 1 : extra.paidAt,
  createdAt: extra.createdAt === undefined ? 1 : extra.createdAt,
  appointmentId: extra.appointmentId ?? null,
});

describe("allocateToPurchases", () => {
  it("Fabiola: 4x$18 with 2x$18 pays only the 2 oldest", () => {
    const purchases = [
      p("a", 18, { completionDate: 1 }),
      p("b", 18, { completionDate: 2 }),
      p("c", 18, { completionDate: 3 }),
      p("d", 18, { completionDate: 4 }),
    ];
    const payments = [pay("p1", 18, { paidAt: 1 }), pay("p2", 18, { paidAt: 2 })];
    const { allocations } = allocateToPurchases(purchases, payments);
    expect(allocations).toEqual([
      { paymentId: "p1", purchaseId: "a", amountUsd: 18 },
      { paymentId: "p2", purchaseId: "b", amountUsd: 18 },
    ]);
  });

  it("Wanda: 2x$12 with 1x$12 pays only the oldest", () => {
    const purchases = [p("a", 12, { completionDate: 1 }), p("b", 12, { completionDate: 2 })];
    const payments = [pay("p1", 12, { paidAt: 1 })];
    const { allocations } = allocateToPurchases(purchases, payments);
    expect(allocations).toEqual([{ paymentId: "p1", purchaseId: "a", amountUsd: 12 }]);
  });

  it("service split across two payments", () => {
    const purchases = [p("a", 18)];
    const payments = [pay("p1", 9, { paidAt: 1 }), pay("p2", 9, { paidAt: 2 })];
    const { allocations } = allocateToPurchases(purchases, payments);
    expect(allocations).toEqual([
      { paymentId: "p1", purchaseId: "a", amountUsd: 9 },
      { paymentId: "p2", purchaseId: "a", amountUsd: 9 },
    ]);
  });

  it("one payment spanning two services", () => {
    const purchases = [p("a", 18, { completionDate: 1 }), p("b", 18, { completionDate: 2 })];
    const payments = [pay("p1", 30)];
    const { allocations, byPayment } = allocateToPurchases(purchases, payments);
    expect(allocations).toEqual([
      { paymentId: "p1", purchaseId: "a", amountUsd: 18 },
      { paymentId: "p1", purchaseId: "b", amountUsd: 12 },
    ]);
    expect(byPayment.get("p1")).toEqual({ appliedUsd: 30, creditUsd: 0 });
  });

  it("overpayment leaves the rest as credit (no allocation)", () => {
    const purchases = [p("a", 10)];
    const payments = [pay("p1", 100)];
    const { allocations, byPayment } = allocateToPurchases(purchases, payments);
    expect(allocations).toEqual([{ paymentId: "p1", purchaseId: "a", amountUsd: 10 }]);
    expect(byPayment.get("p1")).toEqual({ appliedUsd: 10, creditUsd: 90 });
  });

  it("payment linked to an appointment pays that appointment's purchases first", () => {
    const purchases = [
      p("a", 10, { completionDate: 1, appointmentId: "appt-X" }),
      p("b", 10, { completionDate: 2, appointmentId: "appt-Y" }),
    ];
    const payments = [pay("p1", 10, { appointmentId: "appt-Y" })];
    const { allocations } = allocateToPurchases(purchases, payments);
    expect(allocations).toEqual([{ paymentId: "p1", purchaseId: "b", amountUsd: 10 }]);
  });

  it("appointment affinity does not change how much a payment covers", () => {
    const purchases = [
      p("a", 10, { completionDate: 1, appointmentId: "appt-X" }),
      p("b", 10, { completionDate: 2, appointmentId: "appt-Y" }),
    ];
    const payments = [pay("p1", 15, { appointmentId: "appt-Y" })];
    const { allocations, byPayment } = allocateToPurchases(purchases, payments);
    expect(allocations).toEqual([
      { paymentId: "p1", purchaseId: "b", amountUsd: 10 },
      { paymentId: "p1", purchaseId: "a", amountUsd: 5 },
    ]);
    expect(byPayment.get("p1")).toEqual({ appliedUsd: 15, creditUsd: 0 });
  });

  it("is deterministic on ties (purchase id, then payment id)", () => {
    const purchases = [
      p("b", 10, { completionDate: 1, createdAt: 5 }),
      p("a", 10, { completionDate: 1, createdAt: 5 }),
    ];
    const payments = [
      pay("y", 10, { paidAt: 1, createdAt: 5 }),
      pay("x", 10, { paidAt: 1, createdAt: 5 }),
    ];
    const { allocations } = allocateToPurchases(purchases, payments);
    expect(allocations).toEqual([
      { paymentId: "x", purchaseId: "a", amountUsd: 10 },
      { paymentId: "y", purchaseId: "b", amountUsd: 10 },
    ]);
  });

  it("orders purchases by completionDate, nulls last", () => {
    const purchases = [
      p("future", 10, { completionDate: null, createdAt: 1 }),
      p("done", 10, { completionDate: 50, createdAt: 9 }),
    ];
    const payments = [pay("p1", 10, { paidAt: 1 })];
    const { allocations } = allocateToPurchases(purchases, payments);
    expect(allocations).toEqual([{ paymentId: "p1", purchaseId: "done", amountUsd: 10 }]);
  });

  it("keeps the per-payment appliedUsd identical to allocatePayments", () => {
    const purchases = [
      p("a", 18, { completionDate: 1 }),
      p("b", 18, { completionDate: 2 }),
      p("c", 18, { completionDate: 3 }),
    ];
    const payments = [
      pay("p1", 20, { paidAt: 1 }),
      pay("p2", 10, { paidAt: 2 }),
      pay("p3", 50, { paidAt: 3 }),
    ];
    const totalDue = 54;
    const { byPayment } = allocateToPurchases(purchases, payments);
    const split = allocatePayments(
      totalDue,
      payments.map((x) => ({
        id: x.id,
        amountUsd: x.amountUsd,
        paidAt: x.paidAt,
        createdAt: x.createdAt,
      }))
    );
    for (const s of split) {
      expect(byPayment.get(s.id)!.appliedUsd).toBe(s.appliedUsd);
      expect(byPayment.get(s.id)!.creditUsd).toBe(s.creditUsd);
    }
  });
});

describe("statusFromAllocated", () => {
  it("pending when nothing allocated", () => {
    expect(statusFromAllocated(0, 18)).toBe("pending");
  });
  it("partial when some allocated", () => {
    expect(statusFromAllocated(9, 18)).toBe("partial");
  });
  it("paid when fully allocated", () => {
    expect(statusFromAllocated(18, 18)).toBe("paid");
  });
  it("tolerates rounding within PAYMENT_EPS", () => {
    expect(statusFromAllocated(17.997, 18)).toBe("paid");
  });
});
