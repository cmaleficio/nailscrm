# Implementation Plan: Inventory Specs

## Overview

Three interconnected specs for the inventory system:
1. Max uses tracking reset on restock
2. Category/subcategory suggestions on create/edit
3. Product image lightbox/preview

## Implementation Order

### Phase 1: Max Uses Reset (Highest Priority - Business Logic)

**Day 1-2**: Implement `createInventoryIn()` reset logic

**Files to modify:**
- `src/lib/inventory.ts` - `createInventoryIn()` function

**Steps:**
1. In `createInventoryIn()`, after computing `newStock` and `newAvg`, add reset of `usesConsumed` and `isExhausted` when `item.maxUses != null`
2. The reset should happen BEFORE the stock update (order doesn't matter functionally, but semantically reset usage first)
3. Run existing tests to ensure no regression
4. Manual test: restock an item with maxUses, verify usesConsumed resets to 0

**Verification commands:**
- `npx tsc --noEmit` - typecheck
- `npm run lint` - lint check
- Check existing `inventory-search.test.ts` still passes

---

### Phase 2: Category/Subcategory Suggestions (UX/Prevention)

**Day 3-4**: Implement category suggestions API and form component

**Files to create/modify:**
- `src/app/api/inventory/items/categories/route.ts` - NEW: GET endpoint for categories/subcategories
- `src/components/inventory/CategoryChips.tsx` - NEW: reusable component with chips + input
- Integrate into existing inventory item form (likely `src/app/dashboard/inventory/[...]/page.tsx` or create/edit dialog)

**Steps:**
1. Create new API route `GET /api/inventory/items/categories` that fetches distinct categories and subcategories from DB
2. Create `CategoryChips` component that:
   - Fetches categories on mount
   - Displays as clickable chips with names
   - Has input field for typing new category
   - On chip click, pre-fills input with exact stored value
   - On submit, returns selected/created category value
3. Integrate component into inventory item create/edit form
4. Test: existing categories appear as chips, new categories can be typed

**Verification commands:**
- `npx tsc --noEmit`
- `npm run lint`
- Test the API endpoint manually or via Postman

---

### Phase 3: Product Image Lightbox (UI/UX)

**Day 5-6**: Implement image lightbox for inventory items

**Files to create/modify:**
- `src/components/InventoryImageViewer.tsx` - NEW: thumbnail grid + lightbox integration
- Modify existing inventory item card/component to use the new viewer
- May need minor adjustments to `PhotoLightbox` if not already compatible

**Steps:**
1. Create `InventoryImageViewer.tsx` component that:
   - Receives `photoUrls: string[]` prop
   - Renders thumbnails in masonry grid (2-column, gap, rounded corners)
   - Each thumbnail on click opens `PhotoLightbox` with full-size images
   - Lightbox shows download button with slugified filename
   - Supports keyboard navigation (Esc, arrows, +/- zoom)
   - Shows fallback when no photoUrl
2. Find the inventory item card/list component in the dashboard
3. Replace/embed the image rendering with `InventoryImageViewer`
4. Test: clicking thumbnail opens lightbox, navigation works, zoom functions, download works

**Verification commands:**
- `npx tsc --noEmit`
- `npm run lint`
- Manual testing in browser: open inventory, click images, verify lightbox behavior

---

### Cross-Phase Considerations

**Testing Strategy:**
- Each phase has independent tests, but verify no cross-phase regressions
- Phase 1: Verify `recordUsage()` still works correctly after `createInventoryIn()` reset
- Phase 2: Verify categories don't break existing inventory items
- Phase 3: Verify lightbox doesn't break item listing or form submissions

**Dependencies Between Phases:**
- **Phase 1 has no dependencies** on 2 or 3 - pure business logic change
- **Phase 2 has no dependencies** on 1 or 3 - pure UX/prevention change  
- **Phase 3 has no dependencies** on 1 or 2 - pure UI change
- All three can be developed in parallel, but I've ordered them by business criticality

**Risk Mitigation:**
- Phase 1: Add a guard condition `if (item.maxUses != null)` to ensure we only reset when maxUses is configured
- Phase 2: API endpoint is read-only (fetch), no DB schema changes, low risk
- Phase 3: Lightbox is opt-in (only renders when photoUrls exist), fallback for missing images

**Rollback Plan:**
- If Phase 1 causes issues: revert the `createInventoryIn()` changes - the reset logic is localized to one function
- If Phase 2 causes issues: remove the CategoryChips component, the API endpoint can be kept or removed
- If Phase 3 causes issues: hide the lightbox trigger, the underlying image URLs still work

## Timeline

| Day | Phase | Deliverable |
|-----|-------|-------------|
| 1-2 | 1 | `createInventoryIn()` reset logic in `src/lib/inventory.ts` |
| 3-4 | 2 | Category suggestions API + `CategoryChips` component |
| 5-6 | 3 | `InventoryImageViewer` + lightbox integration |

## Success Criteria

- [ ] Restocking an inventory item with `maxUses` configured resets `usesConsumed` to 0
- [ ] Stock still accumulates correctly on restock
- [ ] Admin can see existing categories as chips when creating/editing inventory items
- [ ] Admin can type new categories while seeing suggestions
- [ ] Product images can be clicked to open lightbox with enlarged view
- [ ] Lightbox supports zoom, pan, navigation between multiple images
- [ ] Download button works with slugified filenames
- [ ] No existing functionality broken (tests pass, lint passes)