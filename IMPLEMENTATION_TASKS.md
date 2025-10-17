# ACQUIRED Bookshelf - Implementation Task List

**Document Purpose**: Definitive implementation guide with corrected requirements based on user clarification interview.

**Last Updated**: 2025-10-15

---

## CRITICAL CORRECTIONS FROM USER INTERVIEW

This document supersedes PRODUCT_ROADMAP.md where specifications conflict. Key corrections:

### Grid System (NOT Masonry):
- ❌ WRONG: Masonry grid with auto-placement
- ✅ CORRECT: Column-based layout with books flowing left-to-right by row
- All tiles are **320px tall** (not 400px/460px)
- Small tiles: **180px wide**
- Large tiles: **270px wide**
- Column gaps: **30px** (not 24px)
- **Column 4 is the large column** (not column 1)
- Books fill columns sequentially, wrapping to next row

### Responsive Behavior:
- 6 columns → 5 columns → 4 columns (large moves to col 3) → 3 columns → 2 columns (mobile)
- Use `auto-fill` with `minmax()` - no fixed breakpoints
- Mobile: No large column, quote appears after 8 books
- Large column shifts position as column count decreases

### Book Card Dimensions (CRITICAL):
- **Total height: 320px** (fixed)
- Cover image: **180px height**
- Metadata section: **140px height**
- Background color: **#D9D9D9** (not gray-50)
- Category badge background: **#575757** (not gray-300)
- **NO flex-1** - all heights must be explicit

### Typography Specifications:
- Title: **14px bold** (not 16px)
- Author: **10px regular** (not 14px)
- Category badge: **8px light** (not 12px)
- Amazon link: **8px medium, 5% letter-spacing** (not 14px)

### Sidebar Specifications:
- Width: **380px fixed**
- Episode format: Code first, title second (already correct)
- Active state: When **majority** of episode's books are visible
- Footer: Fixed at bottom, always visible
- Sidebar does NOT auto-scroll when episode clicked
- Mobile: Full-screen overlay with X button

### Search Behavior:
- Filters books, authors, AND episodes
- Fuzzy matching algorithm
- X button to clear inside search input
- Filters BOTH grid and sidebar simultaneously

---

## PHASE 1: CRITICAL FIXES (Blocking Issues)

### TASK-001: Remove `overflow: hidden` from Body
**Priority**: CRITICAL
**Effort**: Small
**Blocking**: Scrolling is currently broken

#### Problem:
`overflow: hidden` on body or html prevents page scrolling entirely.

#### Files to Modify:
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/globals.css`

#### Changes Required:
Search for and remove any:
```css
body {
  overflow: hidden; /* DELETE THIS */
}

html {
  overflow: hidden; /* DELETE THIS */
}
```

Ensure only:
```css
body {
  overflow-y: auto;
  overflow-x: hidden;
}
```

#### Acceptance Criteria:
- [ ] Page scrolls normally
- [ ] No horizontal scrollbar appears
- [ ] TopBar remains fixed during scroll
- [ ] Books scroll under TopBar

---

### TASK-002: Replace Masonry Grid with Column-Based Grid
**Priority**: CRITICAL
**Effort**: High
**Blocking**: Current grid system is fundamentally wrong

#### Problem:
Current implementation uses masonry/auto-placement. Design requires column-based layout where books flow left-to-right by row.

#### Files to Modify:
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/components/ShelfGrid.tsx`
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/components/BookCard.tsx`

#### Current Implementation (WRONG):
```tsx
// Masonry approach with auto-rows
<div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] auto-rows-[10px] gap-6">
```

#### Required Implementation:
```tsx
// Column-based with explicit widths
<div className="grid gap-[30px]" style={{
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 180px))',
}}>
  {/* Books flow left-to-right, wrapping to next row */}
  {/* Every 4th column (columns 4, 8, 12...) is large (270px) */}
