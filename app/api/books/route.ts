import { promises as fs } from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { processBookData } from '@/lib/processBooks'

// Move the ACQUIRED_PODCAST constant here
const ACQUIRED_PODCAST = {
  id: "acquired-podcast",
  amazonUrl: "https://acquired.fm",
  title: "Acquired Podcast",
  author: "Ben Gilbert and David Rosenthal",
  coverUrl: "/images/acq-book-cover.jpg",
  category: "Podcast",
  episodeRef: null
}

export async function GET() {
    try {
      const booksPath = path.join(process.cwd(), 'public', 'data', 'books.json')
      const fileContents = await fs.readFile(booksPath, 'utf8')
      const booksData = JSON.parse(fileContents)
      
      // Make sure the data is an array and process categories
      const booksArray = Array.isArray(booksData) ? booksData : [booksData]
      const processedBooks = processBookData(booksArray)
      
      // Keep ACQUIRED_PODCAST with its original category
      return NextResponse.json([ACQUIRED_PODCAST, ...processedBooks])
    } catch (error) {
      console.error('Error loading books:', error)
      return NextResponse.json([ACQUIRED_PODCAST])
    }
}