#!/usr/bin/env node

/**
 * Backfill Episodes Script
 * Manually process specific episodes that were missed by the RSS monitor
 */

import 'dotenv/config'
import { URLValidator } from '../lib/url-validator.js'
import { getBatchBookMetadata, type BookMetadata } from '../lib/openLibrary.js'
import { createR2UploaderFromEnv, type R2Uploader } from '../lib/r2-uploader.js'
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
  source: 'automated' | 'backfill'
}

// Episodes to backfill
const EPISODES_TO_BACKFILL = [
  'https://www.acquired.fm/episodes/epic-systems-mychart',
  'https://www.acquired.fm/episodes/google',
  'https://www.acquired.fm/episodes/alphabet-inc',
  'https://www.acquired.fm/episodes/google-the-ai-company',
]

class EpisodeBackfill {
  private urlValidator: URLValidator
  private r2Uploader: R2Uploader | null
  private dataDir: string
  private booksFile: string

  constructor() {
    this.urlValidator = new URLValidator()

    // Initialize R2 uploader if credentials are available
    try {
      this.r2Uploader = createR2UploaderFromEnv()
      console.log('✅ R2 uploader initialized')
    } catch (error) {
      console.log('⚠️  R2 credentials not found, will use external URLs for covers')
      this.r2Uploader = null
    }

    this.dataDir = path.join(process.cwd(), 'public', 'data')
    this.booksFile = path.join(this.dataDir, 'books.json')
  }

  async run(): Promise<void> {
    console.log('🚀 Starting episode backfill...\n')
    console.log(`📋 Processing ${EPISODES_TO_BACKFILL.length} episodes\n`)

    const allNewBooks: Book[] = []

    for (const episodeUrl of EPISODES_TO_BACKFILL) {
      console.log(`\n${'='.repeat(70)}`)
      console.log(`📖 Processing: ${episodeUrl}`)
      console.log('='.repeat(70))

      try {
        const books = await this.processEpisode(episodeUrl)

        if (books.length > 0) {
          allNewBooks.push(...books)
          console.log(`✅ Found ${books.length} books`)
        } else {
          console.log(`⚠️  No books found for this episode`)
        }
      } catch (error) {
        console.error(`❌ Error processing episode:`, error)
      }
    }

    if (allNewBooks.length > 0) {
      console.log(`\n\n${'='.repeat(70)}`)
      console.log(`📚 Adding ${allNewBooks.length} new books to database`)
      console.log('='.repeat(70))
      await this.updateBooksDatabase(allNewBooks)
      console.log(`\n🎉 Backfill complete! Added ${allNewBooks.length} books`)
    } else {
      console.log('\n⚠️  No new books found to add')
    }
  }

  private async processEpisode(episodeUrl: string): Promise<Book[]> {
    try {
      // Step 1: Validate episode URL
      const urlValidation = this.urlValidator.validateUrl(episodeUrl)
      if (!urlValidation.isValid) {
        console.log(`  ❌ Invalid episode URL: ${urlValidation.error}`)
        return []
      }

      // Step 2: Extract episode info from URL
      const episodeInfo = this.extractEpisodeInfo(episodeUrl)

      // Step 3: Find Google Doc link on episode page
      console.log(`  🔍 Searching for Google Doc link...`)
      const googleDocUrl = await this.findGoogleDocLink(urlValidation.sanitizedUrl!)
      if (!googleDocUrl) {
        console.log('  ⚠️  No Google Doc link found')
        return []
      }

      console.log(`  📄 Found Google Doc`)

      // Step 4: Extract Amazon links from Google Doc
      console.log(`  📚 Extracting Amazon links...`)
      const amazonLinks = await this.extractAmazonLinksFromGoogleDoc(googleDocUrl)
      if (amazonLinks.length === 0) {
        console.log('  ⚠️  No Amazon book links found')
        return []
      }

      console.log(`  🔗 Found ${amazonLinks.length} Amazon links`)

      // Step 5: Get book metadata
      console.log(`  📖 Fetching book metadata...`)
      const bookMetadata = await this.getBooksMetadata(amazonLinks)

      // Step 6: Create books with R2 upload
      console.log(`  💾 Creating book records...`)
      const books = await this.createBookObjects(bookMetadata, amazonLinks, episodeInfo)

      return books
    } catch (error) {
      console.error(`  ❌ Error:`, error)
      return []
    }
  }

