#!/usr/bin/env node

/**
 * Analyze current data structure to ensure complete preservation during migration
 */

import * as fs from 'fs/promises'
import * as path from 'path'

interface CurrentBook {
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
}

async function analyzeCurrentData() {
  console.log('📊 ANALYZING CURRENT DATA STRUCTURE')
  console.log('=====================================\n')

  try {
    // Read current books
    const booksData = await fs.readFile('public/data/books.json', 'utf-8')
    const books: CurrentBook[] = JSON.parse(booksData)

    // Read manual covers
    const manualCoversData = await fs.readFile('data/manual-covers.json', 'utf-8')
    const manualCovers = JSON.parse(manualCoversData)

    // Read stats
    const statsData = await fs.readFile('public/data/stats.json', 'utf-8')
    const stats = JSON.parse(statsData)

    // Analyze books
    console.log(`📚 TOTAL BOOKS: ${books.length}`)
    console.log(`   Expected from stats.json: ${stats.totalBooks}`)
    console.log(`   ✅ Match: ${books.length === stats.totalBooks ? 'YES' : 'NO'}\n`)

    // Analyze episodes
    const episodes = new Set(books.map(book => 
      `S${book.episodeRef.seasonNumber}E${book.episodeRef.episodeNumber}: ${book.episodeRef.name}`
    ))
    console.log(`🎧 UNIQUE EPISODES: ${episodes.size}`)
    console.log('   Episodes list:')
    Array.from(episodes).sort().forEach(ep => console.log(`   - ${ep}`))
    console.log()

    // Analyze covers
    const localCovers = books.filter(book => book.coverUrl.startsWith('/covers/'))
    const externalCovers = books.filter(book => !book.coverUrl.startsWith('/covers/'))
    
    console.log(`🖼️  COVER ANALYSIS:`)
    console.log(`   Local covers (/covers/): ${localCovers.length}`)
    console.log(`   External covers: ${externalCovers.length}`)
    console.log(`   Manual covers available: ${Object.keys(manualCovers).length}`)
    console.log()

    // Check for actual cover files
    const coverFiles = await fs.readdir('public/covers')
    const jpgFiles = coverFiles.filter(file => file.endsWith('.jpg'))
    console.log(`📁 ACTUAL COVER FILES: ${jpgFiles.length}`)
    console.log()

    // Analyze categories
    const categories = new Set(books.map(book => book.category))
    console.log(`🏷️  CATEGORIES: ${categories.size}`)
    categories.forEach(cat => {
      const count = books.filter(book => book.category === cat).length
      console.log(`   - ${cat}: ${count} books`)
    })
    console.log()

    // Analyze ASINs/IDs
    const asinPattern = /^[0-9B][0-9A-Z]{9}$/
    const validASINs = books.filter(book => asinPattern.test(book.id))
    console.log(`🔖 AMAZON ASINs: ${validASINs.length} / ${books.length}`)
    console.log()

    // List all unique data that needs preservation
    console.log('🔒 DATA PRESERVATION CHECKLIST:')
    console.log('================================')
    console.log(`✅ ${books.length} books with full metadata`)
    console.log(`✅ ${episodes.size} unique episodes`)
    console.log(`✅ ${localCovers.length} local cover references`)
    console.log(`✅ ${jpgFiles.length} actual cover image files`)
    console.log(`✅ ${Object.keys(manualCovers).length} manual cover overrides`)
    console.log(`✅ ${categories.size} book categories`)
    console.log(`✅ All Amazon URLs and ASINs`)
    console.log()

    // Generate preservation report
    const preservationReport = {
      totalBooks: books.length,
      uniqueEpisodes: episodes.size,
      episodesList: Array.from(episodes).sort(),
      localCovers: localCovers.length,
      actualCoverFiles: jpgFiles.length,
      manualCoversCount: Object.keys(manualCovers).length,
      categories: Array.from(categories),
      booksPerCategory: Object.fromEntries(
        Array.from(categories).map(cat => [
          cat, 
          books.filter(book => book.category === cat).length
        ])
      ),
      sampleBooks: books.slice(0, 3), // First 3 books as examples
      timestamp: new Date().toISOString()
    }

    await fs.writeFile(
      'data/preservation-report.json',
      JSON.stringify(preservationReport, null, 2)
    )

    console.log('📄 Preservation report saved to: data/preservation-report.json')
    console.log('\n✅ READY FOR MIGRATION - All data catalogued and ready to preserve!')

  } catch (error) {
    console.error('❌ Error analyzing data:', error)
  }
}

analyzeCurrentData()