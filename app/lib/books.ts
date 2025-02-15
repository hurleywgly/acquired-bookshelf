import { promises as fs } from 'fs'
import path from 'path'
import { processBookData } from './processBooks'
import { Book } from './data'

const ACQUIRED_PODCAST = {
  id: "acquired-podcast",
  amazonUrl: "https://acquired.fm",
  title: "Acquired Podcast",
  author: "Ben Gilbert and David Rosenthal",
  coverUrl: "/images/acq-book-cover.jpg",
  category: "Podcast",
  episodeRef: null
}

export async function getBooks(): Promise<Book[]> {
  try {
    const booksPath = path.join(process.cwd(), 'public', 'data', 'books.json')
    const fileContents = await fs.readFile(booksPath, 'utf8')
    const booksData = JSON.parse(fileContents)
    
    const booksArray = Array.isArray(booksData) ? booksData : [booksData]
    const processedBooks = processBookData(booksArray)
    
    return [ACQUIRED_PODCAST, ...processedBooks]
  } catch (error) {
    console.error('Error loading books:', error)
    return [ACQUIRED_PODCAST]
  }
} 