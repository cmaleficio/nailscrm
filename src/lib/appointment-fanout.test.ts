import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Cargar compras de una cita con leftJoin multiplica la fila de la cita por
 * cada compra: una cita de 3 servicios salía 3 veces y en el portal
 * `key={appt.id}` se duplicaba. El patrón correcto es cargar las compras
 * aparte y fusionarlas con summarizePurchases, que ya distingue las compras
 * del grupo de las de otros alumnos en las sesiones de curso.
 *
 * No hay forma de testear esto en runtime sin montar la BD, así que se blinda
 * la fuente: si alguien reintroduce el JOIN, esto falla.
 */
const READERS: [string, string][] = [
  ["src/app/(client)/profile/page.tsx", "../app/(client)/profile/page.tsx"],
  ["src/app/api/appointments/route.ts", "../app/api/appointments/route.ts"],
  ["src/app/api/gallery/route.ts", "../app/api/gallery/route.ts"],
  ["src/app/api/production-photos/route.ts", "../app/api/production-photos/route.ts"],
  ["src/app/api/clients/[id]/route.ts", "../app/api/clients/[id]/route.ts"],
];

describe("citas + compras sin fan-out", () => {
  for (const [label, relative] of READERS) {
    it(`${label} no hace leftJoin a service_purchases`, () => {
      const source = readFileSync(new URL(relative, import.meta.url), "utf8");
      expect(source).not.toMatch(/leftJoin\(\s*schema\.servicePurchases/);
    });
  }
});