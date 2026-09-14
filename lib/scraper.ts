import * as fs from 'fs/promises'
import * as path from 'path'
import { XMLParser } from 'fast-xml-parser'

interface Episode {
  id: string; slug: string; name: string; sourceUrl: string
  pubDate?: string; year?: number; seasonNumber?: number; episodeNumber?: number; seasonName?: string
  discoveredVia: 'rss' | 'sitemap' | 'listing'; fetchedAt: string
}
const RSS_URL = 'https://feeds.transistor.fm/acquired'
function slugify(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/['\u2018\u2019]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// Publication identity comes from the main-show feed, never a sitemap's lastmod.
export function parseEpisodeFeed(xml: string, fetchedAt: string): Episode[] {
  const parsed = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: true }).parse(xml)
  const raw = parsed?.rss?.channel?.item
  const items = Array.isArray(raw) ? raw : raw ? [raw] : []
  const result: Episode[] = []; const seen = new Set<string>()
  for (const item of items) {
    let url: URL
    try { url = new URL(item.link) } catch { continue }
    if (!['acquired.fm', 'www.acquired.fm'].includes(url.hostname)) continue
    const slug = url.pathname.match(/^\/episodes\/([^/]+)\/?$/)?.[1]
    if (!slug || seen.has(slug) || item['itunes:episodeType'] === 'trailer' || item['itunes:episodeType'] === 'bonus') continue
    const timestamp = Date.parse(item.pubDate)
    if (!Number.isFinite(timestamp)) continue
    seen.add(slug)
    const season = Number(item['itunes:season']); const episode = Number(item['itunes:episode'])
    result.push({ id: slug, slug, name: String(item.title || slug), sourceUrl: `https://www.acquired.fm/episodes/${slug}`,
      pubDate: item.pubDate, year: new Date(timestamp).getUTCFullYear(),
      seasonNumber: season > 0 ? season : undefined, episodeNumber: episode > 0 ? episode : undefined,
      discoveredVia: 'rss', fetchedAt })
  }
  return result.sort((a,b) => Date.parse(b.pubDate!) - Date.parse(a.pubDate!))
}
async function getAllEpisodes(forceRefresh = false): Promise<Episode[]> {
  const cacheFile = path.join(process.cwd(), 'data', 'episode-cache.json')
  if (!forceRefresh) {
    try {
      const cached = JSON.parse(await fs.readFile(cacheFile, 'utf8'))
      if (cached.version === 2 && Date.now() - Date.parse(cached.fetchedAt) < 6 * 60 * 60 * 1000) return cached.episodes
    } catch { /* Fetch a new canonical snapshot. */ }
  }
  const response = await fetch(RSS_URL, { signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`Canonical RSS unavailable: HTTP ${response.status}; no sitemap fallback`)
  const fetchedAt = new Date().toISOString()
  const episodes = parseEpisodeFeed(await response.text(), fetchedAt)
  if (episodes.length < 5) throw new Error('Canonical RSS incomplete; refusing to infer episode identities')
  await fs.mkdir(path.dirname(cacheFile), { recursive: true })
  await fs.writeFile(cacheFile, JSON.stringify({ version: 2, fetchedAt, episodes }, null, 2))
  return episodes
}
export { getAllEpisodes, slugify, type Episode }
