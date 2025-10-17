/**
 * RSS Monitor for Acquired Podcast
 * Efficiently detects new episodes using RSS feed with adaptive delays
 */

import { XMLParser } from 'fast-xml-parser'
import * as fs from 'fs/promises'
import * as path from 'path'

interface RSSEpisode {
  id: string
  title: string
  link: string
  pubDate: Date
  guid: string
  description?: string
}

interface EpisodeProcessing {
  episode: RSSEpisode
  detectedAt: number
  processAfter: number
  retryCount: number
  hasGoogleDoc?: boolean
  episodeType?: EpisodeType
}

interface RSSItem {
  title?: string
  link?: string
  pubDate?: string
  guid?: string | { '#text': string }
  description?: string
}

enum EpisodeType {
  REGULAR = 'regular',        // Has sources doc
  INTERVIEW = 'interview',    // No sources doc
  SPECIAL = 'special',        // Holiday specials, etc
  UNKNOWN = 'unknown'         // Needs checking
}

class RSSMonitor {
  private rssUrl = 'https://feeds.transistor.fm/acquired'
  private dataDir: string
  private pendingEpisodesFile: string
  private lastCheckFile: string
  private xmlParser: XMLParser

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data')
    this.pendingEpisodesFile = path.join(this.dataDir, 'pending-episodes.json')
    this.lastCheckFile = path.join(this.dataDir, 'last-rss-check.json')
    
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: true,
      parseAttributeValue: true,
      trimValues: true
    })
  }

  /**
   * Check RSS feed for new episodes and queue them for processing
   */
  async checkForNewEpisodes(): Promise<EpisodeProcessing[]> {
    console.log('🔍 Checking RSS feed for new episodes...')
    
    try {
      // Fetch RSS feed
      const rssData = await this.fetchRSSFeed()
      if (!rssData) {
        console.log('❌ Failed to fetch RSS feed')
        return []
      }

      // Parse episodes from RSS
      const episodes = this.parseRSSFeed(rssData)
      console.log(`📡 Found ${episodes.length} episodes in RSS feed`)

      // Get last check timestamp
      const lastCheck = await this.getLastCheckTime()
      
      // Find new episodes since last check
      const newEpisodes = episodes.filter(episode => {
        return episode.pubDate > lastCheck
      })

      if (newEpisodes.length === 0) {
        console.log('✅ No new episodes found')
        await this.updateLastCheckTime()
        return []
      }

      console.log(`🆕 Found ${newEpisodes.length} new episodes`)
      newEpisodes.forEach(ep => {
        console.log(`  - ${ep.title} (${ep.pubDate.toDateString()})`)
      })

      // Queue episodes for processing with adaptive delays
      const queuedEpisodes = this.queueEpisodesForProcessing(newEpisodes)
      
      // Save pending episodes and update last check
      await this.savePendingEpisodes(queuedEpisodes)
      await this.updateLastCheckTime()

      return queuedEpisodes

    } catch (error) {
      console.error('❌ Error checking RSS feed:', error)
      return []
    }
  }

  /**
   * Get episodes that are ready for processing
   */
  async getReadyEpisodes(): Promise<EpisodeProcessing[]> {
    try {
      const pendingEpisodes = await this.loadPendingEpisodes()
      const now = Date.now()
      
      // Filter episodes that are ready to process
      const readyEpisodes = pendingEpisodes.filter(ep => now >= ep.processAfter)
      
      if (readyEpisodes.length > 0) {
        console.log(`📋 Found ${readyEpisodes.length} episodes ready for processing`)
        readyEpisodes.forEach(ep => {
          console.log(`  - ${ep.episode.title} (retry: ${ep.retryCount})`)
        })
      }

      return readyEpisodes
    } catch (error) {
      console.error('Error getting ready episodes:', error)
      return []
    }
  }

  /**
   * Mark episode as processed successfully
   */
  async markEpisodeProcessed(episodeId: string): Promise<void> {
    try {
      const pendingEpisodes = await this.loadPendingEpisodes()
      const updatedEpisodes = pendingEpisodes.filter(ep => ep.episode.id !== episodeId)
      await this.savePendingEpisodes(updatedEpisodes)
      console.log(`✅ Marked episode ${episodeId} as processed`)
    } catch (error) {
      console.error('Error marking episode as processed:', error)
    }
  }

  /**
   * Requeue episode with delay after failed processing
   */
  async requeueEpisode(episodeId: string, hasGoogleDoc: boolean = false): Promise<void> {
    try {
      const pendingEpisodes = await this.loadPendingEpisodes()
      const episodeIndex = pendingEpisodes.findIndex(ep => ep.episode.id === episodeId)
      
      if (episodeIndex === -1) {
        console.log(`Episode ${episodeId} not found in pending queue`)
        return
      }

      const episode = pendingEpisodes[episodeIndex]
      episode.retryCount++
      episode.hasGoogleDoc = hasGoogleDoc

      // If no Google Doc found and it's likely an interview, remove from queue
      if (!hasGoogleDoc && episode.episodeType === EpisodeType.INTERVIEW && episode.retryCount >= 2) {
        console.log(`🚫 Removing interview episode from queue: ${episode.episode.title}`)
        pendingEpisodes.splice(episodeIndex, 1)
      } else if (episode.retryCount >= 3) {
        // Max retries reached, remove from queue
        console.log(`🚫 Max retries reached for episode: ${episode.episode.title}`)
        pendingEpisodes.splice(episodeIndex, 1)
      } else {
        // Requeue with 2-hour delay
        const twoHours = 2 * 60 * 60 * 1000
        episode.processAfter = Date.now() + twoHours
        console.log(`♻️ Requeued episode ${episode.episode.title} for retry in 2 hours`)
      }

      await this.savePendingEpisodes(pendingEpisodes)
    } catch (error) {
      console.error('Error requeuing episode:', error)
    }
  }

  /**
   * Classify episode type based on title
   */
  private classifyEpisode(title: string): EpisodeType {
    const lowerTitle = title.toLowerCase()
    
    if (lowerTitle.includes('interview')) {
      return EpisodeType.INTERVIEW
    }
    
    if (lowerTitle.includes('holiday special') || 
        lowerTitle.includes('acquired live') ||
        lowerTitle.includes('special episode')) {
      return EpisodeType.SPECIAL
    }
    
    // Most episodes are regular episodes with sources
    return EpisodeType.REGULAR
  }

  /**
   * Determine processing delay based on episode type and retry count
   */
  private getProcessingDelay(episode: RSSEpisode, retryCount: number = 0): number {
    const episodeType = this.classifyEpisode(episode.title)
    
    // Interview episodes - skip entirely after first check
    if (episodeType === EpisodeType.INTERVIEW && retryCount > 0) {
      return -1 // Flag to skip
    }
    
    // First attempt - immediate for regular episodes
    if (retryCount === 0) {
      return 0 // Process immediately
    }
    
    // Retry with 2-hour delay if no sources found
    return 2 * 60 * 60 * 1000 // 2 hours
  }

  /**
   * Queue episodes for processing with adaptive delays
   */
  private queueEpisodesForProcessing(episodes: RSSEpisode[]): EpisodeProcessing[] {
    const now = Date.now()
    
    return episodes.map(episode => {
      const episodeType = this.classifyEpisode(episode.title)
      const delay = this.getProcessingDelay(episode, 0)
      
      // Skip interview episodes entirely
      if (episodeType === EpisodeType.INTERVIEW) {
        console.log(`  🎤 Skipping interview episode: ${episode.title}`)
        return null
      }

      const processing: EpisodeProcessing = {
        episode,
        detectedAt: now,
        processAfter: now + delay,
        retryCount: 0,
        episodeType
      }

      const delayMinutes = delay / (1000 * 60)
      console.log(`  📅 Queued: ${episode.title} (${delayMinutes > 0 ? `${delayMinutes}min delay` : 'immediate'})`)
      
      return processing
    }).filter(ep => ep !== null) as EpisodeProcessing[]
  }

  /**
   * Fetch RSS feed with conditional requests
   */
  private async fetchRSSFeed(): Promise<string | null> {
    try {
      const response = await fetch(this.rssUrl, {
        headers: {
          'User-Agent': 'Acquired Bookshelf Scraper/1.0',
          'Accept': 'application/rss+xml, application/xml, text/xml'
        }
      })

      if (!response.ok) {
        console.error(`RSS fetch failed: ${response.status} ${response.statusText}`)
        return null
      }

      return await response.text()
    } catch (error) {
      console.error('Error fetching RSS feed:', error)
      return null
    }
  }

  /**
   * Parse RSS feed XML and extract episode data
   */
  private parseRSSFeed(xmlData: string): RSSEpisode[] {
    try {
      const parsed = this.xmlParser.parse(xmlData)
      const items = parsed.rss?.channel?.item || []

      return items.map((item: RSSItem) => {
        // Create unique ID from GUID or link
        const guid = typeof item.guid === 'object' && item.guid !== null
          ? item.guid['#text']
          : (item.guid ?? item.link ?? '')
        const id = guid.split('/').pop() || `episode-${Date.now()}`
        
        return {
          id,
          title: item.title || 'Unknown Title',
          link: item.link || '',
          pubDate: new Date(item.pubDate || Date.now()),
          guid,
          description: item.description || ''
        }
      })
    } catch (error) {
      console.error('Error parsing RSS feed:', error)
      return []
    }
  }

  /**
   * Load pending episodes from file
   */
  private async loadPendingEpisodes(): Promise<EpisodeProcessing[]> {
    try {
      const data = await fs.readFile(this.pendingEpisodesFile, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      // File doesn't exist or is invalid
      return []
    }
  }

  /**
   * Save pending episodes to file
   */
  private async savePendingEpisodes(episodes: EpisodeProcessing[]): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true })
      await fs.writeFile(
        this.pendingEpisodesFile, 
        JSON.stringify(episodes, null, 2)
      )
    } catch (error) {
      console.error('Error saving pending episodes:', error)
    }
  }

  /**
   * Get last RSS check timestamp
   */
  private async getLastCheckTime(): Promise<Date> {
    try {
      const data = await fs.readFile(this.lastCheckFile, 'utf-8')
      const parsed = JSON.parse(data)
      return new Date(parsed.timestamp)
    } catch (error) {
      // No previous check, return date from 1 week ago
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
      return oneWeekAgo
    }
  }

  /**
   * Update last RSS check timestamp
   */
  private async updateLastCheckTime(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true })
      await fs.writeFile(
        this.lastCheckFile,
        JSON.stringify({ timestamp: new Date().toISOString() }, null, 2)
      )
    } catch (error) {
      console.error('Error updating last check time:', error)
    }
  }
}

export { RSSMonitor, type RSSEpisode, type EpisodeProcessing, EpisodeType }