/**
 * Image optimization utility for external book covers
 * Handles fallback chain and performance optimization
 */

interface ImageSource {
  url: string
  priority: number
  type: 'openlibrary' | 'amazon' | 'local' | 'default'
}

class BookCoverOptimizer {
  private cache = new Map<string, string>()
  
  /**
   * Get optimized cover URL with fallback chain
   */
  async getOptimizedCoverUrl(bookId: string, coverSources: {
    openLibrary?: string
    amazon?: string
    local?: string
  }): Promise<string> {
    
    // Check cache first
    if (this.cache.has(bookId)) {
      return this.cache.get(bookId)!
    }

    // Build fallback chain by priority
    const sources: ImageSource[] = [
      ...(coverSources.openLibrary ? [{
        url: coverSources.openLibrary,
        priority: 1,
        type: 'openlibrary' as const
      }] : []),
      ...(coverSources.amazon ? [{
        url: coverSources.amazon,
        priority: 2,
        type: 'amazon' as const
      }] : []),
      ...(coverSources.local ? [{
        url: coverSources.local,
        priority: 3,
        type: 'local' as const
      }] : []),
      {
        url: '/covers/default-book.jpg',
        priority: 4,
        type: 'default' as const
      }
    ]

    // Test each source in priority order
    for (const source of sources.sort((a, b) => a.priority - b.priority)) {
      if (await this.isImageAccessible(source.url)) {
        this.cache.set(bookId, source.url)
        return source.url
      }
    }

    // Fallback to default
    const defaultUrl = '/covers/default-book.jpg'
    this.cache.set(bookId, defaultUrl)
    return defaultUrl
  }

  /**
   * Test if image URL is accessible
   */
  private async isImageAccessible(url: string): Promise<boolean> {
    try {
      // For external URLs, do a HEAD request
      if (url.startsWith('http')) {
        const response = await fetch(url, { 
          method: 'HEAD',
          cache: 'force-cache' // Cache the result
        })
        return response.ok && response.headers.get('content-type')?.startsWith('image/')
      }
      
      // Local URLs are assumed to exist (Next.js will handle 404s)
      return true
    } catch {
      return false
    }
  }

  /**
   * Preload critical images for better performance
   */
  preloadImages(urls: string[]) {
    if (typeof window !== 'undefined') {
      urls.forEach(url => {
        const link = document.createElement('link')
        link.rel = 'preload'
        link.as = 'image'
        link.href = url
        document.head.appendChild(link)
      })
    }
  }

  /**
   * Get Next.js optimized image props
   */
  getNextImageProps(coverUrl: string, bookTitle: string) {
    return {
      src: coverUrl,
      alt: `Cover of ${bookTitle}`,
      width: 400,
      height: 600,
      quality: 85,
      placeholder: 'blur' as const,
      blurDataURL: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
      priority: false, // Set to true for above-the-fold images
      loading: 'lazy' as const
    }
  }
}

export { BookCoverOptimizer }