# Book Tile Technical Reference

**Last Updated:** 2025-10-15
**Status:** Canonical Reference

---

## Overview

The ACQUIRED Bookshelf uses a column-based CSS Grid layout with two tile sizes: SMALL and LARGE. All tiles have the same height but different widths.

**Key Principle:** Column 4 gets large tiles, all other columns get small tiles. Books flow left-to-right by row.

---

## Tile Specifications

### Dimensions

| Property | Small Tile | Large Tile |
|----------|-----------|------------|
| **Width** | 180px | 270px |
| **Height** | 320px | 320px |
| **Grid Columns** | 2 | 3 |
| **Gap (H & V)** | 30px | 30px |

**Important:** Both tile sizes have identical 320px height. Only width differs.

### Component Breakdown

Each tile consists of two sections:
1. **Image container** - Book cover with episode badge overlay
2. **Metadata section** - Category badge, title, author, Amazon link

**Height allocation** (for 320px total):
- Calculate based on: `Total Height - Metadata Height = Image Height`
- Example: If metadata needs 120px, image gets 200px
- Use explicit heights on both sections (never `flex-1`)

---

## Grid Layout

### Grid Configuration

```tsx
// Container grid setup
grid-template-columns: repeat(auto-fill, 90px)
auto-rows-[8px]  // rowUnit for masonry-like effect
gap: 30px        // both horizontal and vertical
grid-flow: dense // for optimal packing
```

### Tile Assignment Logic

```tsx
// First 4 books in each episode → LARGE (270px)
// All subsequent books → SMALL (180px)

const sizeForIndex = (i: number): Size => {
  return i < 4 ? 'lg' : 'sm'
}
```

**Why this works:**
- First column visually gets all large tiles
- Creates visual hierarchy with prominent lead books
- Remaining books flow naturally in standard size

### Column Span Values

```tsx
// Small tile: 180px ÷ 90px = 2 columns
col-span-2 w-[180px]

// Large tile: 270px ÷ 90px = 3 columns
col-span-3 w-[270px]
```

### Row Span Calculation

Row spans are calculated dynamically by the `useMasonryItem` hook:

```tsx
// Formula: ceil(actualHeight ÷ rowUnit)
// For 320px tile: ceil(320 ÷ 8) = 40 rows

const rowSpan = Math.ceil(height / rowUnit)
```

**Note:** Gap spacing is handled by CSS Grid automatically - do NOT include it in row-span math.

---

## Common Pitfalls

### 1. Using `flex-1` (CRITICAL)

❌ **NEVER DO THIS:**
```tsx
<div className="flex flex-col">
  <div className="flex-1">  {/* BAD - causes height calculation issues */}
    <img className="w-full h-full" />
  </div>
  <div className="p-4">Metadata</div>
</div>
```

✅ **CORRECT APPROACH:**
```tsx
<div className="flex flex-col h-[320px]">
  <div className="h-[200px]">  {/* Explicit height */}
    <img className="w-full h-full object-cover" />
  </div>
  <div className="h-[120px] p-4">  {/* Explicit height */}
    Metadata
  </div>
</div>
```

**Why:** `flex-1` causes browser height miscalculations with padding, borders, and shadows. Total rendered height can exceed declared height, causing tile overlap.

### 2. Missing `overflow-hidden`

❌ **Problem:**
```tsx
<article className="h-[320px]">  {/* No overflow control */}
  <div className="h-[200px]">
    <img />
  </div>
</article>
```

✅ **Solution:**
```tsx
<article className="h-[320px] overflow-hidden">
  <div className="h-[200px] overflow-hidden">
    <img />
  </div>
</article>
```

**Why:** Without `overflow-hidden`, content can spill beyond declared height, especially with long titles or images that don't crop properly.

### 3. Incorrect Gap Calculations

❌ **WRONG:**
```tsx
// Including gap in row-span calculation
rowSpan = (tileHeight + gap) ÷ rowUnit  // NO!
```

✅ **CORRECT:**
```tsx
// Gap is handled by CSS Grid container
rowSpan = tileHeight ÷ rowUnit  // YES!
```

**Why:** CSS Grid's `gap` property adds space between grid items automatically. Including it in row-span math causes double-counting and misalignment.

### 4. Inconsistent Height Values

❌ **WRONG:**
```tsx
// Parent declares 320px, but children sum to 340px
<article className="h-[320px]">
  <div className="h-[220px]">Image</div>  {/* 220px */}
  <div className="h-[120px]">Meta</div>   {/* 120px */}
  {/* Total: 340px > 320px = OVERLAP! */}
</article>
```

