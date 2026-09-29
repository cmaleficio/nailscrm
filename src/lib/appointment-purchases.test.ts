import { describe, expect, it } from "vitest";
import {
  remainingCombination,
  summarizePurchases,
  type PurchaseSummaryRow,
  type RemainingPurchase,
} from "./appointment-purchases";

const appt = (id: string, clientId: string, serviceName: string) => ({
  id,
  clientId,
  serviceName,
});

let seq = 0;
const buy = (
  appointmentId: string,
  userId: string,
  serviceName: string,
  servicePrice: number,
  isPrimary: number | null = 1,
  serviceDurationMins = 60
): PurchaseSummaryRow => ({
  id: `p${++seq}`,
  appointmentId,
  userId,
  serviceName,
  servicePrice,
  serviceDurationMins,
  isPrimary,
});

describe("summarizePurchases", () => {
  it("colapsa N compras del mismo cliente y suma el precio", () => {
    const map = summarizePurchases(
      [appt("a1", "c1", "Acrílicas Full")],
      [
        buy("a1", "c1", "Acrílicas Full", 35, 1),
        buy("a1", "c1", "Matiz", 5, 0),
        buy("a1", "c1", "Diseño", 8, 0),
      ]
    );
    const s = map.get("a1")!;
    expect(s.serviceName).toBe("Acrílicas Full + Diseño + Matiz");
    expect(s.servicePrice).toBe(48);
    expect(s.isComplementaryOnly).toBe(false);
    expect(s.hasPrincipal).toBe(true);
  });

  it("pone la principal primero y ordena las complementarias por nombre", () => {
    const map = summarizePurchases(
      [appt("a1", "c1", "Gel")],
      [
        buy("a1", "c1", "Zafiro", 5, 0),
        buy("a1", "c1", "Gel", 25, 1),
        buy("a1", "c1", "Diseño", 8, 0),
      ]
    );
    expect(map.get("a1")!.serviceName).toBe("Gel + Diseño + Zafiro");
  });

  it("marca isComplementaryOnly cuando ninguna compra es principal", () => {
    const map = summarizePurchases(
      [appt("a1", "c1", "Matiz")],
      [buy("a1", "c1", "Diseño", 8, 0), buy("a1", "c1", "Matiz", 5, 0)]
    );
    const s = map.get("a1")!;
    expect(s.isComplementaryOnly).toBe(true);
    expect(s.hasPrincipal).toBe(false);
  });

  it("NO infla el precio de una sesión de curso (N compras, N clientes)", () => {
    const map = summarizePurchases(
      [appt("a1", "alumno1", "Curso")],
      [
        buy("a1", "alumno1", "Curso", 50, 1),
        buy("a1", "alumno2", "Curso", 50, 1),
        buy("a1", "alumno3", "Curso", 50, 1),
        buy("a1", "alumno4", "Curso", 50, 1),
        buy("a1", "alumno5", "Curso", 50, 1),
      ]
    );
    const s = map.get("a1")!;
    expect(s.serviceName).toBe("Curso");
    expect(s.servicePrice).toBe(50);
  });

  it("con un solo grupo y clientId que no coincide, suma el grupo entero", () => {
    // Forma multi-servicio: todas las compras son del mismo cliente, así que
    // aunque client_id no coincida, la cita entera es ese grupo.
    const map = summarizePurchases(
      [appt("a1", "alumno-fantasma", "Acrílicas")],
      [
        buy("a1", "c9", "Acrílicas", 35, 1),
        buy("a1", "c9", "Matiz", 5, 0),
      ]
    );
    expect(map.get("a1")!.servicePrice).toBe(40);
  });

  it("con varios grupos y clientId que no coincide, toma uno solo (curso)", () => {
    // Forma curso: un grupo por alumno. Sumarlos daría precio x alumnos.
    const map = summarizePurchases(
      [appt("a1", "alumno-fantasma", "Curso")],
      [
        buy("a1", "alumno2", "Curso", 50, 1),
        buy("a1", "alumno3", "Curso", 50, 1),
        buy("a1", "alumno4", "Curso", 50, 1),
      ]
    );
    const s = map.get("a1")!;
    expect(s.serviceName).toBe("Curso");
    expect(s.servicePrice).toBe(50);
  });

  it("sin clientId (null) usa la misma lógica de grupos", () => {
    const multi = summarizePurchases(
      [{ id: "a1", clientId: null, serviceName: "A" } as never],
      [buy("a1", "c9", "A", 35, 1), buy("a1", "c9", "Matiz", 5, 0)]
    );
    expect(multi.get("a1")!.servicePrice).toBe(40);
  });

  it("cae a services.name y precio 0 si la cita no tiene compras", () => {
    const map = summarizePurchases([appt("a1", "c1", "Acrílicas Full")], []);
    const s = map.get("a1")!;
    expect(s.serviceName).toBe("Acrílicas Full");
    expect(s.servicePrice).toBe(0);
    expect(s.isComplementaryOnly).toBe(false);
  });

  it("ignora compras de otras citas", () => {
    const map = summarizePurchases(
      [appt("a1", "c1", "A")],
      [buy("a1", "c1", "A", 10, 1), buy("a2", "c1", "B", 99, 1)]
    );
    expect(map.get("a1")!.servicePrice).toBe(10);
  });

  it("produce exactamente una entrada por cita", () => {
    const map = summarizePurchases(
      [appt("a1", "c1", "A"), appt("a2", "c2", "B"), appt("a3", "c3", "C")],
      [
        buy("a1", "c1", "A", 10, 1),
        buy("a1", "c1", "X", 5, 0),
        buy("a2", "u1", "B", 20, 1),
        buy("a2", "u2", "B", 20, 1),
      ]
    );
    expect(map.size).toBe(3);
  });

  it("trata isPrimary null como complementario", () => {
    const map = summarizePurchases(
      [appt("a1", "c1", "A")],
      [buy("a1", "c1", "A", 10, null), buy("a1", "c1", "B", 5, null)]
    );
    const s = map.get("a1")!;
    expect(s.isComplementaryOnly).toBe(true);
    expect(s.hasPrincipal).toBe(false);
  });

  it("tolera precios nulos o NaN sin romper la suma", () => {
    const map = summarizePurchases(
      [appt("a1", "c1", "A")],
      [buy("a1", "c1", "A", 10, 1), buy("a1", "c1", "B", NaN, 0)]
    );
    expect(map.get("a1")!.servicePrice).toBe(10);
  });
});

