# Catalog repair

The UI release inherited catalog commit 8e37ec5 instead of reconciling it with the 192-record approved preview. That scraper treated sitemap lastmod as a release date and assigned historical episodes 2026 ordinals. Its batch deduplication and broad metadata search also admitted duplicate/wrong books.

Restored the 192-record catalog from the approved local snapshot; retained five verified Walt Disney Company books; quarantined the 16 other later additions. Ran the corrected scraper through Home Depot: four Home Depot books and three additional Disney Renaissance books. Final catalog: 204 records with 204 unique IDs. Already-cataloged editions are not duplicated by the new run. Historical legitimate repeated works across different episodes remain as in the approved snapshot.

Official episode sources:
- https://www.acquired.fm/episodes/home-depot — Fall 2026 E2
- https://www.acquired.fm/episodes/disney-the-renaissance-and-the-empire — Fall 2026 E1
- https://www.acquired.fm/episodes/the-walt-disney-company — Spring 2026 E4
- https://www.acquired.fm/episodes/vanguard — Spring 2026 E3
- https://www.acquired.fm/episodes/ferrari — Spring 2026 E2
- https://www.acquired.fm/episodes/formula-1 — Spring 2026 E1
- https://www.acquired.fm/episodes/rolex — Spring 2025 E2 (rereleased in 2026)
- https://www.acquired.fm/episodes/costco — Season 13 E2 (rereleased in 2026)

The main-show RSS is the discovery authority; on-page season labels take precedence over numerical RSS tags. Sitemap timestamps are not publication identity. Episode grouping uses canonical slugs when present; known legacy aliases now share those slugs. Source links are restricted to Links and Sources, canonicalized by ASIN. Exact bibliographic lookup replaces unrelated general-search results. Reviewed metadata corrections include cited sources in lib/book-metadata-overrides.ts. Missing metadata now aborts before writing. New duplicate IDs/editions are rejected within the batch and against existing records.

Validation: 12 Jest tests pass; production build passes. Corrected scraper added seven unique books; subsequent scan covering all 2026 feed entries found no unprocessed episodes. Local desktop and mobile search, empty state, reset, icons, and label spacing checked. Label bottom margin is 4px and wrapped labels align to the cover.

Scraper was invoked locally with GIT_PUSH=false and SCRAPER_NOTIFY=false. This runs the same entry point as the Render cron, without sending Discord messages. Render's configured autoDeploy is false; hosted cron revision must be verified separately from frontend deployment.
