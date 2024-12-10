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
  // Try to get ASIN from URL
  const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/) || url.match(/\/([B][0-9A-Z]{9})/)
  const asin = asinMatch?.[1]
  
  // Try to extract title from Amazon URL
  let title, author
  try {
    const urlParts = url.split('/dp/')[0].split('/')
    const lastPart = urlParts[urlParts.length - 1]
    if (lastPart && lastPart !== 'amazon.com') {
      title = lastPart
        .replace(/-/g, ' ')
        .replace(/ebook|kindle|edition|audiobook|hardcover|paperback/gi, '')
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .trim()
    }
  } catch (error) {
    console.error('Error extracting title:', error)
  }
  
  return { asin, title, author }
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
      const metadata: BookMetadata = {
        title: bookData.title || 'Unknown Title',
        author: bookData.author_name?.[0] || 'Unknown Author',
        coverUrl: bookData.cover_i 
          ? `https://covers.openlibrary.org/b/id/${bookData.cover_i}-L.jpg`
          : undefined,
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

    console.warn(`✗ No metadata found for ${amazonUrl}`)
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

export { getBookMetadata, getBatchBookMetadata, type BookMetadata }