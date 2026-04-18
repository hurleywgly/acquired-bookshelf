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
 * Falls back to the entire page if the Links heading can't be located,
 * so episodes with unusual markup still yield sources.
 */
export function extractAmazonLinksFromEpisodePage(
  $: CheerioAPI,
  urlValidator: URLValidator
): string[] {
  const roots: ReturnType<CheerioAPI>[] = []

  const linksHeading = findLinksHeading($)
  if (linksHeading) {
    const nextSibling = linksHeading.nextAll('ul, ol').first()
    if (nextSibling.length > 0) roots.push(nextSibling)

    const parentContainer = linksHeading.parent()
    if (parentContainer.length > 0) {
      const siblingLists = parentContainer.find('ul, ol')
      if (siblingLists.length > 0) roots.push(siblingLists)
    }

    let container = linksHeading.parent()
    for (let i = 0; i < 4 && container.length > 0; i++) {
      const lists = container.find('ul, ol')
      if (lists.length > 0) {
        roots.push(lists)
        break
      }
      container = container.parent()
    }
  }

  if (roots.length === 0) {
    roots.push($('body'))
  }

  const hrefs = collectAmazonHrefs($, roots)
  const sanitized: string[] = []
  for (const href of hrefs) {
    const validation = urlValidator.validateUrl(href)
    if (validation.isValid && validation.sanitizedUrl) {
      sanitized.push(validation.sanitizedUrl)
    }
  }
  return [...new Set(sanitized)]
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
 * Returns null when no hint is present — callers should fall back to sitemap-derived values.
 */
export function parseSeasonEpisodeHint(
  $: CheerioAPI
): { seasonNumber: number; episodeNumber: number } | null {
  const body = $('body').text().replace(/\s+/g, ' ')

  const seasonalMatch = body.match(/(?:Fall|Spring|Summer|Winter)\s+(\d{4})[,\s]+Episode\s+(\d+)/i)
  if (seasonalMatch) {
    return {
      seasonNumber: parseInt(seasonalMatch[1], 10),
      episodeNumber: parseInt(seasonalMatch[2], 10)
    }
  }

  const seasonEpisodeMatch = body.match(/Season\s+(\d+)[,\s]+Episode\s+(\d+)/i)
  if (seasonEpisodeMatch) {
    return {
      seasonNumber: parseInt(seasonEpisodeMatch[1], 10),
      episodeNumber: parseInt(seasonEpisodeMatch[2], 10)
    }
  }

  return null
}
