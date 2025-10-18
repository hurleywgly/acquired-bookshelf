#!/usr/bin/env node

/**
 * Migrate Covers to R2
 * One-time script to upload all existing book covers to Cloudflare R2
 */

import 'dotenv/config'
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
  addedAt?: string
  source?: 'automated' | 'manual'
}

async function migrateCoversToR2() {
  console.log('🚀 Starting cover migration to R2...\n')

  try {
    // Initialize R2 uploader
    const r2Uploader = createR2UploaderFromEnv()
    console.log('✅ R2 uploader initialized\n')

    // Read books.json
    const booksPath = path.join(process.cwd(), 'public', 'data', 'books.json')
    const booksData = await fs.readFile(booksPath, 'utf-8')
    const books: Book[] = JSON.parse(booksData)

    console.log(`📚 Found ${books.length} books to process\n`)

    let uploadedCount = 0
    let skippedCount = 0
    let failedCount = 0
    const updatedBooks: Book[] = []

    for (const book of books) {
      console.log(`\n📖 Processing: ${book.title}`)
      console.log(`   Current URL: ${book.coverUrl}`)

      let newCoverUrl = book.coverUrl

      // Case 1: External URL (OpenLibrary, Amazon, etc.)
      if (book.coverUrl.startsWith('http://') || book.coverUrl.startsWith('https://')) {
        console.log('   📥 Downloading from external URL...')

        const r2Url = await r2Uploader.downloadAndUpload(
          book.coverUrl,
          book.id,
          true // Skip if already exists
        )

        if (r2Url) {
          newCoverUrl = r2Url
          uploadedCount++
          console.log(`   ✅ Uploaded to R2: ${r2Url}`)
        } else {
          failedCount++
          console.log(`   ❌ Upload failed, keeping original URL`)
        }
      }
      // Case 2: Local cover (/covers/...)
      else if (book.coverUrl.startsWith('/covers/')) {
        const localPath = path.join(process.cwd(), 'public', book.coverUrl)

        // Check if local file exists
        try {
          await fs.access(localPath)
          console.log('   📤 Uploading local file...')

          const r2Url = await r2Uploader.uploadLocalFile(
            localPath,
            book.id,
            true // Skip if already exists
          )

          if (r2Url) {
            newCoverUrl = r2Url
            uploadedCount++
            console.log(`   ✅ Uploaded to R2: ${r2Url}`)
          } else {
            failedCount++
            console.log(`   ❌ Upload failed, keeping original URL`)
          }
        } catch (error) {
          console.log(`   ⚠️  Local file not found: ${localPath}`)
          skippedCount++
        }
      }
      // Case 3: Already an R2 URL or default cover
      else {
        console.log('   ⏭️  Skipping (already processed or default cover)')
        skippedCount++
      }

      // Update book with new URL
      updatedBooks.push({
        ...book,
        coverUrl: newCoverUrl
      })
    }

    // Write updated books.json
    console.log('\n\n📝 Writing updated books.json...')
    await fs.writeFile(booksPath, JSON.stringify(updatedBooks, null, 2))

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('🎉 Migration Complete!')
    console.log('='.repeat(60))
    console.log(`📊 Summary:`)
    console.log(`   Total books:     ${books.length}`)
    console.log(`   ✅ Uploaded:     ${uploadedCount}`)
    console.log(`   ⏭️  Skipped:      ${skippedCount}`)
    console.log(`   ❌ Failed:       ${failedCount}`)
    console.log('='.repeat(60))

    if (failedCount > 0) {
      console.log('\n⚠️  Some uploads failed. Check the logs above for details.')
      process.exit(1)
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateCoversToR2().catch(error => {
    console.error('❌ Migration script failed:', error)
    process.exit(1)
  })
}

export { migrateCoversToR2 }
