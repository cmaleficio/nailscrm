import { describe, test, expect } from "vitest";
import * as schema from "@/db/schema";
import {
  getAppSetting,
  setAppSetting,
  isDuplicateDetectionEnabled,
} from "./app-settings";
import { createMergeTestDb } from "./merge-clients.test-helpers";

describe("app settings", () => {
  test("returns the fallback when the key has no row", () => {
    const db = createMergeTestDb();
    expect(getAppSetting(db, "detectDuplicateClients", "0")).toBe("0");
    expect(isDuplicateDetectionEnabled(db)).toBe(false);
  });

  test("set + get roundtrip and update on conflict", () => {
    const db = createMergeTestDb();
    setAppSetting(db, "detectDuplicateClients", "1");
    expect(isDuplicateDetectionEnabled(db)).toBe(true);
    expect(getAppSetting(db, "detectDuplicateClients", "0")).toBe("1");

    setAppSetting(db, "detectDuplicateClients", "0");
    expect(isDuplicateDetectionEnabled(db)).toBe(false);
    // Sigue habiendo una sola fila (upsert, no duplica)
    const rows = db.select().from(schema.appSettings).all();
    expect(rows).toHaveLength(1);
  });
});
