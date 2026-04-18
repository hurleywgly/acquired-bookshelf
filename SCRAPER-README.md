# Acquired Bookshelf Scraper

Bi-monthly automated scraper that discovers new Acquired podcast episodes, extracts Amazon book links from their Links sections, enriches metadata via Open Library, uploads covers to Cloudflare R2, commits to git, and notifies Discord.

## Features

- **Multi-source episode discovery**: Transistor RSS (primary) → acquired.fm sitemap → paginated listing (fallback chain).
- **Direct Links-section extraction**: Parses `<h2>Links</h2>` + following `<ul><li><a>` on each episode page. No Google Docs indirection.
- **Canary pre-flight**: Before every run, verifies that the Ferrari episode page still yields Amazon links. On selector drift, it halts and pages Discord — preventing silent empty runs.
- **Open Library metadata**: Batch enrichment with Amazon-scrape fallback for titles, authors, subjects, covers.
- **Cloudflare R2 cover storage**: Persistent hosting for book covers.
- **Discord notifications**: Books added, unknown-metadata warnings, errors, and "no new episodes" heartbeats.
- **Bi-monthly schedule**: `0 10 1,15 * *` UTC (1st and 15th of each month at 10 AM UTC).
- **SSH-key git push**: Autonomous commit/push of `public/data/books.json` triggers Vercel rebuild.

## File Structure

```
lib/
├── scraper.ts                 # Episode discovery (RSS + sitemap + listing)
├── episode-page-parser.ts     # Links-section extractor, title + season/episode hints
├── url-validator.ts           # SSRF-safe URL allowlist + fetch
├── openLibrary.ts             # Batch metadata via Open Library
├── r2-uploader.ts             # Cloudflare R2 cover uploader
├── discord-notifier.ts        # Discord webhook notifications
└── episode-classifier.ts      # Skips interviews, ACQ2, specials

scripts/
├── optimized-scraper.ts       # Primary cron entry point
├── backfill-episodes.ts       # Manual escape hatch for specific URLs
├── detect-gaps.ts             # Compares RSS to books.json (diagnostic)
├── fix-unknown-books.ts       # Amazon-scrape retry for Unknown-metadata rows
├── test-discord.ts            # Webhook smoke test
└── setup-ssh.sh               # SSH key setup used by the Render cron

render.yaml                    # Render.com cron + web service config
```

## Local Development

```bash
npm install

# Smoke test the Discord webhook
npm run test-discord

# Diagnose missing-episode coverage against the RSS feed
npm run detect-gaps

# Run the scraper (set GIT_PUSH=false to skip the git commit + push)
GIT_PUSH=false npm run optimized-scraper

# Manually backfill specific episodes by URL (edit the list inside the script)
npm run backfill-episodes
```

### Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `DISCORD_WEBHOOK_URL` | optional | Notifications. Omit to disable Discord. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | optional | Cover uploads to Cloudflare R2. Omit to fall back to Amazon image URLs. |
| `SSH_PRIVATE_KEY` | required on Render | Base64-encoded ed25519 key for `git push`. |
| `GIT_PUSH` | optional | Set to `false` to run the scraper in dry-run mode (skip git commit and push). |
| `NODE_ENV` | optional | Render sets this to `production`. |

## How It Works

1. **Canary** — fetch `https://www.acquired.fm/episodes/ferrari`, confirm ≥ 1 Amazon link under the Links section. On failure, notify Discord and exit non-zero.
2. **Discover episodes** — RSS feed yields `{ slug, title, pubDate, link }`; sitemap and paginated listing fill gaps for episodes not in RSS.
3. **Assign season + episode numbers** — `seasonNumber = pubDate year`, `episodeNumber = ordinal within year (chronological)`. Maintains consistency with historical `books.json` shape.
4. **Filter unprocessed** — skip episodes whose slug (or slugified name) is already present in `books.json`, skip anything the classifier flags as interview/ACQ2/special, skip episodes earlier than `latestSeason - 1`.
5. **For each unprocessed episode** — fetch the page once, extract title (`<h1>`), season/episode hint (if present in text), and every Amazon `/dp/` URL under the Links section.
6. **Enrich** — `getBatchBookMetadata()` hits Open Library with Amazon-scrape fallback. Cover URLs get uploaded to R2.
7. **Validate + dedupe** — filter ghost books (Unknown, very short titles, ASIN blocklist), dedupe by ASIN.
8. **Persist** — merge into `public/data/books.json`, sort by season desc + episode desc, write file.
9. **Notify + commit + push** — Discord notification, SSH-key git commit + push to `main`.

