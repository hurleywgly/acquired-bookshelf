'use client'

import { useRef, useEffect, useState } from 'react'
import { Book } from '@/lib/data'
import BookTile from './BookTile'

interface MasonryBookGalleryProps {
  books: Book[]
  activeEpisode?: string
  onScroll: (episodeId: string) => void
}

export default function MasonryBookGallery({ books, activeEpisode, onScroll }: MasonryBookGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [visibleBooks, setVisibleBooks] = useState(books)

  // Group books by episode for easier navigation
  const booksByEpisode = books.reduce((acc, book) => {
    const episodeId = book.episodeRef?.name || 'no-episode'
    if (!acc[episodeId]) {
      acc[episodeId] = []
    }
    acc[episodeId].push(book)
    return acc
  }, {} as Record<string, Book[]>)

  // Handle scroll to episode
  useEffect(() => {
    if (activeEpisode && containerRef.current) {
      const targetBook = books.find(book => book.episodeRef?.name === activeEpisode)
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

  // Handle scroll tracking to update active episode
  const handleScroll = () => {
    if (!containerRef.current) return

    const container = containerRef.current
    const scrollTop = container.scrollTop
    const containerHeight = container.clientHeight
    const scrollCenter = scrollTop + containerHeight / 2

    // Find the book that's currently in the center of the viewport
    let currentBook: Book | null = null
    let minDistance = Infinity

    books.forEach(book => {
      const bookElement = document.getElementById(`book-${book.id}`)
      if (bookElement) {
        const bookTop = bookElement.offsetTop
        const bookHeight = bookElement.offsetHeight
        const bookCenter = bookTop + bookHeight / 2
        const distance = Math.abs(scrollCenter - bookCenter)
        
        if (distance < minDistance) {
          minDistance = distance
          currentBook = book
        }
      }
    })

    if (currentBook?.episodeRef?.name) {
      onScroll(currentBook.episodeRef.name)
    }
  }

  return (
    <div className="flex-1 bg-gray-50">
      <div 
        ref={containerRef}
        className="h-full overflow-y-auto p-4 lg:p-6"
        onScroll={handleScroll}
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
          {books.map((book) => (
            <div 
              key={book.id} 
              id={`book-${book.id}`}
              className="break-inside-avoid"
            >
              <BookTile {...book} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}