import * as cheerio from 'cheerio'
import * as fs from 'fs/promises'
import * as path from 'path'
import { XMLParser } from 'fast-xml-parser'

interface Episode {
  id: string
  slug: string
  name: string
  sourceUrl: string
  pubDate?: string
  year?: number
  seasonNumber?: number
  episodeNumber?: number
  discoveredVia: 'rss' | 'sitemap' | 'listing'
  fetchedAt: string
}

const ACQUIRED_BASE = 'https://www.acquired.fm'
const RSS_URL = 'https://feeds.transistor.fm/acquired'
const SITEMAP_URL = `${ACQUIRED_BASE}/sitemap.xml`
const LISTING_URL = `${ACQUIRED_BASE}/episodes`
const LISTING_PAGE_PARAM = 'b8478ff5_page'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u2018\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function slugToName(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function extractSlugFromUrl(url: string | undefined): string | null {
  if (!url) return null
  const match = url.match(/\/episodes\/([^/?#]+)/)
  return match ? match[1] : null
}

async function getAllEpisodes(forceRefresh: boolean = false): Promise<Episode[]> {
  const cacheDir = path.join(process.cwd(), 'data')
  const cacheFile = path.join(cacheDir, 'episode-cache.json')

  if (!forceRefresh) {
    try {
      const cacheData = await fs.readFile(cacheFile, 'utf-8')
      const cached = JSON.parse(cacheData) as Episode[]
      if (Array.isArray(cached) && cached.length > 0) {
        const cacheAge = Date.now() - new Date(cached[0]?.fetchedAt || 0).getTime()
        if (cacheAge < CACHE_TTL_MS) {
          console.log(`Loaded ${cached.length} episodes from cache (${Math.round(cacheAge / 60000)} min old)`)
          return cached
        }
        console.log('Cache is stale (>6 hours), refreshing...')
      }
    } catch {
      console.log('No cache found, fetching episodes...')
    }
  } else {
    console.log('Force refresh requested, fetching all episodes...')
  }

  const fetchedAt = new Date().toISOString()

  let episodes = await getEpisodesFromRSS(fetchedAt)

  if (episodes.length < 5) {
    console.log(`RSS yielded only ${episodes.length} episodes, trying sitemap`)
    const sitemapEps = await getEpisodesFromSitemap(fetchedAt)
    episodes = mergeEpisodes(episodes, sitemapEps)
  } else {
    const sitemapEps = await getEpisodesFromSitemap(fetchedAt)
    episodes = mergeEpisodes(episodes, sitemapEps)
  }

  if (episodes.length < 5) {
    console.log(`Still only ${episodes.length} episodes, falling back to listing pages`)
    const listingEps = await getEpisodesFromListing(fetchedAt)
    episodes = mergeEpisodes(episodes, listingEps)
  }

  episodes.sort((a, b) => {
    const at = a.pubDate ? Date.parse(a.pubDate) : 0
    const bt = b.pubDate ? Date.parse(b.pubDate) : 0
    return bt - at
  })

  assignSeasonAndEpisodeNumbers(episodes)

  console.log(`Total episodes discovered: ${episodes.length}`)

  try {
    await fs.mkdir(cacheDir, { recursive: true })
    await fs.writeFile(cacheFile, JSON.stringify(episodes, null, 2))
    console.log('Saved episodes to cache')
  } catch (error) {
    console.error('Error saving episode cache:', error)
  }

  return episodes
}

/**
 * Merge episode lists by slug — later lists only fill in missing slugs,
 * so RSS (richest data) takes priority over sitemap/listing fallbacks.
 */
function mergeEpisodes(primary: Episode[], secondary: Episode[]): Episode[] {
  const bySlug = new Map<string, Episode>()
  for (const ep of primary) bySlug.set(ep.slug, ep)
  for (const ep of secondary) {
    if (!bySlug.has(ep.slug)) bySlug.set(ep.slug, ep)
  }
  return [...bySlug.values()]
}

async function getEpisodesFromRSS(fetchedAt: string): Promise<Episode[]> {
  try {
    console.log(`Fetching RSS feed: ${RSS_URL}`)
    const response = await fetch(RSS_URL)
    if (!response.ok) {
      console.log(`RSS fetch failed: ${response.status}`)
      return []
    }
    const xml = await response.text()
    const parser = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: false,
      trimValues: true
    })
    const parsed = parser.parse(xml)

    const rawItems = parsed?.rss?.channel?.item
    const items: any[] = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : []

    const episodes: Episode[] = []
    const seen = new Set<string>()

    for (const item of items) {
      const link: string | undefined = item.link
      const slug = extractSlugFromUrl(link)
      if (!slug || seen.has(slug)) continue
      seen.add(slug)

      const title: string = (item.title || slugToName(slug)).toString().trim()
      const pubDate: string | undefined = item.pubDate
      const year = pubDate ? new Date(pubDate).getUTCFullYear() : undefined

      episodes.push({
        id: slug,
        slug,
        name: title,
        sourceUrl: `${ACQUIRED_BASE}/episodes/${slug}`,
        pubDate,
        year,
        discoveredVia: 'rss',
        fetchedAt
      })
    }

    console.log(`RSS yielded ${episodes.length} episodes`)
    return episodes
  } catch (error) {
    console.error('RSS fetch error:', error)
    return []
  }
}

async function getEpisodesFromSitemap(fetchedAt: string): Promise<Episode[]> {
  try {
    console.log(`Fetching sitemap: ${SITEMAP_URL}`)
    const response = await fetch(SITEMAP_URL)
    if (!response.ok) {
      console.log(`Sitemap fetch failed: ${response.status}`)
      return []
    }

    const xml = await response.text()
    const parser = new XMLParser({ ignoreAttributes: false })
    const parsed = parser.parse(xml)

    const rawUrls = parsed?.urlset?.url
    const urls: Array<{ loc: string; lastmod?: string }> = Array.isArray(rawUrls)
      ? rawUrls
      : rawUrls
      ? [rawUrls]
      : []

    const episodes: Episode[] = []
    const seen = new Set<string>()

    for (const entry of urls) {
      const loc: string = entry.loc
      if (!loc || !loc.includes('/episodes/')) continue

      const slug = extractSlugFromUrl(loc)
      if (!slug || seen.has(slug)) continue
      seen.add(slug)

      const pubDate: string | undefined = entry.lastmod
      const year = pubDate ? new Date(pubDate).getUTCFullYear() : undefined

      episodes.push({
        id: slug,
        slug,
        name: slugToName(slug),
        sourceUrl: loc.split('?')[0].split('#')[0],
        pubDate,
        year,
        discoveredVia: 'sitemap',
        fetchedAt
      })
    }

    console.log(`Sitemap yielded ${episodes.length} episode URLs`)
    return episodes
  } catch (error) {
    console.error('Sitemap fetch error:', error)
    return []
  }
}

async function getEpisodesFromListing(fetchedAt: string): Promise<Episode[]> {
  const episodes: Episode[] = []
  const seen = new Set<string>()

  for (let page = 1; page <= 30; page++) {
    const url = `${LISTING_URL}?${LISTING_PAGE_PARAM}=${page}`
    console.log(`Fetching listing page ${page}: ${url}`)
    try {
      const response = await fetch(url)
      if (!response.ok) {
        console.log(`Listing page ${page} failed: ${response.status}`)
        break
      }
      const html = await response.text()
      const $ = cheerio.load(html)
      let pageCount = 0

      $('a[href^="/episodes/"]').each((_, el) => {
        const href = $(el).attr('href') || ''
        const slug = extractSlugFromUrl(`${ACQUIRED_BASE}${href}`)
        if (!slug || seen.has(slug)) return
        seen.add(slug)
        pageCount += 1

        const anchorText = $(el).text().replace(/\s+/g, ' ').trim()
        const title = anchorText && anchorText.length > 1 ? anchorText : slugToName(slug)

        episodes.push({
          id: slug,
          slug,
          name: title,
          sourceUrl: `${ACQUIRED_BASE}/episodes/${slug}`,
          discoveredVia: 'listing',
          fetchedAt
        })
      })

      console.log(`  Page ${page} added ${pageCount} new episodes`)
      if (pageCount === 0) {
        console.log('  Stopping pagination — no new episodes on this page')
        break
      }
      if (page < 30) {
        await new Promise(resolve => setTimeout(resolve, 750))
      }
    } catch (error) {
      console.error(`Error fetching listing page ${page}:`, error)
      break
    }
  }

  return episodes
}

/**
 * For each episode with a known pubDate year, assign seasonNumber = year
 * and episodeNumber = ordinal position within that year (chronological).
 * Episodes without a pubDate are left with undefined numbers — callers should
 * fall back to current year and 0 when needed.
 */
function assignSeasonAndEpisodeNumbers(episodes: Episode[]): void {
  const byYear = new Map<number, Episode[]>()
  for (const ep of episodes) {
    if (ep.year === undefined) continue
    if (!byYear.has(ep.year)) byYear.set(ep.year, [])
    byYear.get(ep.year)!.push(ep)
  }

  for (const yearEps of byYear.values()) {
    yearEps.sort((a, b) => {
      const at = a.pubDate ? Date.parse(a.pubDate) : 0
      const bt = b.pubDate ? Date.parse(b.pubDate) : 0
      return at - bt
    })
    yearEps.forEach((ep, idx) => {
      ep.seasonNumber = ep.year
      ep.episodeNumber = idx + 1
    })
  }
}

export { getAllEpisodes, slugify, type Episode }
