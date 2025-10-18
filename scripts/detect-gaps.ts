#!/usr/bin/env node

/**
 * Detect Gaps Script
 * Identifies episodes in the RSS feed that have no books in the database
 */

import { XMLParser } from 'fast-xml-parser'
import * as fs from 'fs/promises'
import * as path from 'path'

interface RSSEpisode {
  id: string
  title: string
  link: string
  pubDate: Date
}

interface Book {
  id: string
  episodeRef: {
    name: string
  }
}

class GapDetector {
  private rssUrl = 'https://feeds.transistor.fm/acquired'
  private xmlParser: XMLParser
  private booksFile: string

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: true,
      parseAttributeValue: true,
      trimValues: true
    })
    this.booksFile = path.join(process.cwd(), 'public', 'data', 'books.json')
  }

  async run(): Promise<void> {
    console.log('🔍 Detecting gaps in book coverage...\n')

    try {
      // Fetch and parse RSS feed
      console.log('📡 Fetching RSS feed...')
      const rssData = await this.fetchRSSFeed()
      if (!rssData) {
        console.log('❌ Failed to fetch RSS feed')
        return
      }

      const episodes = this.parseRSSFeed(rssData)
      console.log(`✅ Found ${episodes.length} episodes in RSS feed\n`)

      // Load existing books
      console.log('📚 Loading books database...')
      const books = await this.loadBooks()
      console.log(`✅ Found ${books.length} books in database\n`)

      // Group books by episode
      const booksByEpisode = new Map<string, number>()
      books.forEach(book => {
        const episodeName = this.normalizeEpisodeName(book.episodeRef.name)
        booksByEpisode.set(episodeName, (booksByEpisode.get(episodeName) || 0) + 1)
      })

      // Find episodes with no books
      const episodesWithNoBooks: RSSEpisode[] = []
      const episodesWithBooks: { episode: RSSEpisode; count: number }[] = []

      episodes.forEach(episode => {
        const normalized = this.normalizeEpisodeName(episode.title)
        const bookCount = booksByEpisode.get(normalized) || 0

        if (bookCount === 0) {
          episodesWithNoBooks.push(episode)
        } else {
          episodesWithBooks.push({ episode, count: bookCount })
        }
      })

      // Filter out interview/special episodes (likely to have no books)
      const episodesToBackfill = episodesWithNoBooks.filter(ep => {
        const lower = ep.title.toLowerCase()
        return !lower.includes('interview') &&
               !lower.includes('holiday special') &&
               !lower.includes('special episode') &&
               !lower.includes('acquired live')
      })

      // Report results
      console.log('='.repeat(70))
      console.log('📊 GAP DETECTION REPORT')
      console.log('='.repeat(70))
      console.log(`\nTotal episodes in RSS: ${episodes.length}`)
      console.log(`Episodes with books: ${episodesWithBooks.length}`)
      console.log(`Episodes with NO books: ${episodesWithNoBooks.length}`)
      console.log(`Episodes to backfill (excluding interviews): ${episodesToBackfill.length}`)

      if (episodesToBackfill.length > 0) {
        console.log(`\n⚠️  EPISODES MISSING BOOKS:`)
        console.log('='.repeat(70))
        episodesToBackfill.forEach((ep, index) => {
          console.log(`\n${index + 1}. ${ep.title}`)
          console.log(`   Published: ${ep.pubDate.toDateString()}`)
          console.log(`   URL: ${ep.link}`)
        })

        // Generate backfill command
        console.log(`\n\n💡 TO BACKFILL THESE EPISODES:`)
        console.log('='.repeat(70))
        console.log(`Edit scripts/backfill-episodes.ts and add these URLs:`)
        console.log(`\nconst EPISODES_TO_BACKFILL = [`)
        episodesToBackfill.forEach(ep => {
          console.log(`  '${ep.link}',`)
        })
        console.log(`]\n`)
        console.log(`Then run: npm run backfill-episodes`)
      } else {
        console.log(`\n✅ No gaps found! All regular episodes have books.`)
      }

      // Show episodes with books for reference
      if (episodesWithBooks.length > 0) {
        console.log(`\n\n📚 EPISODES WITH BOOKS (Recent 10):`)
        console.log('='.repeat(70))
        episodesWithBooks.slice(0, 10).forEach(({ episode, count }) => {
          console.log(`${episode.title}: ${count} books`)
        })
      }

      console.log('\n' + '='.repeat(70))
      console.log('✅ Gap detection complete!')
      console.log('='.repeat(70))

    } catch (error) {
      console.error('❌ Error:', error)
      process.exit(1)
    }
  }

  private normalizeEpisodeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private async fetchRSSFeed(): Promise<string | null> {
    try {
      const response = await fetch(this.rssUrl, {
        headers: {
          'User-Agent': 'Acquired Bookshelf Gap Detector/1.0',
          'Accept': 'application/rss+xml, application/xml, text/xml'
        }
      })

      if (!response.ok) {
        console.error(`RSS fetch failed: ${response.status}`)
        return null
      }

      return await response.text()
    } catch (error) {
      console.error('Error fetching RSS:', error)
      return null
    }
  }

  private parseRSSFeed(xmlData: string): RSSEpisode[] {
    try {
      const parsed = this.xmlParser.parse(xmlData)
      const items = parsed.rss?.channel?.item || []

      return items.map((item: any) => {
        const guid = typeof item.guid === 'object' && item.guid !== null
          ? item.guid['#text']
          : (item.guid ?? item.link ?? '')
        const id = guid.split('/').pop() || `episode-${Date.now()}`

        return {
          id,
          title: item.title || 'Unknown Title',
          link: item.link || '',
          pubDate: new Date(item.pubDate || Date.now())
        }
      })
    } catch (error) {
      console.error('Error parsing RSS:', error)
      return []
    }
  }

  private async loadBooks(): Promise<Book[]> {
    try {
      const data = await fs.readFile(this.booksFile, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      console.log('Warning: Could not load books.json')
      return []
    }
  }
}

// Run gap detection if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const detector = new GapDetector()
  detector.run().catch(error => {
    console.error('❌ Gap detection failed:', error)
    process.exit(1)
  })
}

export { GapDetector }
