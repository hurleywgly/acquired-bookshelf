#!/usr/bin/env node

/**
 * Manually add books to the database
 * Usage: tsx scripts/manual-add-books.ts
 */

import 'dotenv/config'
import { getBatchBookMetadata } from '../lib/openLibrary.js'
import { createR2UploaderFromEnv } from '../lib/r2-uploader.js'
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
  addedAt: string
  source: 'manual'
}

const BOOKS_TO_ADD = [
  {
    amazonUrl: 'https://www.amazon.com/Becoming-Trader-Joe-Business-Still/dp/1400225434',
    asin: '1400225434'
  },
  {
    amazonUrl: 'https://www.amazon.com/Build-Brand-Like-Trader-Joes/dp/0979167337',
    asin: '0979167337'
  },
  {
    amazonUrl: 'https://www.amazon.com/Secret-Life-Groceries-American-Supermarket-ebook/dp/B083RZFYZC',
    asin: 'B083RZFYZC'
  }
]

const EPISODE_INFO = {
  name: "Trader Joe's",
  seasonNumber: 2025,
  episodeNumber: 11
}

async function main() {
  console.log('📚 Manually adding books for Trader Joe\'s episode...\n')

  // Initialize R2 uploader
  const r2Uploader = createR2UploaderFromEnv()

  // Get metadata for all books
  console.log('🔍 Fetching metadata from Open Library...')
  const amazonUrls = BOOKS_TO_ADD.map(b => b.amazonUrl)
  const metadataResults = await getBatchBookMetadata(amazonUrls)

  const books: Book[] = []

  // Process each book
  for (let i = 0; i < BOOKS_TO_ADD.length; i++) {
    const { amazonUrl, asin } = BOOKS_TO_ADD[i]
    const metadata = metadataResults[i]

    if (!metadata) {
      console.log(`❌ Could not find metadata for ${amazonUrl}`)
      continue
    }

    console.log(`\n✓ Found: "${metadata.title}" by ${metadata.author}`)

    // Upload cover to R2
    let coverUrl = metadata.coverUrl || '/covers/default-book.jpg'
    if (metadata.coverUrl && !metadata.coverUrl.startsWith('/')) {
      console.log(`  📸 Uploading cover to R2...`)
      const r2Url = await r2Uploader.downloadAndUpload(
        metadata.coverUrl,
        asin,
        true // Skip if exists
      )
      if (r2Url) {
        coverUrl = r2Url
        console.log(`  ✅ Cover uploaded`)
      }
    }

    const book: Book = {
      id: asin,
      title: metadata.title,
      author: metadata.author,
      coverUrl,
      amazonUrl,
      category: 'Business',
      episodeRef: EPISODE_INFO,
      addedAt: new Date().toISOString(),
      source: 'manual'
    }

    books.push(book)
  }

  if (books.length === 0) {
    console.log('\n❌ No books to add')
    return
  }

  // Read existing books
  const dataDir = path.join(process.cwd(), 'public', 'data')
  const booksFile = path.join(dataDir, 'books.json')

  let existingBooks: Book[] = []
  try {
    const data = await fs.readFile(booksFile, 'utf-8')
    existingBooks = JSON.parse(data)
  } catch (error) {
    console.log('No existing books file found')
  }

  // Add new books at the beginning
  const allBooks = [...books, ...existingBooks]

  // Write updated file
  await fs.writeFile(booksFile, JSON.stringify(allBooks, null, 2))

  console.log(`\n✅ Added ${books.length} books to books.json`)
  books.forEach(book => {
    console.log(`  + "${book.title}" by ${book.author}`)
  })
}

main().catch(error => {
  console.error('❌ Error:', error)
  process.exit(1)
})
