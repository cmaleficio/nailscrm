import { describe, test, expect } from "vitest";
import {
  normalizeName,
  levenshtein,
  nameSimilarity,
  maskPhone,
  NAME_MATCH_THRESHOLD,
} from "./name-match";

describe("normalizeName", () => {
  test("folds accents, case, punctuation and extra spaces", () => {
    expect(normalizeName("  Ana   Martínez, Sra. ")).toBe("ana martinez sra");
  });

  test("keeps numbers (apartamentos, segundnombre)", () => {
    expect(normalizeName("Luz 4ta Avenida")).toBe("luz 4ta avenida");
  });

  test("empty for blank input", () => {
    expect(normalizeName("   ")).toBe("");
    expect(normalizeName("...")).toBe("");
  });
});

describe("levenshtein", () => {
  test("computes edit distance", () => {
    expect(levenshtein("ana", "ana")).toBe(0);
    expect(levenshtein("ana", "anabella")).toBe(5);
    expect(levenshtein("martinez", "martine")).toBe(1);
    expect(levenshtein("", "abc")).toBe(3);
  });
});

describe("nameSimilarity", () => {
  test("exact normalized match scores 1", () => {
    expect(nameSimilarity("Ana Martínez", "ana  martínez")).toBe(1);
  });

  test("reordered tokens score 0.9", () => {
    const s = nameSimilarity("Ana García Martínez", "Ana Martínez García");
    expect(s).toBe(0.9);
  });

  test("token subset scores 0.85 (apellido compuesto)", () => {
    const s = nameSimilarity("Ana Martínez", "Ana Martínez García");
    expect(s).toBe(0.85);
  });

  test("one-typo names score above threshold", () => {
    // 1 char de diferencia sobre 12 → 0.917
    const s = nameSimilarity("Ana Martínez", "Ana Marínez");
    expect(s).toBeGreaterThan(NAME_MATCH_THRESHOLD);
    expect(s).toBeCloseTo(1 - 1 / 12, 2);
  });

  test("two-typo names on long names still match", () => {
    // 2 chars sobre 14 → 0.857
    const s = nameSimilarity("Mariana González", "Mariana Gonxálezs");
    expect(s).toBeGreaterThanOrEqual(NAME_MATCH_THRESHOLD);
  });

  test("same first name + same last initial scores 0.75", () => {
    const s = nameSimilarity("Ana Martínez", "Ana Marín");
    expect(s).toBe(0.75);
  });

  test("clearly different people score below threshold", () => {
    expect(nameSimilarity("Ana Martínez", "Carla Pérez")).toBeLessThan(
      NAME_MATCH_THRESHOLD
    );
    expect(nameSimilarity("Ana Martínez", "Ana")).toBeLessThan(
      NAME_MATCH_THRESHOLD
    );
  });

  test("empty name never matches", () => {
    expect(nameSimilarity("", "Ana Martínez")).toBe(0);
    expect(nameSimilarity("Ana Martínez", "")).toBe(0);
  });
});

describe("maskPhone", () => {
  test("shows only last 4 digits", () => {
    expect(maskPhone("+58 412 123 4567")).toBe("****4567");
  });

  test("short or missing phone", () => {
    expect(maskPhone(null)).toBe("—");
    expect(maskPhone("12")).toBe("****");
  });
});
