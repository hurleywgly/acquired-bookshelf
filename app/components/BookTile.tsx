'use client'

import Image from 'next/image'
import { useState } from 'react'

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
  size?: 'standard' | 'xl'
}

export default function BookTile({ id, amazonUrl, title, author, coverUrl, category, episodeRef, size = 'standard' }: BookTileProps) {
  // Dynamic aspect ratio based on size - more pronounced difference
  const aspectClass = size === 'xl' ? 'aspect-[4/5]' : 'aspect-[2/3]'

  return (
    <div className="bg-white border border-gray-200 overflow-hidden shadow-sm">
      {/* Book Cover */}
      <div className={`relative ${aspectClass} overflow-hidden`}>
        <Image
          src={coverUrl}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover"
        />
      </div>

      {/* Book Info */}
      <div className="p-4">
        <h3 className="font-medium text-gray-900 text-sm mb-1 line-clamp-2 leading-tight">{title}</h3>
        <p className="text-gray-600 text-xs mb-2">{author}</p>
        
        {/* Category Badge */}
        <div className="inline-block bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700 mb-2">
          Business & Leadership
        </div>
        
        {episodeRef && (
          <div className="text-xs text-gray-500 mb-2">
            S{episodeRef.seasonNumber}E{episodeRef.episodeNumber}
          </div>
        )}
        
        <a
          href={amazonUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-600 hover:underline"
        >
          View on Amazon
        </a>
      </div>
    </div>
  )
}

