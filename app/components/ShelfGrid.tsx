'use client'

import { useState, useEffect } from 'react'
import { Book } from '@/lib/data'
import { Quote } from '@/lib/groupBooks'
import BookCard from './BookCard'
import QuoteBlock from './QuoteBlock'

// Grid item can be either a book or a quote
export type GridItem =
  | { type: 'book'; book: Book; episodeId: string }
  | { type: 'quote'; quote: Quote }

interface ShelfGridProps {
  items: GridItem[]
}

// Hook to calculate number of columns based on available width
const useColumnCount = () => {
  const [count, setCount] = useState(6)

  useEffect(() => {
    const updateCount = () => {
      // Calculate available width: window width - sidebar (desktop only) - padding
      // Sidebar: 330px on desktop (md+), 0px on mobile
      // Padding: p-4 (32px) mobile, p-8 (64px) md, p-12 (96px) lg
      // Gap: 20px mobile, 30px desktop
      const isMobile = window.innerWidth < 768
      const sidebarWidth = isMobile ? 0 : 330
      const padding = window.innerWidth >= 1024 ? 96 : window.innerWidth >= 768 ? 64 : 32
      const availableWidth = window.innerWidth - sidebarWidth - padding

      // Column requirements with updated mobile values:
      // 6 cols: 5×180 + 1×270 + 5×30 = 1320px (desktop gap)
      // 5 cols: 4×180 + 1×270 + 4×30 = 1110px (desktop gap)
      // 4 cols: 3×180 + 1×270 + 3×30 = 900px (desktop gap)
      // 3 cols: 3×180 + 2×30 = 600px (desktop gap)
      // 2 cols: 2×180 + 1×20 = 380px (mobile gap)

      if (availableWidth >= 1320) setCount(6)
      else if (availableWidth >= 1110) setCount(5)
      else if (availableWidth >= 900) setCount(4)
      else if (availableWidth >= 600) setCount(3)
      else setCount(2)
    }

    updateCount()
    window.addEventListener('resize', updateCount)
    return () => window.removeEventListener('resize', updateCount)
  }, [])

  return count
}

// Build grid template columns string
// Column 4 is always large (270px) when there are 4+ columns
// All other columns are small (180px)
const buildGridColumns = (columnCount: number) => {
  return Array.from({ length: columnCount })
    .map((_, i) => {
      const columnNumber = i + 1
      return columnNumber === 4 && columnCount >= 4 ? '270px' : '180px'
    })
    .join(' ')
}

export default function ShelfGrid({ items }: ShelfGridProps) {
  const columnCount = useColumnCount()

  return (
    <div
      className="grid gap-[20px] md:gap-[30px] items-start"
      style={{
        gridTemplateColumns: buildGridColumns(columnCount),
        gridAutoFlow: 'row'
      }}
    >
      {items.map((item, index) => {
        // Calculate which column this item is in (1-indexed)
        const column = (index % columnCount) + 1

        // Column 4 gets large tiles when there are 4+ columns
        const size = column === 4 && columnCount >= 4 ? 'lg' : 'sm'

        if (item.type === 'quote') {
          // On mobile (2 cols), quote should span both columns
          // On desktop (4+ cols), quote takes normal position
          return (
            <div
              key={`quote-${index}`}
              className={columnCount === 2 ? 'col-span-2' : ''}
            >
              <QuoteBlock quote={item.quote} />
            </div>
          )
        }

        return (
          <BookCard
            key={item.book.id}
            book={item.book}
            size={size}
            episodeId={item.episodeId}
          />
        )
      })}
    </div>
  )
}
