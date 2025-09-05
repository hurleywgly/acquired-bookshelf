#!/usr/bin/env node

import { getAllEpisodes, getSourceDocument, type Episode } from '../lib/scraper.js'
import { getBatchBookMetadata, type BookMetadata } from '../lib/openLibrary.js'
import * as cheerio from 'cheerio'
import * as fs from 'fs/promises'
import * as path from 'path'

interface Book {
  id: string
  title: string
  author: string
  coverUrl: string
  amazonUrl: string
  category: string
  episodeRef: {
    name: string
    seasonNumber: number
    episodeNumber: number
  }
}

interface GoogleDocLink {
  url: string
  text: string
}

class WeeklyScraper {
  private dataDir: string
  private booksFile: string
  private lastRunFile: string

  constructor() {
    this.dataDir = path.join(process.cwd(), 'public', 'data')
    this.booksFile = path.join(this.dataDir, 'books.json')
    this.lastRunFile = path.join(process.cwd(), 'data', 'last-scraper-run.json')
  }

  async run(): Promise<void> {
    console.log('🚀 Starting weekly scraper...')
    
    try {
      // Get all episodes (force refresh to check for new ones)
      const episodes = await getAllEpisodes(true)
      console.log(`📝 Found ${episodes.length} total episodes`)

      // Get new episodes since last run
      const newEpisodes = await this.getNewEpisodes(episodes)
      console.log(`🆕 Found ${newEpisodes.length} new episodes to process`)

      if (newEpisodes.length === 0) {
        console.log('✅ No new episodes found. Scraper complete.')
        await this.updateLastRun()
        return
      }

      // Process each new episode
      const allNewBooks: Book[] = []
      for (const episode of newEpisodes) {
        console.log(`\n📖 Processing: ${episode.name} (S${episode.seasonNumber}E${episode.episodeNumber})`)
        
        const books = await this.processEpisode(episode)
        if (books.length > 0) {
          allNewBooks.push(...books)
          console.log(`  ✅ Found ${books.length} books`)
        } else {
          console.log('  ⚠️ No books found or no sources available')
        }
      }

      // Add new books to existing data
      if (allNewBooks.length > 0) {
        await this.updateBooksData(allNewBooks)
        console.log(`\n🎉 Successfully added ${allNewBooks.length} new books!`)
      }

      // Update last run timestamp
      await this.updateLastRun()
      console.log('✅ Weekly scraper completed successfully')

    } catch (error) {
      console.error('❌ Error in weekly scraper:', error)
      throw error
    }
  }

  private async getNewEpisodes(allEpisodes: Episode[]): Promise<Episode[]> {
    try {
      const lastRunData = await fs.readFile(this.lastRunFile, 'utf-8')
      const lastRun = JSON.parse(lastRunData)
      const lastRunDate = new Date(lastRun.timestamp)

      console.log(`Last scraper run: ${lastRunDate.toISOString()}`)

      // Filter episodes based on when they were likely published
      // For episodes that are newer than our last run, check if they're actually new
      return allEpisodes.filter(episode => {
        if (!episode.date) return false
        
        // Parse episode date - handle various formats
        let episodeDate: Date
        try {
          // Try parsing the date string directly
          episodeDate = new Date(episode.date)
          
          // If invalid, try extracting from common formats
          if (isNaN(episodeDate.getTime())) {
            // Handle formats like "12/15/2024December 15, 2024"
            const dateMatch = episode.date.match(/(\d{1,2}\/\d{1,2}\/\d{4})|(\w+ \d{1,2}, \d{4})/)
            if (dateMatch) {
              episodeDate = new Date(dateMatch[0])
            } else {
              console.log(`Could not parse date for episode ${episode.name}: ${episode.date}`)
              return false
            }
          }
        } catch (error) {
          console.log(`Error parsing date for episode ${episode.name}: ${episode.date}`)
          return false
        }

        // Check if episode was published after our last run
        const isNew = episodeDate > lastRunDate
        if (isNew) {
          console.log(`  New episode found: ${episode.name} (${episodeDate.toDateString()})`)
        }
        return isNew
      })
    } catch (error) {
      // If no last run file, process only very recent episodes
      console.log('No previous run found, processing recent episodes only')
      const twoWeeksAgo = new Date()
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
      
      return allEpisodes.filter(episode => {
        if (!episode.date) return false
        
        try {
          const episodeDate = new Date(episode.date)
          if (isNaN(episodeDate.getTime())) {
            // Try extracting date from mixed format
            const dateMatch = episode.date.match(/(\d{1,2}\/\d{1,2}\/\d{4})|(\w+ \d{1,2}, \d{4})/)
            if (dateMatch) {
              const parsedDate = new Date(dateMatch[0])
              return parsedDate > twoWeeksAgo
            }
            return false
          }
          return episodeDate > twoWeeksAgo
        } catch (error) {
          return false
        }
      }).slice(0, 3) // Limit to 3 most recent for initial run
    }
  }

