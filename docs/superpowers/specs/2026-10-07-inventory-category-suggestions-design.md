# Spec: Inventory Category/Subcategory Suggestions on Create/Edit

## Problem

When creating or editing an inventory item, there's no mechanism to prevent duplicate categories/subcategories or to guide the admin toward existing options. This leads to:
- Same category created multiple times (e.g., "Esmalte" created 3 different ways)
- Unnecessary/cryptic subcategories
- Inconsistent naming across the inventory

## Current Behavior

The `inventoryItems` table in `src/db/schema.ts` has `category` (text) and `subcategory` (text) fields, but:
- No validation on create/edit to prevent duplicates
- No suggestions displayed to the admin
- Admin types freely, creating inconsistent data

## Requirements

1. **Server-side category suggestions**: When creating/editing an inventory item, fetch existing categories from the database and display as clickable chips.

2. **Server-side subcategory suggestions**: Similarly, fetch existing subcategories for the selected category (or globally) and display as chips.

3. **Prevent obvious duplicates**: If admin types a category that already exists (case-insensitive, accent-insensitive), show the existing option and prefer it over creating a new one.

4. **Allow new categories/subcategories**: Admin should still be able to type a new category/subcategory if none exist matching their intent.

5. **Client-side search experience**: Suggestions should appear as the admin types, similar to tag input components.

6. **Normalization**: Use the same `foldSearchText` normalization (accent-insensitive, case-insensitive) for matching existing categories.

## Affected Files

- `src/app/api/inventory/items/route.ts` - API endpoint for create/update (need to add suggestions fetching)
- `src/app/api/inventory/items/\[id\]/route.ts` - API endpoint for item by ID
- `src/components/inventory/` - Inventory item form components (Need to identify existing components)
- `src/lib/inventory-search.ts` - Already has `matchesInventoryItem` with normalization - can reuse

## Implementation Details

### API Endpoint: `GET /api/inventory/items/categories`

New endpoint that returns:
- All distinct categories from `inventory_items` table
- All distinct subcategories from `inventory_items` table
- Format: `{ categories: string[], subcategories: string[] }`

```typescript
// In src/app/api/inventory/items/route.ts or new file
GET /api/inventory/items/categories
// Query: none required
// Returns: { categories: string[], subcategories: string[] }
```

### Reuse Existing Search Logic

`src/lib/inventory-search.ts` already has `normalizeSearchText()` that:
- Normalizes NFD (removes diacritics/accents)
- Lowercases
- Trims

We can use this same function for matching admin input against existing categories.

### Form Component Changes

Create a reusable `CategoryChips` component that:
1. Fetches categories/subcategories from API on mount
2. Displays existing options as chips with click-to-select
3. Provides input field for typing new category
4. On submit/select, returns the normalized category/subcategory value

**Interaction flow:**
1. Admin starts typing category name
2. Component fetches matching categories (using `normalizeSearchText` for comparison)
3. Admin can click an existing chip to select it (pre-fills the input)
4. Or admin types new category and submits
5. If new category, API creates it (or just uses it - no DB constraint needed, just UX guidance)
6. If existing category selected, use the exact stored value (preserves casing/naming)

### Example UI Flow

```
[Esmalte] [Gel]   ← Clickable chips of existing categories
              ↑
          Typing area: "esmalte" → matches "Esmalte" chip → admin clicks it
                    OR types "Nuevo Esmalte" → creates new (or suggests existing)
```

### Backend: Fetch Distinct Values

Simple SQL queries:

```sql
SELECT DISTINCT category FROM inventory_items WHERE category IS NOT NULL ORDER BY category
SELECT DISTINCT subcategory FROM inventory_items WHERE subcategory IS NOT NULL ORDER BY subcategory
```

Or via Drizzle:

```typescript
const categories = db.selectDistinct({ category: schema.inventoryItems.category }).from(schema.inventoryItems).where(sql`${schema.inventoryItems.category} IS NOT NULL`).orderBy(schema.inventoryItems.category);
const subcategories = db.selectDistinct({ subcategory: schema.inventoryItems.subcategory }).from(schema.inventoryItems).where(sql`${schema.inventoryItems.subcategory} IS NOT NULL`).orderBy(schema.inventoryItems.subcategory);
```

### Notes

- No unique constraint added on (category, subcategory) - this is UX guidance only, not data integrity enforcement
- The goal is to reduce duplicates, not prevent them entirely (admin may have valid reason to create new category)
- Matching should be case-insensitive and accent-insensitive using the existing `foldSearchText`/`normalizeSearchText` utility