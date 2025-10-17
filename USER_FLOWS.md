# App Flow & Functionality Document

## Overview

ACQUIRED Bookshelf is a visual directory of all books mentioned on the Acquired podcast. Users can browse chronologically through episodes, search for specific books or authors, and navigate through the complete book catalog via an interactive grid layout with sidebar navigation.

---

## Primary User Flows

### 1. Landing Experience

**Initial Page Load:**
- User opens the page
- Sees skeleton loaders (light gray tiles) displaying the layout structure
- Content progressively loads from the API
- Grid of books appears with episode sidebar on the right
- Page is ready for interaction

**What Users See:**
- A column-based grid of book cover images (NOT masonry - books flow left-to-right by row)
- Episode timeline sidebar on the right (desktop) or hamburger menu (mobile)
- Search bar and "What is this?" button in the top bar
- Books organized chronologically by episode appearance

---

### 2. Browsing Books

**Grid Layout:**
- Books displayed in a responsive column layout
- Column 4 features larger tiles for visual variety and emphasis
- All other columns use standard-sized tiles
- Books flow vertically, creating a scrollable gallery

**Scrolling Behavior:**
- User scrolls vertically through the entire book catalog
- As they scroll, the sidebar automatically highlights the currently active episode
- Episode is considered "active" when the majority of its books are visible in viewport
- Smooth, natural scrolling experience

**Book Interaction:**
- Hovering over a book: slight lift/scale effect for visual feedback
- Book covers themselves are not clickable
- Each book has a "View on Amazon" link that opens in a new tab
- Book metadata (title, author) visible on hover or below tile

---

### 3. Episode Navigation

**Using the Sidebar:**
- User clicks on an episode in the right sidebar
- Main content area smoothly scrolls to center that episode's books
- Clicked episode becomes highlighted in the sidebar
- Sidebar maintains its scroll position (does not auto-scroll)

**Visual Feedback:**
- Active episode is visually distinguished (highlighted state)
- Smooth scroll animation provides clear connection between click and content
- Episode groupings are visually separated in the main grid

---

### 4. Search Flow

**Search Input:**
- Type in the search bar at the top of the page
- Search uses fuzzy matching to filter:
  - Book titles
  - Author names
  - Episode names

**Real-Time Filtering:**
- Grid instantly updates to show only matching books
- Sidebar filters to display only episodes containing matches
- X button appears in search input for quick clearing
- Search is non-case-sensitive and forgiving of typos

**No Results State:**
- If no matches found: "No books found" message displays
- Clear call-to-action to adjust search or clear filters
- Easy recovery path for users

---

### 5. Mobile Experience

**Layout Adaptations:**
- Sidebar becomes a hamburger menu in the top bar
- Tap hamburger icon: full-screen overlay sidebar appears
- X button in overlay to close and return to grid
- Search input shrinks to fit mobile viewport

**Mobile-Specific UI:**
- "What is this?" button becomes a ? icon to save space
- Grid displays 2 columns of small book tiles only (no large tiles)
- Quote block appears after every 8 books for visual break
- Touch-optimized interactions and spacing

**Navigation:**
- Tap episode in overlay menu to jump to that section
- Overlay automatically closes after selection
- Optimized for thumb-friendly interaction zones

---

### 6. Modal ("What is this?")

**Opening the Modal:**
- User clicks "What is this?" button in the top bar (desktop)
- Or taps ? icon (mobile)
- Modal appears with an explanation of the site's purpose and background

**Modal Content:**
- Explains what ACQUIRED Bookshelf is
- Describes the Acquired podcast connection
- Provides context for how books are curated
- "Got it" button to close

**Important Behavior:**
- Modal does NOT auto-show on first visit
- Only appears when user explicitly requests information
- User-initiated information discovery only

---

## Key Interaction Principles

1. **Performance**: Skeleton loaders communicate loading state without blocking interaction
2. **Discoverability**: Visual feedback on hover/interaction guides users naturally
3. **Context**: Sidebar keeps users oriented in the chronological episode timeline
4. **Responsiveness**: Layout adapts intelligently from desktop to mobile
5. **Search**: Forgiving, fast, and easy to clear
6. **Accessibility**: Click targets are appropriately sized, contrast is maintained

---

## Technical Notes

- The only non-book element in the grid may include the Acquired Podcast artwork tile
- All external links (Amazon) open in new tabs
- Smooth scrolling is native browser behavior where supported
- Episode data and book metadata loaded from API/cache