✅ **CORRECT:**
```tsx
// Parent and children heights must match exactly
<article className="h-[320px]">
  <div className="h-[200px]">Image</div>  {/* 200px */}
  <div className="h-[120px]">Meta</div>   {/* 120px */}
  {/* Total: 320px = 320px ✓ */}
</article>
```

---

## Implementation Checklist

When creating or modifying book tiles:

- [ ] Total tile height is exactly 320px
- [ ] Width is 180px (small) or 270px (large)
- [ ] Image section has explicit height (e.g., `h-[200px]`)
- [ ] Metadata section has explicit height (e.g., `h-[120px]`)
- [ ] Heights sum exactly to total: `image + meta = 320px`
- [ ] NO `flex-1` anywhere in the tile
- [ ] `overflow-hidden` on both tile and image container
- [ ] Column span: 2 (small) or 3 (large)
- [ ] Row span calculated via `useMasonryItem` hook
- [ ] Image uses `object-cover` for proper cropping
- [ ] Episode badge positioned absolutely within image container

---

## Working Example

```tsx
export default function BookCard({ book, size, rowUnit, rowGap }) {
  const isBig = size === 'lg'
  const { ref, style } = useMasonryItem(rowUnit, rowGap)

  // Explicit heights - NO flex-1!
  const imageHeight = isBig ? 'h-[200px]' : 'h-[200px]'  // Same for both
  const metaHeight = 'h-[120px]'

  const sizeClasses = isBig
    ? "col-span-3 w-[270px] h-[320px]"
    : "col-span-2 w-[180px] h-[320px]"

  return (
    <article
      ref={ref}
      style={style}
      className={`flex flex-col overflow-hidden ${sizeClasses}`}
    >
      {/* Image - explicit height */}
      <div className={`relative ${imageHeight} overflow-hidden bg-gray-100`}>
        <img
          src={book.coverUrl}
          className="w-full h-full object-cover"
        />
        {book.episodeRef && (
          <div className="absolute top-2 right-2 bg-gray-900 text-white px-3 py-1.5 rounded text-xs">
            S{book.episodeRef.seasonNumber}, E{book.episodeRef.episodeNumber}
          </div>
        )}
      </div>

      {/* Metadata - explicit height */}
      <div className={`${metaHeight} p-4 flex flex-col gap-2 overflow-hidden`}>
        <div className="text-xs text-gray-500">{book.category}</div>
        <h3 className="font-bold text-sm line-clamp-2">{book.title}</h3>
        <p className="text-xs text-gray-600 line-clamp-1">{book.author}</p>
        <a href={book.amazonUrl} className="text-xs underline mt-auto">
          View on Amazon
        </a>
      </div>
    </article>
  )
}
```

---

## Debugging Tips

If tiles are overlapping:

1. **Check computed heights** in DevTools:
   - Inspect tile → Computed tab
   - Verify total height = 320px exactly
   - Check if any padding/borders are adding extra height

2. **Look for `flex-1`:**
   - Search codebase for `flex-1` in tile components
   - Replace with explicit heights

3. **Verify height math:**
   - Image height + metadata height = 320px?
   - Account for padding inside metadata section
   - If using `p-4` (16px), metadata content area = declared height - 32px

4. **Check overflow:**
   - Is `overflow-hidden` on both tile and image container?
   - Are long titles causing overflow? (use `line-clamp-2`)

5. **Inspect row spans:**
   - Check if `useMasonryItem` hook is calculating correct row-span
   - Verify rowUnit is 8px
   - Expected row-span: ceil(320 / 8) = 40

---

## Files to Archive/Remove

After adopting this reference:

- ❌ Delete: `BOOK_TILE_FIX_PLAN_V2.md` (outdated dimensions, wrong assumptions)
- ❌ Delete: `BOOK_TILE_REMEDIATION_PLAN.md` (outdated, contains incorrect gap math)

Keep this file as the single source of truth for book tile implementation.

---

## Notes

- **Not true masonry:** This is a column-based grid that mimics masonry aesthetics
- **Dynamic row spans:** The `useMasonryItem` hook measures actual content and assigns row-spans
- **Responsive considerations:** Grid may reflow on smaller screens - test tile heights remain consistent
- **Performance:** Use `loading="lazy"` on images to improve initial page load

---

**Questions or issues?** Check this document first before making changes to tile layout.
