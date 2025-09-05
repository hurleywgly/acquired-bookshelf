# Optimized Scraper Implementation Plan - August 2025

## Phase 1: Fix Critical Bugs (Immediate)

### 1. Fix Cache Refresh Logic
- **File**: `lib/scraper.ts`
- **Change**: Add cache invalidation and refresh mechanism
- **Implementation**: Check for new episodes BEFORE returning cached data

### 2. Fix Episode Pattern Matching
- **File**: `lib/scraper.ts` 
- **Change**: Update regex to handle seasonal patterns
- **Pattern**: `/(?:Fall|Spring|Summer|Winter) (\d{4}), Episode (\d+)|Season (\d+), Episode (\d+)/`

### 3. Fix New Episode Detection
- **File**: `scripts/weekly-scraper.ts`
- **Change**: Compare episode dates, not fetchedAt timestamps

## Phase 2: Smart RSS-Based Detection with Adaptive Delays (Week 1)

### 1. Create RSS Monitor with Intelligence
- **New File**: `lib/rss-monitor.ts`
- **Features**:
  - Poll RSS feed (`https://feeds.transistor.fm/acquired`) every 6 hours
  - Detect episode type (interview vs regular)
  - Apply adaptive delay strategy

### 2. Adaptive Delay Strategy
```typescript
interface EpisodeProcessing {
  episode: Episode
  detectedAt: number
  processAfter: number
  retryCount: number
  hasGoogleDoc?: boolean
}

// Smart delay logic
function getProcessingDelay(episode: Episode): number {
  // Interview episodes - skip entirely
  if (episode.title.toLowerCase().includes('interview')) {
    return -1 // Flag to skip
  }
  
  // First attempt - immediate for regular episodes
  if (!episode.retryCount) {
    return 0 // Process immediately
  }
  
  // Retry with 2-hour delay if no sources found
  return 2 * 60 * 60 * 1000
}
```

### 3. Processing Flow
1. **RSS Check** (every 6 hours):
   - Detect new episodes from Transistor feed
   - Filter out interviews
   - Queue regular episodes for immediate processing

2. **Initial Processing** (immediate):
   - Try to fetch Google Doc from acquired.fm episode page
   - If found → process books
   - If not found → requeue with 2-hour delay

3. **Retry Processing** (2 hours later):
   - Second attempt to find sources
   - If still not found → log and skip (likely no sources for this episode)

## Phase 3: Security Fixes (Week 1-2)

### 1. URL Validation
```typescript
const ALLOWED_DOMAINS = [
  'www.acquired.fm',
  'docs.google.com',
  'openlibrary.org',
  'amazon.com',
  'images-na.ssl-images-amazon.com',
  'm.media-amazon.com',
  'feeds.transistor.fm'
]

function validateUrl(url: string): boolean {
  const parsed = new URL(url)
  return ALLOWED_DOMAINS.includes(parsed.hostname)
}
```

### 2. Input Sanitization
- Sanitize all scraped content
- Limit string lengths
- Validate ASIN formats

### 3. Safe Google Doc Access
- Validate Google Doc IDs
- Use proper export formats
- Handle redirect URLs safely

## Phase 4: Performance Optimizations (Week 2)

### 1. Parallel Processing
- Process up to 3 episodes concurrently
- Batch book metadata requests (10 at a time)

### 2. Smart Caching
- Cache episode types (interview vs regular)
- Skip known interview episodes
- Incremental cache updates

### 3. Efficient Retry Logic
- Max 2 attempts per episode
- Exponential backoff for API failures
- Circuit breaker for repeated failures

## Phase 5: Quality Enhancements (Week 3)

### 1. Episode Classification
```typescript
enum EpisodeType {
  REGULAR = 'regular',        // Has sources doc
  INTERVIEW = 'interview',    // No sources doc
  SPECIAL = 'special',        // Holiday specials, etc
  UNKNOWN = 'unknown'         // Needs checking
}

function classifyEpisode(title: string): EpisodeType {
  const lowerTitle = title.toLowerCase()
  if (lowerTitle.includes('interview')) return EpisodeType.INTERVIEW
  if (lowerTitle.includes('holiday special')) return EpisodeType.SPECIAL
  if (lowerTitle.includes('acquired live')) return EpisodeType.SPECIAL
  return EpisodeType.REGULAR
}
```

### 2. Monitoring & Metrics
- Track success rate by episode type
- Monitor delay effectiveness
- Log source availability timing

### 3. Data Validation
- Validate scraped book data
- Check metadata quality
- Confidence scoring for matches

## Implementation Files

### Files to Create:
1. `lib/rss-monitor.ts` - RSS monitoring with smart delays
2. `lib/episode-classifier.ts` - Identify episode types
3. `lib/adaptive-processor.ts` - Handle retry logic
4. `lib/url-validator.ts` - Security validation
5. `lib/data-sanitizer.ts` - Input sanitization
6. `scripts/optimized-scraper.ts` - New main scraper
7. `data/episode-types.json` - Cache episode classifications
8. `data/pending-episodes.json` - Queue state persistence
9. `optimized-scraper-implementation-plan-aug25.md` - This plan

### Files to Modify:
1. `lib/scraper.ts` - Fix cache and patterns
2. `lib/openLibrary.ts` - Add validation and sanitization
3. `scripts/weekly-scraper.ts` - Integrate new system
4. `package.json` - Add dependencies (fast-xml-parser, p-retry)
5. `render.yaml` - Update to 6-hour schedule

## Processing Timeline Example

**Hour 0:00** - RSS Check
- New episode "Google" detected at 8:11 PM Pacific
- Type: Regular (not interview)
- Queue for immediate processing

**Hour 0:01** - Initial Processing
- Fetch acquired.fm/episodes/google
- Google Doc found ✅
- Process books, update database

**Hour 6:00** - RSS Check
- New episode "Jamie Dimon Interview" detected
- Type: Interview
- Skip (no sources expected)

**Hour 12:00** - RSS Check
- New episode "Microsoft" detected
- Type: Regular
- Queue for immediate processing

**Hour 12:01** - Initial Processing
- Fetch episode page
- No Google Doc found ❌ (blog post not yet updated)
- Requeue with 2-hour delay

**Hour 14:01** - Retry Processing
- Fetch episode page again
- Google Doc now found ✅
- Process books, update database

## Success Metrics
- 90% success on first attempt (immediate)
- 99% success after retry (2-hour delay)
- Zero processing of interview episodes
- 95% reduction in unnecessary API calls
- Episodes processed within 2-8 hours of podcast release

## Implementation Order

### Week 1: Core Fixes & RSS Integration
1. Fix cache refresh bug preventing new episode detection
2. Fix episode pattern matching for seasonal formats
3. Implement RSS monitor with Transistor feed
4. Add adaptive delay processing
5. Create episode classifier

### Week 2: Security & Optimization
1. Add URL validation and allowlisting
2. Implement input sanitization
3. Add parallel processing
4. Optimize caching strategy

### Week 3: Quality & Testing
1. Add monitoring and metrics
2. Implement data validation
3. Test with various episode types
4. Verify timing assumptions

### Week 4: Deployment
1. Deploy alongside existing system
2. Monitor both systems in parallel
3. Validate improved performance
4. Switch to new system

## Why This Approach Works
1. **Adaptive**: Only delays when necessary (blog post lag)
2. **Intelligent**: Skips episodes that won't have sources
3. **Efficient**: 95% reduction in API calls
4. **Reliable**: Handles timing uncertainties gracefully
5. **Secure**: Validates all external inputs
6. **Fast**: Most episodes processed within minutes