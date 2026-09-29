import { describe, it, expect } from "vitest";
import {
  foldSearchText,
  dayKeyFromTimestamp,
  dayLabelFromKey,
  groupPhotosByDay,
  buildProductionCaption,
  isDayKey,
  escapeLikePattern,
  parseProductionFilters,
} from "./production-photos";

const TZ = "America/Caracas";

function ts(iso: string): number {
  return Date.parse(iso) / 1000;
}

describe("foldSearchText", () => {
  it("quita tildes y baja a minúsculas", () => {
    expect(foldSearchText("Martínez")).toBe("martinez");
    expect(foldSearchText("ÁNGELA")).toBe("angela");
  });

  it("tolera null, undefined y números", () => {
    expect(foldSearchText(null)).toBe("");
    expect(foldSearchText(undefined)).toBe("");
    expect(foldSearchText(42)).toBe("42");
  });

  it("es idempotente", () => {
    const once = foldSearchText("Rodríguez Ñ");
    expect(foldSearchText(once)).toBe(once);
  });
});

describe("dayKeyFromTimestamp", () => {
  it("usa el día local del salón, no el de UTC", () => {
    // 2026-01-12T02:00:00Z son las 22:00 del 11 de enero en Caracas (UTC-4).
    expect(dayKeyFromTimestamp(ts("2026-01-12T02:00:00Z"), TZ)).toBe("2026-01-11");
  });

  it("no corre el día cuando ya es medianoche en el salón", () => {
    // 2026-01-12T05:00:00Z son las 01:00 del 12 de enero en Caracas.
    expect(dayKeyFromTimestamp(ts("2026-01-12T05:00:00Z"), TZ)).toBe("2026-01-12");
  });

  it("cae exactamente en la frontera de medianoche", () => {
    // 2026-01-12T04:00:00Z son las 00:00 del 12 de enero en Caracas.
    expect(dayKeyFromTimestamp(ts("2026-01-12T04:00:00Z"), TZ)).toBe("2026-01-12");
  });

  it("tolera 0 como timestamp", () => {
    expect(dayKeyFromTimestamp(0, TZ)).toBe("1969-12-31");
  });
});

describe("isDayKey", () => {
  it("acepta fechas reales", () => {
    expect(isDayKey("2026-01-12")).toBe(true);
    expect(isDayKey("2026-02-29")).toBe(false);
  });

  it("rechaza basura", () => {
    expect(isDayKey("")).toBe(false);
    expect(isDayKey("2026-1-12")).toBe(false);
    expect(isDayKey("12-01-2026")).toBe(false);
    expect(isDayKey("2026-13-01")).toBe(false);
    expect(isDayKey("ayer")).toBe(false);
    expect(isDayKey(null)).toBe(false);
  });
});

describe("dayLabelFromKey", () => {
  it("no cambia de día al re-formatear la clave", () => {
    // El round-trip clave -> fecha -> etiqueta tiene que devolver el 12 de enero,
    // no el 11, que es lo que pasaría si se interpretara la clave en hora local.
    const label = dayLabelFromKey("2026-01-12");
    expect(label).toContain("lunes");
    expect(label).toContain("12");
    expect(label).toContain("enero");
  });
});

