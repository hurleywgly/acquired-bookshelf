# Development Guide

This guide covers the development setup and workflows for Acquired Bookshelf.

## Project Structure

```
.
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   ├── globals.css        # Global styles
│   └── components/        # React components
│       ├── BookGrid.tsx       # Horizontal scrolling grid
│       ├── BookTile.tsx       # Individual book display
│       ├── CategoryNav.tsx    # Category navigation
│       ├── Header.tsx         # App header with search
│       └── Footer.tsx         # App footer
├── data/                  # Data management
│   ├── episode-cache.ts   # Episode data
│   └── manual-covers.json # Fallback cover images
└── public/               
    └── data/             # Static JSON data
        ├── books.json    # Generated book data
        └── stats.json    # Book and episode counter
```

## Development Workflow

### 1. Component Development

Each component follows these principles:
- Written in TypeScript with React
- Styled using TailwindCSS utility classes
- Implements responsive design patterns
- Uses Next.js Image component for optimized images

### 2. Data Management

Book data is handled through multiple systems:

1. **Open Library API Integration**
   - Primary source for book covers and metadata
   - Rate-limited requests with proper error handling
   - Caching system for API responses

2. **Fallback System**
   - `manual-covers.json` for missing API covers
   - Generated placeholders as final fallback
   - Automatic fallback handling in BookTile component

### 3. Search and Filtering

The application implements:
- Real-time search across titles and authors
- Category-based filtering
- Combined filter state management
- Optimized re-rendering patterns

## Best Practices

### Component Guidelines

1. **State Management**
   - Use hooks for complex state
   - Implement proper memo patterns
   - Keep state as local as possible

2. **Performance**
   - Lazy load images
   - Implement proper list virtualization
   - Optimize re-renders

3. **Styling**
   - Use Tailwind's utility classes
   - Maintain consistent spacing
   - Follow responsive design patterns

### TypeScript Usage

1. **Type Definitions**
```typescript
interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  category: string;
  episodeRef: {
    name: string;
    seasonNumber: number;
    episodeNumber: number;
  } | null;
}
```

2. **Prop Types**
```typescript
interface BookTileProps {
  book: Book;
  className?: string;
}
```

## Troubleshooting

### Common Issues

1. **Book Covers Not Loading**
   - Check Open Library API status
   - Verify manual-covers.json format
   - Check network requests

2. **Horizontal Scroll Issues**
   - Verify scroll container width
   - Check overflow properties
   - Inspect event listeners

3. **Search Performance**
   - Implement debouncing
   - Optimize filter functions
   - Check re-render patterns

## Deployment

### Vercel Deployment

1. **Setup**
   - Connect GitHub repository
   - Configure build settings
   - Set up automatic deployments

2. **Build Configuration**
   - Node.js 18 environment
   - Install dependencies
   - Build static assets

3. **Monitoring**
   - Check build logs
   - Monitor API usage
   - Track performance metrics

## Contributing

### Development Process

1. Create feature branch
2. Implement changes
3. Run tests
4. Create pull request
5. Address review feedback

### Code Style

- Follow TypeScript best practices
- Use meaningful component names
- Document complex logic
- Maintain consistent formatting