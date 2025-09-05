#!/usr/bin/env node

/**
 * Test script for the weekly scraper using the Indian Premier League Cricket episode
 */

import { WeeklyScraper } from './weekly-scraper.js'
import { getBatchBookMetadata } from '../lib/openLibrary.js'
import * as cheerio from 'cheerio'

class ScraperTester {
  private scraper: WeeklyScraper

  constructor() {
    this.scraper = new WeeklyScraper()
  }

  async testIPLEpisode(): Promise<void> {
    console.log('🏏 Testing scraper with Indian Premier League Cricket episode...')
    
    const testEpisode = {
      id: '2025-1',
      name: 'Indian Premier League Cricket',
      seasonNumber: 2025,
      episodeNumber: 1,
      sourceUrl: 'https://www.acquired.fm/episodes/indian-premier-league-cricket',
      date: '2025-01-01',
      page: 1,
      fetchedAt: new Date().toISOString()
    }

    try {
      // Test finding Google Doc link
      console.log('\n1️⃣ Testing Google Doc link extraction...')
      const googleDocUrl = await this.findGoogleDocLink(testEpisode.sourceUrl)
      
      if (googleDocUrl) {
        console.log(`✅ Found Google Doc: ${googleDocUrl}`)
        
        // Test extracting Amazon links
        console.log('\n2️⃣ Testing Amazon link extraction...')
        const amazonLinks = await this.extractAmazonLinksFromGoogleDoc(googleDocUrl)
        
        if (amazonLinks.length > 0) {
          console.log(`✅ Found ${amazonLinks.length} Amazon links:`)
          amazonLinks.forEach((link, i) => {
            console.log(`   ${i + 1}. ${link}`)
          })
          
          // Test getting book metadata
          console.log('\n3️⃣ Testing book metadata extraction...')
          const metadata = await getBatchBookMetadata(amazonLinks.slice(0, 3)) // Test first 3 books
          
          metadata.forEach((book, i) => {
            if (book) {
              console.log(`✅ Book ${i + 1}: "${book.title}" by ${book.author}`)
              if (book.coverUrl) {
                console.log(`   Cover: ${book.coverUrl}`)
              }
            } else {
              console.log(`❌ Book ${i + 1}: No metadata found`)
            }
          })
          
        } else {
          console.log('❌ No Amazon links found in Google Doc')
        }
      } else {
        console.log('❌ No Google Doc link found on episode page')
      }
      
    } catch (error) {
      console.error('❌ Test failed:', error)
    }
  }

  private async findGoogleDocLink(episodeUrl: string): Promise<string | null> {
    try {
      const response = await fetch(episodeUrl)
      if (!response.ok) return null

      const html = await response.text()
      const $ = cheerio.load(html)

      let googleDocUrl: string | null = null

      // Look for "Episode sources" text and find nearby Google Doc links
      $('a').each((_, element) => {
        const href = $(element).attr('href')
        const text = $(element).text().toLowerCase()

        if (href && href.includes('docs.google.com')) {
          const linkText = text
          const parentText = $(element).parent().text().toLowerCase()
          const nearbyText = $(element).closest('p, div').text().toLowerCase()

          if (
            linkText.includes('episode sources') ||
            linkText.includes('sources') ||
            parentText.includes('episode sources') ||
            nearbyText.includes('episode sources')
          ) {
            googleDocUrl = href
            return false
          }
        }
      })

      // If no specific "Episode sources" link found, look for any Google Doc link
      if (!googleDocUrl) {
        $('a').each((_, element) => {
          const href = $(element).attr('href')
          if (href && href.includes('docs.google.com/document')) {
            googleDocUrl = href
            return false
          }
        })
      }

      return googleDocUrl
    } catch (error) {
      console.error('Error finding Google Doc link:', error)
      return null
    }
  }

  private async extractAmazonLinksFromGoogleDoc(googleDocUrl: string): Promise<string[]> {
    try {
      const docId = googleDocUrl.match(/\/document\/d\/([a-zA-Z0-9-_]+)/)?.[1]
      if (!docId) {
        console.error('Could not extract document ID from URL')
        return []
      }

      const exportUrls = [
        `https://docs.google.com/document/d/${docId}/export?format=html`,
        `https://docs.google.com/document/d/${docId}/pub`,
        googleDocUrl.replace('/edit', '/export?format=html')
      ]

      let html = ''
      let successUrl = ''
      
      for (const url of exportUrls) {
        try {
          console.log(`   Trying: ${url}`)
          const response = await fetch(url)
          if (response.ok) {
            html = await response.text()
            successUrl = url
            console.log(`   ✅ Success with: ${url}`)
            break
          } else {
            console.log(`   ❌ Failed with status: ${response.status}`)
          }
        } catch (error) {
          console.log(`   ❌ Failed with error: ${error.message}`)
          continue
        }
      }

      if (!html) {
        console.error('Could not fetch Google Doc content from any URL')
        return []
      }

      const $ = cheerio.load(html)
      const amazonLinks: string[] = []

      $('a').each((_, element) => {
        const href = $(element).attr('href')
        if (href && href.includes('amazon.com')) {
          let cleanUrl = href
          
          // Remove Google redirect wrapper
          if (href.includes('google.com/url?')) {
            const urlParam = new URLSearchParams(href.split('?')[1])
            cleanUrl = urlParam.get('url') || href
          }

          // Check if it's a book link
          if (cleanUrl.includes('/dp/') || cleanUrl.match(/\/[B][0-9A-Z]{9}/)) {
            amazonLinks.push(cleanUrl)
          }
        }
      })

      return [...new Set(amazonLinks)]
    } catch (error) {
      console.error('Error extracting Amazon links from Google Doc:', error)
      return []
    }
  }
}

// Run the test
const tester = new ScraperTester()
tester.testIPLEpisode().then(() => {
  console.log('\n🎉 Test completed!')
}).catch(error => {
  console.error('❌ Test failed:', error)
  process.exit(1)
})