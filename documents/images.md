# Image Processing Strategy

This document outlines how Acquired Bookshelf handles book cover images from Open Library.

## Overview

Our image strategy focuses on reliable performance and API rate limit compliance through:
1. Batch processing of cover images
2. Local caching strategy
3. Optimized delivery using Next.js Image
4. Fallback system for missing images

## Implementation

### 1. Batch Processing
```typescript
// Process covers in generate-data.ts
async function processBookCovers(books: Book[]) {
  const BATCH_SIZE = 10;
  const DELAY_MS = 1000;
  
  console.log(`Processing ${books.length} books in batches of ${BATCH_SIZE}`);
  
  for (let i = 0; i < books.length; i += BATCH_SIZE) {
    const batch = books.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}`);
    
    await Promise.all(
      batch.map(async (book) => {
        await downloadAndCacheCover(book);
      })
    );
    
    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  }
}
```

### 2. Caching Strategy
```
public/
└── covers/
    ├── [isbn].jpg        # Primary resolution
    ├── [isbn]-thumb.jpg  # Thumbnail version
    └── placeholder.jpg   # Fallback image
```

### 3. Image Component Implementation
```typescript
// components/BookCover.tsx
interface BookCoverProps {
  isbn: string;
  title: string;
}

export default function BookCover({ isbn, title }: BookCoverProps) {
  return (
    <Image
      src={`/covers/${isbn}.jpg`}
      fallback={`/covers/placeholder.jpg`}
      alt={`Cover of ${title}`}
      width={240}
      height={350}
      loading="lazy"
      className="rounded-lg"
    />
  );
}
```

## Error Handling

### Download Failures
- Implement exponential backoff
- Log failed downloads for review
- Use placeholder for failed downloads

### Cache Management
- Regular cleanup of unused covers
- Verification of cache integrity
- Monitoring of storage usage

## Monitoring

Key metrics to track:
- Download success rate
- Cache hit rate
- Storage usage
- Image load performance

## Development Setup

```bash
# Generate local cover cache
npm run generate-covers

# Clean unused covers
npm run clean-covers
```

## Production Considerations

### Storage Options
1. **Git Repository**
   - Pros: Simple, version controlled
   - Cons: Repository size, rebuild required
   
2. **CDN (Recommended)**
   - Pros: Scalable, better performance
   - Cons: Additional service to manage

3. **Vercel Blob Storage**
   - Pros: Integrated with deployment
   - Cons: Usage limits, costs

## Initial Load Strategy

For the first deployment, we handle downloading covers for the existing catalog with conservative settings:

```typescript
const config = {
  batchSize: 5,
  delayMs: 2000, // 2 seconds between batches
};

async function processBookCovers(books: Book[]) {
  const { batchSize, delayMs } = config;
  
  console.log(`Processing ${books.length} books in batches of ${batchSize}`);
  
  for (let i = 0; i < books.length; i += batchSize) {
    const batch = books.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(books.length/batchSize)}`);
    
    await Promise.all(
      batch.map(async (book) => {
        await downloadAndCacheCover(book);
      })
    );
    
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
}
```

## Future Improvements

1. Implement WebP conversion
2. Add responsive images
3. Consider blur placeholder generation
4. Implement image optimization pipeline