// Rate limiting configuration
const BATCH_SIZE = 10
const DELAY_MS = 1000 // 1 second between requests
const MAX_RETRIES = 3

interface BookMetadata {
  title: string
  author: string
  coverUrl?: string
  firstPublishYear?: number
  isbn?: string
  olid?: string // Open Library ID
  subjects?: string[]
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Response> {
  try {
    const response = await fetch(url)
    
    if (response?.status === 429) { // Too Many Requests
      if (retries > 0) {
        const backoffDelay = (MAX_RETRIES - retries + 1) * DELAY_MS
        await sleep(backoffDelay)
        return fetchWithRetry(url, retries - 1)
      }
    }
    
    return response
  } catch (error) {
    if (retries > 0) {
      await sleep(DELAY_MS)
      return fetchWithRetry(url, retries - 1)
    }
    throw error
  }
}

async function extractBookInfo(url: string): Promise<{ asin?: string; title?: string; author?: string }> {
  // Clean URL first - remove Google redirect wrapper
  let cleanUrl = url
  if (url.includes('google.com/url?')) {
    try {
      const urlParams = new URLSearchParams(url.split('?')[1])
      cleanUrl = urlParams.get('q') || urlParams.get('url') || url
    } catch (error) {
      console.error('Error cleaning Google redirect URL:', error)
    }
  }

  // Try to get ASIN from URL
  const asinMatch = cleanUrl.match(/\/dp\/([A-Z0-9]{10})/) || cleanUrl.match(/\/([B][0-9A-Z]{9})/)
  const asin = asinMatch?.[1]
  
  // Try to extract title from Amazon URL
  let title, author
  try {
    // Look for the title part in Amazon URLs (usually between domain and /dp/)
    const titleMatch = cleanUrl.match(/amazon\.com\/([^\/]+)\/dp\//) || 
                      cleanUrl.match(/amazon\.com\/([^\/\?]+)/)
    
    if (titleMatch && titleMatch[1] && !titleMatch[1].includes('gp')) {
      title = titleMatch[1]
        .replace(/-/g, ' ')
        .replace(/ebook|kindle|edition|audiobook|hardcover|paperback/gi, '')
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }
  } catch (error) {
    console.error('Error extracting title:', error)
  }
  
  return { asin, title, author }
}

async function getAmazonBookCover(amazonUrl: string): Promise<string | null> {
  try {
    const { asin } = await extractBookInfo(amazonUrl)
    if (!asin) return null

    // Amazon book cover image URLs follow a predictable pattern
    // Try different image sizes and formats
    const imageUrls = [
      `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.L.jpg`,  // Large
      `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.M.jpg`,  // Medium
      `https://m.media-amazon.com/images/P/${asin}.01.L.jpg`,               // Alternative CDN Large
      `https://m.media-amazon.com/images/P/${asin}.01.M.jpg`,               // Alternative CDN Medium
    ]

    // Test each URL to see if the image exists
    for (const imageUrl of imageUrls) {
      try {
        const response = await fetch(imageUrl, { method: 'HEAD' })
        if (response.ok && response.headers.get('content-type')?.startsWith('image/')) {
          console.log(`✅ Found Amazon cover: ${imageUrl}`)
          return imageUrl
        }
      } catch (error) {
        // Continue to next URL
        continue
      }
    }

    console.log(`⚠️ No Amazon cover found for ASIN: ${asin}`)
    return null
  } catch (error) {
    console.error('Error getting Amazon book cover:', error)
    return null
  }
}

async function getBookMetadata(amazonUrl: string): Promise<BookMetadata | null> {
  try {
    const { asin, title } = await extractBookInfo(amazonUrl)
    let bookData = null

    // First try by ASIN if available
    if (asin) {
      const isbnSearchUrl = `https://openlibrary.org/search.json?q=${asin}`
      const response = await fetchWithRetry(isbnSearchUrl)
      
      if (response?.ok) {
        const data = await response.json()
        if (data?.docs?.length > 0) {
          bookData = data.docs[0]
        }
      }
    }

    // Then try by exact title if available
    if (!bookData && title) {
      const titleSearchUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&fields=title,author_name,cover_i,first_publish_year,isbn,key,subject`
      const response = await fetchWithRetry(titleSearchUrl)
      
      if (response?.ok) {
        const data = await response.json()
        if (data?.docs?.length > 0) {
          // Try to find an exact title match
          const exactMatch = data.docs.find((doc: { title: string }) => 
            doc.title.toLowerCase() === title.toLowerCase()
          )
          if (exactMatch) {
            bookData = exactMatch
          }
        }
      }
    }

    // If still no result, try a general search
    if (!bookData) {
      // Clean the URL for searching
      const searchTerms = amazonUrl
        .split('/dp/')[0]
        .split('/').pop()
        ?.replace(/-/g, ' ')
        .replace(/ebook|kindle|edition|audiobook|hardcover|paperback/gi, '')
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .trim()

      if (searchTerms) {
        const searchUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(searchTerms)}&fields=title,author_name,cover_i,first_publish_year,isbn,key,subject`
        const response = await fetchWithRetry(searchUrl)
        
        if (response?.ok) {
          const data = await response.json()
          if (data?.docs?.length > 0) {
            bookData = data.docs[0]
          }
        }
      }
    }

    if (bookData) {
      // Try to get Open Library cover first, then fallback to Amazon
      let coverUrl = bookData.cover_i 
        ? `https://covers.openlibrary.org/b/id/${bookData.cover_i}-L.jpg`
        : undefined

      // If no Open Library cover, try Amazon as fallback
      if (!coverUrl) {
        console.log('  📸 No Open Library cover found, trying Amazon...')
        coverUrl = await getAmazonBookCover(amazonUrl) ?? undefined
      }

      const metadata: BookMetadata = {
        title: bookData.title || 'Unknown Title',
        author: bookData.author_name?.[0] || 'Unknown Author',
        coverUrl: coverUrl || '/covers/default-book.jpg',
        firstPublishYear: bookData.first_publish_year,
        isbn: bookData.isbn?.[0],
        olid: bookData.key?.replace('/works/', ''),
        subjects: bookData.subject || []
      }

      // Debug logging
      console.log(`✓ Match found for "${metadata.title}" by ${metadata.author}`)
      console.log(`  Original URL: ${amazonUrl}`)
      if (bookData.subject?.length > 0) {
        console.log(`  Subjects: ${bookData.subject.slice(0, 3).join(', ')}${bookData.subject.length > 3 ? '...' : ''}`)
      }
      
      return metadata
    }

    // No Open Library data found, but try to create basic metadata with Amazon cover
    console.warn(`✗ No Open Library metadata found for ${amazonUrl}`)
    console.log('  📸 Attempting to get Amazon cover as fallback...')
    
    const bookInfo = await extractBookInfo(amazonUrl)
    const amazonCover = await getAmazonBookCover(amazonUrl)
    
    if (amazonCover || bookInfo.title) {
      const fallbackMetadata: BookMetadata = {
        title: bookInfo.title || 'Unknown Title',
        author: 'Unknown Author',
        coverUrl: amazonCover || '/covers/default-book.jpg',
        subjects: []
      }
      
      console.log(`✓ Created fallback metadata: "${fallbackMetadata.title}"`)
      if (amazonCover) {
        console.log(`  📸 Using Amazon cover: ${amazonCover}`)
      }
      
      return fallbackMetadata
    }
    
    return null
  } catch (error) {
    console.error('Error fetching book metadata:', error)
    return null
  }
}

async function getBatchBookMetadata(amazonUrls: string[]): Promise<(BookMetadata | null)[]> {
  const results: (BookMetadata | null)[] = []
  let successCount = 0
  let failureCount = 0
  
  for (let i = 0; i < amazonUrls.length; i += BATCH_SIZE) {
    const batch = amazonUrls.slice(i, i + BATCH_SIZE)
    console.log(`\nProcessing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(amazonUrls.length/BATCH_SIZE)}`)
    
    const batchResults = await Promise.all(
      batch.map(async (url) => {
        console.log(`\nProcessing URL: ${url}`)
        const result = await getBookMetadata(url)
        if (result) {
          successCount++
        } else {
          failureCount++
        }
        await sleep(DELAY_MS)
        return result
      })
    )
    
    results.push(...batchResults)
    
    if (i + BATCH_SIZE < amazonUrls.length) {
      console.log(`\nProgress: ${successCount} found, ${failureCount} not found`)
      await sleep(DELAY_MS * 2)
    }
  }
  
  console.log(`\nFinal results: ${successCount} books found, ${failureCount} not found`)
  return results
}

export { getBookMetadata, getBatchBookMetadata, getAmazonBookCover, type BookMetadata }