import { describe, expect, test } from "vitest";
import {
  expandLegacyPermissions,
  parseStoredPermissions,
  PERMISSION_KEYS,
} from "./permissions";

describe("permission keys", () => {
  test("includes independent permissions for configuration modules", () => {
    expect(PERMISSION_KEYS).toEqual(
      expect.arrayContaining([
        "brandSettings",
        "workingHours",
        "exchangeRates",
        "legalSettings",
        "navigation",
      ])
    );
    expect(PERMISSION_KEYS).not.toContain("settings");
  });
});

describe("expandLegacyPermissions", () => {
  test("expands the legacy settings permission to all configuration modules", () => {
    const expanded = expandLegacyPermissions(["settings", "clients"]);

    expect(new Set(expanded)).toEqual(
      new Set([
        "clients",
        "brandSettings",
        "workingHours",
        "exchangeRates",
        "legalSettings",
        "navigation",
      ])
    );
  });

  test("does not duplicate permissions when expanded values are repeated", () => {
    expect(expandLegacyPermissions(["settings", "workingHours", "settings"])).toEqual([
      "brandSettings",
      "workingHours",
      "exchangeRates",
      "legalSettings",
      "navigation",
    ]);
  });
});

describe("parseStoredPermissions", () => {
  test("returns null (full access) when nothing is stored", () => {
    expect(parseStoredPermissions(null)).toBeNull();
    expect(parseStoredPermissions(undefined)).toBeNull();
    expect(parseStoredPermissions("")).toBeNull();
  });

  test("expands the legacy settings permission coming from the database", () => {
    const parsed = parseStoredPermissions('["appointments","settings"]');

    expect(new Set(parsed ?? [])).toEqual(
      new Set([
        "appointments",
        "brandSettings",
        "workingHours",
        "exchangeRates",
        "legalSettings",
        "navigation",
      ])
    );
    expect(parsed).not.toContain("settings");
  });

  test("keeps granular permissions untouched", () => {
    expect(parseStoredPermissions('["clients","brandSettings"]')).toEqual([
      "clients",
      "brandSettings",
    ]);
  });

  test("denies every module when the stored value is corrupted", () => {
    expect(parseStoredPermissions("not-json")).toEqual([]);
    expect(parseStoredPermissions('{"clients":true}')).toEqual([]);
    expect(parseStoredPermissions("[1,2,3]")).toEqual([]);
    expect(parseStoredPermissions("[]")).toEqual([]);
  });
});
