'use client'

import Image from 'next/image'
import { useState } from 'react'
import { ExternalLink } from 'lucide-react'

interface BookTileProps {
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

export default function BookTile({ id, amazonUrl, title, author, coverUrl, category, episodeRef }: BookTileProps) {
  const [isHovered, setIsHovered] = useState(false)

  const isAcquiredPodcast = id === 'acquired-podcast'

  return (
    <div className="bg-white rounded-lg overflow-hidden shadow-sm">
      {/* Book Cover */}
      <div
        className="relative aspect-[3/4] overflow-hidden"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Image
          src={coverUrl}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition-transform duration-200 hover:scale-105"
        />
        
        {/* Category Badge */}
        <div className="absolute top-2 left-2 bg-gray-100 px-2 py-1 rounded text-xs font-medium text-gray-700">
          Business & Leadership
        </div>

        {/* Hover Overlay */}
        {isHovered && (
          <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
            <a
              href={amazonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-black px-4 py-2 rounded font-medium text-sm hover:bg-gray-100 transition-colors flex items-center gap-2"
            >
              View on Amazon <ExternalLink size={16} />
            </a>
          </div>
        )}
      </div>

      {/* Book Info */}
      <div className="p-4">
        <h3 className="font-medium text-gray-900 text-sm mb-1 line-clamp-2">{title}</h3>
        <p className="text-gray-600 text-xs mb-2">{author}</p>
        
        {episodeRef && (
          <div className="text-xs text-gray-500">
            S{episodeRef.seasonNumber}E{episodeRef.episodeNumber}
          </div>
        )}
      </div>
    </div>
  )
}

