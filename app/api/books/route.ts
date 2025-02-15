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

// Cache the processed books data
let cachedBooks: any[] | null = null
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds

export async function GET() {
    // Return cached data if available and not expired
    if (cachedBooks) {
        return NextResponse.json(cachedBooks, {
            headers: {
                'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=86400'
            }
        })
    }

    try {
        const booksPath = path.join(process.cwd(), 'public', 'data', 'books.json')
        const fileContents = await fs.readFile(booksPath, 'utf8')
        const booksData = JSON.parse(fileContents)
        
        // Make sure the data is an array and process categories
        const booksArray = Array.isArray(booksData) ? booksData : [booksData]
        const processedBooks = processBookData(booksArray)
        
        // Cache the results
        cachedBooks = [ACQUIRED_PODCAST, ...processedBooks]

        return NextResponse.json(cachedBooks, {
            headers: {
                'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=86400'
            }
        })
    } catch (error) {
        console.error('Error loading books:', error)
        return NextResponse.json([ACQUIRED_PODCAST], {
            headers: {
                'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=86400'
            }
        })
    }
}