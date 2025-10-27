/**
 * URL Validator
 * Security module to validate and sanitize URLs before making requests
 */

const ALLOWED_DOMAINS = [
  'www.acquired.fm',
  'docs.google.com',
  'openlibrary.org',
  'amazon.com',
  'www.amazon.com',
  'images-na.ssl-images-amazon.com',
  'm.media-amazon.com',
  'feeds.transistor.fm',
  'covers.openlibrary.org'
]

const ALLOWED_PROTOCOLS = ['http:', 'https:']

const BLOCKED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  '169.254.169.254' // AWS metadata service
]

interface ValidationResult {
  isValid: boolean
  sanitizedUrl?: string
  error?: string
  warnings: string[]
}

class URLValidator {
  /**
   * Validate and sanitize a URL for safe HTTP requests
   */
  validateUrl(url: string): ValidationResult {
    const warnings: string[] = []
    
    try {
      // Basic URL parsing
      const parsedUrl = new URL(url)
      
      // Protocol validation
      if (!ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
        return {
          isValid: false,
          error: `Protocol not allowed: ${parsedUrl.protocol}`,
          warnings
        }
      }

      // Domain validation
      const hostname = parsedUrl.hostname.toLowerCase()
      
      // Check against blocked domains first
      if (this.isBlockedDomain(hostname)) {
        return {
          isValid: false,
          error: `Domain is blocked: ${hostname}`,
          warnings
        }
      }

      // Check against allowed domains
      if (!this.isAllowedDomain(hostname)) {
        return {
          isValid: false,
          error: `Domain not in allowlist: ${hostname}`,
          warnings
        }
      }

      // Port validation (prevent access to internal services)
      if (parsedUrl.port && this.isDangerousPort(parseInt(parsedUrl.port))) {
        return {
          isValid: false,
          error: `Dangerous port detected: ${parsedUrl.port}`,
          warnings
        }
      }

      // Path validation for specific domains
      if (!this.isValidPath(hostname, parsedUrl.pathname)) {
        return {
          isValid: false,
          error: `Invalid path for domain ${hostname}: ${parsedUrl.pathname}`,
          warnings
        }
      }

      // URL length validation
      if (url.length > 2048) {
        warnings.push('URL is unusually long')
      }

      // Check for suspicious patterns
      this.checkSuspiciousPatterns(url, warnings)

      // Sanitize the URL
      const sanitizedUrl = this.sanitizeUrl(parsedUrl)

      return {
        isValid: true,
        sanitizedUrl,
        warnings
      }

    } catch (error) {
      return {
        isValid: false,
        error: `Invalid URL format: ${error instanceof Error ? error.message : 'Unknown error'}`,
        warnings
      }
    }
  }

  /**
   * Validate multiple URLs in batch
   */
  validateUrls(urls: string[]): { url: string; result: ValidationResult }[] {
    return urls.map(url => ({
      url,
      result: this.validateUrl(url)
    }))
  }

  /**
   * Get only valid URLs from a list, with optional logging
   */
  filterValidUrls(urls: string[], logWarnings: boolean = true): string[] {
    const valid: string[] = []
    
    for (const url of urls) {
      const result = this.validateUrl(url)
      
      if (result.isValid && result.sanitizedUrl) {
        valid.push(result.sanitizedUrl)
        
        if (logWarnings && result.warnings.length > 0) {
          console.warn(`⚠️ URL warnings for ${url}:`, result.warnings)
        }
      } else if (logWarnings) {
        console.error(`❌ Invalid URL ${url}: ${result.error}`)
      }
    }
    
    return valid
  }

  /**
   * Check if domain is explicitly blocked
   */
  private isBlockedDomain(hostname: string): boolean {
    // Check exact matches
    if (BLOCKED_DOMAINS.includes(hostname)) {
      return true
    }

    // Check for private IP ranges
    if (this.isPrivateIP(hostname)) {
      return true
    }

    // Check for localhost variations
    if (hostname.startsWith('localhost') || hostname.endsWith('.local')) {
      return true
    }

    return false
  }

  /**
   * Check if domain is in the allowlist
   */
  private isAllowedDomain(hostname: string): boolean {
    // Check exact matches
    if (ALLOWED_DOMAINS.includes(hostname)) {
      return true
    }

    // Check subdomain matches for allowed domains
    for (const allowedDomain of ALLOWED_DOMAINS) {
      if (hostname.endsWith(`.${allowedDomain}`)) {
        return true
      }
    }

    return false
  }

  /**
   * Check if IP address is in private ranges
   */
  private isPrivateIP(hostname: string): boolean {
    // Simple regex check for common private IP patterns
    const privateIPPatterns = [
      /^10\.\d+\.\d+\.\d+$/,           // 10.0.0.0/8
      /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/, // 172.16.0.0/12
      /^192\.168\.\d+\.\d+$/,          // 192.168.0.0/16
      /^127\.\d+\.\d+\.\d+$/           // 127.0.0.0/8
    ]

    return privateIPPatterns.some(pattern => pattern.test(hostname))
  }

