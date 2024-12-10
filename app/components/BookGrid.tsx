'use client'

import { useRef } from 'react'
import BookTile from './BookTile'

interface Book {
  id: string
  amazonUrl: string
  title: string
  author: string
  coverUrl: string
  category: string
  episodeRef: {
    name: string
    seasonNumber: number
    episodeNumber: number
  } | null
}

interface BookGridProps {
  books: Book[]
  className?: string
}

export default function BookGrid({ books, className = '' }: BookGridProps) {
  const gridRef = useRef<HTMLDivElement>(null)

  return (
    <div className={`relative ${className}`}>
      <div
        ref={gridRef}
        className="flex gap-6 overflow-x-auto scroll-smooth w-full
          [&::-webkit-scrollbar]:h-2
          [&::-webkit-scrollbar]:block
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:bg-gray-300/60
          [&::-webkit-scrollbar-thumb]:rounded-full
          [&::-webkit-scrollbar-thumb]:hover:bg-gray-400/60"
      >
        {books.map((book) => (
          <div 
            key={book.id} 
            className="flex-none w-[240px]"
            style={{ 
              scrollSnapAlign: 'start',
              scrollSnapStop: 'always'
            }}
          >
            <BookTile {...book} />
          </div>
        ))}
      </div>
    </div>
  )
}

