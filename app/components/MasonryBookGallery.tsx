'use client'

import { useRef, useEffect } from 'react'
import { Book } from '@/lib/data'
import BookTile from './BookTile'

interface MasonryBookGalleryProps {
  books: Book[]
  activeEpisode?: string
  onScroll: (episodeId: string) => void
}

export default function MasonryBookGallery({ books, activeEpisode, onScroll }: MasonryBookGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Handle scroll to episode
  useEffect(() => {
    if (activeEpisode && containerRef.current) {
      const targetBook = books.find(book => 
        book.episodeRef && `${book.episodeRef.seasonNumber}-${book.episodeRef.episodeNumber}` === activeEpisode
      )
      if (targetBook) {
        const bookElement = document.getElementById(`book-${targetBook.id}`)
        if (bookElement) {
          bookElement.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
          })
        }
      }
    }
  }, [activeEpisode, books])

  // Handle scroll tracking to update active episode with throttling
  const handleScroll = (() => {
    let ticking = false
    
    return () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          if (!containerRef.current) {
            ticking = false
            return
          }

          const container = containerRef.current
          const scrollTop = container.scrollTop
          const containerHeight = container.clientHeight
          const scrollCenter = scrollTop + 100 // Fixed offset from top

          // Find the book that's currently visible near the top
          let currentBook: Book | null = null
          let minDistance = Infinity

          for (const book of books) {
            const bookElement = document.getElementById(`book-${book.id}`)
            if (bookElement) {
              const bookTop = bookElement.offsetTop - scrollTop
              const bookHeight = bookElement.offsetHeight
              
              // Check if book is visible and near the scroll tracking point
              if (bookTop <= scrollCenter && bookTop + bookHeight >= scrollCenter) {
                const distance = Math.abs(scrollCenter - (bookTop + bookHeight / 2))
                
                if (distance < minDistance) {
                  minDistance = distance
                  currentBook = book
                }
              }
            }
          }

          if (currentBook && currentBook.episodeRef) {
            const episodeId = `${currentBook.episodeRef.seasonNumber}-${currentBook.episodeRef.episodeNumber}`
            onScroll(episodeId)
          }
          
          ticking = false
        })
        
        ticking = true
      }
    }
  })()

  // Dynamic size assignment function
  const getBookSize = (index: number, bookId: string): 'standard' | 'xl' => {
    // Use a combination of index and book ID hash to create predictable but varied sizing
    const hash = bookId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
    const combined = (index + hash) % 4
    
    // Roughly 40% XL tiles for more visual variety
    return combined < 2 ? 'xl' : 'standard'
  }

  return (
    <div className="flex-1 bg-white">
      <div 
        ref={containerRef}
        className="h-full overflow-y-auto px-6 py-4 min-h-full"
        onScroll={handleScroll}
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pb-8">
          {books.map((book, index) => (
            <div 
              key={book.id} 
              id={`book-${book.id}`}
              className="break-inside-avoid"
            >
              <BookTile {...book} size={getBookSize(index, book.id)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}