  private async processEpisode(episode: Episode): Promise<Book[]> {
    if (!episode.sourceUrl) {
      console.log(`  ⚠️ No source URL for episode: ${episode.name}`)
      return []
    }

    try {
      // Get the episode page to find the Google Doc link
      const googleDocUrl = await this.findGoogleDocLink(episode.sourceUrl)
      if (!googleDocUrl) {
        console.log(`  ⚠️ No Google Doc link found for: ${episode.name}`)
        return []
      }

      console.log(`  📄 Found Google Doc: ${googleDocUrl}`)

      // Extract Amazon book links from the Google Doc
      const amazonLinks = await this.extractAmazonLinksFromGoogleDoc(googleDocUrl)
      if (amazonLinks.length === 0) {
        console.log(`  ⚠️ No Amazon book links found in Google Doc`)
        return []
      }

      console.log(`  🔗 Found ${amazonLinks.length} Amazon book links`)

      // Get metadata for all books
      const bookMetadata = await getBatchBookMetadata(amazonLinks)

      // Convert to Book objects
      const books: Book[] = []
      for (let i = 0; i < amazonLinks.length; i++) {
        const metadata = bookMetadata[i]
        const amazonUrl = amazonLinks[i]

        if (metadata) {
          const book: Book = {
            id: this.extractASIN(amazonUrl) || `manual-${Date.now()}-${i}`,
            title: metadata.title,
            author: metadata.author,
            coverUrl: metadata.coverUrl || '/covers/default-book.jpg',
            amazonUrl: amazonUrl,
            category: this.categorizeBook(metadata),
            episodeRef: {
              name: episode.name,
              seasonNumber: episode.seasonNumber,
              episodeNumber: episode.episodeNumber
            }
          }
          books.push(book)
        }
      }

      return books
    } catch (error) {
      console.error(`  ❌ Error processing episode ${episode.name}:`, error)
      return []
    }
  }

  private async findGoogleDocLink(episodeUrl: string): Promise<string | null> {
    try {
      const response = await fetch(episodeUrl)
      if (!response.ok) return null

      const html = await response.text()
      const $ = cheerio.load(html)

      // Look for "Episode sources" text and find nearby Google Doc links
      let googleDocUrl: string | null = null

      $('a').each((_, element) => {
        const href = $(element).attr('href')
        const text = $(element).text().toLowerCase()

        if (href && href.includes('docs.google.com')) {
          // Check if this link is near "Episode sources" text
          const linkText = text
          const parentText = $(element).parent().text().toLowerCase()
          const nearbyText = $(element).closest('p, div').text().toLowerCase()

          if (
            linkText.includes('episode sources') ||
            linkText.includes('sources') ||
            parentText.includes('episode sources') ||
            nearbyText.includes('episode sources')
          ) {
            googleDocUrl = href
            return false // Break the loop
          }
        }
      })

      // If no specific "Episode sources" link found, look for any Google Doc link
      if (!googleDocUrl) {
        $('a').each((_, element) => {
          const href = $(element).attr('href')
          if (href && href.includes('docs.google.com/document')) {
            googleDocUrl = href
            return false // Break the loop
          }
        })
      }

      return googleDocUrl
    } catch (error) {
      console.error('Error finding Google Doc link:', error)
      return null
    }
  }

