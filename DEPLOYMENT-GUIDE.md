# Acquired Bookshelf — Deployment Guide

Production deployment runs on two services:

- **Vercel**: Next.js frontend (auto-deploys on push to `main`).
- **Render**: bi-monthly cron that runs `scripts/optimized-scraper.ts` and commits new books back to the repo.

## render.yaml

```yaml
services:
  - type: web
    name: acquired-bookshelf
    runtime: node
    buildCommand: npm ci && npm run build
    startCommand: npm start

  - type: cron
    name: optimized-scraper-bimonthly
    runtime: node
    schedule: "0 10 1,15 * *"      # 1st and 15th of each month at 10 AM UTC
    buildCommand: npm ci
    startCommand: npm run optimized-scraper
```

## Required Environment Variables (Render cron)

| Variable | Required | Purpose |
|---|---|---|
| `SSH_PRIVATE_KEY` | yes | Base64-encoded ed25519 private key with write access to the repo. `scripts/setup-ssh.sh` installs it at run time. |
| `DISCORD_WEBHOOK_URL` | strongly recommended | Books-added, canary, and error notifications. Without this, silent failures are possible. |
| `R2_ACCOUNT_ID` | recommended | Cloudflare R2 credentials for cover hosting. |
| `R2_ACCESS_KEY_ID` | recommended | |
| `R2_SECRET_ACCESS_KEY` | recommended | |
| `R2_BUCKET_NAME` | recommended | e.g. `acquired-bookshelf-covers`. |
| `R2_PUBLIC_URL` | recommended | e.g. `https://pub-…r2.dev`. |
| `NODE_ENV` | optional | Render defaults to `production`. |
| `GIT_PUSH` | optional | Set to `false` for a dry-run that skips commit and push. Useful when manually triggering the cron to debug. |

Vercel needs no scraper-specific env vars.

## Autonomy Guarantees

The scraper is designed to run headless on Render twice a month. Three mechanisms protect against silent failures:

1. **Canary pre-flight** — before each run, `scripts/optimized-scraper.ts::runCanary()` confirms the Ferrari episode page still yields at least one Amazon link under `<h2>Links</h2>`. On drift, the scraper posts a Discord error and exits non-zero so Render surfaces a failed run.
2. **Discord heartbeat on empty runs** — `notifyNoNewBooks()` fires even when there are zero new books, so absence of signal is itself a signal.
3. **Exit codes** — Render treats non-zero exits as failed runs. Combined with Render's built-in cron failure emails, this catches most breakage without extra monitoring.

## First-Time Setup

```bash
# 1. Deploy the web service and cron from render.yaml via the Render dashboard.
# 2. Set env vars listed above in the cron service's Environment tab.
# 3. Generate an ed25519 deploy key with write access and base64-encode it:
ssh-keygen -t ed25519 -f ./render-deploy -N ""
base64 < ./render-deploy | pbcopy            # paste into SSH_PRIVATE_KEY
cat ./render-deploy.pub                       # add as a deploy key on the GitHub repo
# 4. Trigger a manual run from the Render dashboard to verify:
#    - canary passes
#    - R2 uploads succeed
#    - git push lands on main
#    - Discord notification arrives
```

## Local Testing

```bash
# Smoke-test the Discord webhook
npm run test-discord

# Compare books.json coverage against the RSS feed (read-only)
npm run detect-gaps

# Full scraper run without committing or pushing
GIT_PUSH=false npm run optimized-scraper

# After verifying local diff looks good, commit and push via git
git add public/data/books.json
git commit -m "chore: Add books from …"
git push origin main
```

## Frontend Deployment (Vercel)

- Auto-deploys every push to `main`.
- Requires Next.js ≥ 15.5.14 (CVE-2025-66478 fix is enforced by Vercel builds).
- ISR revalidation on `app/page.tsx` is set to 86400 seconds (24 hours) so scraper-committed books appear within a day.
- No backend — everything serves from `public/data/books.json` at build time.

## Monitoring

| Signal | Source | Action |
|---|---|---|
| Cron run failed (non-zero exit) | Render dashboard + Render failure email | Check Discord for the error context; read Render logs. |
| Canary halted | Discord (error embed with "Canary failed" title) | Update `lib/episode-page-parser.ts` selectors; the markup probably changed. |
| Books added | Discord (green embed) | No action — verify the Vercel rebuild lands within 24h. |
| Unknown metadata | Discord (orange embed) | Run `npm run fix-unknown-books` locally to retry Amazon scraping, or add manual entries. |
| No new books for >4 weeks | silence in Discord | Run `npm run detect-gaps` to see if RSS has episodes we missed. |

## Rollback

The scraper writes only `public/data/books.json`. To revert:

```bash
git revert <scraper-commit-sha>   # undoes the scraper's automated commit
git push origin main              # Vercel rebuilds with the previous dataset
```

Render cron can be paused from its dashboard while debugging.

## Common Issues

### Canary fails on every run

The Ferrari episode page no longer has `<h2>Links</h2>` — either the heading renamed, or the list moved out of that container. Fetch the page with `curl` and update `findLinksHeading()` or `extractAmazonLinksFromEpisodePage()` in `lib/episode-page-parser.ts`. If Ferrari itself is gone, change `CANARY_EPISODE_URL` in `scripts/optimized-scraper.ts` to another stable episode.

### Cron runs but commits nothing

Most common causes:

1. All new episodes are interviews/specials (filtered by `EpisodeClassifier`). Verify via Discord's "no new books" heartbeat.
2. SSH key is missing or wrong permission. Check Render cron logs for `git push` errors; confirm the deploy key has write scope on GitHub.
3. `GIT_PUSH=false` accidentally set in Render env. Remove it.

### Vercel builds fail after a scraper commit

Usually a Next.js CVE update blocking build (as happened at CVE-2025-66478). Bump `next` in `package.json`, run `npm install`, commit and push.

## Key Paths

```
scripts/optimized-scraper.ts      # Cron entry point
lib/scraper.ts                    # RSS + sitemap + listing discovery
lib/episode-page-parser.ts        # Links-section extraction
render.yaml                       # Cron + web service config
public/data/books.json            # Output database (committed)
data/episode-cache.json           # 6-hour episode cache (gitignored)
```