</div>
```

#### Logic Required:
```tsx
const ShelfGrid = ({ books, episodeId }) => {
  const booksWithSize = books.map((book, index) => ({
    ...book,
    isLarge: (index % 4) === 3 // Columns 4, 8, 12, 16... (0-indexed: 3, 7, 11, 15)
  }));

  return (
    <div className="grid gap-[30px]" style={{
      gridTemplateColumns: books.reduce((acc, book, i) => {
        const width = ((i % 4) === 3) ? '270px' : '180px';
        return acc + (i > 0 ? ' ' : '') + width;
      }, '')
    }}>
      {booksWithSize.map(book => (
        <BookCard key={book.id} book={book} isLarge={book.isLarge} />
      ))}
    </div>
  );
};
```

#### Acceptance Criteria:
- [ ] Books flow left-to-right by row (not auto-placed)
- [ ] Every 4th column is large (270px wide)
- [ ] All other columns are small (180px wide)
- [ ] 30px gaps between all tiles
- [ ] All tiles are 320px tall
- [ ] No masonry/auto-rows behavior

#### Implementation Notes:
- Remove all `auto-rows`, `row-span`, `col-span` logic
- Use explicit grid-template-columns with calculated widths
- Large column position: 4, 8, 12, 16, 20... (every 4th)
- Consider using `grid-auto-flow: row` for clarity

---

### TASK-003: Fix BookCard to Explicit Heights (No flex-1)
**Priority**: CRITICAL
**Effort**: Medium
**Blocking**: Layout breaks with flex-1

#### Problem:
Using `flex-1` causes layout issues. All dimensions must be explicit.

#### Files to Modify:
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/components/BookCard.tsx`

#### Current Implementation (WRONG):
```tsx
<div className="h-[400px]"> {/* Wrong height */}
  <div className="h-[260px]"> {/* Wrong image height */}
    <img className="object-cover" />
  </div>
  <div className="flex-1 bg-gray-50"> {/* WRONG: flex-1 */}
    {/* Metadata */}
  </div>
</div>
```

#### Required Implementation:
```tsx
const BookCard = ({ book, isLarge }) => {
  return (
    <div className={`flex flex-col ${isLarge ? 'w-[270px]' : 'w-[180px]'} h-[320px]`}>
      {/* Cover Image: 180px height */}
      <div className="relative w-full h-[180px] bg-gray-100 overflow-hidden flex-shrink-0">
        <img
          src={book.coverUrl}
          alt={book.title}
          className="w-full h-full object-cover object-center"
          loading="lazy"
        />
        {book.episodeRef && (
          <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-medium">
            S{book.episodeRef.seasonNumber}E{book.episodeRef.episodeNumber}
          </div>
        )}
      </div>

      {/* Metadata: 140px height */}
      <div className="w-full h-[140px] p-4 flex flex-col bg-[#D9D9D9] flex-shrink-0">
        {/* Category Badge: 8px light */}
        <div className="inline-flex items-center bg-[#575757] text-white rounded-full px-3 py-1 w-fit mb-2">
          <span className="text-[8px] font-light">{book.category}</span>
        </div>

        {/* Title: 14px bold, max 2 lines */}
        <h3 className="text-[14px] font-bold text-gray-900 line-clamp-2 leading-tight mb-1">
          {book.title}
        </h3>

        {/* Author: 10px regular, max 1 line */}
        <p className="text-[10px] font-normal text-gray-600 line-clamp-1 mb-auto">
          {book.author}
        </p>

        {/* Amazon Link: 8px medium, 5% letter-spacing */}
        <a
          href={book.amazonUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[8px] font-medium text-gray-700 hover:text-gray-900 underline decoration-gray-400 hover:decoration-gray-700 mt-auto"
          style={{ letterSpacing: '0.05em' }}
        >
          View on Amazon
        </a>
      </div>
    </div>
  );
};
```

#### Acceptance Criteria:
- [ ] Total card height: exactly 320px
- [ ] Image height: exactly 180px
- [ ] Metadata height: exactly 140px
- [ ] Background: #D9D9D9 (not gray-50)
- [ ] Category badge: #575757 background
- [ ] Title: 14px bold
- [ ] Author: 10px regular
- [ ] Category: 8px light
- [ ] Amazon link: 8px medium with 5% letter-spacing
- [ ] No flex-1 anywhere
- [ ] Layout doesn't break at any zoom level

---

## PHASE 2: LAYOUT & RESPONSIVE

### TASK-004: Implement Responsive Column Behavior
**Priority**: High
**Effort**: High
**Dependencies**: TASK-002 must be complete

#### Problem:
Grid needs to respond to viewport width while maintaining large column logic.

#### Files to Modify:
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/components/ShelfGrid.tsx`
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/hooks/useResponsiveColumns.ts` (NEW)

#### Responsive Logic:
```
Viewport Width → Column Count → Large Column Position
≥ 1800px       → 6 columns    → Column 4
1500-1799px    → 5 columns    → Column 4
1200-1499px    → 4 columns    → Column 3
900-1199px     → 3 columns    → None (all small)
< 900px        → 2 columns    → None (all small)
```

