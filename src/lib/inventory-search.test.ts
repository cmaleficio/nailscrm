import { describe, expect, test } from "vitest";
import { matchesInventoryItem } from "./inventory-search";

describe("matchesInventoryItem", () => {
  const item = {
    id: "GEL-001",
    name: "Esmalte Rouge",
    barcode: "7501234567890",
    category: "Esmalte",
    subcategory: "Max Glow",
  };

  test("returns true for an empty query", () => {
    expect(matchesInventoryItem(item, "")).toBe(true);
  });

  test("matches code, name, barcode, category and subcategory without case or accents", () => {
    expect(matchesInventoryItem(item, "gel")).toBe(true);
    expect(matchesInventoryItem(item, "ROUGE")).toBe(true);
    expect(matchesInventoryItem(item, "456789")).toBe(true);
    expect(matchesInventoryItem(item, "esmalte")).toBe(true);
    expect(matchesInventoryItem(item, "max glow")).toBe(true);
  });

  test("returns false when no searchable field contains the query", () => {
    expect(matchesInventoryItem(item, "azul")).toBe(false);
  });
});
