import { describe, expect, it } from "vitest";
import { publicFirstName } from "./public-name";

describe("publicFirstName", () => {
  it("deja solo el nombre de pila", () => {
    expect(publicFirstName("Valery Medrano")).toBe("Valery");
    expect(publicFirstName("Ana Martínez")).toBe("Ana");
  });

  it("funciona con nombres compuestos", () => {
    expect(publicFirstName("María José Rodríguez")).toBe("María");
  });

  it("separa por cualquier espacio en blanco, no solo por un espacio", () => {
    expect(publicFirstName("  Giselle  Salazar ")).toBe("Giselle");
    expect(publicFirstName("Andrea\tLópez")).toBe("Andrea");
    expect(publicFirstName("Siloe\nNurse")).toBe("Siloe");
  });

  it("respeta un nombre de una sola palabra", () => {
    expect(publicFirstName("Ana")).toBe("Ana");
  });

  it("devuelve null cuando no hay nada que mostrar", () => {
    expect(publicFirstName(null)).toBeNull();
    expect(publicFirstName(undefined)).toBeNull();
    expect(publicFirstName("")).toBeNull();
    expect(publicFirstName("   ")).toBeNull();
  });

  it("no filtra el apellido aunque el nombre de pila sea corto", () => {
    // El bug original no era un nombre corto, era no truncar en absoluto:
    // la API devolvía `users.name` entero y el componente lo pintaba tal cual.
    expect(publicFirstName("Giselle Salazar")).not.toContain("Salazar");
  });
});
