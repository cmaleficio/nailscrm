import { describe, expect, it } from "vitest";
import {
  MAX_COMPLEMENTARY_SERVICES,
  formatServiceNames,
  parseComplementaryIds,
  resolveBookingServices,
  type ServiceRoleRow,
  classifyBookingEntry,
  clearPreselected,
  partitionBookingServices,
} from "./booking-combos";

function svc(over: Partial<ServiceRoleRow> & { id: string }): ServiceRoleRow {
  return {
    name: `Servicio ${over.id}`,
    price: 10,
    durationMins: 30,
    isActive: 1,
    isGroup: 0,
    isComplementary: 0,
    ...over,
  };
}

const set = {
  full: svc({ id: "full", name: "Acrílicas Full", price: 35, durationMins: 120 }),
  gel: svc({ id: "gel", name: "Gel Semipermanente", price: 25, durationMins: 60 }),
  matiz: svc({
    id: "matiz",
    name: "Matiz",
    price: 5,
    durationMins: 15,
    isComplementary: 1,
  }),
  diseno: svc({
    id: "diseno",
    name: "Diseño",
    price: 8,
    durationMins: 30,
    isComplementary: 1,
  }),
  curso: svc({ id: "curso", name: "Curso", price: 50, durationMins: 180, isGroup: 1 }),
};

const all = [set.full, set.gel, set.matiz, set.diseno, set.curso];

describe("parseComplementaryIds", () => {
  it("acepta string separado por comas, array y null", () => {
    expect(parseComplementaryIds("a,b")).toEqual(["a", "b"]);
    expect(parseComplementaryIds(["a", "b"])).toEqual(["a", "b"]);
    expect(parseComplementaryIds(null)).toEqual([]);
    expect(parseComplementaryIds(undefined)).toEqual([]);
    expect(parseComplementaryIds("")).toEqual([]);
  });

  it("recorta, deduplica y descarta vacíos", () => {
    expect(parseComplementaryIds(" a , b ,a ,, b ")).toEqual(["a", "b"]);
  });

  it("mezcla array con comas internas", () => {
    expect(parseComplementaryIds(["a,b", "c"])).toEqual(["a", "b", "c"]);
  });
});

describe("formatServiceNames", () => {
  it("une con + y filtra vacíos", () => {
    expect(formatServiceNames(["A", "B", "C"])).toBe("A + B + C");
    expect(formatServiceNames(["A", ""])).toBe("A");
    expect(formatServiceNames([])).toBe("");
  });
});

