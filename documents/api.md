# API Documentation

This document outlines the external APIs used in Acquired Bookshelf.

## OpenLibrary API

### Covers API
Base URL: `https://covers.openlibrary.org`

#### Access Patterns
```
Book Covers: /b/$key/$value-$size.jpg
Author Photos: /a/$key/$value-$size.jpg
```

Where:
- `key`: ISBN, OCLC, LCCN, OLID, or ID
- `size`: S (small), M (medium), or L (large)

#### Rate Limits
- 100 requests per IP every 5 minutes
- Only applies to ISBN, OCLC, LCCN lookups
- OLID and Cover ID lookups not rate limited

#### Example URLs
```
https://covers.openlibrary.org/b/isbn/9780385533225-S.jpg
https://covers.openlibrary.org/b/olid/OL7440033M-S.jpg
https://covers.openlibrary.org/b/id/240727-S.jpg
```

### Subjects API

Base URL: `https://openlibrary.org/subjects`

#### Key Endpoints

1. Get Works by Subject:
```
GET /subjects/{subject}.json
```

2. Get Detailed Subject Information:
```
GET /subjects/{subject}.json?details=true
```

#### Response Format (Basic)
```json
{
    "key": "/subjects/love",
    "name": "love",
    "subject_type": "subject",
    "work_count": 4918,
    "works": [
        {
            "key": "/works/OL66534W",
            "title": "Pride and prejudice",
            "edition_count": 752,
            "authors": [
                {
                    "name": "Jane Austen",
                    "key": "/authors/OL21594A"
                }
            ]
        }
    ]
}
```

#### Response Format (Detailed)
```json
{
    "key": "/subjects/love",
    "name": "Love",
    "subject_type": "subject",
    "work_count": 4918,
    "works": [...],
    "authors": [
        {
            "count": 28,
            "name": "Plato",
            "key": "/authors/OL12823A"
        }
    ],
    "subjects": [
        {
            "count": 914,
            "name": "Religious aspects of Love",
            "key": "/subjects/religious_aspects_of_love"
        }
    ]
}
```

#### Query Parameters
- `details`: When true, includes related subjects and metadata
- `ebooks`: When true, only includes works with e-books
- `published_in`: Filter by publication year range (e.g., "1500-1600")
- `limit`: Number of works to return
- `offset`: Starting offset for pagination

## Error Handling

### Rate Limiting Strategy
```typescript
const rateLimitConfig = {
  maxRequests: 100,
  timeWindow: 5 * 60 * 1000, // 5 minutes in ms
  backoffFactor: 1.5,
  maxRetries: 3
};
```

### Response Validation
- Check for empty/invalid responses
- Validate required fields
- Handle missing cover images
- Process subject data formatting

## Testing

### API Testing
```bash
# Test cover image retrieval
npm run test:covers

# Test subject data retrieval
npm run test:subjects

# Test rate limit handling
npm run test:rate-limits
```

## Implementation Notes

1. Cover Image Processing:
```typescript
async function getCoverUrl(isbn: string) {
  const sizes = ['L', 'M', 'S'];
  for (const size of sizes) {
    const url = `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg`;
    if (await checkImageExists(url)) {
      return url;
    }
  }
  return '/placeholder.jpg';
}
```

2. Subject Processing:
```typescript
async function getBookSubjects(olid: string) {
  const response = await fetch(`https://openlibrary.org/works/${olid}.json`);
  const data = await response.json();
  return data.subjects || [];
}
```

3. Rate Limiting Implementation:
```typescript
class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;

  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      if (!this.processing) {
        this.process();
      }
    });
  }

  private async process() {
    this.processing = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        await task();
        await new Promise(resolve => setTimeout(resolve, 60000 / 100)); // Max 100 requests per minute
      }
    }
    this.processing = false;
  }
}