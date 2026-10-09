# Spec: Inventory Max Uses Reset on Restock

## Problem

When an inventory product reaches its maximum configured uses (`maxUses`), the system marks it as exhausted (`isExhausted=1`, `stock=0`). However, when a new purchase/restock of the same product is made via `createInventoryIn()`, the current behavior preserves the old `usesConsumed` count, meaning the "remaining uses" from the previous batch carry over. This contradicts the requirement that each new purchase should start fresh with a new `maxUses` cycle.

Additionally, there's a scenario where `maxUses` is configured but product stock still exists - the system needs to handle this gracefully.

## Current Behavior (Bug)

In `src/lib/inventory.ts:recordUsage()`, when `maxUses` is reached:
- `usesConsumed` continues incrementing past `maxUses`
- `isExhausted` gets set to 1
- `stock` is set to 0

In `src/lib/inventory.ts:createInventoryIn()`, when restocking an existing item:
- `usesConsumed` and `isExhausted` are NOT reset
- Old usage count carries over to new batch

## Requirements

1. **Reset on restock**: When `createInventoryIn()` is called for an existing inventory item that has `maxUses` configured, reset `usesConsumed` to 0 and `isExhausted` to 0. Each new purchase starts a fresh `maxUses` cycle.

2. **Stock accumulation**: The `stock` value should still accumulate normally (add new qty to existing stock), regardless of usage reset.

3. **No maxUses case**: If item has no `maxUses` configured, behavior remains unchanged (no reset, no usage tracking side effects).

4. **Graceful handling of stock + maxUses**: If `maxUses` is configured but `usesConsumed < maxUses` (product still has remaining uses), the restock still resets `usesConsumed` to 0 - the new batch starts its own cycle. The existing stock remains and can be used until the new `maxUses` is reached.

5. **UI indication**: When viewing inventory item, display whether the current cycle has remaining uses or if it's a fresh restock.

## Affected Files

- `src/lib/inventory.ts` - `createInventoryIn()` function
- `src/lib/inventory.ts` - `setExhausted()` function (may need adjustment)
- `src/db/schema.ts` - `inventoryItems` table (already has `maxUses`, `usesConsumed`, `isExhausted`)

## Implementation Details

### `createInventoryIn()` modifications

When updating an existing item (item already exists in DB):

```typescript
// After calculating newStock and newAvg, add:
if (item.maxUses != null) {
  db.update(schema.inventoryItems)
    .set({ 
      usesConsumed: 0, 
      isExhausted: 0 
    })
    .where(eq(schema.inventoryItems.id, itemId))
    .run();
}
```

This reset should happen before or after the stock/avgCost update. The order doesn't matter functionally since we're resetting usage counters, not affecting stock calculation.

### `recordUsage()` considerations

The existing `recordUsage()` logic at line 191-213 already handles the `maxUses` check:

```typescript
const hasMaxUses = item.maxUses != null;
const exhaustedNow = item.maxUses != null && newUses >= item.maxUses;
```

This logic remains unchanged. The key change is that `createInventoryIn()` now resets the counter, so `recordUsage()` will count from 0 on the new batch.

### `setExhausted()` function

The `setExhausted()` function (used for manual exhaustion) should continue to work as-is. It toggles `isExhausted` and sets `stock=0` when `exhausted=true`. No changes needed since the reset in `createInventoryIn()` happens at restock time.

## Edge Cases

1. **Restocking item without maxUses**: No reset occurs, behavior unchanged.
2. **Restocking already exhausted item**: `usesConsumed` resets to 0, `isExhausted` resets to 0, new batch starts fresh.
3. **Restocking item with remaining uses** (usesConsumed < maxUses): Counter resets to 0, new batch starts fresh. Previous remaining uses are discarded (by design - each purchase is a new product batch).
4. **Creating new item** (item doesn't exist yet): Existing logic applies - `usesConsumed` starts at 0 (default), `maxUses` is stored as-is.

## Testing

- Verify `createInventoryIn()` resets `usesConsumed` and `isExhausted` when restocking existing item with `maxUses`
- Verify `createInventoryIn()` does NOT reset when item has no `maxUses`
- Verify stock still accumulates correctly on restock
- Verify `recordUsage()` correctly counts from 0 after restock reset
- Edge case: restock exhausted item, then use it - should count from 0 to maxUses again