#### Implementation Strategy:
```tsx
// useResponsiveColumns.ts
export const useResponsiveColumns = () => {
  const [columnCount, setColumnCount] = useState(6);

  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width >= 1800) setColumnCount(6);
      else if (width >= 1500) setColumnCount(5);
      else if (width >= 1200) setColumnCount(4);
      else if (width >= 900) setColumnCount(3);
      else setColumnCount(2);
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  const getLargeColumnPosition = () => {
    if (columnCount >= 5) return 4; // 4th column
    if (columnCount === 4) return 3; // 3rd column
    return null; // No large column for 2-3 columns
  };

  return { columnCount, largeColumnPosition: getLargeColumnPosition() };
};
```

#### Acceptance Criteria:
- [ ] 6 columns on wide screens (≥1800px)
- [ ] 5 columns on medium-wide screens (1500-1799px)
- [ ] 4 columns on medium screens (1200-1499px)
- [ ] 3 columns on narrow screens (900-1199px)
- [ ] 2 columns on mobile (< 900px)
- [ ] Large column shifts correctly (col 4 → col 3 → none)
- [ ] No fixed breakpoints in CSS (all JS-based)
- [ ] Smooth transitions when resizing

---

### TASK-005: Fix TopBar as Fixed Position
**Priority**: High
**Effort**: Small

#### Problem:
TopBar must remain fixed at top while content scrolls underneath.

#### Files to Modify:
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/components/TopBar.tsx`
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/ClientPage.tsx`

#### Changes Required:
```tsx
// TopBar.tsx
<header className="fixed top-0 left-0 right-0 bg-sidebar-bg border-b border-gray-400 p-4 z-50">
  {/* content */}
</header>

// ClientPage.tsx - add top padding to account for fixed header
<main className="pt-[72px]"> {/* Adjust based on actual TopBar height */}
  {/* content */}
</main>
```

#### Acceptance Criteria:
- [ ] TopBar stays at top during scroll
- [ ] Content scrolls underneath TopBar
- [ ] No gap between TopBar and content
- [ ] TopBar appears above all other content (z-index)
- [ ] Search bar remains accessible while scrolling

---

### TASK-006: Implement Sidebar Fixed Positioning
**Priority**: High
**Effort**: Medium

#### Problem:
Sidebar should remain fixed on left while main content scrolls.

#### Files to Modify:
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/components/EpisodeTimeline.tsx`
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/ClientPage.tsx`

#### Implementation:
```tsx
// EpisodeTimeline.tsx
<aside className="fixed left-0 top-0 bottom-0 w-[380px] bg-sidebar-bg flex flex-col z-40">
  {/* Header - Fixed height */}
  <div className="flex-shrink-0 p-6 border-b border-gray-400 h-[88px]">
    {/* Logo */}
  </div>

  {/* Scrollable episode list */}
  <div className="flex-1 overflow-y-auto">
    {/* Episodes */}
  </div>

  {/* Footer - Fixed height */}
  <div className="flex-shrink-0 border-t border-gray-400 p-6 h-[136px] bg-sidebar-bg">
    {/* Podcast links */}
  </div>
</aside>

// ClientPage.tsx
<div className="ml-[380px]"> {/* Offset for sidebar */}
  {/* Main content */}
</div>
```

#### Acceptance Criteria:
- [ ] Sidebar fixed at 380px width
- [ ] Sidebar stays in place during scroll
- [ ] Episode list scrolls independently
- [ ] Header remains visible (logo)
- [ ] Footer remains visible (podcast links)
- [ ] Footer doesn't disappear after load

---

### TASK-007: Implement Mobile Sidebar Overlay
**Priority**: Medium
**Effort**: Medium
**Dependencies**: TASK-006

#### Problem:
On mobile, sidebar should be full-screen overlay triggered by hamburger menu.

#### Files to Modify:
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/components/EpisodeTimeline.tsx`
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/components/MobileMenu.tsx`