describe("resolveBookingServices", () => {
  it("exige al menos un servicio", () => {
    expect(resolveBookingServices(all, null, null).error).toBe(
      "Elige al menos un servicio"
    );
    expect(resolveBookingServices(all, "", []).error).toBe(
      "Elige al menos un servicio"
    );
  });

  it("resuelve principal + complementarios y suma duración y precio", () => {
    const r = resolveBookingServices(all, "full", ["matiz", "diseno"]);
    expect(r.error).toBeNull();
    expect(r.principal?.id).toBe("full");
    expect(r.complementaries.map((c) => c.id)).toEqual(["matiz", "diseno"]);
    expect(r.totalDurationMins).toBe(120 + 15 + 30);
    expect(r.totalPrice).toBe(35 + 5 + 8);
    expect(r.services.map((s) => s.id)).toEqual(["full", "matiz", "diseno"]);
  });

  it("permite apilar complementarios sin ninguna principal", () => {
    const r = resolveBookingServices(all, null, ["matiz", "diseno"]);
    expect(r.error).toBeNull();
    expect(r.principal).toBeNull();
    expect(r.totalDurationMins).toBe(45);
    expect(r.totalPrice).toBe(13);
  });

  it("permite un solo complementario sin principal", () => {
    const r = resolveBookingServices(all, null, ["matiz"]);
    expect(r.error).toBeNull();
    expect(r.totalDurationMins).toBe(15);
  });

  it("usa la principal como ancla y el primer complementario si no hay principal", () => {
    expect(resolveBookingServices(all, "full", ["matiz"]).anchorServiceId).toBe("full");
    expect(resolveBookingServices(all, null, ["diseno", "matiz"]).anchorServiceId).toBe(
      "diseno"
    );
  });

  it("rechaza una principal inexistente o inactiva", () => {
    expect(resolveBookingServices(all, "nope", null).error).toBe(
      "El servicio principal no existe"
    );
    const inactive = resolveBookingServices(
      [svc({ id: "x", isActive: 0 })],
      "x",
      null
    );
    expect(inactive.error).toBe("El servicio principal está inactivo");
  });

  it("un principal que es complementario no es un principal: se resuelve como cita solo de complementarios", () => {
    // Ambas UIs anclan con el primer complementario elegido cuando no hay
    // principal, así que el id llega en el slot de serviceId. Antes esto era un
    // 400 que rompía /book?serviceId=<COMPLEMENTARIO> sin principal.
    const r = resolveBookingServices(all, "matiz", null);
    expect(r.error).toBeNull();
    expect(r.principal).toBeNull();
    expect(r.complementaries.map((c) => c.id)).toEqual(["matiz"]);
    expect(r.services.map((s) => s.id)).toEqual(["matiz"]);
    expect(r.anchorServiceId).toBe("matiz");
    expect(r.totalDurationMins).toBe(15);
    expect(r.totalPrice).toBe(5);
  });

  it("el principal complementario se suma a los del input sin duplicarse y ancla primero", () => {
    const r = resolveBookingServices(all, "matiz", ["matiz", "diseno"]);
    expect(r.error).toBeNull();
    expect(r.principal).toBeNull();
    expect(r.complementaries.map((c) => c.id)).toEqual(["matiz", "diseno"]);
    expect(r.anchorServiceId).toBe("matiz");
    expect(r.totalDurationMins).toBe(45);
    expect(r.totalPrice).toBe(13);
  });

  it("el principal complementario se valida como complementario (inactivo, curso, no marcado)", () => {
    const inactive = resolveBookingServices(
      [svc({ id: "m", isComplementary: 1, isActive: 0 })],
      "m",
      null
    );
    expect(inactive.error).toBe('El servicio "Servicio m" está inactivo');

    const cursoComp = svc({ id: "cc", isGroup: 1, isComplementary: 1 });
    expect(resolveBookingServices([cursoComp], "cc", null).error).toBe(
      "Un curso no se puede agregar como servicio complementario"
    );
  });

  it("el principal complementario cuenta para el tope de complementarios", () => {
    const many = Array.from({ length: MAX_COMPLEMENTARY_SERVICES }, (_, i) =>
      svc({ id: `c${i}`, isComplementary: 1 })
    );
    const rows = [...all, ...many];
    // 4 del input + el principal anclado = 5, uno por encima del tope.
    expect(resolveBookingServices(rows, "matiz", many.map((m) => m.id)).error).toBe(
      `Puedes agregar hasta ${MAX_COMPLEMENTARY_SERVICES} servicios complementarios`
    );
    // 3 del input + el principal anclado = 4, exactamente el tope.
    const ok = resolveBookingServices(rows, "matiz", many.slice(0, 3).map((m) => m.id));
    expect(ok.error).toBeNull();
    expect(ok.complementaries).toHaveLength(MAX_COMPLEMENTARY_SERVICES);
  });

  it("no pliega una principal normal: sigue siendo principal", () => {
    const r = resolveBookingServices(all, "full", ["matiz"]);
    expect(r.principal?.id).toBe("full");
    expect(r.complementaries.map((c) => c.id)).toEqual(["matiz"]);
    expect(r.anchorServiceId).toBe("full");
  });

  it("deja agendar un curso solo, pero nunca combinado", () => {
    // Un curso se sigue agendando como un servicio normal (POST /api/appointments
    // hoy crea 1 cita + 1 compra sin inscripción). La combinación es lo nuevo que
    // se prohíbe, para no alterar el flujo de cursos ya en uso.
    const solo = resolveBookingServices(all, "curso", null);
    expect(solo.error).toBeNull();
    expect(solo.services).toHaveLength(1);
    expect(solo.totalDurationMins).toBe(180);
    expect(solo.totalPrice).toBe(50);

    expect(resolveBookingServices(all, "curso", ["matiz"]).error).toBe(
      "Un curso no se puede combinar con servicios complementarios"
    );
    // Guarda defensiva: POST/PATCH de servicios impide marcar grupo y
    // complementario a la vez, así que esta combinación no debería existir.
    const cursoComp = svc({
      id: "cursoComp",
      name: "Curso",
      isGroup: 1,
      isComplementary: 1,
    });
    expect(
      resolveBookingServices([...all, cursoComp], "full", ["cursoComp"]).error
    ).toBe("Un curso no se puede agregar como servicio complementario");
  });

  it("rechaza un complementario inexistente, inactivo o no marcado", () => {
    expect(resolveBookingServices(all, "full", ["nope"]).error).toBe(
      "Uno de los servicios complementarios no existe"
    );
    const inactive = resolveBookingServices(
      [set.full, svc({ id: "m", isComplementary: 1, isActive: 0 })],
      "full",
      ["m"]
    );
    expect(inactive.error).toBe('El servicio "Servicio m" está inactivo');
    expect(resolveBookingServices(all, "full", ["gel"]).error).toBe(
      '"Gel Semipermanente" no es un servicio complementario'
    );
  });

  it("rechaza repetir la principal en la lista de complementarios", () => {
    expect(resolveBookingServices(all, "full", ["full"]).error).toBe(
      "El servicio principal no puede repetirse como complementario"
    );
  });

  it("aplica el tope de complementarios", () => {
    const many = Array.from({ length: MAX_COMPLEMENTARY_SERVICES + 1 }, (_, i) =>
      svc({ id: `c${i}`, isComplementary: 1 })
    );
    const r = resolveBookingServices([...all, ...many], "full", many.map((m) => m.id));
    expect(r.error).toBe(
      `Puedes agregar hasta ${MAX_COMPLEMENTARY_SERVICES} servicios complementarios`
    );
  });

  it("acepta exactamente el tope", () => {
    const many = Array.from({ length: MAX_COMPLEMENTARY_SERVICES }, (_, i) =>
      svc({ id: `c${i}`, isComplementary: 1 })
    );
    const r = resolveBookingServices([...all, ...many], "full", many.map((m) => m.id));
    expect(r.error).toBeNull();
    expect(r.complementaries).toHaveLength(MAX_COMPLEMENTARY_SERVICES);
  });

  it("deduplica los complementarios repetidos en el input", () => {
    const r = resolveBookingServices(all, "full", "matiz,matiz,diseno");
    expect(r.error).toBeNull();
    expect(r.complementaries.map((c) => c.id)).toEqual(["matiz", "diseno"]);
  });
});

