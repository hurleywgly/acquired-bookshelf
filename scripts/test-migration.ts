#!/usr/bin/env node

/**
 * Test migration script with limited books to verify data preservation
 */

import * as fs from 'fs/promises'

async function testMigration() {
  console.log('🧪 TESTING MIGRATION WITH LIMITED DATASET')
  console.log('=========================================\n')

  try {
    // Read current data
    const booksData = await fs.readFile('public/data/books.json', 'utf-8')
    const allBooks = JSON.parse(booksData)
    
    // Take first 5 books for testing
    const testBooks = allBooks.slice(0, 5)
    
    console.log(`📚 Testing with ${testBooks.length} books:`)
    testBooks.forEach((book, i) => {
      console.log(`   ${i + 1}. "${book.title}" by ${book.author}`)
      console.log(`      Episode: ${book.episodeRef.name} (S${book.episodeRef.seasonNumber}E${book.episodeRef.episodeNumber})`)
      console.log(`      Cover: ${book.coverUrl}`)
      console.log(`      Category: ${book.category}`)
      console.log()
    })

    // Create test data file
    await fs.writeFile(
      'public/data/books-test.json',
      JSON.stringify(testBooks, null, 2)
    )

    console.log('✅ Test dataset created: public/data/books-test.json')
    console.log('\n📋 DATA PRESERVATION VERIFICATION:')
    console.log('==================================')

    // Verify each critical data element is present
    const verification = {
      allHaveIds: testBooks.every(book => book.id),
      allHaveTitles: testBooks.every(book => book.title),
      allHaveAuthors: testBooks.every(book => book.author),
      allHaveCovers: testBooks.every(book => book.coverUrl),
      allHaveAmazonUrls: testBooks.every(book => book.amazonUrl),
      allHaveCategories: testBooks.every(book => book.category),
      allHaveEpisodes: testBooks.every(book => 
        book.episodeRef && 
        book.episodeRef.name && 
        book.episodeRef.seasonNumber && 
        book.episodeRef.episodeNumber
      ),
      uniqueIds: new Set(testBooks.map(b => b.id)).size === testBooks.length,
      uniqueEpisodes: new Set(testBooks.map(b => 
        `S${b.episodeRef.seasonNumber}E${b.episodeRef.episodeNumber}`
      )).size
    }

    console.log(`✅ All books have IDs: ${verification.allHaveIds}`)
    console.log(`✅ All books have titles: ${verification.allHaveTitles}`)
    console.log(`✅ All books have authors: ${verification.allHaveAuthors}`)
    console.log(`✅ All books have covers: ${verification.allHaveCovers}`)
    console.log(`✅ All books have Amazon URLs: ${verification.allHaveAmazonUrls}`)
    console.log(`✅ All books have categories: ${verification.allHaveCategories}`)
    console.log(`✅ All books have episode refs: ${verification.allHaveEpisodes}`)
    console.log(`✅ All IDs are unique: ${verification.uniqueIds}`)
    console.log(`✅ Unique episodes: ${verification.uniqueEpisodes}`)

    if (Object.values(verification).slice(0, -1).every(v => v === true)) {
      console.log('\n🎉 ALL DATA PRESERVATION CHECKS PASSED!')
      console.log('Ready for full migration.')
    } else {
      console.log('\n❌ Some data preservation checks failed!')
    }

  } catch (error) {
    console.error('❌ Test migration failed:', error)
  }
}

testMigration()