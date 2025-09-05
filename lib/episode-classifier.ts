/**
 * Episode Classifier
 * Intelligently identifies episode types to optimize scraping strategy
 */

enum EpisodeType {
  REGULAR = 'regular',        // Standard episodes with source documents
  INTERVIEW = 'interview',    // Interview episodes (usually no sources)
  SPECIAL = 'special',        // Holiday specials, live events, etc
  ACQ2 = 'acq2',             // ACQ2 episodes (different format)
  UNKNOWN = 'unknown'         // Needs manual classification
}

interface EpisodeClassification {
  type: EpisodeType
  confidence: number
  reasoning: string[]
  shouldSkip: boolean
  expectedSources: boolean
}

class EpisodeClassifier {
  private readonly interviewKeywords = [
    'interview',
    'conversation with',
    'talk with',
    'fireside chat',
    'q&a with',
    'discussion with'
  ]

  private readonly specialKeywords = [
    'holiday special',
    'acquired live',
    'live from',
    'special episode',
    'year-end',
    'annual',
    'celebration'
  ]

  private readonly regularPatterns = [
    /^[A-Z][^:]*: The Complete History/i,
    /^[A-Z][^:]*: The Story/i,
    /^\w+: Volume \w+/i,
    /^\w+ \w+$/  // Two words typically indicate company names
  ]

  /**
   * Classify an episode based on its title and metadata
   */
  classify(title: string, description?: string): EpisodeClassification {
    const reasoning: string[] = []
    let type = EpisodeType.UNKNOWN
    let confidence = 0
    let shouldSkip = false
    let expectedSources = false

    const lowerTitle = title.toLowerCase()
    const lowerDesc = (description || '').toLowerCase()
    const combined = `${lowerTitle} ${lowerDesc}`.trim()

    // Check for interview episodes
    if (this.isInterview(combined, reasoning)) {
      type = EpisodeType.INTERVIEW
      confidence = 0.9
      shouldSkip = true
      expectedSources = false
    }
    // Check for special episodes
    else if (this.isSpecial(combined, reasoning)) {
      type = EpisodeType.SPECIAL
      confidence = 0.8
      shouldSkip = true
      expectedSources = false
    }
    // Check for ACQ2 episodes
    else if (this.isACQ2(combined, reasoning)) {
      type = EpisodeType.ACQ2
      confidence = 0.7
      shouldSkip = true
      expectedSources = false
    }
    // Check for regular episodes
    else if (this.isRegular(title, reasoning)) {
      type = EpisodeType.REGULAR
      confidence = 0.8
      shouldSkip = false
      expectedSources = true
    }
    else {
      // Unknown type - err on the side of processing
      reasoning.push('Does not match known patterns, treating as regular episode')
      type = EpisodeType.REGULAR
      confidence = 0.3
      shouldSkip = false
      expectedSources = true
    }

    return {
      type,
      confidence,
      reasoning,
      shouldSkip,
      expectedSources
    }
  }

  /**
   * Batch classify multiple episodes
   */
  classifyBatch(episodes: Array<{ title: string; description?: string }>): EpisodeClassification[] {
    return episodes.map(ep => this.classify(ep.title, ep.description))
  }

  /**
   * Get processing recommendation based on classification
   */
  getProcessingRecommendation(classification: EpisodeClassification): {
    shouldProcess: boolean
    priority: 'high' | 'medium' | 'low' | 'skip'
    delay: number // milliseconds
    maxRetries: number
  } {
    switch (classification.type) {
      case EpisodeType.REGULAR:
        return {
          shouldProcess: true,
          priority: 'high',
          delay: 0, // Process immediately
          maxRetries: 2
        }

      case EpisodeType.INTERVIEW:
        return {
          shouldProcess: false,
          priority: 'skip',
          delay: -1,
          maxRetries: 0
        }

      case EpisodeType.SPECIAL:
        return {
          shouldProcess: classification.expectedSources,
          priority: classification.expectedSources ? 'low' : 'skip',
          delay: classification.expectedSources ? 60 * 60 * 1000 : -1, // 1 hour delay if processing
          maxRetries: 1
        }

      case EpisodeType.ACQ2:
        return {
          shouldProcess: false,
          priority: 'skip',
          delay: -1,
          maxRetries: 0
        }

      default:
        return {
          shouldProcess: true,
          priority: 'medium',
          delay: 30 * 60 * 1000, // 30 minute delay for unknown types
          maxRetries: 1
        }
    }
  }