describe("classifyBookingEntry", () => {
  it("un principal preseleccionado es principal", () => {
    expect(classifyBookingEntry({ id: "a", isComplementary: 0 }, "a")).toBe("principal");
  });

  it("un complementario preseleccionado es complementario (se ofrece agregar, no se ignora)", () => {
    expect(classifyBookingEntry({ id: "b", isComplementary: 1 }, "b")).toBe("complementary");
  });

  it("una respuesta de la API que no es el servicio pedido se ignora", () => {
    expect(classifyBookingEntry({ id: "otro", isComplementary: 0 }, "a")).toBe("ignore");
    expect(classifyBookingEntry(null, "a")).toBe("ignore");
    expect(classifyBookingEntry({ id: "a", isComplementary: 0 }, null)).toBe("ignore");
  });
});

describe("partitionBookingServices", () => {
  const catalogo = [
    { id: "a", isComplementary: 0 },
    { id: "b", isComplementary: 0 },
    { id: "c", isComplementary: 1 },
    { id: "d", isComplementary: 1 },
  ];

  it("sin preselección separa principales de complementarios", () => {
    const r = partitionBookingServices(catalogo, null);
    expect(r.principal.map((s) => s.id)).toEqual(["a", "b"]);
    expect(r.complementary.map((s) => s.id)).toEqual(["c", "d"]);
  });

  it("con preselección de un principal no ofrece principales (no hay a qué cambiar)", () => {
    const r = partitionBookingServices(catalogo, "a");
    expect(r.principal).toEqual([]);
    expect(r.complementary.map((s) => s.id)).toEqual(["c", "d"]);
  });

  it("con preselección de un complementario no lo repite en la lista", () => {
    const r = partitionBookingServices(catalogo, "c");
    expect(r.principal).toEqual([]);
    expect(r.complementary.map((s) => s.id)).toEqual(["d"]);
  });
});

describe("clearPreselected", () => {
  const a = { id: "a", isComplementary: 0 };
  const c = { id: "c", isComplementary: 1 };

  it("si era el principal, lo suelta", () => {
    const r = clearPreselected(a, [], "a");
    expect(r.primary).toBeNull();
    expect(r.complementaries).toEqual([]);
  });

  it("si era complementario, lo quita de los complementarios y conserva el resto", () => {
    const r = clearPreselected(null, [a, c], "c");
    expect(r.primary).toBeNull();
    expect(r.complementaries.map((s) => s.id)).toEqual(["a"]);
  });

  it("es idempotente cuando el id no está en ninguna de las dos listas", () => {
    const r = clearPreselected(null, [a], "zzz");
    expect(r.complementaries.map((s) => s.id)).toEqual(["a"]);
  });
});