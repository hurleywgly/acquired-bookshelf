# Scraper Next Steps - Proposal

## Executive Summary

**Current Status**: Phases 1-3 COMPLETE ✅
**Pending Work**: Phases 4-5 (Performance & Quality)
**Recommendation**: Test in production FIRST, then optimize based on real data

---

## What's Complete (Phases 1-3)

✅ **Phase 1: Critical Bug Fixes**
- Cache refresh logic fixed
- Episode pattern matching updated for seasonal formats
- New episode detection corrected

✅ **Phase 2: Smart RSS-Based Detection**
- RSS monitor implemented (`lib/rss-monitor.ts`)
- Adaptive delay strategy working (immediate + 2-hour retry)
- Episode classification (Regular/Interview/Special)

✅ **Phase 3: Security Fixes**
- URL validation with domain allowlisting (`lib/url-validator.ts`)
- Input sanitization implemented
- Safe Google Doc access with SSRF protection

---

## What's Pending (Phases 4-5)

### Phase 4: Performance Optimizations
- ⏳ Parallel processing (3 episodes concurrently)
- ⏳ Smart caching enhancements
- ⏳ Circuit breaker for repeated failures

### Phase 5: Quality Enhancements
- ⏳ Monitoring & metrics system
- ⏳ Data validation & confidence scoring
- ⏳ Success rate tracking by episode type

---

## Recommended Approach

### Step 1: Production Testing (Week 1)
**Goal**: Validate core scraper with real data before optimizing

**Actions**:
1. Run `npm run optimized-scraper` manually to test end-to-end flow
2. Monitor for any runtime errors or edge cases
3. Verify book data quality and categorization
4. Collect baseline metrics (success rate, timing, API calls)

**Success Criteria**:
- At least 3 episodes processed successfully
- Books added to database correctly
- No security issues or crashes
- Adaptive delay logic works as expected

### Step 2: Enable Production Schedule (Week 2)
**Current**: Weekly (Monday 10 AM UTC)
**Proposed**: Keep weekly initially, then consider 6-hour after proven stability

**Decision Point**:
- If Step 1 shows 90%+ success rate → Enable 6-hour schedule
- If issues found → Fix first, stay weekly

**Config Change** (`render.yaml`):
```yaml
# Option A: Conservative (keep weekly)
schedule: "0 10 * * 1"  # Every Monday 10 AM UTC

# Option B: Aggressive (6-hour, after validation)
schedule: "0 */6 * * *"  # Every 6 hours
```

### Step 3: Performance Optimizations (Week 3-4)

#### 3A: Parallel Episode Processing
**File**: `scripts/optimized-scraper.ts:75-86`

**Current**:
```typescript
for (const episodeProcessing of allEpisodesToProcess) {
  const books = await this.processEpisode(episodeProcessing)
  // Sequential processing
}
```

**Proposed**:
```typescript
// Process up to 3 episodes concurrently
const CONCURRENCY_LIMIT = 3
const results = []

for (let i = 0; i < allEpisodesToProcess.length; i += CONCURRENCY_LIMIT) {
  const batch = allEpisodesToProcess.slice(i, i + CONCURRENCY_LIMIT)
  const batchResults = await Promise.all(
    batch.map(ep => this.processEpisode(ep))
  )
  results.push(...batchResults)
}
```

**Benefit**: 3x faster when multiple episodes ready (rare but useful for backfill)

#### 3B: Circuit Breaker Pattern
**New File**: `lib/circuit-breaker.ts`

**Purpose**: Stop retrying after repeated failures (e.g., Google Docs down)

```typescript
class CircuitBreaker {
  private failures = 0
  private lastFailure: number | null = null
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

  constructor(
    private threshold = 5,      // Open after 5 failures
    private timeout = 60000     // Reset after 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure! > this.timeout) {
        this.state = 'HALF_OPEN'
      } else {
        throw new Error('Circuit breaker is OPEN')
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess() {
    this.failures = 0
    this.state = 'CLOSED'
  }

  private onFailure() {
    this.failures++
    this.lastFailure = Date.now()
    if (this.failures >= this.threshold) {
      this.state = 'OPEN'
    }
  }
}
```

**Integration**: Wrap Google Doc fetches and OpenLibrary calls

### Step 4: Monitoring & Metrics (Week 4)

#### 4A: Add Metrics Tracking
**New File**: `lib/scraper-metrics.ts`

```typescript
interface ScraperMetrics {
  runId: string
  timestamp: string
  episodesChecked: number
  episodesProcessed: number
  episodesSkipped: number
  booksAdded: number
  successRate: number
  processingTimeMs: number
  errors: Array<{ episode: string; error: string }>
}

class MetricsCollector {
  private metrics: ScraperMetrics

  startRun() {
    this.metrics = {
      runId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      episodesChecked: 0,
      episodesProcessed: 0,
      episodesSkipped: 0,
      booksAdded: 0,
      successRate: 0,
      processingTimeMs: 0,
      errors: []
    }
  }

  async saveMetrics() {
    const metricsFile = path.join(
      process.cwd(),
      'data',
      'scraper-metrics.json'
    )

    let history = []
    try {
      history = JSON.parse(await fs.readFile(metricsFile, 'utf-8'))
    } catch {}

    history.unshift(this.metrics)
    history = history.slice(0, 100) // Keep last 100 runs

    await fs.writeFile(metricsFile, JSON.stringify(history, null, 2))
  }
}
```

