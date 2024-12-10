# Data Structure Documentation

## Data Sources

1. **Manual Sources**
   - Episode metadata
   - Amazon book URLs
   - Basic book information

2. **Open Library API**
   - Book covers
   - Subject categorization

## Data Structure

### Manual Sources Object
```typescript
interface ManualSources {
  [episodeId: string]: {  // Format: "seasonNumber-episodeNumber"
    episodeName: string;
    bookUrls: string[];  // Amazon URLs
  }
}
```

### Book Object
```typescript
interface Book {
  id: string;                // Unique identifier
  title: string;            // From Amazon URL
  author: string;           // From Amazon URL
  coverUrl: string;         // From Open Library
  amazonUrl: string;        // Original Amazon URL
  category: string[];       // From Open Library
  episodeRef: {
    name: string;          // Episode name
    seasonNumber: number;  // Season number
    episodeNumber: number; // Episode number
  } | null;                // null for special tiles (e.g., podcast tile)
}
```

## File Structure

```
public/
└── data/
    ├── books.json          # Generated book data
    └── stats.json          # Processing statistics
```

## Data Pipeline

1. **Source Management**
   - Maintain manual-sources.json
   - Version control source data
   - Validate Amazon URLs

2. **Book Metadata**
   - Process Amazon URLs
   - Query Open Library API
   - Apply rate limiting
   - Generate unique IDs

3. **Data Generation**
   - Combine source and enriched data
   - Generate static JSON files
   - Validate output format

## Example JSONs

### manual-sources.json
```json
{
  "14-6": {
    "episodeName": "Microsoft Volume II",
    "bookUrls": [
      "https://www.amazon.com/Hardcore-Software-Inside-Revolution-ebook/dp/B0CYBS9PFY",
      "https://www.amazon.com/Microsoft-Story-Rebooted-Upgraded-Storybook/dp/1400223903"
    ]
  }
}
```

### books.json
```json
{
  "books": [
    {
      "id": "hardcore-software",
      "title": "Hardcore Software",
      "author": "Steven Sinofsky",
      "coverUrl": "https://covers.openlibrary.org/...",
      "amazonUrl": "https://www.amazon.com/...",
      "category": ["Computer Science", "Business"],
      "episodeRef": {
        "name": "Microsoft Volume II",
        "seasonNumber": 14,
        "episodeNumber": 6
      }
    }
  ]
}
```

### manual-covers.json
```json
{
  "1783341726": {
    "id": "1783341726",
    "title": "Ikea",
    "author": "Johan Stenebo",
    "coverUrl": "/covers/ikea.jpg"
  }
}
```

## Updating Data

To update the book catalog:

1. Add new entries to manual-sources.json
2. Run data generation:
```bash
npm run generate-data
```

This will:
1. Process all manual sources
2. Update book metadata
3. Generate new JSON files

## Error Handling

### Invalid URLs
- Log invalid Amazon URLs for review
- Skip processing but continue pipeline
- Include error details in stats.json

### API Failures
- Implement exponential backoff
- Cache successful responses
- Provide manual override options

## Monitoring

Key metrics tracked in stats.json:
- Total books processed
- Success rate
- Failed URLs
- Processing duration
- Category distribution