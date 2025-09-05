#!/usr/bin/env node

/**
 * Optimized Acquired Podcast Scraper
 * Uses RSS feed monitoring with adaptive delays for efficient book discovery
 */

import { RSSMonitor, type EpisodeProcessing } from '../lib/rss-monitor.js'
import { EpisodeClassifier, type EpisodeClassification } from '../lib/episode-classifier.js'
import { URLValidator } from '../lib/url-validator.js'
import { getBatchBookMetadata, type BookMetadata } from '../lib/openLibrary.js'
import * as cheerio from 'cheerio'
import * as fs from 'fs/promises'
import * as path from 'path'
import pRetry from 'p-retry'

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
  addedAt: string
  source: 'automated'
}

class OptimizedScraper {
  private rssMonitor: RSSMonitor
  private classifier: EpisodeClassifier
  private urlValidator: URLValidator
  private dataDir: string
  private booksFile: string

  constructor() {
    this.rssMonitor = new RSSMonitor()
    this.classifier = new EpisodeClassifier()
    this.urlValidator = new URLValidator()
    this.dataDir = path.join(process.cwd(), 'public', 'data')
    this.booksFile = path.join(this.dataDir, 'books.json')
  }

  /**
   * Main scraper execution
   */
  async run(): Promise<void> {
    console.log('🚀 Starting optimized scraper...')
    
    try {
      // Phase 1: Check RSS for new episodes
      console.log('\n📡 Phase 1: RSS Monitoring')
      const newEpisodes = await this.rssMonitor.checkForNewEpisodes()
      
      // Phase 2: Process any ready episodes
      console.log('\n📋 Phase 2: Processing Ready Episodes')
      const readyEpisodes = await this.rssMonitor.getReadyEpisodes()
      
      const allEpisodesToProcess = [...newEpisodes, ...readyEpisodes]
      
      if (allEpisodesToProcess.length === 0) {
        console.log('✅ No episodes to process. Scraper complete.')
        return
      }

      console.log(`\n📚 Processing ${allEpisodesToProcess.length} episodes...`)
      
      // Phase 3: Process episodes and extract books
      const allNewBooks: Book[] = []
      
      for (const episodeProcessing of allEpisodesToProcess) {
        const books = await this.processEpisode(episodeProcessing)
        
        if (books.length > 0) {
          allNewBooks.push(...books)
          await this.rssMonitor.markEpisodeProcessed(episodeProcessing.episode.id)
          console.log(`✅ Successfully processed: ${episodeProcessing.episode.title} (${books.length} books)`)
        } else {
          // Requeue with delay if no books found
          await this.rssMonitor.requeueEpisode(episodeProcessing.episode.id, false)
          console.log(`♻️ Requeued: ${episodeProcessing.episode.title} (no books found)`)
        }
      }

      // Phase 4: Update database
      if (allNewBooks.length > 0) {
        await this.updateBooksDatabase(allNewBooks)
        console.log(`\n🎉 Successfully added ${allNewBooks.length} new books!`)
      }

      console.log('✅ Optimized scraper completed successfully')

    } catch (error) {
      console.error('❌ Error in optimized scraper:', error)
      throw error
    }
  }

  /**
   * Process a single episode to extract books
   */
  private async processEpisode(episodeProcessing: EpisodeProcessing): Promise<Book[]> {
    const { episode } = episodeProcessing
    console.log(`\n📖 Processing: ${episode.title}`)
    
    try {
      // Step 1: Get episode page URL from RSS link
      const episodeUrl = this.extractEpisodePageUrl(episode.link)
      if (!episodeUrl) {
        console.log('  ⚠️ Could not extract episode page URL')
        return []
      }

      // Step 2: Validate episode URL
      const urlValidation = this.urlValidator.validateUrl(episodeUrl)
      if (!urlValidation.isValid) {
        console.log(`  ❌ Invalid episode URL: ${urlValidation.error}`)
        return []
      }

      // Step 3: Find Google Doc link on episode page
      const googleDocUrl = await this.findGoogleDocLink(urlValidation.sanitizedUrl!)
      if (!googleDocUrl) {
        console.log('  ⚠️ No Google Doc link found')
        return []
      }

      console.log(`  📄 Found Google Doc: ${googleDocUrl}`)

      // Step 4: Extract Amazon links from Google Doc
      const amazonLinks = await this.extractAmazonLinksFromGoogleDoc(googleDocUrl)
      if (amazonLinks.length === 0) {
        console.log('  ⚠️ No Amazon book links found in Google Doc')
        return []
      }

      console.log(`  🔗 Found ${amazonLinks.length} Amazon book links`)

      // Step 5: Get book metadata
      const bookMetadata = await this.getBooksMetadata(amazonLinks)

      // Step 6: Convert to Book objects
      const books = this.createBookObjects(bookMetadata, amazonLinks, episode)

      return books

    } catch (error) {
      console.error(`  ❌ Error processing episode ${episode.title}:`, error)
      return []
    }
  }

