# Acquired Bookshelf

A curated collection of books mentioned on the Acquired podcast, presented in an interactive masonry grid layout with synchronized episode navigation.

## Features

- **Column-Based Grid Layout**: Books displayed in a responsive grid using CSS Grid with auto-fill and dense packing
- **Episode Sidebar Navigation**: Gray-themed sidebar (#B8B9B8) with 164+ episodes and scroll spy synchronization
- **Three-way Synchronization**: Seamless sync between sidebar episodes, book gallery scrolling, and search functionality
- **Two Card Sizes**: First 4 books per episode displayed in large tiles (270px × 470px), remaining books in small tiles (180px × 350px)
- **Interactive Search**: Real-time search across books, authors, and episode names
- **Responsive Design**: Optimized for all screen sizes with auto-fill grid that adapts from desktop to mobile
- **Modern UI**: Clean design with gray sidebar, active green highlights (#5CE8C5), and integrated quote blocks

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Architecture

### Core Components

- **ClientPage.tsx**: Main layout orchestrator managing state, search, and scroll spy synchronization
- **TopBar**: Search bar, mobile menu toggle, and "What is this?" button
- **ShelfGrid**: CSS Grid layout manager with auto-fill 90px columns and dense packing algorithm
- **BookCard**: Individual book components with two sizes - large (270px × 470px) and small (180px × 350px)
- **EpisodeTimeline**: Gray sidebar with episode list, active state tracking, and IntersectionObserver-based scroll spy
- **IntroModal**: Welcome modal shown on first visit (tracked via localStorage)
- **QuoteBlock**: Integrated quote displays spanning 2-3 columns within the grid

### Layout Architecture

- **Grid System**: CSS Grid with `repeat(auto-fill, 90px)` tracks and `grid-flow-dense` for optimal packing
- **Card Sizing**:
  - Large cards: First 4 books per episode (3 columns × variable rows)
  - Small cards: Remaining books (2 columns × variable rows)
- **Responsive Behavior**: Auto-fill grid naturally adapts to screen width, collapsing from multi-column to single-column on mobile
- **Gap & Spacing**: 24px horizontal/vertical gaps, content padding of 6-12 based on breakpoint

### Data Management

- **Episode Cache**: 164+ unique episodes with deduplication
- **Book Data**: Comprehensive book metadata with episode references
- **Dynamic Height Calculation**: `useMasonryItem` hook measures actual content height and calculates row spans
- **Scroll Spy**: IntersectionObserver tracks visible episodes and updates sidebar active state

### Styling

- **Tailwind CSS**: Utility-first styling with custom color palette
- **Color Scheme**:
  - Sidebar background: #B8B9B8
  - Active green: #5CE8C5
  - Hover gray: #C6C7C6
- **Fixed Sidebar**: 380px width on desktop, hidden on mobile with menu drawer
- **Typography**: Geist Sans and Geist Mono fonts with size-specific scaling

## Development

The project uses Next.js 15 with TypeScript and modern React patterns:

- Server components for initial data loading
- Client components for interactive features  
- Optimized image handling for book covers
- Debounced scroll events for smooth performance

## Scraper Integration

See [SCRAPER-README.md](./SCRAPER-README.md) for details on the automated book collection system that powers the data.

## Deployment

See [DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md) for production deployment instructions.

## Contributing

Thank you for your interest in contributing to Acquired Bookshelf! We welcome contributions from the community.

### Development Workflow

1. **Fork and Clone**:
```bash
git clone https://github.com/your-username/acquired-bookshelf.git
git remote add upstream https://github.com/original-owner/acquired-bookshelf.git
```

2. **Create a Branch**:
```bash
git checkout -b feature/your-feature-name
# or fix/your-fix-name, docs/your-doc-change, etc.
```

3. **Code Standards**:
   - Use TypeScript for all new code
   - Follow existing code formatting patterns
   - Use functional components with hooks
   - Include TypeScript interfaces for props
   - Use TailwindCSS for styling

4. **Commit Messages** - Follow conventional commits:
```
type(scope): description

feat: New feature
fix: Bug fix
docs: Documentation changes
refactor: Code refactoring
```

5. **Testing Before Submission**:
   - Test all changes locally
   - Ensure responsive design works (6→5→4→3→2 column breakpoints)
   - Check console for errors
   - Verify vertical scrolling functionality
   - Test column grid layout (column 4 should be large 270px)
   - Test search and filtering features
   - Verify scroll spy synchronization with sidebar

6. **Submit Pull Request**:
   - Use clear title and detailed description
   - Include screenshots for UI changes
   - Link related issues

### Book Data Contributions

When adding new books:
- Verify book information (correct Amazon URL, accurate episode reference)
- Update `manual-covers.json` if needed for missing covers
- Document the source for any manual cover images

### Questions?

- Check existing issues
- Review documentation
- Create a new issue with the "question" label

All contributors will be recognized in the project.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!