  /**
   * Check if episode is an interview
   */
  private isInterview(text: string, reasoning: string[]): boolean {
    for (const keyword of this.interviewKeywords) {
      if (text.includes(keyword)) {
        reasoning.push(`Contains interview keyword: "${keyword}"`)
        return true
      }
    }

    // Check for common interview patterns
    if (text.match(/with [A-Z][a-z]+ [A-Z][a-z]+/)) {
      reasoning.push('Contains "with [Name]" pattern typical of interviews')
      return true
    }

    if (text.match(/the .+ interview/i)) {
      reasoning.push('Title ends with "Interview"')
      return true
    }

    return false
  }

  /**
   * Check if episode is a special episode
   */
  private isSpecial(text: string, reasoning: string[]): boolean {
    for (const keyword of this.specialKeywords) {
      if (text.includes(keyword)) {
        reasoning.push(`Contains special episode keyword: "${keyword}"`)
        return true
      }
    }

    // Check for event-based episodes
    if (text.match(/live from [A-Z]/i)) {
      reasoning.push('Contains "Live from [Location]" pattern')
      return true
    }

    return false
  }

  /**
   * Check if episode is ACQ2
   */
  private isACQ2(text: string, reasoning: string[]): boolean {
    if (text.includes('acq2')) {
      reasoning.push('Contains "ACQ2" identifier')
      return true
    }

    // Additional ACQ2 patterns could be added here
    return false
  }

  /**
   * Check if episode is a regular company/topic episode
   */
  private isRegular(title: string, reasoning: string[]): boolean {
    // Check against regular episode patterns
    for (const pattern of this.regularPatterns) {
      if (pattern.test(title)) {
        reasoning.push(`Matches regular episode pattern: ${pattern.source}`)
        return true
      }
    }

    // Check for company name patterns (single word + optional descriptor)
    if (title.match(/^[A-Z][a-z]+( [A-Z][a-z]+)?$/)) {
      reasoning.push('Matches company name pattern')
      return true
    }

    // Check for typical business/tech topics
    const businessWords = ['inc', 'corp', 'company', 'technologies', 'systems', 'group']
    for (const word of businessWords) {
      if (title.toLowerCase().includes(word)) {
        reasoning.push(`Contains business identifier: "${word}"`)
        return true
      }
    }

    return false
  }

  /**
   * Update classification based on processing results
   */
  updateClassification(
    title: string, 
    originalClassification: EpisodeClassification,
    hasGoogleDoc: boolean,
    foundBooks: number = 0
  ): EpisodeClassification {
    const updated = { ...originalClassification }
    
    // Update confidence based on actual findings
    if (hasGoogleDoc && foundBooks > 0) {
      if (updated.type === EpisodeType.REGULAR) {
        updated.confidence = Math.min(1.0, updated.confidence + 0.1)
        updated.reasoning.push(`Confirmed: Found ${foundBooks} books in sources`)
      } else {
        // Unexpected sources found
        updated.type = EpisodeType.REGULAR
        updated.confidence = 0.7
        updated.reasoning.push(`Reclassified: Unexpectedly found ${foundBooks} books`)
        updated.expectedSources = true
        updated.shouldSkip = false
      }
    } else if (!hasGoogleDoc) {
      if (updated.type === EpisodeType.INTERVIEW || updated.type === EpisodeType.SPECIAL) {
        updated.confidence = Math.min(1.0, updated.confidence + 0.1)
        updated.reasoning.push('Confirmed: No sources found as expected')
      } else {
        // Expected sources but none found
        updated.confidence = Math.max(0.1, updated.confidence - 0.2)
        updated.reasoning.push('Warning: Expected sources but none found')
      }
    }

    return updated
  }
}

export { EpisodeClassifier, EpisodeType, type EpisodeClassification }