  private async extractAmazonLinksFromGoogleDoc(googleDocUrl: string): Promise<string[]> {
    try {
      // Convert to public/export format for easier scraping
      const docId = googleDocUrl.match(/\/document\/d\/([a-zA-Z0-9-_]+)/)?.[1]
      if (!docId) {
        console.error('Could not extract document ID from URL')
        return []
      }

      // Try different export formats
      const exportUrls = [
        `https://docs.google.com/document/d/${docId}/export?format=html`,
        `https://docs.google.com/document/d/${docId}/pub`,
        googleDocUrl.replace('/edit', '/export?format=html')
      ]

      let html = ''
      for (const url of exportUrls) {
        try {
          const response = await fetch(url)
          if (response.ok) {
            html = await response.text()
            break
          }
        } catch (error) {
          console.log(`Failed to fetch ${url}:`, error)
          continue
        }
      }

      if (!html) {
        console.error('Could not fetch Google Doc content')
        return []
      }

      const $ = cheerio.load(html)
      const amazonLinks: string[] = []

      $('a').each((_, element) => {
        const href = $(element).attr('href')
        if (href && href.includes('amazon.com')) {
          // Clean up the URL and validate it's a book link
          let cleanUrl = href
          
          // Remove Google redirect wrapper
          if (href.includes('google.com/url?')) {
            const urlParam = new URLSearchParams(href.split('?')[1])
            cleanUrl = urlParam.get('url') || href
          }

          // Check if it's a book link (has /dp/ or looks like a book ASIN)
          if (cleanUrl.includes('/dp/') || cleanUrl.match(/\/[B][0-9A-Z]{9}/)) {
            amazonLinks.push(cleanUrl)
          }
        }
      })

      return [...new Set(amazonLinks)] // Remove duplicates
    } catch (error) {
      console.error('Error extracting Amazon links from Google Doc:', error)
      return []
    }
  }

  private extractASIN(amazonUrl: string): string | null {
    const asinMatch = amazonUrl.match(/\/dp\/([A-Z0-9]{10})/) || amazonUrl.match(/\/([B][0-9A-Z]{9})/)
    return asinMatch?.[1] || null
  }

  private categorizeBook(metadata: BookMetadata): string {
    const subjects = metadata.subjects || []
    const title = metadata.title.toLowerCase()
    const author = metadata.author.toLowerCase()

    // Business/Finance keywords
    if (subjects.some(s => /business|finance|economics|management|entrepreneurship|investing|money/i.test(s)) ||
        title.includes('business') || title.includes('finance') || title.includes('economics')) {
      return 'Business'
    }

    // Technology keywords
    if (subjects.some(s => /technology|computer|software|programming|digital|internet/i.test(s)) ||
        title.includes('tech') || title.includes('computer') || title.includes('digital')) {
      return 'Technology'
    }

    // History keywords
    if (subjects.some(s => /history|historical|biography|memoir/i.test(s)) ||
        title.includes('history') || title.includes('historical')) {
      return 'History'
    }

    // Default category
    return 'Business'
  }

  private async updateBooksData(newBooks: Book[]): Promise<void> {
    try {
      // Read existing books
      let existingBooks: Book[] = []
      try {
        const existingData = await fs.readFile(this.booksFile, 'utf-8')
        existingBooks = JSON.parse(existingData)
      } catch (error) {
        console.log('No existing books file found, creating new one')
      }

      // Filter out duplicates based on ID
      const existingIds = new Set(existingBooks.map(book => book.id))
      const uniqueNewBooks = newBooks.filter(book => !existingIds.has(book.id))

      if (uniqueNewBooks.length === 0) {
        console.log('All books already exist in the database')
        return
      }

      // Combine and sort
      const allBooks = [...existingBooks, ...uniqueNewBooks]
      allBooks.sort((a, b) => {
        // Sort by season (descending), then episode (descending)
        if (a.episodeRef.seasonNumber !== b.episodeRef.seasonNumber) {
          return b.episodeRef.seasonNumber - a.episodeRef.seasonNumber
        }
        return b.episodeRef.episodeNumber - a.episodeRef.episodeNumber
      })

      // Ensure directory exists
      await fs.mkdir(this.dataDir, { recursive: true })

      // Write updated data
      await fs.writeFile(this.booksFile, JSON.stringify(allBooks, null, 2))
      console.log(`📚 Updated books.json with ${uniqueNewBooks.length} new books`)

    } catch (error) {
      console.error('Error updating books data:', error)
      throw error
    }
  }

  private async updateLastRun(): Promise<void> {
    try {
      const dataDir = path.dirname(this.lastRunFile)
      await fs.mkdir(dataDir, { recursive: true })

      const lastRunData = {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }

      await fs.writeFile(this.lastRunFile, JSON.stringify(lastRunData, null, 2))
    } catch (error) {
      console.error('Error updating last run file:', error)
    }
  }
}

// Run the scraper if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const scraper = new WeeklyScraper()
  scraper.run().catch(error => {
    console.error('❌ Scraper failed:', error)
    process.exit(1)
  })
}

export { WeeklyScraper }