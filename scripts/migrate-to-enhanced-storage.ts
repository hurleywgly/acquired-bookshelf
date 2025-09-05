#!/usr/bin/env node

/**
 * Migration script to enhanced storage structure
 * PRESERVES ALL EXISTING DATA while adding optimization features
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { getBookMetadata, getAmazonBookCover } from '../lib/openLibrary.js'

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

interface EnhancedBook {
  id: string
  title: string
  author: string
  amazonUrl: string
  category: string
  covers: {
    openLibrary?: string
    amazon?: string
    local?: string
    optimized: string
    fallbackChain: string[]
  }
  metadata: {
    isbn?: string
    firstPublishYear?: number
    subjects?: string[]
    olid?: string
  }
  episodeRef: {
    name: string
    seasonNumber: number
    episodeNumber: number
  }
  addedAt: string
  source: 'manual' | 'automated'
  migrated: true
}

class StorageMigrator {
  private preservationReport: any
  private currentBooks: CurrentBook[] = []
  private manualCovers: any = {}
  private enhancedBooks: EnhancedBook[] = []

  async migrate(): Promise<void> {
    console.log('🚀 STARTING ENHANCED STORAGE MIGRATION')
    console.log('=====================================\n')

    // Load preservation report
    await this.loadPreservationData()
    
    // Load current data
    await this.loadCurrentData()
    
    // Verify data integrity before migration
    await this.verifyDataIntegrity()
    
    // Perform migration
    await this.performMigration()
    
    // Verify migration results
    await this.verifyMigrationResults()
    
    // Save enhanced data
    await this.saveEnhancedData()
    
    console.log('\n🎉 MIGRATION COMPLETED SUCCESSFULLY!')
    console.log('All data preserved and enhanced with optimization features.')
  }

  private async loadPreservationData(): Promise<void> {
    console.log('📄 Loading preservation report...')
    const reportData = await fs.readFile('data/preservation-report.json', 'utf-8')
    this.preservationReport = JSON.parse(reportData)
    console.log(`✅ Loaded preservation data for ${this.preservationReport.totalBooks} books\n`)
  }

  private async loadCurrentData(): Promise<void> {
    console.log('📚 Loading current data...')
    
    // Load books
    const booksData = await fs.readFile('public/data/books.json', 'utf-8')
    this.currentBooks = JSON.parse(booksData)
    
    // Load manual covers
    const manualCoversData = await fs.readFile('data/manual-covers.json', 'utf-8')
    this.manualCovers = JSON.parse(manualCoversData)
    
    console.log(`✅ Loaded ${this.currentBooks.length} books`)
    console.log(`✅ Loaded ${Object.keys(this.manualCovers).length} manual covers\n`)
  }

  private async verifyDataIntegrity(): Promise<void> {
    console.log('🔍 VERIFYING DATA INTEGRITY')
    console.log('============================')
    
    const issues: string[] = []
    
    // Check book count
    if (this.currentBooks.length !== this.preservationReport.totalBooks) {
      issues.push(`Book count mismatch: ${this.currentBooks.length} vs ${this.preservationReport.totalBooks}`)
    } else {
      console.log(`✅ Book count: ${this.currentBooks.length}`)
    }
    
    // Check episodes
    const currentEpisodes = new Set(this.currentBooks.map(book => 
      `S${book.episodeRef.seasonNumber}E${book.episodeRef.episodeNumber}: ${book.episodeRef.name}`
    ))
    if (currentEpisodes.size !== this.preservationReport.uniqueEpisodes) {
      issues.push(`Episode count mismatch: ${currentEpisodes.size} vs ${this.preservationReport.uniqueEpisodes}`)
    } else {
      console.log(`✅ Episodes: ${currentEpisodes.size}`)
    }
    
    // Check local covers
    const localCovers = this.currentBooks.filter(book => book.coverUrl.startsWith('/covers/'))
    if (localCovers.length !== this.preservationReport.localCovers) {
      issues.push(`Local cover count mismatch: ${localCovers.length} vs ${this.preservationReport.localCovers}`)
    } else {
      console.log(`✅ Local covers: ${localCovers.length}`)
    }
    
    // Check categories
    const categories = new Set(this.currentBooks.map(book => book.category))
    if (categories.size !== this.preservationReport.categories.length) {
      issues.push(`Category count mismatch: ${categories.size} vs ${this.preservationReport.categories.length}`)
    } else {
      console.log(`✅ Categories: ${categories.size}`)
    }
    
    if (issues.length > 0) {
      console.error('\n❌ DATA INTEGRITY ISSUES:')
      issues.forEach(issue => console.error(`   - ${issue}`))
      throw new Error('Data integrity check failed')
    }
    
    console.log('\n✅ DATA INTEGRITY VERIFIED - Safe to proceed with migration\n')
  }

  private async performMigration(): Promise<void> {
    console.log('🔄 PERFORMING MIGRATION')
    console.log('=======================')
    
    let processed = 0
    
    for (const book of this.currentBooks) {
      processed++
      console.log(`\n📖 Processing ${processed}/${this.currentBooks.length}: "${book.title}"`)
      
      // Create enhanced book structure
      const enhancedBook: EnhancedBook = {
        id: book.id,
        title: book.title,
        author: book.author,
        amazonUrl: book.amazonUrl,
        category: book.category,
        covers: {
          optimized: book.coverUrl, // Keep current as default
          fallbackChain: []
        },
        metadata: {
          subjects: []
        },
        episodeRef: book.episodeRef,
        addedAt: new Date().toISOString(),
        source: 'manual', // Existing books are manually curated
        migrated: true
      }

      // Build cover fallback chain
      await this.buildCoverFallbackChain(book, enhancedBook)
      
      // Try to get enhanced metadata from Open Library if possible
      await this.enhanceMetadata(book, enhancedBook)
      
      this.enhancedBooks.push(enhancedBook)
    }
    
    console.log(`\n✅ Successfully migrated ${this.enhancedBooks.length} books`)
  }

  private async buildCoverFallbackChain(currentBook: CurrentBook, enhancedBook: EnhancedBook): Promise<void> {
    const covers = enhancedBook.covers
    const fallbackChain: string[] = []
    
    // 1. Check if local cover exists
    if (currentBook.coverUrl.startsWith('/covers/')) {
      covers.local = currentBook.coverUrl
      fallbackChain.push(currentBook.coverUrl)
    }
    
    // 2. Check manual covers override
    if (this.manualCovers[currentBook.id]) {
      const manualCover = this.manualCovers[currentBook.id].coverUrl
      if (manualCover) {
        covers.local = manualCover
        if (!fallbackChain.includes(manualCover)) {
          fallbackChain.unshift(manualCover) // Higher priority
        }
      }
    }
    
    // 3. Try to get Amazon cover
    try {
      const amazonCover = await getAmazonBookCover(currentBook.amazonUrl)
      if (amazonCover) {
        covers.amazon = amazonCover
        fallbackChain.unshift(amazonCover) // Even higher priority
        console.log(`   📸 Found Amazon cover`)
      }
    } catch (error) {
      console.log(`   ⚠️ Could not get Amazon cover`)
    }
    
    // 4. Set optimized cover (best available)
    covers.optimized = fallbackChain[0] || currentBook.coverUrl
    covers.fallbackChain = fallbackChain.length > 0 ? fallbackChain : [currentBook.coverUrl]
    
    console.log(`   🖼️ Cover chain: ${covers.fallbackChain.length} options`)
  }

  private async enhanceMetadata(currentBook: CurrentBook, enhancedBook: EnhancedBook): Promise<void> {
    try {
      // Try to get metadata from Open Library
      const metadata = await getBookMetadata(currentBook.amazonUrl)
      if (metadata) {
        enhancedBook.metadata = {
          isbn: metadata.isbn || currentBook.id,
          firstPublishYear: metadata.firstPublishYear,
          subjects: metadata.subjects || [],
          olid: metadata.olid
        }
        
        // If Open Library has a cover and we don't have Amazon, use it
        if (metadata.coverUrl && !enhancedBook.covers.amazon) {
          enhancedBook.covers.openLibrary = metadata.coverUrl
          enhancedBook.covers.fallbackChain.unshift(metadata.coverUrl)
          enhancedBook.covers.optimized = metadata.coverUrl
        }
        
        console.log(`   📚 Enhanced with Open Library metadata`)
      }
    } catch (error) {
      console.log(`   ⚠️ Could not enhance metadata`)
    }
  }

  private async verifyMigrationResults(): Promise<void> {
    console.log('\n🔍 VERIFYING MIGRATION RESULTS')
    console.log('==============================')
    
    const issues: string[] = []
    
    // Check all books migrated
    if (this.enhancedBooks.length !== this.currentBooks.length) {
      issues.push(`Book count mismatch after migration: ${this.enhancedBooks.length} vs ${this.currentBooks.length}`)
    } else {
      console.log(`✅ All ${this.enhancedBooks.length} books migrated`)
    }
    
    // Check all IDs preserved
    const originalIds = new Set(this.currentBooks.map(b => b.id))
    const migratedIds = new Set(this.enhancedBooks.map(b => b.id))
    const missingIds = [...originalIds].filter(id => !migratedIds.has(id))
    if (missingIds.length > 0) {
      issues.push(`Missing book IDs after migration: ${missingIds.join(', ')}`)
    } else {
      console.log(`✅ All book IDs preserved`)
    }
    
    // Check all episodes preserved
    const originalEpisodes = new Set(this.currentBooks.map(book => 
      `${book.episodeRef.seasonNumber}-${book.episodeRef.episodeNumber}`
    ))
    const migratedEpisodes = new Set(this.enhancedBooks.map(book => 
      `${book.episodeRef.seasonNumber}-${book.episodeRef.episodeNumber}`
    ))
    if (originalEpisodes.size !== migratedEpisodes.size) {
      issues.push(`Episode count mismatch: ${originalEpisodes.size} vs ${migratedEpisodes.size}`)
    } else {
      console.log(`✅ All ${originalEpisodes.size} episodes preserved`)
    }
    
    // Check cover preservation
    const booksWithCovers = this.enhancedBooks.filter(book => 
      book.covers.fallbackChain.length > 0
    )
    if (booksWithCovers.length !== this.enhancedBooks.length) {
      issues.push(`Some books missing cover fallback chains`)
    } else {
      console.log(`✅ All books have cover fallback chains`)
    }
    
    if (issues.length > 0) {
      console.error('\n❌ MIGRATION VERIFICATION FAILED:')
      issues.forEach(issue => console.error(`   - ${issue}`))
      throw new Error('Migration verification failed')
    }
    
    console.log('\n✅ MIGRATION VERIFICATION PASSED')
    
    // Generate summary statistics
    const withAmazonCovers = this.enhancedBooks.filter(b => b.covers.amazon).length
    const withOpenLibraryCovers = this.enhancedBooks.filter(b => b.covers.openLibrary).length
    const withLocalCovers = this.enhancedBooks.filter(b => b.covers.local).length
    const withEnhancedMetadata = this.enhancedBooks.filter(b => 
      b.metadata.subjects && b.metadata.subjects.length > 0
    ).length
    
    console.log('\n📊 ENHANCEMENT SUMMARY:')
    console.log(`   📸 Amazon covers: ${withAmazonCovers}`)
    console.log(`   📚 Open Library covers: ${withOpenLibraryCovers}`)
    console.log(`   💾 Local covers: ${withLocalCovers}`)
    console.log(`   📖 Enhanced metadata: ${withEnhancedMetadata}`)
  }

  private async saveEnhancedData(): Promise<void> {
    console.log('\n💾 SAVING ENHANCED DATA')
    console.log('=======================')
    
    // Create backup of original data
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    await fs.copyFile('public/data/books.json', `data/books-backup-${timestamp}.json`)
    console.log(`✅ Created backup: data/books-backup-${timestamp}.json`)
    
    // Save enhanced books
    await fs.writeFile(
      'public/data/books-enhanced.json',
      JSON.stringify(this.enhancedBooks, null, 2)
    )
    console.log(`✅ Saved enhanced data: public/data/books-enhanced.json`)
    
    // Update stats
    const enhancedStats = {
      totalBooks: this.enhancedBooks.length,
      uniqueEpisodes: new Set(this.enhancedBooks.map(book => 
        `${book.episodeRef.seasonNumber}-${book.episodeRef.episodeNumber}`
      )).size,
      coverSources: {
        amazon: this.enhancedBooks.filter(b => b.covers.amazon).length,
        openLibrary: this.enhancedBooks.filter(b => b.covers.openLibrary).length,
        local: this.enhancedBooks.filter(b => b.covers.local).length
      },
      enhancedMetadata: this.enhancedBooks.filter(b => 
        b.metadata.subjects && b.metadata.subjects.length > 0
      ).length,
      lastUpdated: new Date().toISOString(),
      migrationDate: new Date().toISOString()
    }
    
    await fs.writeFile(
      'public/data/stats-enhanced.json',
      JSON.stringify(enhancedStats, null, 2)
    )
    console.log(`✅ Saved enhanced stats: public/data/stats-enhanced.json`)
    
    // Generate migration report
    const migrationReport = {
      originalBookCount: this.currentBooks.length,
      migratedBookCount: this.enhancedBooks.length,
      preservationReport: this.preservationReport,
      enhancementStats: enhancedStats,
      migrationDate: new Date().toISOString(),
      status: 'completed'
    }
    
    await fs.writeFile(
      'data/migration-report.json',
      JSON.stringify(migrationReport, null, 2)
    )
    console.log(`✅ Saved migration report: data/migration-report.json`)
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const migrator = new StorageMigrator()
  migrator.migrate().catch(error => {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  })
}

export { StorageMigrator }