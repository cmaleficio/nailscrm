export type InventorySearchItem = {
  id?: string | null;
  code?: string | null;
  name?: string | null;
  barcode?: string | null;
  category?: string | null;
  subcategory?: string | null;
};

function normalizeSearchText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function matchesInventoryItem(
  item: InventorySearchItem,
  query: string
): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  return [
    item.id,
    item.code,
    item.name,
    item.barcode,
    item.category,
    item.subcategory,
  ].some((value) => normalizeSearchText(value).includes(normalizedQuery));
}
