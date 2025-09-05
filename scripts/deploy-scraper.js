#!/usr/bin/env node

/**
 * Deployment script for Render.com
 * This script runs the weekly scraper and then deploys any new data to the main website
 */

import { WeeklyScraper } from './weekly-scraper.js'
import { execSync } from 'child_process'
import fs from 'fs/promises'
import path from 'path'

async function deployScraperResults() {
  console.log('🚀 Starting Render deployment script...')
  
  try {
    // Run the weekly scraper
    const scraper = new WeeklyScraper()
    await scraper.run()
    
    // Check if any files were modified
    const booksFile = path.join(process.cwd(), 'public', 'data', 'books.json')
    
    try {
      const stats = await fs.stat(booksFile)
      const fileAge = Date.now() - stats.mtime.getTime()
      const fiveMinutes = 5 * 60 * 1000
      
      if (fileAge < fiveMinutes) {
        console.log('📚 New books were added! Files were recently modified.')
        
        // If running in a Git environment, commit and push the changes
        try {
          console.log('📝 Committing new book data...')
          
          // Check if we're in a git repository
          execSync('git status', { stdio: 'pipe' })
          
          // Add the modified files
          execSync('git add public/data/books.json data/last-scraper-run.json', { stdio: 'inherit' })
          
          // Create a commit with the current timestamp
          const timestamp = new Date().toISOString().split('T')[0]
          execSync(`git commit -m "🤖 Weekly scraper update - ${timestamp}"`, { stdio: 'inherit' })
          
          console.log('✅ Changes committed successfully')
          
          // Note: In a Render environment, you might want to trigger a webhook
          // to redeploy the main website, or use Render's API to trigger a deployment
          
        } catch (gitError) {
          console.log('⚠️ Git operations failed or not in a git repo:', gitError.message)
          console.log('📄 New data is available in the files but not committed')
        }
      } else {
        console.log('📚 No new books were added during this run.')
      }
    } catch (error) {
      console.log('⚠️ Could not check file modification time:', error.message)
    }
    
    console.log('✅ Deployment script completed successfully')
    
  } catch (error) {
    console.error('❌ Deployment script failed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  deployScraperResults()
}