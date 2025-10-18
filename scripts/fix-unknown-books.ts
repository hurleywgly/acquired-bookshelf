#!/usr/bin/env node

/**
 * Fix Unknown Books Script
 * Finds books with "Unknown Title" or "Unknown Author" and scrapes Amazon for correct metadata
 */

import 'dotenv/config'
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
  addedAt?: string
  source?: string
}

interface AmazonMetadata {
  title: string
  author: string
}

class UnknownBookFixer {
  private booksFile: string

  constructor() {
    this.booksFile = path.join(process.cwd(), 'public', 'data', 'books.json')
  }

  async run(): Promise<void> {
    console.log('🔍 Finding books with unknown metadata...\n')

    try {
      // Load books
      const books: Book[] = JSON.parse(await fs.readFile(this.booksFile, 'utf-8'))

      // Find books with unknown metadata
      const unknownBooks = books.filter(
        book =>
          book.title.includes('Unknown') ||
          book.author.includes('Unknown') ||
          book.title.length < 5
      )

      if (unknownBooks.length === 0) {
        console.log('✅ No books with unknown metadata found!')
        return
      }

      console.log(`Found ${unknownBooks.length} books with unknown metadata:\n`)
      unknownBooks.forEach((book, i) => {
        console.log(`${i + 1}. "${book.title}" by ${book.author}`)
        console.log(`   Amazon URL: ${book.amazonUrl}`)
        console.log(`   Episode: ${book.episodeRef.name}\n`)
      })

      console.log('🔧 Fetching metadata from Amazon...\n')

      // Fix each book
      const fixes: { book: Book; newMetadata: AmazonMetadata }[] = []

      for (const book of unknownBooks) {
        try {
          const metadata = await this.scrapeAmazonMetadata(book.amazonUrl)
          if (metadata.title !== 'Unknown Title') {
            fixes.push({ book, newMetadata: metadata })
            console.log(`✅ Fixed: "${metadata.title}" by ${metadata.author}`)
          } else {
            console.log(`⚠️  Could not extract metadata for: ${book.amazonUrl}`)
          }
        } catch (error) {
          console.log(`❌ Error scraping ${book.id}:`, error)
        }
      }

      if (fixes.length === 0) {
        console.log('\n⚠️  No fixes could be made')
        return
      }

      // Apply fixes
      console.log(`\n📝 Applying ${fixes.length} fixes to books.json...`)

      const updatedBooks = books.map(book => {
        const fix = fixes.find(f => f.book.id === book.id)
        if (fix) {
          return {
            ...book,
            title: fix.newMetadata.title,
            author: fix.newMetadata.author,
          }
        }
        return book
      })

      // Write updated books
      await fs.writeFile(this.booksFile, JSON.stringify(updatedBooks, null, 2))

      console.log('\n' + '='.repeat(70))
      console.log('🎉 Fix Complete!')
      console.log('='.repeat(70))
      console.log(`\nUpdated ${fixes.length} books:\n`)
      fixes.forEach(({ book, newMetadata }) => {
        console.log(`  "${book.title}" → "${newMetadata.title}"`)
        console.log(`  ${book.author} → ${newMetadata.author}\n`)
      })
    } catch (error) {
      console.error('❌ Error:', error)
      process.exit(1)
    }
  }

  private async scrapeAmazonMetadata(amazonUrl: string): Promise<AmazonMetadata> {
    try {
      console.log(`  📥 Scraping: ${amazonUrl}`)

      const response = await fetch(amazonUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      })

      if (!response.ok) {
        throw new Error(`Amazon returned ${response.status}`)
      }

      const html = await response.text()
      const $ = cheerio.load(html)

      // Extract title - multiple selectors to try
      let title =
        $('#productTitle').text().trim() ||
        $('#ebooksProductTitle').text().trim() ||
        $('span[id="productTitle"]').text().trim() ||
        $('h1.product-title').text().trim()

      // Extract author - multiple selectors to try
      let author =
        $('.author a').first().text().trim() ||
        $('#bylineInfo .author a').first().text().trim() ||
        $('span.author a').first().text().trim() ||
        $('.contributorNameID').first().text().trim() ||
        $('a[data-a-target="authorLink"]').first().text().trim()

      // Clean up title (remove extra whitespace, newlines)
      title = title.replace(/\s+/g, ' ').trim()

      // Clean up author (remove "by", extra text)
      author = author
        .replace(/^by\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim()

      // Fallback: try to extract from meta tags
      if (!title) {
        title = $('meta[name="title"]').attr('content') || 'Unknown Title'
      }

      if (!author) {
        author = $('meta[name="author"]').attr('content') || 'Unknown Author'
      }

      // Validation
      if (title.length > 200) {
        title = title.substring(0, 200) + '...'
      }

      if (author.length > 100) {
        author = author.substring(0, 100) + '...'
      }

      return { title, author }
    } catch (error) {
      console.error(`  ❌ Scraping failed:`, error)
      return { title: 'Unknown Title', author: 'Unknown Author' }
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const fixer = new UnknownBookFixer()
  fixer.run().catch(error => {
    console.error('❌ Fix failed:', error)
    process.exit(1)
  })
}

export { UnknownBookFixer }
