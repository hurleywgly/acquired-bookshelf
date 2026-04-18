#!/usr/bin/env node

/**
 * Optimized Acquired Podcast Scraper
 * Discovers episodes via acquired.fm sitemap (with listing fallback),
 * extracts Amazon book links directly from each episode page's Links section,
 * enriches metadata via Open Library, uploads covers to Cloudflare R2,
 * and writes updated books.json.
 */

import 'dotenv/config'
import { getAllEpisodes, type Episode } from '../lib/scraper.js'
import { EpisodeClassifier } from '../lib/episode-classifier.js'
import { URLValidator } from '../lib/url-validator.js'
import { getBatchBookMetadata, type BookMetadata } from '../lib/openLibrary.js'
import { createR2UploaderFromEnv, type R2Uploader } from '../lib/r2-uploader.js'
import { createDiscordNotifierFromEnv, type DiscordNotifier } from '../lib/discord-notifier.js'
import { extractAmazonLinksFromEpisodePage, extractEpisodeTitle, parseSeasonEpisodeHint } from '../lib/episode-page-parser.js'
import { toTitleCase, normalizeAuthor } from '../lib/title-case.js'
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
  source: 'automated'
}

const CANARY_EPISODE_URL = 'https://www.acquired.fm/episodes/ferrari'
const MIN_CANARY_AMAZON_LINKS = 1

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

class OptimizedScraper {
  private classifier: EpisodeClassifier
  private urlValidator: URLValidator
  private r2Uploader: R2Uploader | null
  private discord: DiscordNotifier | null
  private dataDir: string
  private booksFile: string
  private gitPushEnabled: boolean

  constructor() {
    this.classifier = new EpisodeClassifier()
    this.urlValidator = new URLValidator()

    try {
      this.r2Uploader = createR2UploaderFromEnv()
      console.log('R2 uploader initialized')
    } catch {
      console.log('R2 credentials not found, will use external URLs for covers')
      this.r2Uploader = null
    }

    this.discord = createDiscordNotifierFromEnv()

    this.dataDir = path.join(process.cwd(), 'public', 'data')
    this.booksFile = path.join(this.dataDir, 'books.json')
    this.gitPushEnabled = process.env.GIT_PUSH !== 'false'
  }

