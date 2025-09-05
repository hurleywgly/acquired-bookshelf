'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'
import { ExternalLink } from 'lucide-react'

interface EnhancedBook {
  id: string
  title: string
  author: string
  amazonUrl: string
  category: string
  covers: {
    openLibrary?: string
    amazon?: string
    local?: string
    optimized: string
    fallbackChain: string[]
  }
  metadata: {
    isbn?: string
    firstPublishYear?: number
    subjects?: string[]
    olid?: string
  }
  episodeRef: {
    name: string
    seasonNumber: number
    episodeNumber: number
  }
  addedAt: string
  source: 'manual' | 'automated'
  migrated?: boolean
}

interface OptimizedBookTileProps {
  book: EnhancedBook
}

export default function OptimizedBookTile({ book }: OptimizedBookTileProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [currentCoverIndex, setCurrentCoverIndex] = useState(0)
  const [imageError, setImageError] = useState(false)

  const isAcquiredPodcast = book.id === 'acquired-podcast'

  // Get the current cover URL from fallback chain
  const getCurrentCoverUrl = (): string => {
    if (imageError && currentCoverIndex < book.covers.fallbackChain.length - 1) {
      return book.covers.fallbackChain[currentCoverIndex + 1] || '/covers/default-book.jpg'
    }
    return book.covers.fallbackChain[currentCoverIndex] || book.covers.optimized || '/covers/default-book.jpg'
  }

  // Handle image loading errors by falling back to next image in chain
  const handleImageError = () => {
    if (currentCoverIndex < book.covers.fallbackChain.length - 1) {
      setCurrentCoverIndex(prev => prev + 1)
      setImageError(false)
    } else {
      setImageError(true)
    }
  }

  // Reset image state when book changes
  useEffect(() => {
    setCurrentCoverIndex(0)
    setImageError(false)
  }, [book.id])

  // Enhanced metadata display
  const getMetadataDisplay = () => {
    const metadata = []
    if (book.metadata.firstPublishYear) {
      metadata.push(`Published: ${book.metadata.firstPublishYear}`)
    }
    if (book.metadata.subjects && book.metadata.subjects.length > 0) {
      const topSubjects = book.metadata.subjects.slice(0, 2).join(', ')
      metadata.push(`Topics: ${topSubjects}`)
    }
    return metadata
  }

  const coverUrl = getCurrentCoverUrl()

  return (
    <div
      className="relative w-[240px] h-[350px] flex-shrink-0 rounded-lg overflow-hidden shadow-lg transition-transform duration-300 ease-in-out transform hover:scale-105"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Optimized Image with fallback chain */}
      <Image
        src={coverUrl}
        alt={`Cover of ${book.title}`}
        fill
        className="rounded-lg object-cover"
        sizes="240px"
        quality={85}
        placeholder="blur"
        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
        priority={false}
        loading="lazy"
        onError={handleImageError}
      />

      {/* Category badge */}
      <div className="absolute top-2 left-2 bg-white px-2 py-1 rounded-full text-xs text-black font-semibold">
        {book.category}
      </div>

      {/* Source indicator for enhanced books */}
      {book.source === 'automated' && (
        <div className="absolute top-2 right-2 bg-green-500 px-2 py-1 rounded-full text-xs text-white font-semibold">
          Auto
        </div>
      )}

      {/* Cover source indicator (for debugging) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-2 right-2 bg-gray-800 bg-opacity-75 px-1 py-0.5 rounded text-xs text-white">
          {coverUrl.includes('openlibrary') ? 'OL' : 
           coverUrl.includes('amazon') ? 'AMZ' : 
           coverUrl.includes('/covers/') ? 'LOC' : 'DEF'}
        </div>
      )}

      {/* Hover overlay with enhanced information */}
      {isHovered && (
        <div className="absolute inset-0 bg-black bg-opacity-75 p-4 flex flex-col justify-between text-white">
          <div>
            <h3 className="font-bold text-lg mb-1">{book.title}</h3>
            <p className="text-sm mb-2">{book.author}</p>
            
            {/* Enhanced metadata */}
            {getMetadataDisplay().map((info, index) => (
              <p key={index} className="text-xs text-gray-300 mb-1">
                {info}
              </p>
            ))}
          </div>

          {/* Episode reference */}
          <div className="space-y-2">
            {book.episodeRef && (
              <p className="text-sm">
                Source for S{book.episodeRef.seasonNumber}, E{book.episodeRef.episodeNumber} - {book.episodeRef.name}
              </p>
            )}

            {/* Action button */}
            {!isAcquiredPodcast && (
              <a
                href={book.amazonUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-full px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded transition-colors duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink size={16} className="mr-2" />
                View on Amazon
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}