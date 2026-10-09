# Spec: Product Image Lightbox/Preview Feature

## Problem

Inventory product images (`photoUrl` in `inventory_items` table) cannot be viewed enlarged by admins. There is no image viewer component implemented for the inventory section. Users need to see product photos in detail, especially for catalog/brand purposes.

## Current Behavior

- `inventoryItems` table has `photoUrl` field (text)
- Photos are uploaded via `POST /api/upload` with `kind` field
- Photo URLs stored as `/api/media/private/<uuid>.<ext>` or `/public/uploads/...`
- No component exists to view these images enlarged
- Admin cannot visualize product photos in the inventory management UI

## Requirements

1. **PhotoLightbox integration**: Use the existing `PhotoLightbox` component pattern from the codebase (see `src/components/PhotoLightbox.tsx` and `src/lib/zoom.ts`).

2. **Click-to-enlarge on inventory item thumbnail**: When admin clicks on a product image thumbnail in the inventory grid/list, open the `PhotoLightbox` modal with enlarged image.

3. **Support multiple images per product**: If an inventory item has multiple photos, allow switching between them in the lightbox.

4. **Zoom and pan functionality**: Lightbox should support pinch-to-zoom, mouse wheel zoom, and panning (already implemented in `src/lib/zoom.ts`).

5. **Keyboard navigation**: Escape to close, arrow keys to navigate between images, +/- buttons for zoom.

6. **Download capability**: Provide download button for the original image (using `src/lib/download-name.ts` for slugified filename).

7. **Fallback for missing images**: Display placeholder/fallback image if `photoUrl` is empty or invalid.

## Affected Files

- `src/components/InventoryImageViewer.tsx` - NEW component (or integrate into existing inventory item card)
- `src/components/PhotoLightbox.tsx` - May need minor adjustments if not already compatible
- `src/lib/zoom.ts` - Already has zoom math, should work as-is
- `src/lib/download-name.ts` - For download filename generation
- Existing inventory item card/list components - Need to add image click handler

## Implementation Details

### New Component: `InventoryImageViewer`

A Server Component or Client Component (likely Client since it needs state for lightbox open/close) that:

1. Receives props: `photoUrls: string[]`, `itemId?: string`, `onClose?: () => void`
2. Renders thumbnails grid (2-column masonry layout)
3. Each thumbnail on click opens `PhotoLightbox` with the full image URLs
4. Lightbox shows current image index / total count
5. Includes download button with slugified filename

**Thumbnail rendering:**
- Use `next/image` with `fill` or fixed dimensions
- `src` = the photoUrl
- `alt` = item name
- `className` = `object-cover h-48 w-full rounded-md cursor-pointer`

**PhotoLightbox integration:**
```tsx
<PhotoLightbox
  photos={photoUrls.map((url, i) => ({
    id: i.toString(),
    url,
    caption: itemName
  }))}
  onClose={onClose}
/>
```

### Existing Components to Integrate With

Look at existing inventory components to see how items are displayed:

- Check `src/app/dashboard/inventory/page.tsx` or similar for the inventory list grid
- Identify where item cards/grids are rendered
- Add image thumbnail click handler that opens the lightbox

### Download Naming

Use existing `src/lib/download-name.ts` which generates slugified filenames. For the download button in lightbox:

```typescript
import { generateDownloadName } from "@/lib/download-name";

// Usage: generateDownloadName("Aceite de Cutícula 10ML") → "aceite-de-cutcula-10ml"
```

### Edge Cases

1. **No photoUrl**: Show "No image" placeholder, click does nothing or shows info message
2. **Invalid URL**: Show placeholder, handle gracefully
3. **Single image**: Lightbox still opens, no navigation arrows or hide them
4. **Multiple images**: Navigation dots/arrows appear to switch between them
5. **Private media URLs** (`/api/media/private/...`): Lightbox should fetch these via the API endpoint that authorizes by row - need to ensure the lightbox component can access these URLs properly. Actually, since the admin is authenticated, direct URLs should work if they're proper `/api/media/private/...` endpoints that next/auth protects.

### API Considerations

The `photoUrl` values are already stored correctly (either private `/api/media/...` or public `/public/uploads/...`). The lightbox just needs to render them. No API changes needed unless we want to add an endpoint to list photos for an item, but since the URLs are already on the item, we can use them directly.

### Styling

- Lightbox should match existing design system (rosa pastel palette, rounded corners, soft shadows)
- Follow the patterns from `src/components/PhotoLightbox.tsx`
- Grid layout should match existing inventory grid (probably `grid grid-cols-2 gap-4 sm:grid-cols-3`)

### Testing

- Verify clicking thumbnail opens lightbox with correct image
- Verify navigation between multiple images
- Verify keyboard controls (Esc to close, arrows to navigate)
- Verify zoom/pan functionality works
- Verify download button generates correct filename
- Verify fallback display when no photoUrl