  private extractEpisodeInfo(url: string): { name: string; seasonNumber: number; episodeNumber: number } {
    // Extract episode name from URL
    const slug = url.split('/episodes/')[1] || 'unknown'
    const name = slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')

    // Use current year as season
    const seasonNumber = new Date().getFullYear()

    // Generate episode number from timestamp
    const episodeNumber = Math.floor(Date.now() / 1000) % 10000

    return { name, seasonNumber, episodeNumber }
  }

  private async findGoogleDocLink(episodeUrl: string): Promise<string | null> {
    return pRetry(async () => {
      const response = await this.urlValidator.safeFetch(episodeUrl)

      if (!response.ok) {
        throw new Error(`Failed to fetch episode page: ${response.status}`)
      }

      const html = await response.text()
      const $ = cheerio.load(html)

      let googleDocUrl: string | null = null

      $('a').each((_, element) => {
        const href = $(element).attr('href')
        const text = $(element).text().toLowerCase()

        if (href && href.includes('docs.google.com')) {
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
            return false
          }
        }
      })

      if (!googleDocUrl) {
        $('a').each((_, element) => {
          const href = $(element).attr('href')
          if (href && href.includes('docs.google.com/document')) {
            googleDocUrl = href
            return false
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
    })
  }

  private async extractAmazonLinksFromGoogleDoc(googleDocUrl: string): Promise<string[]> {
    return pRetry(async () => {
      const urlValidation = this.urlValidator.validateUrl(googleDocUrl)
      if (!urlValidation.isValid) {
        throw new Error(`Invalid Google Doc URL: ${urlValidation.error}`)
      }

      const sanitizedUrl = urlValidation.sanitizedUrl!
      const docId = sanitizedUrl.match(/\/document\/d\/([a-zA-Z0-9-_]+)/)?.[1]
      if (!docId) {
        throw new Error('Could not extract document ID')
      }

      const exportUrls = [
        `https://docs.google.com/document/d/${docId}/export?format=html`,
        `https://docs.google.com/document/d/${docId}/pub`,
        sanitizedUrl.replace('/edit', '/export?format=html')
      ]

      let html = ''
      for (const url of exportUrls) {
        try {
          const validation = this.urlValidator.validateUrl(url)
          if (!validation.isValid) continue

          const response = await this.urlValidator.safeFetch(validation.sanitizedUrl!)
          if (response.ok) {
            html = await response.text()
            break
          }
        } catch (error) {
          continue
        }
      }

      if (!html) {
        throw new Error('Could not fetch Google Doc content')
      }

      const $ = cheerio.load(html)
      const amazonLinks: string[] = []

      $('a').each((_, element) => {
        const href = $(element).attr('href')
        if (href && href.includes('amazon.com')) {
          let cleanUrl = href

          if (href.includes('google.com/url?')) {
            try {
              const urlParams = new URLSearchParams(href.split('?')[1])
              cleanUrl = urlParams.get('q') || urlParams.get('url') || href
            } catch (error) {
              // Ignore
            }
          }

          if (cleanUrl.includes('/dp/') || cleanUrl.match(/\/[B][0-9A-Z]{9}/)) {
            const validation = this.urlValidator.validateUrl(cleanUrl)
            if (validation.isValid && validation.sanitizedUrl) {
              amazonLinks.push(validation.sanitizedUrl)
            }
          }
        }
      })

      const uniqueLinks = [...new Set(amazonLinks)]

      if (uniqueLinks.length === 0) {
        throw new Error('No Amazon book links found')
      }

      return uniqueLinks
    }, {
      retries: 2,
      minTimeout: 2000,
      maxTimeout: 8000,
    })
  }

  private async getBooksMetadata(amazonUrls: string[]): Promise<(BookMetadata | null)[]> {
    const validUrls = this.urlValidator.filterValidUrls(amazonUrls, true)

    if (validUrls.length === 0) {
      return []
    }

    return getBatchBookMetadata(validUrls)
  }

  private async createBookObjects(
    bookMetadata: (BookMetadata | null)[],
    amazonUrls: string[],
    episodeInfo: { name: string; seasonNumber: number; episodeNumber: number }
  ): Promise<Book[]> {
    const books: Book[] = []

    for (let i = 0; i < amazonUrls.length; i++) {
      const metadata = bookMetadata[i]
      const amazonUrl = amazonUrls[i]

      if (metadata) {
        const bookId = this.extractASIN(amazonUrl) || `backfill-${Date.now()}-${i}`
        let coverUrl = metadata.coverUrl || '/covers/default-book.jpg'

        // If R2 is available and we have a valid cover URL, upload to R2
        if (this.r2Uploader && metadata.coverUrl && !metadata.coverUrl.startsWith('/')) {
          console.log(`    📸 Uploading cover for: ${metadata.title}`)
          const r2Url = await this.r2Uploader.downloadAndUpload(
            metadata.coverUrl,
            bookId,
            true
          )

          if (r2Url) {
            coverUrl = r2Url
          }
        }

        const book: Book = {
          id: bookId,
          title: metadata.title,
          author: metadata.author,
          coverUrl: coverUrl,
          amazonUrl: amazonUrl,
          category: this.categorizeBook(metadata),
          episodeRef: episodeInfo,
          addedAt: new Date().toISOString(),
          source: 'backfill'
        }
        books.push(book)
      }
    }

    return books
  }

  private extractASIN(amazonUrl: string): string | null {
    const asinMatch = amazonUrl.match(/\/dp\/([A-Z0-9]{10})/) || amazonUrl.match(/\/([B][0-9A-Z]{9})/)
    return asinMatch?.[1] || null
  }

  private categorizeBook(metadata: BookMetadata): string {
    const subjects = metadata.subjects || []
    const title = metadata.title.toLowerCase()

    if (subjects.some(s => /business|finance|economics|management|entrepreneurship|investing|money/i.test(s)) ||
        title.includes('business') || title.includes('finance') || title.includes('economics')) {
      return 'Business'
    }

    if (subjects.some(s => /technology|computer|software|programming|digital|internet/i.test(s)) ||
        title.includes('tech') || title.includes('computer') || title.includes('digital')) {
      return 'Technology'
    }

    if (subjects.some(s => /history|historical|biography|memoir/i.test(s)) ||
        title.includes('history') || title.includes('historical')) {
      return 'History'
    }

    return 'Business'
  }

  private async updateBooksDatabase(newBooks: Book[]): Promise<void> {
    try {
      let existingBooks: Book[] = []
      try {
        const existingData = await fs.readFile(this.booksFile, 'utf-8')
        existingBooks = JSON.parse(existingData)
      } catch (error) {
        console.log('No existing books file found')
      }

      const existingIds = new Set(existingBooks.map(book => book.id))
      const uniqueNewBooks = newBooks.filter(book => !existingIds.has(book.id))

      if (uniqueNewBooks.length === 0) {
        console.log('All books already exist in database')
        return
      }

      const allBooks = [...existingBooks, ...uniqueNewBooks]
      allBooks.sort((a, b) => {
        if (a.episodeRef.seasonNumber !== b.episodeRef.seasonNumber) {
          return b.episodeRef.seasonNumber - a.episodeRef.seasonNumber
        }
        return b.episodeRef.episodeNumber - a.episodeRef.episodeNumber
      })

      await fs.mkdir(this.dataDir, { recursive: true })
      await fs.writeFile(this.booksFile, JSON.stringify(allBooks, null, 2))

      console.log(`\n📚 Books added:`)
      uniqueNewBooks.forEach(book => {
        console.log(`  + "${book.title}" by ${book.author}`)
        console.log(`    Episode: ${book.episodeRef.name}`)
      })
    } catch (error) {
      console.error('Error updating books database:', error)
      throw error
    }
  }
}

// Run backfill if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const backfill = new EpisodeBackfill()
  backfill.run().catch(error => {
    console.error('❌ Backfill failed:', error)
    process.exit(1)
  })
}

export { EpisodeBackfill }
