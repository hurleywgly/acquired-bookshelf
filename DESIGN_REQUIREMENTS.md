# ACQUIRED Bookshelf - Design Requirements

**Version:** 1.0
**Last Updated:** 2025-10-15
**Status:** Active

---

## Table of Contents

1. [Overview](#overview)
2. [Grid Layout System](#grid-layout-system)
3. [Responsive Behavior](#responsive-behavior)
4. [Book Card Component](#book-card-component)
5. [Sidebar Navigation](#sidebar-navigation)
6. [Search Functionality](#search-functionality)
7. [Top Bar](#top-bar)
8. [Modal System](#modal-system)
9. [Scroll Behavior](#scroll-behavior)
10. [Loading States](#loading-states)
11. [URL Strategy](#url-strategy)
12. [Color Palette](#color-palette)
13. [Technical Notes](#technical-notes)

---

## Overview

The ACQUIRED Bookshelf is a visual catalog of books featured on the ACQUIRED podcast. The design prioritizes browsing, discovery, and episode-based navigation with a clean, minimal aesthetic.

### Key Principles
- **Column-based grid** (not masonry) for predictable, scannable layout
- **Episode-first navigation** through sidebar with smooth scrolling
- **Subtle but effective** search and filtering
- **Responsive but intentional** - different experiences at different sizes

---

## Grid Layout System

### Base Configuration

```css
/* Desktop Grid Setup */
.book-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 30px;
  padding: 30px;
}
```

### Column Dimensions

| Column Type | Width | Height | Notes |
|------------|-------|--------|-------|
| **Small** | 180px | 320px | Default for all columns |
| **Large** | 270px | 320px | Column 4 only (desktop/tablet) |

### Layout Rules

1. **All tiles same height:** 320px (consistent row alignment)
2. **Books flow left-to-right** by row (standard reading order)
3. **Gap spacing:** 30px horizontal and vertical (consistent breathing room)
4. **Container padding:** 30px on all sides
5. **Column 4 is LARGE** on 4+ column layouts (visual anchor point)

### Quote Block Placement

- **Dimensions:** 270px wide × 320px tall
- **Position:** Top of Column 4 (large column)
- **Purpose:** Visual break and content highlight
- **Mobile:** After 8 books (4 rows), spans both columns

```
Desktop Layout (6 columns):
┌─────┬─────┬─────┬──────┬─────┬─────┐
│ 180 │ 180 │ 180 │ 270  │ 180 │ 180 │
│ Book│ Book│ Book│Quote │ Book│ Book│
│  1  │  2  │  3  │Block │  4  │  5  │
├─────┼─────┼─────┼──────┼─────┼─────┤
│ Book│ Book│ Book│ Book │ Book│ Book│
│  6  │  7  │  8  │  9   │  10 │  11 │
└─────┴─────┴─────┴──────┴─────┴─────┘
```

---

## Responsive Behavior

### Breakpoint Strategy

**Use CSS Grid auto-fill, NOT fixed breakpoints.** The grid naturally adjusts based on available space.

### Column Configurations

| Viewport | Columns | Large Column | Quote Position | Notes |
|----------|---------|--------------|----------------|-------|
| **Desktop** | 6+ | Column 4 | Top of Col 4 | Full experience |
| **Large Tablet** | 5 | Column 4 | Top of Col 4 | Slightly tighter |
| **Tablet** | 4 | Column 3 | Top of Col 3 | Large column shifts left |
| **Small Tablet** | 3 | None | (Hidden) | Drop rightmost, all small |
| **Mobile** | 2 | None | After 8 books | Quote spans both columns |

### Mobile-Specific Behavior

```
Mobile Layout (2 columns):
┌──────┬──────┐
│ Book │ Book │  Row 1
│  1   │  2   │
├──────┼──────┤
│ Book │ Book │  Row 2
│  3   │  4   │
├──────┼──────┤
│ Book │ Book │  Row 3
│  5   │  6   │
├──────┼──────┤
│ Book │ Book │  Row 4
│  7   │  8   │
├──────┴──────┤
│    Quote    │  Row 5 (spans both)
│    Block    │
├──────┬──────┤
│ Book │ Book │  Row 6
│  9   │  10  │
└──────┴──────┘
```

- **Only small tiles** (180px)
- **No large column**
- **Quote appears after 8 books** (4 rows of 2)
- **Quote spans both columns** (full width)

### Implementation Notes

```css
/* Responsive Grid - Auto-adjusting */
.book-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 30px;
  padding: 30px;
}

/* Large column targeting */
.book-grid > *:nth-child(4) {
  /* Apply large styling when 4+ columns visible */
  grid-column: span 1.5; /* or explicit width handling */
}

/* Mobile quote positioning */
@media (max-width: 600px) {
  .quote-block {
    order: 8; /* Appears after first 8 books */
    grid-column: 1 / -1; /* Span all columns */
  }
}
```

---

## Book Card Component

### Structure

```
┌─────────────────────────┐
│                         │
│     Cover Image         │ ← object-cover, full width
│     [Episode Badge]     │ ← Top-right overlay
│                         │
├─────────────────────────┤
│ [Category Badge]        │ ← Top of metadata section
│                         │
│ Book Title (Bold)       │
│ by Author Name          │
│                         │
│ [View on Amazon ↗]      │ ← Bottom of card
└─────────────────────────┘
```

### Cover Image Section

- **Sizing:** Fill available space above metadata
- **Fit:** `object-fit: cover` (maintain aspect, crop if needed)
- **Episode Badge:**
  - Position: Top-right corner
  - Format: "S2025, E2" or "S14 E3"
  - Style: Small, semi-transparent overlay
  - Purpose: Quick episode identification

### Metadata Section

```css
.book-metadata {
  background-color: #D9D9D9;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
```

**Layout (top to bottom):**

1. **Category Badge**
   - Background: `#575757`
   - Font size: `8px`
   - Font weight: Light (300)
   - Text: Category name (e.g., "Technology", "Biography")
   - Position: Top of metadata section

2. **Book Title**
   - Font weight: Bold (700)
   - Font size: `14px`
   - Line height: Tight (1.2)
   - Max lines: 2-3 (truncate with ellipsis if needed)

3. **Author Name**
   - Format: "by [Author Name]"
   - Font weight: Regular (400)
   - Font size: `10px`
   - Color: Inherit from parent

4. **Amazon Link**
   - Text: "View on Amazon ↗"
   - Font size: `9px`
   - Font weight: Medium (500)
   - Letter spacing: `0.05em` (5%)
   - Position: Bottom of card (margin-top: auto)
   - Behavior: Opens in new tab

### Hover State

```css
.book-card:hover {
  transform: scale(1.02) translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease-out;
  cursor: pointer;
}
```

- **Subtle scale and lift** effect
- **Smooth transition** (200ms ease-out)
- **Light shadow** on hover for depth

---

## Sidebar Navigation

### Layout Specifications

```
┌────────────────────────┐
│  [ACQUIRED Logo]       │ ← Header (fixed)
├────────────────────────┤
│                        │
│  ┌──────────────────┐  │
│  │ S14 E3           │  │ ← Episode item
│  │ Rolex            │  │
│  └──────────────────┘  │
│                        │
│  ┌──────────────────┐  │
│  │ S14 E2           │  │ ← Scrollable list
│  │ Costco           │  │
│  └──────────────────┘  │
│        ⋮               │
│                        │
├────────────────────────┤
│ Listen to ACQUIRED     │ ← Footer (fixed)
└────────────────────────┘
```

### Dimensions

- **Width:** 380px (fixed)
- **Position:** Fixed left side
- **Background:** `#B8B9B8`

### Episode List Item

```html
<div class="episode-item">
  <div class="episode-code">S14 E3</div>
  <div class="episode-title">Rolex</div>
</div>
```

**Content:**
- **Line 1:** Episode code (e.g., "S14 E3", "S2025 E2")
  - Font weight: Medium
  - Font size: 14px
  - Color: `#565656`
- **Line 2:** Episode title only (e.g., "Rolex", "Costco")
  - Font weight: Regular
  - Font size: 12px
  - Color: `#767676`

**That's it** - just code and title, nothing else.

### Interaction States

```css
/* Default */
.episode-item {
  background: transparent;
  color: #767676;
  padding: 16px 20px;
  cursor: pointer;
  transition: all 0.15s ease;
}

/* Hover */
.episode-item:hover {
  background-color: #C6C7C6;
}

/* Active (episode visible in main view) */
.episode-item.active {
  background-color: #5CE8C5;
  color: #000000;
}
```

### Scroll Behavior

**Sidebar does NOT auto-scroll** when books are scrolled in main view.

**On Episode Click:**
- Scroll main content area to center that episode's books
- Smooth scroll animation
- Active highlight persists on clicked episode

**Active State Logic:**
- Highlight episode when **majority of its books are visible** in viewport
- Use Intersection Observer API to track visibility
- Single active episode at a time

**Current UX Note:** The hover and click interactions feel good - preserve this behavior exactly.

### Mobile Behavior

- **Hidden by default** on mobile viewports
- **Hamburger menu** in top-left opens sidebar
- **Full-screen overlay** (covers entire screen)
- **X button** in top-right to close
- Same episode list styling and interactions
- Clicking episode closes overlay and scrolls to books

---

## Search Functionality

### Search Scope

**Filters across:**
1. Book titles
2. Author names
3. Episode names

**Match Algorithm:**
- **Fuzzy matching** using industry best practices
- Case-insensitive
- Partial matches allowed
- Match highlighting optional but recommended

### UI Components

```
┌─────────────────────────────────┐
│ 🔍  Search books and episodes   │ ← Search input
│                              [X]│ ← Clear button
└─────────────────────────────────┘
```

**Search Input:**
- Placeholder: "Search books and episodes"
- Icon: Magnifying glass (left)
- Clear button: X icon (right) - appears when input has value
- Width: Flexible (adjusts to container)

**Clear Button Behavior:**
- Click X to clear search
- Input clears immediately
- All filters reset
- Full catalog returns

### Filter Behavior

**Grid View:**
- Shows **only matching books**
- Maintains column layout (books may be in different positions)
- Quote block hidden when filtering

**Sidebar:**
- Shows **only episodes with matching books**
- If episode name matches but no books match, still show episode
- Maintains scroll position

**Search Results:**
- Update instantly as user types
- No loading state needed (fast client-side filtering)
- No debouncing required unless performance demands it

### Empty State

```
┌─────────────────────────────────┐
│                                 │
│         No books found          │
│                                 │
│  Try adjusting your search or   │
│      [Clear search]             │
│                                 │
└─────────────────────────────────┘
```

**When no results:**
- Center-aligned message
- Clear explanation
- CTA button to clear search and return to full catalog

---

## Top Bar

### Desktop Layout

```
┌────────────────────────────────────────────────────┐
│  [Search Input]              [What is this?]       │
└────────────────────────────────────────────────────┘
```

- **Position:** Fixed at top, spans full width
- **Height:** ~60px
- **Components:**
  - Search input (left-aligned, 40% width)
  - "What is this?" button (right-aligned)

### Mobile Layout

```
┌────────────────────────────────────────────────────┐
│ [☰]  [Search]                              [?]     │
└────────────────────────────────────────────────────┘
```

- **Hamburger menu** (left): Opens sidebar overlay
- **Shrunken search** (center): Reduced width input
- **Question mark icon** (right): Opens modal

### Styling

```css
.top-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: white;
  border-bottom: 1px solid #E5E5E5;
  padding: 12px 20px;
  z-index: 1000;
}
```

---

## Modal System

### "What is this?" Modal

**Trigger:** Click "What is this?" button (desktop) or ? icon (mobile)

**Content Structure:**

```markdown
# What is this?

This is a visual catalog of every book discussed on the ACQUIRED podcast.
Browse by episode or search for specific books and authors.

## Navigation Tip
Click any episode in the sidebar to jump to those books in the main view.

---

Built by [@rywigs](https://twitter.com/rywigs)

[Got it]
```

**Styling:**
- Background: Light gray (`#F5F5F5`)
- Max width: 500px
- Center-aligned on screen
- Clean typography (16px body, 24px heading)
- "Got it" button: Primary CTA style

**Behavior:**
- **Does NOT show on first visit** (no auto-popup)
- Overlay darkens background (rgba(0,0,0,0.4))
- Click outside or "Got it" to close
- ESC key to close

---

## Scroll Behavior

### Main Content Area

- **Scrolls vertically** (standard page scroll)
- Contains book grid
- Books scroll **underneath TopBar** (TopBar is fixed)
- Smooth scroll when jumping to episodes

### Sidebar

- **Independent scroll** for episode list
- Header and footer remain fixed within sidebar
- Only episode list scrolls
- Does not auto-scroll when main content scrolls

### TopBar

- **Fixed at top** of viewport
- Always visible
- Z-index above content
- Box shadow on scroll (optional enhancement)

### Scroll-to-Episode

```javascript
// When episode clicked in sidebar
function scrollToEpisode(episodeId) {
  const episodeSection = document.querySelector(`[data-episode="${episodeId}"]`);
  const viewportCenter = window.innerHeight / 2;
  const elementCenter = episodeSection.offsetHeight / 2;

  window.scrollTo({
    top: episodeSection.offsetTop - viewportCenter + elementCenter,
    behavior: 'smooth'
  });
}
```

---

## Loading States

### Initial Page Load

Use **skeleton loaders** (Facebook-style):

```
┌─────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ ← Light gray shape
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
├─────────────────────────┤
│ ████                    │ ← Dark gray text bar
│ ██████████              │ ← Dark gray text bar
│                         │
│ ████████                │ ← Dark gray text bar
└─────────────────────────┘
```

**Colors:**
- Cover area: Light gray (`#E5E5E5`)
- Text lines: Dark gray (`#C0C0C0`)
- Subtle pulse animation (optional)

### Image Loading

- Same skeleton pattern as initial load
- Appears while individual images load
- Fade-in transition when image ready

### Search

- **No loading state needed**
- Results appear instantly (client-side filtering)
- If implementing server-side search, use subtle spinner in search input

### Episode List

- Skeleton loaders for episode items during initial load
- Simple gray rectangles with text bar placeholders

---

## URL Strategy

### Keep URLs Clean

- **No URL updates** for navigation
- **No URL updates** for search queries
- **No URL updates** for active episode

**Rationale:**
- Simpler implementation
- Cleaner browser history
- User experience focused on browsing, not bookmarking specific states

### Future Consideration

If analytics or sharing becomes important:
- Could add optional query params (e.g., `?episode=rolex`)
- Would require additional logic to parse and apply on load

---

## Color Palette

### Primary Colors

```css
:root {
  /* Sidebar */
  --sidebar-bg: #B8B9B8;
  --sidebar-text: #767676;
  --sidebar-code: #565656;

  /* Active States */
  --active: #5CE8C5;
  --hover: #C6C7C6;

  /* Book Card */
  --metadata-bg: #D9D9D9;
  --category-badge-bg: #575757;
  --category-badge-text: #FFFFFF;

  /* Neutrals */
  --gray-light: #F5F5F5;
  --gray-medium: #E5E5E5;
  --gray-dark: #767676;
  --black: #000000;
  --white: #FFFFFF;
}
```

### Usage Reference

| Element | Property | Color | Hex |
|---------|----------|-------|-----|
| Sidebar background | background | Sidebar BG | `#B8B9B8` |
| Episode text | color | Sidebar Text | `#767676` |
| Episode code | color | Sidebar Code | `#565656` |
| Active episode | background | Active | `#5CE8C5` |
| Hover state | background | Hover | `#C6C7C6` |
| Metadata section | background | Metadata BG | `#D9D9D9` |
| Category badge | background | Category Badge | `#575757` |

---

## Technical Notes

### CSS Grid Implementation

- Use `repeat(auto-fill, minmax(180px, 1fr))` for responsive columns
- Avoid fixed breakpoints where possible
- Let grid naturally reflow based on container width

### Large Column Handling

**Challenge:** Column 4 should be 270px while others are 180px.

**Solution Options:**

1. **Grid Template Areas** (explicit control)
   ```css
   grid-template-columns: 180px 180px 180px 270px 180px 180px;
   ```

2. **Dynamic Class Application** (JavaScript)
   ```javascript
   // Apply .large-column to 4th item when 4+ columns visible
   ```

3. **CSS Subgrid** (future-proof)
   ```css
   /* When wider browser support available */
   ```

### Performance Considerations

- **Lazy load images** below the fold
- **Virtualize episode list** if 100+ episodes
- **Debounce search** only if performance issues arise
- **Use CSS transforms** for animations (GPU acceleration)

### Accessibility

- Proper ARIA labels for interactive elements
- Keyboard navigation for episode list
- Focus indicators for keyboard users
- Alt text for book covers
- Semantic HTML structure

### Browser Support

- Target modern evergreen browsers
- CSS Grid: IE11 not required
- Flexbox fallbacks where appropriate
- Test on Safari (macOS/iOS), Chrome, Firefox, Edge

---

## Document Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-10-15 | Initial requirements from user interview |

---

**End of Document**