#### 4B: Success Rate Dashboard
**New File**: `app/api/scraper-status/route.ts`

```typescript
export async function GET() {
  const metricsFile = path.join(process.cwd(), 'data', 'scraper-metrics.json')
  const metrics = JSON.parse(await fs.readFile(metricsFile, 'utf-8'))

  const last10Runs = metrics.slice(0, 10)
  const avgSuccessRate = last10Runs.reduce((sum, m) => sum + m.successRate, 0) / 10

  return Response.json({
    lastRun: metrics[0],
    last10Runs,
    avgSuccessRate,
    totalBooksAdded: metrics.reduce((sum, m) => sum + m.booksAdded, 0)
  })
}
```

**UI Component**: Simple admin page at `/scraper-status`

---

## Priority Ranking

### HIGH PRIORITY
1. **Production Testing** - Critical to validate before optimization
2. **Circuit Breaker** - Prevents wasted API calls when external service down
3. **Basic Metrics** - Need visibility into scraper health

### MEDIUM PRIORITY
4. **Parallel Processing** - Nice optimization but not critical (episodes rarely stack up)
5. **Success Rate Dashboard** - Useful for monitoring but not essential

### LOW PRIORITY
6. **Advanced Caching** - Current caching is sufficient
7. **6-Hour Schedule** - Weekly is fine if success rate is high

---

## Testing Strategy

### Manual Testing Checklist
- [ ] Run `npm run optimized-scraper` locally
- [ ] Verify RSS feed parsing works
- [ ] Confirm episode classification (Regular/Interview/Special)
- [ ] Test Google Doc extraction with recent episode
- [ ] Validate Amazon link parsing
- [ ] Check OpenLibrary metadata quality
- [ ] Verify books.json update with correct data
- [ ] Test duplicate prevention
- [ ] Confirm adaptive delay logic (requeue on failure)

### Edge Cases to Test
- [ ] Episode with no Google Doc (should requeue)
- [ ] Episode with Google Doc but no Amazon links (should handle gracefully)
- [ ] Interview episode (should skip entirely)
- [ ] Multiple episodes released same day
- [ ] Google Doc access denied (should retry)
- [ ] OpenLibrary API timeout (should handle)

### Production Validation
After first week on Render:
- [ ] Check Render logs for errors
- [ ] Verify new books appearing in UI
- [ ] Confirm no duplicate books added
- [ ] Monitor API rate limits
- [ ] Review episode-cache.json for accuracy

---

## Decision Matrix

| If Success Rate... | Then Action |
|-------------------|-------------|
| **90-100%** | Enable 6-hour schedule, add metrics |
| **70-89%** | Fix issues, stay weekly, add circuit breaker |
| **Below 70%** | Deep debugging required, halt optimizations |

---

## Effort Estimates

| Task | Effort | Complexity |
|------|--------|-----------|
| Production testing | 2-4 hours | Low |
| Circuit breaker | 4-6 hours | Medium |
| Parallel processing | 2-3 hours | Low |
| Metrics system | 6-8 hours | Medium |
| Dashboard UI | 4-6 hours | Low |
| **Total** | **18-27 hours** | **~3-4 days** |

---

## Recommended Timeline

### Week 1: Validation
- Day 1: Manual testing (`npm run optimized-scraper`)
- Day 2-3: Monitor first production runs, collect data
- Day 4-5: Fix any issues found, document edge cases

### Week 2: Core Enhancements
- Day 1-2: Implement circuit breaker
- Day 3-4: Add basic metrics tracking
- Day 5: Deploy and monitor

### Week 3: Optimization
- Day 1-2: Implement parallel processing
- Day 3-4: Build metrics dashboard
- Day 5: Final testing and documentation

### Week 4: Production Rollout
- Day 1: Enable 6-hour schedule (if metrics support it)
- Day 2-5: Monitor closely, tune as needed

---

## Open Questions

1. **Schedule Frequency**: Should we enable 6-hour schedule immediately or wait for validation?
   - **Recommendation**: Wait for 1 week of weekly runs first

2. **Metrics Storage**: Where should we store metrics long-term?
   - **Recommendation**: JSON file for now, consider database if >1000 runs

3. **Failure Notifications**: Should we add email/Slack alerts for scraper failures?
   - **Recommendation**: Not essential initially, add if success rate drops

4. **Episode Backfill**: Should we backfill episodes from before RSS implementation?
   - **Recommendation**: Not urgent, can be separate manual task

---

## Success Criteria for Completion

✅ **Phase 4 Complete When**:
- Circuit breaker implemented and tested
- Parallel processing working for 3+ episodes
- No performance regressions vs current implementation

✅ **Phase 5 Complete When**:
- Metrics tracked for every run
- Success rate dashboard accessible
- 90%+ success rate maintained over 10 runs

✅ **Project Complete When**:
- All pending phases complete
- 6-hour schedule running smoothly (optional)
- Documentation updated
- Zero critical bugs

---

## Next Immediate Action

Run this command to test the scraper:
```bash
npm run optimized-scraper
```

Review the output and check:
1. Did it find new episodes in RSS?
2. Did it process them correctly?
3. Were books added to `public/data/books.json`?
4. Any errors in the console?

Then proceed based on results.
