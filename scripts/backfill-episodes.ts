#!/usr/bin/env node

/**
 * Backfill Episodes Script
 * Manually process specific episodes that were missed by the RSS monitor
 */

import 'dotenv/config'
import { URLValidator } from '../lib/url-validator.js'
import { getBatchBookMetadata, type BookMetadata } from '../lib/openLibrary.js'
import { createR2UploaderFromEnv, type R2Uploader } from '../lib/r2-uploader.js'
import {
  extractAmazonLinksFromEpisodePage,
  extractEpisodeTitle,
  parseSeasonEpisodeHint
} from '../lib/episode-page-parser.js'
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
    slug?: string
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
      const urlValidation = this.urlValidator.validateUrl(episodeUrl)
      if (!urlValidation.isValid) {
        console.log(`  ❌ Invalid episode URL: ${urlValidation.error}`)
        return []
      }

      console.log(`  🔍 Fetching episode page...`)
      const $ = await pRetry(async () => {
        const response = await this.urlValidator.safeFetch(urlValidation.sanitizedUrl!)
        if (!response.ok) throw new Error(`Episode page fetch failed: ${response.status}`)
        const html = await response.text()
        return cheerio.load(html)
      }, { retries: 2, minTimeout: 1000, maxTimeout: 5000 })

      const episodeInfo = this.extractEpisodeInfo(episodeUrl, $)

      console.log(`  📚 Extracting Amazon links from Links section...`)
      const amazonLinks = extractAmazonLinksFromEpisodePage($, this.urlValidator)
      if (amazonLinks.length === 0) {
        console.log('  ⚠️  No Amazon book links found')
        return []
      }
      console.log(`  🔗 Found ${amazonLinks.length} Amazon links`)

      console.log(`  📖 Fetching book metadata...`)
      const bookMetadata = await this.getBooksMetadata(amazonLinks)

      console.log(`  💾 Creating book records...`)
      return this.createBookObjects(bookMetadata, amazonLinks, episodeInfo)
    } catch (error) {
      console.error(`  ❌ Error:`, error)
      return []
    }
  }

  private extractEpisodeInfo(
    url: string,
    $?: cheerio.CheerioAPI
  ): { name: string; seasonNumber: number; episodeNumber: number; slug: string } {
    const slug = (url.split('/episodes/')[1] || 'unknown').split(/[/?#]/)[0]
    let name = slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')

    let seasonNumber = new Date().getFullYear()
    let episodeNumber = 0

    if ($) {
      const pageTitle = extractEpisodeTitle($)
      if (pageTitle && pageTitle.length > 1) name = pageTitle
      const hint = parseSeasonEpisodeHint($)
      if (hint) {
        seasonNumber = hint.seasonNumber
        episodeNumber = hint.episodeNumber
      }
    }

    return { name, seasonNumber, episodeNumber, slug }
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
    episodeInfo: { name: string; seasonNumber: number; episodeNumber: number; slug: string }
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
          episodeRef: {
            name: episodeInfo.name,
            seasonNumber: episodeInfo.seasonNumber,
            episodeNumber: episodeInfo.episodeNumber,
            slug: episodeInfo.slug
          },
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