#### Implementation:
```tsx
// Add mobile state
const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

// Desktop: fixed sidebar
// Mobile: full-screen overlay with X button
<aside className={`
  fixed left-0 top-0 bottom-0 bg-sidebar-bg z-50
  lg:w-[380px]
  max-lg:w-full max-lg:transform max-lg:transition-transform
  ${mobileMenuOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'}
`}>
  {/* Mobile: X button in top-right */}
  <button
    className="lg:hidden absolute top-4 right-4 p-2"
    onClick={() => setMobileMenuOpen(false)}
  >
    <X className="w-6 h-6" />
  </button>

  {/* Regular content */}
</aside>
```

#### Acceptance Criteria:
- [ ] Mobile: hamburger menu opens sidebar
- [ ] Mobile: X button closes sidebar
- [ ] Mobile: sidebar is full-screen
- [ ] Mobile: backdrop closes sidebar when clicked
- [ ] Desktop: sidebar always visible (not overlay)
- [ ] Smooth slide animation

---

## PHASE 3: COMPONENT REFINEMENTS

### TASK-008: Fix Sidebar Logo Size
**Priority**: Medium
**Effort**: Small

#### Problem:
Logo is too large in sidebar header.

#### Files to Modify:
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/components/EpisodeTimeline.tsx`

#### Changes:
```tsx
// Current (WRONG)
<Image src="/acq-bookshelf-logo.svg" width={200} height={40} className="h-10 w-auto" />

// Required
<Image src="/acq-bookshelf-logo.svg" width={140} height={28} className="h-7 w-auto" />
```

#### Acceptance Criteria:
- [ ] Logo height: 28px (h-7)
- [ ] Logo maintains aspect ratio
- [ ] Logo fits comfortably in header
- [ ] Sidebar header feels balanced

---

### TASK-009: Fix Episode Listing Typography (Already Correct)
**Priority**: Low
**Effort**: Small (Verification Only)

#### Current Implementation:
Episode code appears first, title appears second (already matches design).

#### Files to Review:
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/components/EpisodeTimeline.tsx`

#### Verify:
- [ ] Episode code shows first: "S14 E3"
- [ ] Episode title shows second: "Renaissance Technologies"
- [ ] Code uses Geist Mono font
- [ ] Code is Extra Bold
- [ ] Title uses Geist font
- [ ] Title is Medium weight
- [ ] Vertical stacking (not horizontal)

---

### TASK-010: Style "What is this?" Button
**Priority**: Medium
**Effort**: Small

#### Problem:
Button needs visual treatment (not plain text).

#### Files to Modify:
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/components/TopBar.tsx`

#### Changes:
```tsx
// Current
<button className="text-sm text-gray-600 hover:text-gray-900 font-medium">
  What is this?
</button>

// Required
<button className="text-sm text-gray-900 font-medium bg-white hover:bg-gray-50 px-4 py-2 rounded-lg border border-gray-300 transition-colors whitespace-nowrap">
  What is this?
</button>
```

#### Acceptance Criteria:
- [ ] White background
- [ ] Rounded corners (8px)
- [ ] Subtle border
- [ ] Hover state (light gray)
- [ ] Matches search input style
- [ ] Proper padding (px-4 py-2)

---

### TASK-011: Update TopBar Background Color
**Priority**: High
**Effort**: Small

#### Problem:
TopBar has white background, should match sidebar gray.

#### Files to Modify:
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/components/TopBar.tsx`

#### Changes:
```tsx
// Current
<header className="bg-white border-b border-gray-200">

// Required
<header className="bg-sidebar-bg border-b border-gray-400">
```

#### Acceptance Criteria:
- [ ] Background: #B8B9B8 (bg-sidebar-bg)
- [ ] Border: border-gray-400
- [ ] Matches sidebar exactly
- [ ] Search bar stands out on gray background

---

### TASK-012: Remove Episode Headers from Grid
**Priority**: High
**Effort**: Small

#### Problem:
Episode titles appear above book grids. Books should flow continuously without headers.

#### Files to Modify:
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/ClientPage.tsx`

#### Changes:
```tsx
// Current (WRONG)
<section className="px-8 pb-12">
  <div className="mb-6">
    <h2>{episode.name}</h2>
    <p>Season {episode.seasonNumber}...</p>
  </div>
  <ShelfGrid books={episode.books} />
</section>

// Required
<section id={`ep-${episode.id}`} data-episode-id={episode.id} className="px-8 pb-12">
  <ShelfGrid books={episode.books} episodeId={episode.id} />
</section>
```

#### Acceptance Criteria:
- [ ] No episode titles in grid area
- [ ] No "Season X, Episode Y" text
- [ ] Books flow continuously
- [ ] Section IDs preserved for navigation
- [ ] Sidebar navigation still works

---

### TASK-013: Position Quote Block Correctly
**Priority**: Medium
**Effort**: Medium

#### Problem:
Quote needs to integrate into book flow at correct position.

#### Desktop Logic:
- Quote appears after first 6 books (end of first full row in 6-column layout)

#### Mobile Logic:
- Quote appears after first 8 books

#### Files to Modify:
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/ClientPage.tsx`
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/components/QuoteBlock.tsx`

#### Implementation Strategy:
```tsx
// ClientPage.tsx
const insertQuoteAt = columnCount >= 5 ? 6 : 8; // Desktop: 6, Mobile: 8

{filteredEpisodes.map((episode, episodeIndex) => {
  const episodeBooks = episode.books;
  const booksBeforeQuote = episodeIndex === 0 ? episodeBooks.slice(0, insertQuoteAt) : episodeBooks;
  const booksAfterQuote = episodeIndex === 0 ? episodeBooks.slice(insertQuoteAt) : [];

  return (
    <section key={episode.id}>
      <ShelfGrid books={booksBeforeQuote} />
      {episodeIndex === 0 && booksAfterQuote.length > 0 && (
        <>
          <QuoteBlock />
          <ShelfGrid books={booksAfterQuote} />
        </>
      )}
    </section>
  );
})}
```

#### Acceptance Criteria:
- [ ] Quote appears after first 6 books (desktop)
- [ ] Quote appears after first 8 books (mobile)
- [ ] Quote spans full grid width
- [ ] Quote has appropriate spacing above/below
- [ ] Books continue flowing after quote
- [ ] No layout breaks

---

### TASK-014: Fix Podcast Icon Size
**Priority**: Low
**Effort**: Small

#### Problem:
Podcast icons (Spotify, Apple, YouTube) are too large.

#### Files to Modify:
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/components/EpisodeTimeline.tsx`

#### Changes:
```tsx
// Current (WRONG)
<img src="/spotify-icon.svg" className="w-8 h-8" />

// Required
<img src="/spotify-icon.svg" className="w-6 h-6 opacity-50 hover:opacity-100 transition-opacity" />
```

#### Acceptance Criteria:
- [ ] Icons are 24px (w-6 h-6)
- [ ] Icons are 50% opacity by default
- [ ] Icons are 100% opacity on hover
- [ ] Smooth transition
- [ ] All three icons same size

---

## PHASE 4: INTERACTIONS

### TASK-015: Implement Scroll Spy with Majority-Visible Logic
**Priority**: High
**Effort**: High

#### Problem:
Current scroll spy may not use "majority visible" logic. Episode should be active when majority of its books are visible.

#### Files to Modify:
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/hooks/useScrollSpy.ts`

#### Algorithm:
```tsx
const calculateVisibility = (episodeId: string) => {
  const section = document.querySelector(`[data-episode-id="${episodeId}"]`);
  if (!section) return 0;

  const books = section.querySelectorAll('[data-book-card]');
  const totalBooks = books.length;
  let visibleBooks = 0;

  books.forEach(book => {
    const rect = book.getBoundingClientRect();
    const windowHeight = window.innerHeight;

    // Check if majority of book is visible
    const visibleHeight = Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0);
    const bookHeight = rect.height;

    if (visibleHeight / bookHeight > 0.5) {
      visibleBooks++;
    }
  });

  return visibleBooks / totalBooks; // Return percentage
};

