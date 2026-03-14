#!/usr/bin/env node

/**
 * Optimized Acquired Podcast Scraper
 * Uses acquired.fm episode listing for reliable episode discovery,
 * then extracts books from Google Doc sources via Open Library metadata.
 */

import 'dotenv/config'
import { getAllEpisodes, type Episode } from '../lib/scraper.js'
import { EpisodeClassifier } from '../lib/episode-classifier.js'
import { URLValidator } from '../lib/url-validator.js'
import { getBatchBookMetadata, type BookMetadata } from '../lib/openLibrary.js'
import { createR2UploaderFromEnv, type R2Uploader } from '../lib/r2-uploader.js'
import { createDiscordNotifierFromEnv, type DiscordNotifier } from '../lib/discord-notifier.js'
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
  private classifier: EpisodeClassifier
  private urlValidator: URLValidator
  private r2Uploader: R2Uploader | null
  private discord: DiscordNotifier | null
  private dataDir: string
  private booksFile: string

  constructor() {
    this.classifier = new EpisodeClassifier()
    this.urlValidator = new URLValidator()

    // Initialize R2 uploader if credentials are available
    try {
      this.r2Uploader = createR2UploaderFromEnv()
      console.log('R2 uploader initialized')
    } catch (error) {
      console.log('R2 credentials not found, will use external URLs for covers')
      this.r2Uploader = null
    }

    // Initialize Discord notifier if webhook URL is available
    this.discord = createDiscordNotifierFromEnv()

    this.dataDir = path.join(process.cwd(), 'public', 'data')
    this.booksFile = path.join(this.dataDir, 'books.json')
  }

  /**
   * Main scraper execution
   */
  async run(): Promise<void> {
    console.log('Starting optimized scraper...')

    try {
      // Phase 1: Get all episodes from acquired.fm
      console.log('\nPhase 1: Fetching episodes from acquired.fm')
      const allEpisodes = await getAllEpisodes(true)
      console.log(`Found ${allEpisodes.length} total episodes`)

      // Phase 2: Find unprocessed episodes newer than our latest
      console.log('\nPhase 2: Finding new unprocessed episodes')
      const existingBooks = await this.loadExistingBooks()

      // Use composite key (name + season + episode) so duplicate episode names
      // across seasons (e.g. "The NFL" in 2023 and 2026) are handled correctly
      const processedEpisodeKeys = new Set(
        existingBooks.map(book =>
          `${book.episodeRef.name}|${book.episodeRef.seasonNumber}|${book.episodeRef.episodeNumber}`
        )
      )

      // Find the most recent season we have books for, so we only look at
      // episodes from that season onward (avoids processing hundreds of old episodes)
      const latestSeason = existingBooks.reduce(
        (max, book) => Math.max(max, book.episodeRef.seasonNumber), 0
      )
      // Go back one season to catch any we might have missed
      const minSeason = Math.max(latestSeason - 1, 0)
      console.log(`  Latest season with books: ${latestSeason}, processing from season ${minSeason}+`)

      const unprocessedEpisodes = allEpisodes.filter(episode => {
        // Only look at recent episodes (current season and one prior)
        if (episode.seasonNumber < minSeason) return false

        const key = `${episode.name}|${episode.seasonNumber}|${episode.episodeNumber}`
        if (processedEpisodeKeys.has(key)) return false

        // Use episode classifier to skip interviews/specials (but NOT "special" episodes
        // which are labeled differently on acquired.fm and may have sources)
        const classification = this.classifier.classify(episode.name)
        if (classification.shouldSkip) {
          console.log(`  Skipping ${classification.type}: ${episode.name}`)
          return false
        }
        return true
      })

      if (unprocessedEpisodes.length === 0) {
        console.log('No new episodes to process. Scraper complete.')
        await this.discord?.notifyNoNewBooks()
        return
      }

      console.log(`\nFound ${unprocessedEpisodes.length} unprocessed episodes:`)
      unprocessedEpisodes.forEach(ep => {
        console.log(`  - ${ep.name} (S${ep.seasonNumber}E${ep.episodeNumber})`)
      })

      // Phase 3: Process episodes and extract books
      console.log('\nPhase 3: Processing episodes')
      const allNewBooks: Book[] = []

      for (const episode of unprocessedEpisodes) {
        const books = await this.processEpisode(episode)

        if (books.length > 0) {
          allNewBooks.push(...books)
          console.log(`Successfully processed: ${episode.name} (${books.length} books)`)
        } else {
          console.log(`No books found for: ${episode.name}`)
        }
      }

      // Phase 4: Update database
      if (allNewBooks.length > 0) {
        await this.updateBooksDatabase(allNewBooks)
        console.log(`\nSuccessfully added ${allNewBooks.length} new books!`)

        // Send Discord notification with book details
        if (this.discord) {
          const booksForDiscord = allNewBooks.map(book => ({
            title: book.title,
            author: book.author,
            episode: book.episodeRef.name
          }))
          await this.discord.notifyBooksAdded(booksForDiscord)

          // Check for unknown metadata and alert
          const unknownBooks = allNewBooks.filter(
            book => book.title.includes('Unknown') || book.author.includes('Unknown')
          )
          if (unknownBooks.length > 0) {
            const unknownForDiscord = unknownBooks.map(book => ({
              title: book.title,
              author: book.author,
              amazonUrl: book.amazonUrl,
              episode: book.episodeRef.name
            }))
            await this.discord.notifyUnknownMetadata(unknownForDiscord)
          }
        }

        // Commit and push changes to git
        const episodeTitles = [...new Set(allNewBooks.map(book => book.episodeRef.name))]
        await this.gitCommitAndPush(episodeTitles)
      } else {
        console.log('\nNo new books found across all episodes.')
        await this.discord?.notifyNoNewBooks()
      }

      console.log('Optimized scraper completed successfully')

    } catch (error) {
      console.error('Error in optimized scraper:', error)
      await this.discord?.notifyError(
        error instanceof Error ? error.message : String(error),
        'Main scraper execution'
      )
      throw error
    }
  }

  /**
   * Load existing books from database
   */
  private async loadExistingBooks(): Promise<Book[]> {
    try {
      const data = await fs.readFile(this.booksFile, 'utf-8')
      return JSON.parse(data)
    } catch {
      return []
    }
  }

  /**
   * Process a single episode to extract books
   */
  private async processEpisode(episode: Episode): Promise<Book[]> {
    console.log(`\nProcessing: ${episode.name} (S${episode.seasonNumber}E${episode.episodeNumber})`)

    try {
      if (!episode.sourceUrl) {
        console.log('  No source URL for episode')
        return []
      }

      // Step 1: Find Google Doc link on episode page
      const googleDocUrl = await this.findGoogleDocLink(episode.sourceUrl)
      if (!googleDocUrl) {
        console.log('  No Google Doc link found')
        return []
      }

      console.log(`  Found Google Doc: ${googleDocUrl}`)

      // Step 2: Extract Amazon links from Google Doc
      const amazonLinks = await this.extractAmazonLinksFromGoogleDoc(googleDocUrl)
      if (amazonLinks.length === 0) {
        console.log('  No Amazon book links found in Google Doc')
        return []
      }

      console.log(`  Found ${amazonLinks.length} Amazon book links`)

      // Step 3: Get book metadata
      const bookMetadata = await this.getBooksMetadata(amazonLinks)

      // Step 4: Convert to Book objects (with R2 upload)
      const books = await this.createBookObjects(bookMetadata, amazonLinks, episode)

      return books

    } catch (error) {
      console.error(`  Error processing episode ${episode.name}:`, error)
      return []
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
        console.log(`  Attempt ${error.attemptNumber} failed: ${error.message}`)
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
          console.log(`  Trying: ${url}`)
          const validation = this.urlValidator.validateUrl(url)
          if (!validation.isValid) continue

          const response = await this.urlValidator.safeFetch(validation.sanitizedUrl!)
          if (response.ok) {
            html = await response.text()
            console.log(`  Success with: ${url}`)
            break
          }
        } catch (error) {
          lastError = error as Error
          console.log(`  Failed: ${url}`)
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
              console.log('  Error cleaning Google redirect URL:', error)
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
      console.log(`  Extracted ${uniqueLinks.length} unique Amazon book links`)

      if (uniqueLinks.length === 0) {
        throw new Error('No Amazon book links found in Google Doc')
      }

      return uniqueLinks
    }, {
      retries: 2,
      minTimeout: 2000,
      maxTimeout: 8000,
      onFailedAttempt: (error) => {
        console.log(`  Google Doc attempt ${error.attemptNumber} failed: ${error.message}`)
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
      console.log('  No valid Amazon URLs after validation')
      return []
    }

    // Get metadata using existing function
    return getBatchBookMetadata(validUrls)
  }

  /**
   * Create Book objects from metadata using real episode data
   */
  private async createBookObjects(
    bookMetadata: (BookMetadata | null)[],
    amazonUrls: string[],
    episode: Episode
  ): Promise<Book[]> {
    const books: Book[] = []

    for (let i = 0; i < amazonUrls.length; i++) {
      const metadata = bookMetadata[i]
      const amazonUrl = amazonUrls[i]

      if (metadata) {
        const bookId = this.extractASIN(amazonUrl) || `automated-${Date.now()}-${i}`
        let coverUrl = metadata.coverUrl || '/covers/default-book.jpg'

        // If R2 is available and we have a valid cover URL, upload to R2
        if (this.r2Uploader && metadata.coverUrl && !metadata.coverUrl.startsWith('/')) {
          console.log(`  Processing cover for: ${metadata.title}`)
          const r2Url = await this.r2Uploader.downloadAndUpload(
            metadata.coverUrl,
            bookId,
            true // Skip if already exists
          )

          if (r2Url) {
            coverUrl = r2Url
          } else {
            console.log(`  R2 upload failed, using original URL: ${metadata.coverUrl}`)
          }
        }

        const book: Book = {
          id: bookId,
          title: metadata.title,
          author: metadata.author,
          coverUrl: coverUrl,
          amazonUrl: amazonUrl,
          category: this.categorizeBook(metadata),
          episodeRef: {
            name: episode.name,
            seasonNumber: episode.seasonNumber,
            episodeNumber: episode.episodeNumber
          },
          addedAt: new Date().toISOString(),
          source: 'automated'
        }

        if (this.validateBook(book)) {
          books.push(book)
        } else {
          console.log(`  Skipping invalid book: "${book.title}" (${book.amazonUrl})`)
        }
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
   * Validate book data to prevent "ghost books"
   */
  private validateBook(book: Book): boolean {
    // Filter out books with very short titles (likely parsing errors)
    if (book.title.length < 3) return false

    // Filter out "Unknown" titles/authors
    if (book.title.includes('Unknown') || book.author.includes('Unknown')) return false

    // Filter out specific problematic titles from bad Open Library matches
    const titleBlocklist = ['Dp', 'Coca-Cola', 'The Adventures of Tom Sawyer']
    if (titleBlocklist.includes(book.title)) return false

    // Filter out known non-book ASINs (movies, videos, etc.)
    const asinBlocklist = ['B01AB7GU0A'] // Concussion movie
    const asin = this.extractASIN(book.amazonUrl)
    if (asin && asinBlocklist.includes(asin)) return false

    return true
  }

  /**
   * Commit and push changes to git
   */
  private async gitCommitAndPush(episodeTitles: string[]): Promise<void> {
    try {
      console.log('\nPushing changes to git...')

      // Check if there are any changes to commit
      const statusCheck = await import('child_process').then(cp =>
        new Promise<string>((resolve, reject) => {
          cp.exec('git status --porcelain public/data/books.json', (error, stdout) => {
            if (error) reject(error)
            else resolve(stdout.trim())
          })
        })
      )

      if (!statusCheck) {
        console.log('  No changes to commit')
        return
      }

      // Add the books.json file
      await import('child_process').then(cp =>
        new Promise<void>((resolve, reject) => {
          cp.exec('git add public/data/books.json', (error) => {
            if (error) reject(error)
            else resolve()
          })
        })
      )

      // Setup SSH for git push
      console.log('  Setting up SSH...')
      try {
        const path = await import('path')
        await import('child_process').then(cp =>
          new Promise<void>((resolve, reject) => {
            const scriptPath = path.join(process.cwd(), 'scripts', 'setup-ssh.sh')
            cp.exec(`chmod +x ${scriptPath} && ${scriptPath}`, (error, stdout, stderr) => {
              if (error) {
                console.error('SSH setup failed:', stderr)
                reject(error)
              } else {
                console.log(stdout)
                resolve()
              }
            })
          })
        )
      } catch (error) {
        console.error('  SSH setup encountered an error, attempting to proceed anyway...')
      }

      // Create commit message
      const episodeList = episodeTitles.join(', ')
      const commitMessage = `chore: Add books from ${episodeList}\n\nGenerated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude <noreply@anthropic.com>`

      // Commit changes
      await import('child_process').then(cp =>
        new Promise<void>((resolve, reject) => {
          cp.exec(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, (error) => {
            if (error) reject(error)
            else resolve()
          })
        })
      )

      console.log('  Changes committed')

      // Push to remote
      await import('child_process').then(cp =>
        new Promise<void>((resolve, reject) => {
          cp.exec('git push origin HEAD:main', (error) => {
            if (error) reject(error)
            else resolve()
          })
        })
      )

      console.log('  Changes pushed to remote')
      console.log('  Vercel will auto-deploy the changes')

    } catch (error) {
      console.error('  Git push failed:', error)
      console.error('  Books have been added locally but not pushed to remote')
      console.error('  Please push manually or check git credentials on Render')
    }
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
      console.log(`Updated books.json with ${uniqueNewBooks.length} new books`)

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
    console.error('Optimized scraper failed:', error)
    process.exit(1)
  })
}

export { OptimizedScraper }
