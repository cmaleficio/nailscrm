import { describe, expect, it } from "vitest";
import { generateSlots, maxContiguousMins, type SlotInput } from "./slots";

/** Epoch del inicio del día (00:00 -04:00) para la fecha de prueba. */
function dayStartTs(date: string): number {
  return Math.floor(new Date(date + "T00:00:00-04:00").getTime() / 1000);
}

/** Timestamp del minuto `m` del día. */
function at(date: string, m: number): number {
  return dayStartTs(date) + m * 60;
}

const DATE = "2026-09-28";

const HOY = new Date();
const manana = new Date(HOY.getTime() + 3 * 86400000);
const fechaFutura = `${manana.getFullYear()}-${String(manana.getMonth() + 1).padStart(2, "0")}-${String(manana.getDate()).padStart(2, "0")}`;

function input(over: Partial<SlotInput> = {}): SlotInput {
  return {
    date: fechaFutura,
    durationMins: 60,
    existingAppointments: [],
    blockouts: [],
    openMin: 9 * 60,
    closeMin: 18 * 60,
    ...over,
  };
}

describe("generateSlots", () => {
  it("genera el grid cada 15 min anclado a la apertura", () => {
    const slots = generateSlots(input());
    expect(slots[0].label).toBe("09:00");
    expect(slots[1].label).toBe("09:15");
    expect(slots[2].label).toBe("09:30");
    expect(slots[3].label).toBe("09:45");
    expect(slots[4].hour).toBe(10);
    expect(slots[4].minute).toBe(0);
  });

  it("el último slot es el último que alcanza a terminar antes del cierre", () => {
    const slots = generateSlots(input({ durationMins: 60 }));
    const last = slots[slots.length - 1];
    expect(last.label).toBe("17:00");
  });

  it("una duración mayor que la ventana devuelve grid vacío", () => {
    expect(generateSlots(input({ durationMins: 600 }))).toEqual([]);
  });

  it("marca ocupado el slot que solapa con una cita", () => {
    const slots = generateSlots(
      input({
        durationMins: 60,
        existingAppointments: [
          { startTime: at(fechaFutura, 10 * 60), endTime: at(fechaFutura, 11 * 60) },
        ],
      })
    );
    const byLabel = Object.fromEntries(slots.map((s) => [s.label, s.available]));
    expect(byLabel["09:00"]).toBe(true);
    expect(byLabel["10:00"]).toBe(false);
    expect(byLabel["10:30"]).toBe(false);
    expect(byLabel["11:00"]).toBe(true);
  });

  it("el solapamiento es semiabierto: terminar justo cuando empieza la otra está libre", () => {
    const slots = generateSlots(
      input({
        durationMins: 60,
        existingAppointments: [
          { startTime: at(fechaFutura, 11 * 60), endTime: at(fechaFutura, 12 * 60) },
        ],
      })
    );
    const byLabel = Object.fromEntries(slots.map((s) => [s.label, s.available]));
    expect(byLabel["10:00"]).toBe(true); // 10:00-11:00, toca 11:00 pero no solapa
  });

  it("respeta los blockouts", () => {
    const slots = generateSlots(
      input({
        durationMins: 60,
        blockouts: [
          { startTime: at(fechaFutura, 14 * 60), endTime: at(fechaFutura, 16 * 60) },
        ],
      })
    );
    const byLabel = Object.fromEntries(slots.map((s) => [s.label, s.available]));
    expect(byLabel["13:00"]).toBe(true);
    expect(byLabel["14:00"]).toBe(false);
    expect(byLabel["15:00"]).toBe(false);
    expect(byLabel["16:00"]).toBe(true);
  });

  it("descarta slots en el pasado", () => {
    const hoyStr = `${HOY.getFullYear()}-${String(HOY.getMonth() + 1).padStart(2, "0")}-${String(HOY.getDate()).padStart(2, "0")}`;
    const slots = generateSlots(input({ date: hoyStr, durationMins: 15 }));
    const nowMin = (Math.floor(Date.now() / 1000) - dayStartTs(hoyStr)) / 60;
    for (const s of slots) {
      const m = s.hour * 60 + s.minute;
      if (m <= nowMin) expect(s.available).toBe(false);
    }
  });

  it("una duración compuesta larga deja menos slots", () => {
    const corto = generateSlots(input({ durationMins: 60 }));
    const largo = generateSlots(input({ durationMins: 210 }));
    expect(largo.length).toBeLessThan(corto.length);
    expect(largo[0].label).toBe("09:00");
    expect(largo[largo.length - 1].label).toBe("14:30");
  });
});

describe("maxContiguousMins", () => {
  it("con el día libre devuelve toda la ventana", () => {
    expect(maxContiguousMins(input())).toBe(9 * 60);
  });

  it("con una cita al medio devuelve el mayor de los dos huecos", () => {
    const r = maxContiguousMins(
      input({
        existingAppointments: [
          { startTime: at(fechaFutura, 12 * 60), endTime: at(fechaFutura, 13 * 60) },
        ],
      })
    );
    expect(r).toBe(5 * 60); // el hueco mayor es 13:00 -> 18:00
  });

  it("con una cita larga al inicio devuelve solo el hueco final", () => {
    const r = maxContiguousMins(
      input({
        existingAppointments: [
          { startTime: at(fechaFutura, 9 * 60), endTime: at(fechaFutura, 16 * 60) },
        ],
      })
    );
    expect(r).toBe(2 * 60);
  });

  it("no reporta capacidad dentro de un bloque ya reservado", () => {
    const r = maxContiguousMins(
      input({
        existingAppointments: [
          { startTime: at(fechaFutura, 10 * 60), endTime: at(fechaFutura, 12 * 60) },
        ],
      })
    );
    // 09:00-10:00 (60) vs 12:00-18:00 (360)
    expect(r).toBe(6 * 60);
  });

  it("con el día completo devuelve 0", () => {
    const r = maxContiguousMins(
      input({
        existingAppointments: [
          { startTime: at(fechaFutura, 9 * 60), endTime: at(fechaFutura, 18 * 60) },
        ],
      })
    );
    expect(r).toBe(0);
  });

  it("suma los blockouts como ocupación", () => {
    const r = maxContiguousMins(
      input({
        blockouts: [
          { startTime: at(fechaFutura, 9 * 60), endTime: at(fechaFutura, 12 * 60) },
        ],
      })
    );
    expect(r).toBe(6 * 60);
  });

  it("respeta el cierre si es antes que el fin de la cita", () => {
    const r = maxContiguousMins(
      input({
        closeMin: 15 * 60,
        existingAppointments: [
          { startTime: at(fechaFutura, 10 * 60), endTime: at(fechaFutura, 14 * 60) },
        ],
      })
    );
    expect(r).toBe(60);
  });

  it("es >= toda duración que generateSlots marca disponible", () => {
    const ocupado = [
      { startTime: at(fechaFutura, 11 * 60), endTime: at(fechaFutura, 12 * 60 + 30) },
      { startTime: at(fechaFutura, 14 * 60), endTime: at(fechaFutura, 16 * 60) },
    ];
    const max = maxContiguousMins(input({ existingAppointments: ocupado }));
    for (const dur of [15, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 420, 480, 540]) {
      const any = generateSlots(
        input({ durationMins: dur, existingAppointments: ocupado })
      ).some((s) => s.available);
      if (any) expect(dur).toBeLessThanOrEqual(max);
    }
  });
});