  /**
   * Extract episode page URL from RSS link
   */
  private extractEpisodePageUrl(rssLink: string): string | null {
    try {
      // RSS links are typically direct episode URLs
      if (rssLink.includes('acquired.fm/episodes/')) {
        return rssLink
      }

      // If it's a different format, we might need to transform it
      // For now, assume RSS provides direct episode URLs
      return rssLink
    } catch (error) {
      console.error('Error extracting episode URL:', error)
      return null
    }
  }

  /**
   * Find Google Doc link on episode page with retry logic
   */
  private async findGoogleDocLink(episodeUrl: string): Promise<string | null> {
    return pRetry(async () => {
      const response = await this.urlValidator.safeFetch(episodeUrl)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch episode page: ${response.status}`)
      }

      const html = await response.text()
      const $ = cheerio.load(html)

      // Look for "Episode sources" text and find nearby Google Doc links
      let googleDocUrl: string | null = null

      $('a').each((_, element) => {
        const href = $(element).attr('href')
        const text = $(element).text().toLowerCase()

        if (href && href.includes('docs.google.com')) {
          // Check if this link is related to episode sources
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

      if (!googleDocUrl) {
        throw new Error('No Google Doc link found')
      }

      return googleDocUrl
    }, {
      retries: 2,
      minTimeout: 1000,
      maxTimeout: 5000,
      onFailedAttempt: (error) => {
        console.log(`  ⚠️ Attempt ${error.attemptNumber} failed: ${error.message}`)
      }
    })
  }

  /**
   * Extract Amazon links from Google Doc with retry logic
   */
  private async extractAmazonLinksFromGoogleDoc(googleDocUrl: string): Promise<string[]> {
    return pRetry(async () => {
      // Validate Google Doc URL
      const urlValidation = this.urlValidator.validateUrl(googleDocUrl)
      if (!urlValidation.isValid) {
        throw new Error(`Invalid Google Doc URL: ${urlValidation.error}`)
      }

      const sanitizedUrl = urlValidation.sanitizedUrl!

      // Extract document ID
      const docId = sanitizedUrl.match(/\/document\/d\/([a-zA-Z0-9-_]+)/)?.[1]
      if (!docId) {
        throw new Error('Could not extract document ID from URL')
      }

      // Try different export formats
      const exportUrls = [
        `https://docs.google.com/document/d/${docId}/export?format=html`,
        `https://docs.google.com/document/d/${docId}/pub`,
        sanitizedUrl.replace('/edit', '/export?format=html')
      ]

      let html = ''
      let lastError: Error | null = null

      for (const url of exportUrls) {
        try {
          console.log(`  🔄 Trying: ${url}`)
          const validation = this.urlValidator.validateUrl(url)
          if (!validation.isValid) continue

          const response = await this.urlValidator.safeFetch(validation.sanitizedUrl!)
          if (response.ok) {
            html = await response.text()
            console.log(`  ✅ Success with: ${url}`)
            break
          }
        } catch (error) {
          lastError = error as Error
          console.log(`  ❌ Failed: ${url}`)
          continue
        }
      }

      if (!html) {
        throw lastError || new Error('Could not fetch Google Doc content from any format')
      }

      // Parse HTML and extract Amazon links
      const $ = cheerio.load(html)
      const amazonLinks: string[] = []

      $('a').each((_, element) => {
        const href = $(element).attr('href')
        if (href && href.includes('amazon.com')) {
          // Clean up the URL
          let cleanUrl = href
          
          // Remove Google redirect wrapper
          if (href.includes('google.com/url?')) {
            try {
              const urlParams = new URLSearchParams(href.split('?')[1])
              cleanUrl = urlParams.get('q') || urlParams.get('url') || href
            } catch (error) {
              console.log('  ⚠️ Error cleaning Google redirect URL:', error)
            }
          }

          // Validate that it's a book link
          if (cleanUrl.includes('/dp/') || cleanUrl.match(/\/[B][0-9A-Z]{9}/)) {
            // Validate the URL before adding
            const validation = this.urlValidator.validateUrl(cleanUrl)
            if (validation.isValid && validation.sanitizedUrl) {
              amazonLinks.push(validation.sanitizedUrl)
            }
          }
        }
      })

      const uniqueLinks = [...new Set(amazonLinks)]
      console.log(`  📚 Extracted ${uniqueLinks.length} unique Amazon book links`)
      
      if (uniqueLinks.length === 0) {
        throw new Error('No Amazon book links found in Google Doc')
      }

      return uniqueLinks
    }, {
      retries: 2,
      minTimeout: 2000,
      maxTimeout: 8000,
      onFailedAttempt: (error) => {
        console.log(`  ⚠️ Google Doc attempt ${error.attemptNumber} failed: ${error.message}`)
      }
    })
  }

  /**
   * Get book metadata with validation
   */
  private async getBooksMetadata(amazonUrls: string[]): Promise<(BookMetadata | null)[]> {
    // Filter and validate URLs
    const validUrls = this.urlValidator.filterValidUrls(amazonUrls, true)
    
    if (validUrls.length === 0) {
      console.log('  ❌ No valid Amazon URLs after validation')
      return []
    }

    // Get metadata using existing function
    return getBatchBookMetadata(validUrls)
  }

  /**
   * Create Book objects from metadata
   */
  private createBookObjects(
    bookMetadata: (BookMetadata | null)[],
    amazonUrls: string[],
    episode: any
  ): Book[] {
    const books: Book[] = []
    
    for (let i = 0; i < amazonUrls.length; i++) {
      const metadata = bookMetadata[i]
      const amazonUrl = amazonUrls[i]

      if (metadata) {
        const book: Book = {
          id: this.extractASIN(amazonUrl) || `automated-${Date.now()}-${i}`,
          title: metadata.title,
          author: metadata.author,
          coverUrl: metadata.coverUrl || '/covers/default-book.jpg',
          amazonUrl: amazonUrl,
          category: this.categorizeBook(metadata),
          episodeRef: {
            name: episode.title,
            seasonNumber: this.extractSeasonFromTitle(episode.title),
            episodeNumber: this.extractEpisodeFromTitle(episode.title)
          },
          addedAt: new Date().toISOString(),
          source: 'automated'
        }
        books.push(book)
      }
    }

    return books
  }

  /**
   * Extract ASIN from Amazon URL
   */
  private extractASIN(amazonUrl: string): string | null {
    const asinMatch = amazonUrl.match(/\/dp\/([A-Z0-9]{10})/) || amazonUrl.match(/\/([B][0-9A-Z]{9})/)
    return asinMatch?.[1] || null
  }

  /**
   * Categorize book based on metadata
   */
  private categorizeBook(metadata: BookMetadata): string {
    const subjects = metadata.subjects || []
    const title = metadata.title.toLowerCase()

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

  /**
   * Extract season number from episode title (fallback)
   */
  private extractSeasonFromTitle(title: string): number {
    // For RSS episodes, we might not have season info, use current year as fallback
    const currentYear = new Date().getFullYear()
    return currentYear
  }

  /**
   * Extract episode number from title (fallback)
   */
  private extractEpisodeFromTitle(title: string): number {
    // Try to extract episode number from title
    const episodeMatch = title.match(/episode (\d+)/i)
    if (episodeMatch) {
      return parseInt(episodeMatch[1])
    }
    
    // Fallback to timestamp-based ID
    return Math.floor(Date.now() / 1000) % 10000
  }

  /**
   * Update books database with new books
   */
  private async updateBooksDatabase(newBooks: Book[]): Promise<void> {
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

      // Log the new books
      uniqueNewBooks.forEach(book => {
        console.log(`  + "${book.title}" by ${book.author}`)
      })

    } catch (error) {
      console.error('Error updating books database:', error)
      throw error
    }
  }
}

// Run the scraper if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const scraper = new OptimizedScraper()
  scraper.run().catch(error => {
    console.error('❌ Optimized scraper failed:', error)
    process.exit(1)
  })
}

export { OptimizedScraper }