describe("groupPhotosByDay", () => {
  it("agrupa por día local y ordena los días del más reciente al más antiguo", () => {
    const photos = [
      { id: "a", startTime: ts("2026-01-12T15:00:00Z") },
      { id: "b", startTime: ts("2026-01-10T15:00:00Z") },
      { id: "c", startTime: ts("2026-01-12T16:00:00Z") },
    ];
    const days = groupPhotosByDay(photos, TZ);
    expect(days.map((d) => d.date)).toEqual(["2026-01-12", "2026-01-10"]);
    expect(days[0].photos.map((p) => p.id)).toEqual(["a", "c"]);
    expect(days[0].count).toBe(2);
    expect(days[1].count).toBe(1);
  });

  it("respeta el orden de entrada dentro del día", () => {
    const photos = [
      { id: "primero", startTime: ts("2026-01-12T15:00:00Z") },
      { id: "segundo", startTime: ts("2026-01-12T15:00:00Z") },
    ];
    expect(groupPhotosByDay(photos, TZ)[0].photos.map((p) => p.id)).toEqual([
      "primero",
      "segundo",
    ]);
  });

  it("colapsa al mismo día del salón dos citas de días UTC distintos", () => {
    // 19:00 del 12 y 22:00 del 12 en Caracas: en UTC son 12 y 13, pero el
    // archivo está indexado por el día que vio la clienta, no por el del UTC.
    const photos = [
      { id: "tarde", startTime: ts("2026-01-12T23:00:00Z") },
      { id: "noche", startTime: ts("2026-01-13T02:00:00Z") },
    ];
    const days = groupPhotosByDay(photos, TZ);
    expect(days).toHaveLength(1);
    expect(days[0].date).toBe("2026-01-12");
    expect(days[0].count).toBe(2);
  });

  it("devuelve vacío sin entrada", () => {
    expect(groupPhotosByDay([], TZ)).toEqual([]);
  });

  it("no muta el arreglo original", () => {
    const photos = [
      { id: "b", startTime: ts("2026-01-10T15:00:00Z") },
      { id: "a", startTime: ts("2026-01-12T15:00:00Z") },
    ];
    const snapshot = photos.map((p) => p.id);
    groupPhotosByDay(photos, TZ);
    expect(photos.map((p) => p.id)).toEqual(snapshot);
  });
});

describe("buildProductionCaption", () => {
  it("une servicio, clienta y fecha", () => {
    const caption = buildProductionCaption({
      serviceName: "Gel Semipermanente",
      clientName: "Ana Martínez",
      startTime: ts("2026-01-12T15:00:00Z"),
      timeZone: TZ,
    });
    expect(caption).toContain("Gel Semipermanente");
    expect(caption).toContain("Ana Martínez");
    expect(caption).toContain("2026");
  });

  it("omite los tramos que no existen sin dejar separadores colgantes", () => {
    const caption = buildProductionCaption({
      serviceName: null,
      clientName: "Ana",
      startTime: ts("2026-01-12T15:00:00Z"),
      timeZone: TZ,
    });
    expect(caption.startsWith("Ana")).toBe(true);
    expect(caption).not.toContain("·  ");
    expect(caption.endsWith("·")).toBe(false);
  });

  it("devuelve cadena vacía si no hay nada que mostrar", () => {
    expect(
      buildProductionCaption({
        serviceName: null,
        clientName: null,
        startTime: null,
        timeZone: TZ,
      })
    ).toBe("");
  });
});

describe("escapeLikePattern", () => {
  it("escapa los comodines de LIKE", () => {
    expect(escapeLikePattern("50%")).toBe("50\\%");
    expect(escapeLikePattern("a_b")).toBe("a\\_b");
    expect(escapeLikePattern("c\\d")).toBe("c\\\\d");
  });

  it("deja intacto el texto normal", () => {
    expect(escapeLikePattern("ana martinez")).toBe("ana martinez");
  });
});

describe("parseProductionFilters", () => {
  it("lee los filtros válidos", () => {
    const params = new URLSearchParams({
      from: "2026-01-01",
      to: "2026-01-31",
      before: "2026-02-01",
      serviceId: "svc-1",
      q: "  Ana  ",
    });
    expect(parseProductionFilters(params)).toEqual({
      from: "2026-01-01",
      to: "2026-01-31",
      before: "2026-02-01",
      serviceId: "svc-1",
      q: "ana",
    });
  });

  it("descarta fechas imposibles en vez de romper", () => {
    const params = new URLSearchParams({
      from: "2026-01-01",
      to: "2026-13-45",
      before: "ayer",
    });
    expect(parseProductionFilters(params)).toEqual({
      from: "2026-01-01",
      to: null,
      before: null,
      serviceId: null,
      q: "",
    });
  });

  // `before` y `from` son ejes independientes: `from` acota el rango y `before`
  // es el cursor de paginación. El cliente solo envía `before` cuando ya
  // agotó el rango, pero el endpoint no debe descartar un cursor válido.
  it("conserva un before válido aunque sea posterior al from", () => {
    const params = new URLSearchParams({
      from: "2026-01-10",
      before: "2026-01-20",
    });
    expect(parseProductionFilters(params).before).toBe("2026-01-20");
  });

  it("devuelve todo en null con un URLSearchParams vacío", () => {
    expect(parseProductionFilters(new URLSearchParams())).toEqual({
      from: null,
      to: null,
      before: null,
      serviceId: null,
      q: "",
    });
  });
});
