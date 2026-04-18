# Scraper — Future Enhancements

The scraper is autonomous as of the Apr 2026 redesign rewrite. The items below are *optional* improvements — none are blockers for production.

## Status

- [x] RSS-based episode discovery with sitemap + listing fallback (`lib/scraper.ts`)
- [x] Direct Links-section extraction (`lib/episode-page-parser.ts`) — Google Docs step removed
- [x] Canary pre-flight (`scripts/optimized-scraper.ts::runCanary`) prevents silent-empty-runs
- [x] Discord notifications for books added, unknown metadata, errors, and heartbeats
- [x] SSH-key git push + Vercel auto-deploy
- [x] Cloudflare R2 cover uploads with Amazon fallback
- [x] Bi-monthly Render cron (`0 10 1,15 * *` UTC)
- [x] ~~Circuit breaker for Google Docs failures~~ — superseded by the Links-section rewrite; there is now only one HTTP fetch per episode.

## Optional Enhancements

### Metadata quality (highest value)
Open Library misses many niche books — typical recent episodes yield ~2 books out of ~15 Amazon links because the rest fall back to "Unknown Title" and get filtered. Possible improvements:

1. Extend `lib/openLibrary.ts` fallbacks: ISBN lookup, author+title cross-search, Google Books API as a secondary source.
2. Improve Amazon scraping in `getBatchBookMetadata` — the current fallback frequently returns Unknown for ebook/kindle URLs.
3. Add a lightweight LLM pass to read the episode page's prose context next to each `<a>` and derive {title, author} when Amazon scraping fails.

### Parallel episode processing
`scripts/optimized-scraper.ts` processes episodes sequentially. With the Google Docs step gone, the per-episode wall time is already low (one fetch + metadata batch). Parallelizing is only worthwhile during backfill of many episodes at once.

### Observability
A single JSON log of each run (episode count, books added, canary status, duration) written to `data/scraper-metrics.json` would make trends visible. Could also post a weekly summary to Discord.

### Schedule tuning
Current bi-monthly (1st & 15th) matches Acquired's release cadence. If they move to a weekly schedule, flip to `0 10 * * 1` (Mondays) in `render.yaml`.

### Fix-unknowns automation
`scripts/fix-unknown-books.ts` is manual. Run it as a post-scrape step when `notifyUnknownMetadata()` fires, then commit a follow-up if any titles resolve.
