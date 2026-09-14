/**
 * Episode page parser — extracts titles, Amazon links, and season/episode hints
 * from the new acquired.fm episode page structure.
 *
 * Source layout (as of the Apr 2026 redesign):
 *   <h1>Episode title</h1>
 *   <h2>overview</h2> / <h2>Links</h2> / <h2>Carve Outs</h2>
 *   Links section: <h2>Links</h2> followed by <ul><li><a href="amazon.com/dp/..."></a></li></ul>
 */

import type { CheerioAPI } from 'cheerio'
import type { URLValidator } from './url-validator.js'

const AMAZON_HOST_RE = /amazon\./i
const ASIN_RE = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i
const STANDALONE_ASIN_RE = /\/([B][0-9A-Z]{9})(?:[/?#]|$)/i

function findLinksHeading($: CheerioAPI): ReturnType<CheerioAPI> | null {
  let found: ReturnType<CheerioAPI> | null = null
  $('h2, h3').each((_, el) => {
    const text = $(el).text().trim().toLowerCase()
    if (/^\s*links\s*$/i.test(text) || /^\s*episode\s+sources?\s*$/i.test(text)) {
      found = $(el)
      return false
    }
    return true
  })
  return found
}

function collectAmazonHrefs($: CheerioAPI, roots: ReturnType<CheerioAPI>[]): string[] {
  const hrefs = new Set<string>()
  for (const root of roots) {
    root.find('a[href]').each((_, el) => {
      const href = $(el).attr('href')
      if (!href) return
      if (!AMAZON_HOST_RE.test(href)) return
      if (!ASIN_RE.test(href) && !STANDALONE_ASIN_RE.test(href)) return
      hrefs.add(href)
    })
  }
  return [...hrefs]
}

/**
 * Extract Amazon book URLs from the episode page's Links section.
 * Includes the explicit Sources panel; absent source sections yield no links.
 */
export function extractAmazonLinksFromEpisodePage(
  $: CheerioAPI,
  urlValidator: URLValidator
): string[] {
  // Only explicit source content, never transcript, recommendations, or carve-outs.
  const roots: ReturnType<CheerioAPI>[] = []
  const heading = findLinksHeading($)
  if (heading) roots.push(heading.nextUntil('h2, h3'))
  $('.sources-rich-text').each((_, el) => { roots.push($(el)) })

  const hrefs = collectAmazonHrefs($, roots)
  const sanitized: string[] = []
  for (const href of hrefs) {
    const validation = urlValidator.validateUrl(href)
    if (validation.isValid && validation.sanitizedUrl) {
      sanitized.push(validation.sanitizedUrl)
    }
  }
  const byAsin = new Map<string, string>()
  for (const url of sanitized) {
    const asin = url.match(ASIN_RE)?.[1] || url.match(STANDALONE_ASIN_RE)?.[1]
    if (asin && !byAsin.has(asin.toUpperCase())) byAsin.set(asin.toUpperCase(), `https://www.amazon.com/dp/${asin.toUpperCase()}`)
  }
  return [...byAsin.values()]
}

export function extractEpisodeTitle($: CheerioAPI): string | null {
  const h1 = $('h1').first().text().replace(/\s+/g, ' ').trim()
  if (h1 && h1.length > 0) return h1

  const ogTitle = $('meta[property="og:title"]').attr('content')
  if (ogTitle) {
    return ogTitle.replace(/\s+\|.*$/, '').replace(/\s+-\s+Acquired.*$/, '').trim()
  }

  return null
}

/**
 * Attempt to read a season/episode hint from the episode page body.
 * Handles the canonical "Season YYYY, Episode N" and "Fall 2025, Episode 3" forms.
 * Returns null when no hint is present — callers may use explicit RSS season and episode tags.
 */
export function parseSeasonEpisodeHint(
  $: CheerioAPI
): { seasonNumber: number; episodeNumber: number; seasonName?: string } | null {
  // The season badge beside Episode/date is authoritative; avoid transcript mentions.
  const badge = $('a[href^="/season/"]').filter((_, el) => /Episode/i.test($(el).parent().text())).first()
  const body = (badge.length ? `${badge.text()} ${badge.siblings().text()}` : $('body').text()).replace(/\s+/g, ' ')

  const seasonalMatch = body.match(/(Fall|Spring|Summer|Winter)\s+(\d{4})[|,\s]+Episode\s+(\d+)/i)
  if (seasonalMatch) {
    return {
      seasonNumber: parseInt(seasonalMatch[2], 10),
      episodeNumber: parseInt(seasonalMatch[3], 10),
      seasonName: `${seasonalMatch[1][0].toUpperCase()}${seasonalMatch[1].slice(1).toLowerCase()} ${seasonalMatch[2]}`
    }
  }

  const seasonEpisodeMatch = body.match(/Season\s+(\d+)[|,\s]+Episode\s+(\d+)/i)
  if (seasonEpisodeMatch) {
    return {
      seasonNumber: parseInt(seasonEpisodeMatch[1], 10),
      episodeNumber: parseInt(seasonEpisodeMatch[2], 10)
    }
  }

  return null
}