  async run(): Promise<void> {
    console.log('Starting optimized scraper...')

    try {
      await this.runCanary()

      console.log('\nPhase 1: Discovering episodes')
      const allEpisodes = await getAllEpisodes(true)
      console.log(`Found ${allEpisodes.length} total episodes`)

      console.log('\nPhase 2: Finding unprocessed episodes')
      const existingBooks = await this.loadExistingBooks()
      const processedSlugs = this.buildProcessedSlugSet(existingBooks)
      const latestSeason = existingBooks.reduce(
        (max, book) => Math.max(max, book.episodeRef.seasonNumber), 0
      )
      const minSeason = Math.max(latestSeason - 1, 0)
      console.log(`  Latest season with books: ${latestSeason}, processing from season ${minSeason}+`)

      const unprocessedEpisodes = allEpisodes.filter(episode => {
        if (episode.seasonNumber === undefined || episode.seasonNumber < minSeason) return false
        if (processedSlugs.has(episode.slug)) return false
        const classification = this.classifier.classify(episode.name)
        if (classification.shouldSkip) {
          console.log(`  Skipping ${classification.type}: ${episode.name}`)
          return false
        }
        return true
      })

      if (unprocessedEpisodes.length === 0) {
        console.log('No new episodes to process.')
        await this.discord?.notifyNoNewBooks()
        return
      }

      console.log(`\nFound ${unprocessedEpisodes.length} unprocessed episodes:`)
      unprocessedEpisodes.forEach(ep => {
        console.log(`  - ${ep.name} (S${ep.seasonNumber ?? '?'}E${ep.episodeNumber ?? '?'}) — ${ep.slug}`)
      })

      console.log('\nPhase 3: Processing episodes')
      const allNewBooks: Book[] = []

      for (const episode of unprocessedEpisodes) {
        const books = await this.processEpisode(episode)
        if (books.length > 0) {
          allNewBooks.push(...books)
          console.log(`  ✓ ${episode.name}: ${books.length} books`)
        } else {
          console.log(`  – ${episode.name}: no books found`)
        }
      }

      if (allNewBooks.length > 0) {
        await this.updateBooksDatabase(allNewBooks)
        console.log(`\nSuccessfully added ${allNewBooks.length} new books!`)

        if (this.discord) {
          const booksForDiscord = allNewBooks.map(book => ({
            title: book.title,
            author: book.author,
            episode: book.episodeRef.name,
            coverUrl: book.coverUrl,
            amazonUrl: book.amazonUrl
          }))
          await this.discord.notifyBooksAdded(booksForDiscord)

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

        const episodeTitles = [...new Set(allNewBooks.map(book => book.episodeRef.name))]
        if (this.gitPushEnabled) {
          await this.gitCommitAndPush(episodeTitles)
        } else {
          console.log('\n[dry-run] GIT_PUSH=false — skipping git commit and push')
        }
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
   * Canary: fetch a known-good episode page and confirm the Links selector still yields
   * Amazon URLs. Prevents silent-empty-run when acquired.fm changes markup.
   */
  private async runCanary(): Promise<void> {
    console.log(`Canary: checking ${CANARY_EPISODE_URL}`)
    try {
      const response = await this.urlValidator.safeFetch(CANARY_EPISODE_URL)
      if (!response.ok) {
        throw new Error(`Canary fetch failed: HTTP ${response.status}`)
      }
      const html = await response.text()
      const $ = cheerio.load(html)
      const links = extractAmazonLinksFromEpisodePage($, this.urlValidator)
      if (links.length < MIN_CANARY_AMAZON_LINKS) {
        throw new Error(
          `Canary selector drift: expected >= ${MIN_CANARY_AMAZON_LINKS} Amazon links on ferrari episode, got ${links.length}`
        )
      }
      console.log(`  ✓ Canary OK (${links.length} Amazon links found on ferrari episode)`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`  ✗ Canary failed: ${msg}`)
      await this.discord?.notifyError(
        msg,
        'Canary pre-flight — selector drift detected, scraper halted before run. Check lib/episode-page-parser.ts.'
      )
      throw new Error(`Canary failed: ${msg}`)
    }
  }

  private async loadExistingBooks(): Promise<Book[]> {
    try {
      const data = await fs.readFile(this.booksFile, 'utf-8')
      return JSON.parse(data)
    } catch {
      return []
    }
  }

  private buildProcessedSlugSet(books: Book[]): Set<string> {
    const slugs = new Set<string>()
    for (const book of books) {
      if (book.episodeRef.slug) slugs.add(book.episodeRef.slug)
      slugs.add(slugify(book.episodeRef.name))
    }
    return slugs
  }

  private async processEpisode(episode: Episode): Promise<Book[]> {
    console.log(`\nProcessing: ${episode.name} (S${episode.seasonNumber ?? '?'}E${episode.episodeNumber ?? '?'})`)

    try {
      const $ = await this.fetchEpisodePage(episode.sourceUrl)
      if (!$) return []

      const titleFromPage = extractEpisodeTitle($)
      const refinedName = titleFromPage && titleFromPage.length > 1 ? titleFromPage : episode.name
      if (titleFromPage && titleFromPage !== episode.name) {
        console.log(`  Title from page: "${titleFromPage}" (was "${episode.name}")`)
      }

      const hint = parseSeasonEpisodeHint($)
      const seasonNumber =
        hint?.seasonNumber ??
        episode.seasonNumber ??
        (episode.lastmod ? new Date(episode.lastmod).getUTCFullYear() : new Date().getUTCFullYear())
      const episodeNumber = hint?.episodeNumber ?? episode.episodeNumber ?? 0

      const amazonLinks = extractAmazonLinksFromEpisodePage($, this.urlValidator)
      if (amazonLinks.length === 0) {
        console.log('  No Amazon book links found under Links section')
        return []
      }
      console.log(`  Found ${amazonLinks.length} Amazon book links`)

      const bookMetadata = await this.getBooksMetadata(amazonLinks)
      const refinedEpisode: Episode = {
        ...episode,
        name: refinedName,
        seasonNumber,
        episodeNumber
      }
      return this.createBookObjects(bookMetadata, amazonLinks, refinedEpisode)
    } catch (error) {
      console.error(`  Error processing ${episode.name}:`, error)
      return []
    }
  }

  private async fetchEpisodePage(url: string): Promise<cheerio.CheerioAPI | null> {
    try {
      return await pRetry(async () => {
        const response = await this.urlValidator.safeFetch(url)
        if (!response.ok) {
          throw new Error(`Episode page fetch failed: ${response.status}`)
        }
        const html = await response.text()
        return cheerio.load(html)
      }, {
        retries: 2,
        minTimeout: 1000,
        maxTimeout: 5000,
        onFailedAttempt: (err) => {
          console.log(`  Attempt ${err.attemptNumber} failed: ${err.message}`)
        }
      })
    } catch (error) {
      console.error(`  Could not fetch episode page: ${error instanceof Error ? error.message : error}`)
      return null
    }
  }

  private async getBooksMetadata(amazonUrls: string[]): Promise<(BookMetadata | null)[]> {
    const validUrls = this.urlValidator.filterValidUrls(amazonUrls, true)
    if (validUrls.length === 0) {
      console.log('  No valid Amazon URLs after validation')
      return []
    }
    return getBatchBookMetadata(validUrls)
  }

  private async createBookObjects(
    bookMetadata: (BookMetadata | null)[],
    amazonUrls: string[],
    episode: Episode
  ): Promise<Book[]> {
    const books: Book[] = []

    for (let i = 0; i < amazonUrls.length; i++) {
      const metadata = bookMetadata[i]
      const amazonUrl = amazonUrls[i]
      if (!metadata) continue

      const bookId = this.extractASIN(amazonUrl) || `automated-${Date.now()}-${i}`
      let coverUrl = metadata.coverUrl || '/covers/default-book.jpg'

      if (this.r2Uploader && metadata.coverUrl && !metadata.coverUrl.startsWith('/')) {
        console.log(`  Processing cover for: ${metadata.title}`)
        const r2Url = await this.r2Uploader.downloadAndUpload(metadata.coverUrl, bookId, true)
        if (r2Url) {
          coverUrl = r2Url
        } else {
          console.log(`  R2 upload failed, using original URL: ${metadata.coverUrl}`)
        }
      }

      const book: Book = {
        id: bookId,
        title: toTitleCase(metadata.title),
        author: normalizeAuthor(metadata.author),
        coverUrl,
        amazonUrl,
        category: this.categorizeBook(metadata),
        episodeRef: {
          name: episode.name,
          seasonNumber: episode.seasonNumber ?? new Date().getUTCFullYear(),
          episodeNumber: episode.episodeNumber ?? 0,
          slug: episode.slug
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

  private validateBook(book: Book): boolean {
    if (book.title.length < 3) return false
    if (book.title.includes('Unknown') || book.author.includes('Unknown')) return false
    const titleBlocklist = ['Dp', 'Coca-Cola', 'The Adventures of Tom Sawyer']
    if (titleBlocklist.includes(book.title)) return false
    const asinBlocklist = ['B01AB7GU0A']
    const asin = this.extractASIN(book.amazonUrl)
    if (asin && asinBlocklist.includes(asin)) return false
    return true
  }

  private async gitCommitAndPush(episodeTitles: string[]): Promise<void> {
    try {
      console.log('\nPushing changes to git...')

      const { exec } = await import('child_process')
      const execAsync = (cmd: string): Promise<string> =>
        new Promise((resolve, reject) => {
          exec(cmd, (error, stdout, stderr) => {
            if (error) reject(new Error(stderr || error.message))
            else resolve(stdout.trim())
          })
        })

      const status = await execAsync('git status --porcelain public/data/books.json')
      if (!status) {
        console.log('  No changes to commit')
        return
      }

      await execAsync('git add public/data/books.json')

      console.log('  Setting up SSH...')
      try {
        const pathMod = await import('path')
        const scriptPath = pathMod.join(process.cwd(), 'scripts', 'setup-ssh.sh')
        const sshOutput = await execAsync(`chmod +x ${scriptPath} && ${scriptPath}`)
        if (sshOutput) console.log(sshOutput)
      } catch (error) {
        console.error('  SSH setup encountered an error, attempting to proceed anyway...', error)
      }

      const episodeList = episodeTitles.join(', ')
      const commitMessage = `chore: Add books from ${episodeList}\n\nGenerated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude <noreply@anthropic.com>`

      await execAsync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`)
      console.log('  Changes committed')

      await execAsync('git push origin HEAD:main')
      console.log('  Changes pushed to remote — Vercel will auto-deploy')
    } catch (error) {
      console.error('  Git push failed:', error)
      console.error('  Books added locally but not pushed. Check SSH + git credentials on Render.')
    }
  }

  private async updateBooksDatabase(newBooks: Book[]): Promise<void> {
    try {
      let existingBooks: Book[] = []
      try {
        const existingData = await fs.readFile(this.booksFile, 'utf-8')
        existingBooks = JSON.parse(existingData)
      } catch {
        console.log('No existing books file found, creating new one')
      }

      const existingIds = new Set(existingBooks.map(book => book.id))
      const uniqueNewBooks = newBooks.filter(book => !existingIds.has(book.id))

      if (uniqueNewBooks.length === 0) {
        console.log('All books already exist in the database')
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
      console.log(`Updated books.json with ${uniqueNewBooks.length} new books`)

      uniqueNewBooks.forEach(book => {
        console.log(`  + "${book.title}" by ${book.author}`)
      })
    } catch (error) {
      console.error('Error updating books database:', error)
      throw error
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const scraper = new OptimizedScraper()
  scraper.run().catch(error => {
    console.error('Optimized scraper failed:', error)
    process.exit(1)
  })
}

export { OptimizedScraper }
