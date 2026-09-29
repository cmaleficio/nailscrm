import { describe, expect, it } from "vitest";
import {
  DEV_FALLBACK_ORIGIN,
  normalizeSiteUrl,
  resolveSiteUrl,
} from "./site-url";

describe("normalizeSiteUrl", () => {
  it("quita las barras finales", () => {
    expect(normalizeSiteUrl("https://example.com/")).toBe("https://example.com");
    expect(normalizeSiteUrl("https://example.com///")).toBe("https://example.com");
  });

  it("deja intacto un origen sin barra final", () => {
    expect(normalizeSiteUrl("https://example.com")).toBe("https://example.com");
  });

  it("recorta espacios accidentales", () => {
    expect(normalizeSiteUrl("  https://example.com/  ")).toBe("https://example.com");
  });
});

describe("resolveSiteUrl", () => {
  it("gana el valor primario", () => {
    expect(resolveSiteUrl("https://a.com/", "https://b.com")).toBe("https://a.com");
  });

  it("cae al secundario si el primario no está", () => {
    expect(resolveSiteUrl(undefined, "https://b.com/")).toBe("https://b.com");
    expect(resolveSiteUrl("", "https://b.com")).toBe("https://b.com");
  });

  it("cae al fallback de dev si no hay ninguno", () => {
    expect(resolveSiteUrl()).toBe(DEV_FALLBACK_ORIGIN);
  });
});