  /**
   * Check if port number is dangerous
   */
  private isDangerousPort(port: number): boolean {
    // Common dangerous ports that might access internal services
    const dangerousPorts = [
      22,    // SSH
      23,    // Telnet
      25,    // SMTP
      53,    // DNS
      135,   // RPC
      139,   // NetBIOS
      445,   // SMB
      993,   // IMAPS
      995,   // POP3S
      1433,  // SQL Server
      3306,  // MySQL
      3389,  // RDP
      5432,  // PostgreSQL
      6379,  // Redis
      8080,  // Common internal web servers
      9200   // Elasticsearch
    ]

    return dangerousPorts.includes(port) || port < 80 || port > 65535
  }

  /**
   * Validate path for specific domains
   */
  private isValidPath(hostname: string, pathname: string): boolean {
    // Google Docs validation
    if (hostname === 'docs.google.com') {
      return pathname.startsWith('/document/') || 
             pathname.startsWith('/spreadsheets/') ||
             pathname.startsWith('/presentation/')
    }

    // Amazon validation
    if (hostname.includes('amazon.com')) {
      // Allow product pages, image URLs, etc.
      return pathname.includes('/dp/') ||  // Changed from startsWith to includes
             pathname.startsWith('/gp/') ||
             pathname.startsWith('/images/') ||
             pathname.startsWith('/s?') ||
             pathname.includes('/B0')  // ASIN pattern
    }

    // Open Library validation
    if (hostname === 'openlibrary.org') {
      return pathname.startsWith('/api/') ||
             pathname.startsWith('/search/') ||
             pathname.startsWith('/works/') ||
             pathname.startsWith('/books/')
    }

    // For other domains, allow most paths but block suspicious ones
    const suspiciousPatterns = [
      /\/\.\./, // Directory traversal
      /\/etc\//, // System files
      /\/proc\//, // System files
      /\/admin/, // Admin interfaces
      /\/api\/v[0-9]+\/internal/ // Internal APIs
    ]

    return !suspiciousPatterns.some(pattern => pattern.test(pathname))
  }

  /**
   * Check for suspicious patterns in URL
   */
  private checkSuspiciousPatterns(url: string, warnings: string[]): void {
    // Check for URL encoding that might hide malicious content
    if (url.includes('%2e%2e') || url.includes('%2f%2f')) {
      warnings.push('URL contains suspicious encoding patterns')
    }

    // Check for unusual Unicode characters
    if (/[^\x00-\x7F]/.test(url)) {
      warnings.push('URL contains non-ASCII characters')
    }

    // Check for extremely long paths or query strings
    try {
      const parsed = new URL(url)
      if (parsed.pathname.length > 500) {
        warnings.push('URL path is unusually long')
      }
      if (parsed.search.length > 1000) {
        warnings.push('URL query string is unusually long')
      }
    } catch {
      // Already handled in main validation
    }
  }

  /**
   * Sanitize URL by removing potentially dangerous elements
   */
  private sanitizeUrl(parsedUrl: URL): string {
    // Remove fragments (everything after #)
    parsedUrl.hash = ''
    
    // For Google URLs, clean up tracking parameters
    if (parsedUrl.hostname === 'docs.google.com') {
      // Keep only essential parameters
      const allowedParams = ['id', 'format', 'export']
      const newSearchParams = new URLSearchParams()
      
      for (const [key, value] of parsedUrl.searchParams) {
        if (allowedParams.includes(key)) {
          newSearchParams.set(key, value)
        }
      }
      
      parsedUrl.search = newSearchParams.toString()
    }

    // For Amazon URLs, clean up tracking parameters
    if (parsedUrl.hostname.includes('amazon.com')) {
      // Remove common tracking parameters
      const trackingParams = ['ref', 'tag', 'linkCode', 'camp', 'creative', 'creativeASIN']
      
      for (const param of trackingParams) {
        parsedUrl.searchParams.delete(param)
      }
    }

    return parsedUrl.toString()
  }

  /**
   * Create a safe fetch wrapper that validates URLs before making requests
   */
  async safeFetch(url: string, options?: RequestInit): Promise<Response> {
    const validation = this.validateUrl(url)
    
    if (!validation.isValid) {
      throw new Error(`URL validation failed: ${validation.error}`)
    }

    if (validation.warnings.length > 0) {
      console.warn('⚠️ URL validation warnings:', validation.warnings)
    }

    const safeUrl = validation.sanitizedUrl!
    
    // Add security headers to requests
    const secureOptions: RequestInit = {
      ...options,
      headers: {
        'User-Agent': 'Acquired Bookshelf Scraper/1.0',
        ...options?.headers
      }
    }

    // Set reasonable timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    try {
      const response = await fetch(safeUrl, {
        ...secureOptions,
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }
}

export { URLValidator, type ValidationResult }