// Episode is active if > 50% of books visible
const activeEpisode = episodes.reduce((best, episode) => {
  const visibility = calculateVisibility(episode.id);
  return visibility > 0.5 && visibility > best.visibility
    ? { id: episode.id, visibility }
    : best;
}, { id: null, visibility: 0 });
```

#### Acceptance Criteria:
- [ ] Episode highlighted when > 50% of books visible
- [ ] Smooth transitions between episodes
- [ ] No flickering during scroll
- [ ] Works with all episode sizes (1 book to many)
- [ ] Accounts for TopBar offset

---

### TASK-016: Ensure Sidebar Does NOT Auto-Scroll on Episode Click
**Priority**: High
**Effort**: Small

#### Problem:
Clicking episode should scroll MAIN content, not sidebar.

#### Files to Modify:
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/components/EpisodeTimeline.tsx`

#### Implementation:
```tsx
const handleEpisodeClick = (episodeId: string) => {
  const section = document.querySelector(`[data-episode-id="${episodeId}"]`);
  if (section) {
    section.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }
  // Do NOT scroll sidebar
};
```

#### Acceptance Criteria:
- [ ] Clicking episode scrolls main content
- [ ] Sidebar stays in place (doesn't auto-scroll)
- [ ] Smooth scroll animation
- [ ] Episode becomes active after scroll
- [ ] Works consistently across all episodes

---

### TASK-017: Implement Comprehensive Search with Fuzzy Matching
**Priority**: High
**Effort**: High

#### Problem:
Search should filter books, authors, AND episodes with fuzzy matching.

#### Files to Modify:
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/ClientPage.tsx`
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/lib/search.ts` (NEW)

#### Search Algorithm:
```tsx
// Fuzzy match function
const fuzzyMatch = (text: string, query: string): boolean => {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  // Exact substring match
  if (textLower.includes(queryLower)) return true;

  // Fuzzy match: all query chars in order
  let queryIndex = 0;
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      queryIndex++;
    }
  }
  return queryIndex === queryLower.length;
};

// Search function
const searchResults = (query: string, episodes: Episode[]) => {
  if (!query) return episodes;

  return episodes.map(episode => {
    // Check if episode title matches
    const episodeMatches = fuzzyMatch(episode.name, query);

    // Filter books
    const matchingBooks = episode.books.filter(book =>
      fuzzyMatch(book.title, query) ||
      fuzzyMatch(book.author, query)
    );

    // Include episode if either episode title matches OR has matching books
    if (episodeMatches || matchingBooks.length > 0) {
      return {
        ...episode,
        books: episodeMatches ? episode.books : matchingBooks
      };
    }
    return null;
  }).filter(Boolean);
};
```

#### Search Input with X Button:
```tsx
<div className="relative flex-1">
  <input
    type="text"
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    placeholder="Search books, authors, or episodes..."
    className="w-full px-4 py-2 pr-10 rounded-lg border border-gray-300"
  />
  {searchQuery && (
    <button
      onClick={() => setSearchQuery('')}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
    >
      <X className="w-4 h-4" />
    </button>
  )}
</div>
```

#### Acceptance Criteria:
- [ ] Searches book titles
- [ ] Searches book authors
- [ ] Searches episode titles
- [ ] Fuzzy matching works (e.g., "rlx" finds "Rolex")
- [ ] X button clears search
- [ ] Grid updates in real-time
- [ ] Sidebar updates simultaneously
- [ ] No results message if nothing found
- [ ] Search is case-insensitive

---

### TASK-018: Add Hover Effects to Book Cards
**Priority**: Low
**Effort**: Small

#### Implementation:
```tsx
<div className="group cursor-pointer transition-transform hover:scale-105 hover:shadow-lg">
  {/* Book card content */}
</div>
```

#### Acceptance Criteria:
- [ ] Subtle scale increase on hover (1.05)
- [ ] Shadow appears on hover
- [ ] Smooth transition
- [ ] Cursor changes to pointer
- [ ] Works on both small and large tiles

---

## PHASE 5: POLISH

### TASK-019: Add Skeleton Loaders for Books
**Priority**: Medium
**Effort**: Medium

#### Problem:
Books should show skeleton/loading state before data loads.

#### Files to Modify:
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/components/BookCardSkeleton.tsx` (NEW)
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/ClientPage.tsx`

#### Implementation:
```tsx
// BookCardSkeleton.tsx
const BookCardSkeleton = ({ isLarge = false }) => (
  <div className={`flex flex-col ${isLarge ? 'w-[270px]' : 'w-[180px]'} h-[320px] animate-pulse`}>
    <div className="w-full h-[180px] bg-gray-300" />
    <div className="w-full h-[140px] p-4 bg-gray-200 flex flex-col gap-2">
      <div className="w-20 h-4 bg-gray-300 rounded-full" />
      <div className="w-full h-4 bg-gray-300 rounded" />
      <div className="w-3/4 h-4 bg-gray-300 rounded" />
      <div className="w-1/2 h-3 bg-gray-300 rounded mt-auto" />
    </div>
  </div>
);

// Show while loading
{isLoading ? (
  <div className="grid gap-[30px]">
    {Array.from({ length: 12 }).map((_, i) => (
      <BookCardSkeleton key={i} isLarge={i % 4 === 3} />
    ))}
  </div>
) : (
  <ShelfGrid books={books} />
)}
```

#### Acceptance Criteria:
- [ ] Skeleton matches book card dimensions exactly
- [ ] Shows correct mix of small/large tiles
- [ ] Pulse animation
- [ ] Smooth transition to real content
- [ ] Appears immediately on page load

---

### TASK-020: Implement Intro Modal ("What is this?")
**Priority**: Medium
**Effort**: Small (Likely already exists)

#### Files to Review:
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/components/IntroModal.tsx`

#### Verify:
- [ ] Modal opens when "What is this?" clicked
- [ ] Modal explains purpose of site
- [ ] Modal has close button
- [ ] Modal has backdrop
- [ ] Clicking backdrop closes modal
- [ ] Pressing ESC closes modal
- [ ] Modal is centered
- [ ] Content is readable

---

### TASK-021: Add Loading States to Search
**Priority**: Low
**Effort**: Small

#### Implementation:
```tsx
const [isSearching, setIsSearching] = useState(false);

const debouncedSearch = useMemo(
  () => debounce((query: string) => {
    setIsSearching(true);
    // Perform search
    setIsSearching(false);
  }, 300),
  []
);

// Show loading spinner in search input
{isSearching && <Spinner className="absolute right-10 top-1/2" />}
```

#### Acceptance Criteria:
- [ ] Spinner shows while searching
- [ ] Search is debounced (300ms)
- [ ] No flicker for fast searches
- [ ] Spinner doesn't block X button

---

### TASK-022: Verify Book Cover Image Loading
**Priority**: Medium
**Effort**: Small (Testing)

#### Test:
- [ ] Images load progressively (lazy loading works)
- [ ] Placeholder shows before image loads (bg-gray-100)
- [ ] Images are centered and cropped correctly
- [ ] object-cover maintains aspect ratios
- [ ] Works with portrait covers
- [ ] Works with square covers
- [ ] Works with landscape covers (rare)
- [ ] No layout shift when images load

---

### TASK-023: Add Accessibility Features
**Priority**: Medium
**Effort**: Medium

#### Changes Required:
1. **Keyboard Navigation**
   - Tab through episodes in sidebar
   - Enter/Space to select episode
   - Focus visible styles

2. **ARIA Labels**
   - aria-label on search input
   - aria-label on episode list
   - aria-current on active episode

3. **Screen Reader Announcements**
   - Announce search results count
   - Announce active episode on scroll

#### Files to Modify:
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/components/EpisodeTimeline.tsx`
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/components/TopBar.tsx`
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/components/BookCard.tsx`

#### Acceptance Criteria:
- [ ] All interactive elements keyboard accessible
- [ ] Focus styles visible
- [ ] Screen reader friendly
- [ ] ARIA labels present
- [ ] Semantic HTML used

---

## PHASE 6: TESTING & VALIDATION

### TASK-024: Cross-Browser Testing
**Priority**: Medium
**Effort**: Medium (Testing)

#### Test Matrix:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Safari iOS (iPhone)
- [ ] Chrome Android

#### Test Cases:
- [ ] Grid layout renders correctly
- [ ] Scrolling is smooth
- [ ] Search works
- [ ] Navigation works
- [ ] Images load
- [ ] Hover effects work (desktop)
- [ ] Touch interactions work (mobile)

---

### TASK-025: Performance Optimization
**Priority**: Low
**Effort**: Medium

#### Optimizations:
1. **Image Optimization**
   - Use Next.js Image component
   - Add blur placeholders
   - Optimize image sizes

2. **Code Splitting**
   - Lazy load IntroModal
   - Lazy load non-critical components

3. **Virtual Scrolling** (Optional)
   - If > 1000 books, implement virtual scrolling
   - Only render visible books

#### Files to Modify:
- `/Users/RyanWigley/my_projects/acquired-bookshelf/app/components/BookCard.tsx`
- `/Users/RyanWigley/my_projects/acquired-bookshelf/next.config.ts`

#### Acceptance Criteria:
- [ ] Lighthouse score > 90
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3s
- [ ] No layout shifts (CLS = 0)

---

## IMPLEMENTATION NOTES

### Color Specifications (Exact):
```
Metadata Background:    #D9D9D9
Category Badge BG:      #575757
Sidebar Background:     #B8B9B8
Active Green:           #5CE8C5
Hover Gray:             #C6C7C6
```

### Typography Specifications (Exact):
```
Book Title:         14px bold, Geist
Book Author:        10px regular, Geist
Category Badge:     8px light, Geist
Amazon Link:        8px medium, Geist, 5% letter-spacing
Episode Code:       12px extra-bold, Geist Mono
Episode Title:      14px medium, Geist
```

### Dimension Specifications (Exact):
```
Book Tile Height:       320px
Book Cover Height:      180px
Book Metadata Height:   140px
Small Tile Width:       180px
Large Tile Width:       270px
Grid Gap:               30px
Sidebar Width:          380px
```

### Grid Logic (Critical):
```
Column Pattern:     180px | 180px | 180px | 270px | repeat...
Large Column:       Every 4th column (4, 8, 12, 16...)
Flow:               Left-to-right by row (NOT masonry)
Responsive:         Column count decreases, large column shifts
```

---

## PRIORITY SUMMARY

### MUST FIX IMMEDIATELY (Blocking):
1. TASK-001: Remove overflow:hidden (page can't scroll)
2. TASK-002: Replace masonry with column grid (fundamentally wrong)
3. TASK-003: Fix BookCard heights (layout broken with flex-1)

### HIGH PRIORITY (Core Functionality):
4. TASK-004: Responsive column behavior
5. TASK-005: Fix TopBar positioning
6. TASK-006: Fix sidebar positioning
7. TASK-011: TopBar background color
8. TASK-012: Remove episode headers
9. TASK-015: Scroll spy with majority-visible
10. TASK-016: Sidebar doesn't auto-scroll
11. TASK-017: Comprehensive search

### MEDIUM PRIORITY (Polish & UX):
12. TASK-007: Mobile sidebar overlay
13. TASK-008: Sidebar logo size
14. TASK-010: "What is this?" button styling
15. TASK-013: Quote block positioning
16. TASK-019: Skeleton loaders
17. TASK-020: Intro modal
18. TASK-023: Accessibility

### LOW PRIORITY (Nice to Have):
19. TASK-009: Episode listing verification
20. TASK-014: Podcast icon size
21. TASK-018: Hover effects
22. TASK-021: Search loading states
23. TASK-022: Image loading verification
24. TASK-024: Cross-browser testing
25. TASK-025: Performance optimization

---

## SUCCESS CRITERIA

The implementation is complete when:

### Visual Match:
- [ ] Grid is column-based (not masonry)
- [ ] All tiles are 320px tall
- [ ] Column 4 is large (270px)
- [ ] 30px gaps everywhere
- [ ] Colors match spec exactly (#D9D9D9, #575757)
- [ ] Typography matches spec exactly (14px, 10px, 8px)
- [ ] TopBar is gray (#B8B9B8)
- [ ] No episode headers in grid
- [ ] Quote integrated after 6/8 books
- [ ] Sidebar footer visible
- [ ] Logo correctly sized

### Functional Requirements:
- [ ] Page scrolls smoothly
- [ ] TopBar fixed at top
- [ ] Sidebar fixed on left
- [ ] Episode click scrolls to books
- [ ] Scroll activates correct episode (majority-visible)
- [ ] Search filters books + authors + episodes
- [ ] Fuzzy search works
- [ ] X button clears search
- [ ] Mobile sidebar is full-screen overlay
- [ ] All interactions smooth, no bugs

### Responsive Requirements:
- [ ] 6 → 5 → 4 → 3 → 2 columns based on viewport
- [ ] Large column shifts: col 4 → col 3 → none
- [ ] Mobile: quote after 8 books
- [ ] Mobile: no large column
- [ ] No fixed breakpoints (auto-fill)

### Performance:
- [ ] No console errors
- [ ] Smooth scrolling (60fps)
- [ ] Images lazy load
- [ ] Search is instant
- [ ] No layout shifts

---

**Document Status**: Ready for Implementation
**Total Tasks**: 25
**Estimated Effort**: 3-4 weeks full-time
**Critical Path**: TASK-001 → TASK-002 → TASK-003 → TASK-004

---

## QUESTIONS FOR CLARIFICATION (If Needed)

1. **Quote Styling**: Does the quote block need any visual updates beyond positioning?
2. **Episode Badges**: Should they appear on ALL books or only certain ones?
3. **Mobile Navigation**: Should there be a hamburger icon, or does sidebar auto-open?
4. **Search Placeholder**: What should the exact placeholder text be?
5. **Footer Links**: Are Spotify/Apple/YouTube links functional or coming soon?
6. **Loading State**: Should first load show skeletons or nothing?
7. **Error Handling**: What should happen if book covers fail to load?
8. **Empty States**: What shows if search has no results?

---

*This document supersedes PRODUCT_ROADMAP.md where specifications conflict.*
*All measurements, colors, and logic have been corrected per user interview 2025-10-15.*