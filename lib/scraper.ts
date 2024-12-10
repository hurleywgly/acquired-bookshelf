import * as cheerio from 'cheerio'
import * as fs from 'fs/promises'
import * as path from 'path'

interface Episode {
  id: string
  name: string
  seasonNumber: number
  episodeNumber: number
  sourceUrl?: string
  date?: string
  isACQ2?: boolean
  page: number
  fetchedAt?: string
}

async function getAllEpisodes(): Promise<Episode[]> {
  const cacheDir = path.join(process.cwd(), 'data')
  const cacheFile = path.join(cacheDir, 'episode-cache.json')
  
  // Try to load from cache first
  try {
    const cacheData = await fs.readFile(cacheFile, 'utf-8')
    const cached = JSON.parse(cacheData)
    if (Array.isArray(cached) && cached.length > 0) {
      console.log(`Loaded ${cached.length} episodes from cache`)
      return cached
    }
    throw new Error('Invalid or empty cache')
  } catch (error) {
    console.log('No cache found or invalid cache, fetching all episodes...')
  }

  const allEpisodes: Episode[] = []
  const fetchedAt = new Date().toISOString()
  
  // Fetch all 20 pages
  for (let page = 1; page <= 20; page++) {
    console.log(`\nFetching page ${page} of 20...`)
    const url = `https://www.acquired.fm/episodes?85af0199_page=${page}`
    const episodes = await getEpisodesFromPage(url, page, fetchedAt)
    allEpisodes.push(...episodes)
    console.log(`Found ${episodes.length} episodes on page ${page}`)
    
    // Add a small delay between requests
    if (page < 20) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  // Sort episodes by season and episode number
  allEpisodes.sort((a, b) => {
    if (a.seasonNumber === b.seasonNumber) {
      return b.episodeNumber - a.episodeNumber
    }
    return b.seasonNumber - a.seasonNumber
  })

  console.log(`Total episodes fetched: ${allEpisodes.length}`)

  // Ensure data directory exists and save cache
  try {
    await fs.mkdir(cacheDir, { recursive: true })
    await fs.writeFile(
      cacheFile, 
      JSON.stringify(allEpisodes, null, 2)
    )
    console.log('Saved episodes to cache')
  } catch (error) {
    console.error('Error saving episode cache:', error)
  }

  return allEpisodes
}

async function getEpisodesFromPage(url: string, pageNum: number, fetchedAt: string): Promise<Episode[]> {
  try {
    console.log('Fetching:', url)
    const response = await fetch(url)
    
    if (!response.ok) {
      console.log(`Failed to fetch ${url} - Status: ${response.status}`)
      return []
    }
    
    const html = await response.text()
    const $ = cheerio.load(html)
    const episodes: Episode[] = []

    // Find each episode container
    $('div[role="listitem"]').each((_, element) => {
      // Get the blog title
      const title = $(element).find('.blog-title').text().trim()
      
      // Get preview text which contains season/episode info
      const previewText = $(element).find('.preview-text').text().trim()
      
      // Check if this is an ACQ2 episode
      const isACQ2 = $(element).find('.category-tag---top-10:not(.w-condition-invisible)').text().includes('ACQ2')
      
      if (isACQ2) return

      // Parse season/episode from preview text
      const seasonEpMatch = previewText.match(/Fall (\d{4}), Episode (\d+)|Season (\d+), Episode (\d+)/)
      
      if (title && seasonEpMatch) {
        const seasonNumber = parseInt(seasonEpMatch[1] || seasonEpMatch[3])
        const episodeNumber = parseInt(seasonEpMatch[2] || seasonEpMatch[4])
        
        const episode: Episode = {
          id: `${seasonNumber}-${episodeNumber}`,
          name: title,
          seasonNumber,
          episodeNumber,
          date: $(element).find('.thumbnail-date').text(),
          page: pageNum,
          fetchedAt
        }

        // Find source document link
        const href = $(element).find('a').first().attr('href')
        if (href) {
          episode.sourceUrl = `https://www.acquired.fm${href}`
        }

        episodes.push(episode)
      }
    })
    
    return episodes
  } catch (error) {
    console.error('Error fetching page:', url, error)
    return []
  }
}

async function getSourceDocument(url: string): Promise<string[]> {
  try {
    const response = await fetch(url)
    
    if (!response.ok) {
      console.log(`Failed to fetch ${url} - Status: ${response.status}`)
      return []
    }
    
    const html = await response.text()
    const $ = cheerio.load(html)
    const bookUrls: string[] = []

    // Find all links on the page
    $('a').each((_, element) => {
      const href = $(element).attr('href')
      if (!href) return

      // Look for Amazon book links in various formats
      if (href.includes('amazon.com')) {
        // Check for /dp/ format
        if (href.includes('/dp/')) {
          bookUrls.push(href)
          return
        }

        // Check for direct ASIN format
        const asinMatch = href.match(/\/([B][0-9A-Z]{9})/)
        if (asinMatch) {
          bookUrls.push(href)
          return
        }

        // Check for ISBN-10 format
        if (href.match(/\/[0-9]{9}[0-9X]/)) {
          bookUrls.push(href)
        }
      }
    })

    return Array.from(new Set(bookUrls))
  } catch (error) {
    console.error('Error fetching source document:', error)
    return []
  }
}

export { getAllEpisodes, getSourceDocument, type Episode }