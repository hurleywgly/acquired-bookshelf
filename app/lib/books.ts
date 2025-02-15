import { promises as fs } from 'fs'
import path from 'path'
import { processBookData } from './processBooks'
import { Book } from './data'

const ACQUIRED_PODCAST: Book = {
  id: "acquired-podcast",
  amazonUrl: "https://acquired.fm",
  title: "Acquired Podcast",
  author: "Ben Gilbert and David Rosenthal",
  coverUrl: "/images/acq-book-cover.jpg",
  category: "Podcast",
  episodeRef: null
}

// Add cache interface
interface CacheEntry<T> {
  data: T
  timestamp: number
}

let booksCache: CacheEntry<Book[]> | null = null
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds

export async function getBooks(): Promise<Book[]> {
  // Check if cache is valid
  if (booksCache && Date.now() - booksCache.timestamp < CACHE_DURATION) {
    return booksCache.data
  }

  try {
    const booksPath = path.join(process.cwd(), 'public', 'data', 'books.json')
    const fileContents = await fs.readFile(booksPath, 'utf8')
    const booksData = JSON.parse(fileContents)
    
    const booksArray = Array.isArray(booksData) ? booksData : [booksData]
    const processedBooks = processBookData(booksArray)
    const books = [ACQUIRED_PODCAST, ...processedBooks]
    
    // Update cache
    booksCache = {
      data: books,
      timestamp: Date.now()
    }
    
    return books
  } catch (error) {
    console.error('Error loading books:', error)
    return [ACQUIRED_PODCAST]
  }
} 