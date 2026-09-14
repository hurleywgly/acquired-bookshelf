Requested: Claude Fable 5.1 medium, standard. Main review modelUsage: claude-fable-5-1; auxiliary usage: claude-haiku-4-5-20251001. Read-only.

**Root cause of the false 2026 episodes (confirmed in source and git, live sitemap not fetched because network calls were denied):**

1. **Sitemap `lastmod` treated as publish date.** `lib/scraper.ts:209-210` sets `pubDate = entry.lastmod` and `year` from it. `assignSeasonAndEpisodeNumbers` (`lib/scraper.ts:292-311`) then sets `seasonNumber = year` and `episodeNumber` = ordinal within that year. The Apr 18 cache snapshot shows sitemap entries with no `pubDate` (58 of 212 entries have one, all from RSS), so at that time the filter at `scripts/optimized-scraper.ts:101` dropped them. By the Sep 1 run the redesigned site evidently emitted 2026 `lastmod` on old pages, so every legacy episode became "2026" and got ordinals like 125, 122, 113, 77. That is exactly the E125/E122/E113 the user sees. Git confirms: `8e37ec5` added 16 rows, 7 of them with `seasonNumber: 2026` for The Browser, Super Pumped, Amazon Unbound, Mauboussin.
2. **Page hint fallback is weak.** `parseSeasonEpisodeHint` (`lib/episode-page-parser.ts:110-131`) regexes the whole body. Old pages with "Season 9, Episode 5" text got correct numbers (Standard Oil Part II); pages without that text fell through to the bogus sitemap-derived values. `optimized-scraper.ts:249-253` prefers hint, then `episode.seasonNumber`, then `episode.lastmod`, which doesn't exist on the `Episode` type.
3. **Season gate is too permissive.** `minSeason = latestSeason - 1` (`optimized-scraper.ts:94-98`) lets anything labeled 2025 or 2026 through, so mis-dated legacy episodes are never rejected.

**Duplicate records:**

- `B0176M1A44` appears twice in `books.json`, both added in `8e37ec5` (Zillow + Trulia and Taylor Barada). `updateBooksDatabase` (`optimized-scraper.ts:450-451`) dedups only against existing ids, not within the new batch.
- Trader Joe's is re-processed every run (commits 80522dc, 937977b, 8e37ec5 all list it). Cause: `scripts/optimized-scraper.ts:45-51` slugify keeps the apostrophe as a separator (`trader-joe-s`) while `lib/scraper.ts:26-33` strips it (`trader-joes`), so the name-based fallback in `buildProcessedSlugSet` never matches for rows lacking `slug`. Id dedup masks it today, but any new link would add rows.
- `app/lib/groupBooks.ts:24` keys episodes by `season-episode` only. Distinct episodes sharing a pair (e.g., gap-filled rows without slugs) silently merge under the first name.
- `automated-<Date.now()>` ids (`optimized-scraper.ts:320`) are unstable; one exists (Standard Oil Part II) and will duplicate on any re-scrape.

**Row counts:** 80522dc 192, 937977b 197, current 213. The "192 vs 213" gap is the Jul and Sep scraper commits, not the UI refresh.

**Not present at all:** Home Depot, Disney: The Renaissance, Costco. Rolex is stored as 2025 E3 while the cached RSS says Jan 2 2026. RSS `pubDate` is also unreliable for re-published items, so date derivation needs a trusted source per slug.

**Guardrails and tests:**

- Never derive year from sitemap `lastmod`; only RSS `pubDate` or an on-page date. Sitemap-only episodes get `seasonNumber: undefined` and are skipped or queued for manual review.
- Reject any candidate whose `episodeNumber` exceeds a sane per-year cap (e.g., 40) or whose slug is missing from the RSS feed for that year.
- Unify slugify into one exported function; add a test asserting `slugify("Trader Joe’s") === "trader-joes"` across both modules.
- Dedup within the new batch by id and amazonUrl; add a test feeding two episodes sharing an ASIN.
- Key `groupBooksByEpisode` by `slug ?? name`, not season/episode; test two episodes with equal numbers stay separate.
- Data-level test over `public/data/books.json`: no duplicate ids, no `automated-` ids, no `seasonNumber >= currentYear` with `episodeNumber > 40`, every row has `slug`.

**Most important finding:** the 2026 mislabels come from `lib/scraper.ts:209` using sitemap `lastmod` as the publish date, which the Sep 1 run inherited when the site started emitting 2026 lastmods on legacy pages.

Codex correction: Costco is present in the restored baseline; the current RSS lists Rolex and Costco as rereleases. Official pages preserve their original season IDs.