describe("summarizePurchases · items", () => {
  it("expone una entrada por compra con id, precio y duración", () => {
    const map = summarizePurchases(
      [appt("a1", "c1", "Acrílicas Full")],
      [buy("a1", "c1", "Acrílicas Full", 35, 1, 120), buy("a1", "c1", "Diseño", 8, 0, 15)]
    );
    expect(map.get("a1")!.items).toEqual([
      { id: expect.any(String), name: "Acrílicas Full", price: 35, durationMins: 120, isPrimary: 1 },
      { id: expect.any(String), name: "Diseño", price: 8, durationMins: 15, isPrimary: 0 },
    ]);
  });

  it("NO duplica items en una sesión de curso (solo el grupo del alumno)", () => {
    const map = summarizePurchases(
      [appt("a1", "alumno1", "Curso")],
      [buy("a1", "alumno1", "Curso", 50), buy("a1", "alumno2", "Curso", 50), buy("a1", "alumno3", "Curso", 50)]
    );
    expect(map.get("a1")!.items).toHaveLength(1);
  });

  it("sin compras devuelve items vacío", () => {
    expect(summarizePurchases([appt("a1", "c1", "Acrílicas")], []).get("a1")!.items).toEqual([]);
  });
});

describe("remainingCombination", () => {
  const p = (o: { id: string; serviceName: string } & Partial<RemainingPurchase>): RemainingPurchase => ({
    serviceId: null,
    servicePrice: 0,
    serviceDurationMins: 60,
    isPrimary: null,
    ...o,
  });

  it("ordena, suma y ancla en el primero", () => {
    const r = remainingCombination([
      p({ id: "2", serviceId: "svc-2", serviceName: "Zafiro", servicePrice: 5, serviceDurationMins: 10, isPrimary: 0 }),
      p({ id: "1", serviceId: "svc-1", serviceName: "Gel", servicePrice: 25, serviceDurationMins: 60, isPrimary: 1 }),
      p({ id: "3", serviceName: "Diseño", servicePrice: 8, serviceDurationMins: 15, isPrimary: 0 }),
    ]);
    expect(r.names).toEqual(["Gel", "Diseño", "Zafiro"]);
    expect(r.items.map((i) => i.id)).toEqual(["1", "3", "2"]);
    expect(r.totalPrice).toBe(38);
    expect(r.totalDurationMins).toBe(85);
    expect(r.anchorServiceId).toBe("svc-1");
  });

  it("con lista vacía devuelve ceros y ancla nula", () => {
    expect(remainingCombination([])).toEqual({
      items: [],
      names: [],
      totalDurationMins: 0,
      totalPrice: 0,
      anchorServiceId: null,
    });
  });

  it("salta los service_id nulos para el ancla y tolera precio sucio", () => {
    const r = remainingCombination([
      p({ id: "a", serviceName: "A", servicePrice: NaN, serviceDurationMins: 30 }),
      p({ id: "b", serviceId: "svc-b", serviceName: "B", servicePrice: 10, serviceDurationMins: 30 }),
    ]);
    expect(r.anchorServiceId).toBe("svc-b");
    expect(r.totalPrice).toBe(10);
    expect(r.totalDurationMins).toBe(60);
  });
});