## Data Flow

```
RSS feed ─┐
Sitemap ──┼─► Episode list (slug, pubDate) ─► Each episode page
Listing ──┘                                        │
                                                   ▼
                                          <h2>Links</h2> → <ul><li><a> amazon/dp/...
                                                   │
                                                   ▼
                                       Open Library + Amazon scrape
                                                   │
                                                   ▼
                             R2 upload ─► books.json ─► git push ─► Vercel rebuild
                                                   │
                                                   ▼
                                         Discord notification
```

## Book Schema (`public/data/books.json`)

```ts
{
  id: string,                    // ASIN
  title: string,
  author: string,
  coverUrl: string,              // R2 URL or Amazon image fallback
  amazonUrl: string,
  category: 'Business' | 'Technology' | 'History',
  episodeRef: {
    name: string,
    seasonNumber: number,        // pubDate year
    episodeNumber: number,       // ordinal within year
    slug?: string                // set on newly-scraped entries
  },
  addedAt: string,               // ISO 8601
  source: 'automated' | 'backfill'
}
```

## Cron Schedule

`render.yaml` configures a Render cron:

```yaml
schedule: "0 10 1,15 * *"        # 1st and 15th of each month at 10 AM UTC
startCommand: npm run optimized-scraper
```

To change frequency, edit `render.yaml` and sync via `render deploy` or the Render dashboard.

## Troubleshooting

### Canary fails on start
The scraper halts if the Ferrari episode stops yielding Amazon URLs. Check:

1. Did `acquired.fm` change markup? Fetch the page, look for `<h2>Links</h2>` and following `<ul>`.
2. If the markup moved, update the selector logic in `lib/episode-page-parser.ts::extractAmazonLinksFromEpisodePage`.
3. If Ferrari was specifically changed, update `CANARY_EPISODE_URL` in `scripts/optimized-scraper.ts` to another stable episode.

### "No Amazon book links found" for episodes that should have them
Most common cause: the episode page loads links via JavaScript after initial HTML. Inspect the raw HTML (`curl` the episode URL) to confirm the links are server-rendered. If not, the scraper will need a headless-browser fallback.

### Open Library returns Unknown Title / Unknown Author
Expected for niche books. The scraper falls back to Amazon page scraping; if that also fails, the book is filtered out by `validateBook()` to prevent ghost entries. Run `npm run fix-unknown-books` to retry Amazon-scrape on existing unknowns.

### Discord notifications missing
Check `DISCORD_WEBHOOK_URL` is set in Render env vars. Run `npm run test-discord` locally to verify the webhook is live.

### Git push fails on Render
The cron needs `SSH_PRIVATE_KEY` (base64-encoded ed25519) in env. `scripts/setup-ssh.sh` installs it at runtime. If pushes fail, check the deploy key on GitHub has write access.

## Monitoring

- **Render dashboard** — cron run logs, exit codes, next run time.
- **Discord channel** — books-added embeds, errors, canary failures.
- **`public/data/books.json` git log** — history of automated commits (`chore: Add books from …`).

## Contributing

1. Reproduce the issue locally with `GIT_PUSH=false npm run optimized-scraper`.
2. Target the minimal helper (`lib/episode-page-parser.ts`, `lib/scraper.ts`) — the entry point in `scripts/optimized-scraper.ts` should stay thin.
3. Test against the canary (Ferrari) plus 1–2 other recent episodes.
4. Update this README if selectors, env vars, or the flow change.
