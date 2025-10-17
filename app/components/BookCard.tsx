
'use client'

import { Book } from '@/lib/data'
import Image from 'next/image'

interface BookCardProps {
  book: Book
  size: 'sm' | 'lg'
  episodeId?: string
}

export default function BookCard({ book, size, episodeId }: BookCardProps) {
  const isBig = size === 'lg'

  // ALL tiles are 320px tall - same height for small and large
  // Image: 180px, Metadata: 140px (180 + 140 = 320)
  const imageHeight = 'h-[180px]'
  const metaHeight = 'h-[140px]'

  // Typography specifications from requirements
  const titleSize = 'text-[14px]'
  const authorSize = 'text-[12px]'
  const categorySize = 'text-[10px]'
  const linkSize = 'text-[9px]'

  const baseClasses = "flex flex-col bg-white shadow-sm overflow-hidden break-inside-avoid border border-gray-200 transition-transform hover:scale-105"
  // All cards are 320px tall, width varies
  const sizeClasses = isBig
    ? "w-[270px] h-[320px]"
    : "w-[180px] h-[320px]"

  return (
    <article
      data-book-card
      data-episode-id={episodeId}
      className={`${baseClasses} ${sizeClasses}`}
    >
      {/* Cover image - EXPLICIT HEIGHT 180px */}
      <div className={`relative ${imageHeight} bg-gray-100 overflow-hidden flex-shrink-0`}>
        <Image
          src={book.coverUrl}
          alt={book.title}
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 270px"
          className="object-cover object-center"
        />

        {/* Episode badge overlay - top right */}
        {book.episodeRef && (
          <div className="absolute top-2 right-2 bg-gray-900/70 text-white px-2 py-1 rounded text-[10px] font-medium">
            S{book.episodeRef.seasonNumber}, E{book.episodeRef.episodeNumber}
          </div>
        )}
      </div>

      {/* Meta section - EXPLICIT HEIGHT 140px */}
      <div className={`${metaHeight} p-4 flex flex-col gap-1.5 flex-shrink-0 overflow-hidden`} style={{ backgroundColor: '#D9D9D9' }}>
        {/* Category Badge - 10px light font */}
        <div className="inline-flex items-center rounded-full px-3 py-1 w-fit" style={{ backgroundColor: '#575757' }}>
          <span className={`${categorySize} font-light text-white`}>{book.category}</span>
        </div>

        {/* Title - 14px bold */}
        <h3 className={`${titleSize} font-bold text-gray-900 line-clamp-2 leading-tight`}>{book.title}</h3>

        {/* Author - 12px regular */}
        <p className={`${authorSize} font-normal text-gray-600 line-clamp-1`}>{book.author}</p>

        {/* Amazon link - 9px medium with 5% letter-spacing */}
        <a
          href={book.amazonUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-auto ${linkSize} font-medium text-gray-700 hover:text-gray-900 underline decoration-gray-400 hover:decoration-gray-700`}
          style={{ letterSpacing: '0.05em' }}
        >
          View on Amazon ↗
        </a>
      </div>
    </article>
  )
}
