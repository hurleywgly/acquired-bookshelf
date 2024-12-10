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
    <div
      className="relative w-[240px] h-[350px] flex-shrink-0 rounded-lg overflow-hidden shadow-lg transition-transform duration-300 ease-in-out transform hover:scale-105"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Image
        src={coverUrl}
        alt={title}
        layout="fill"
        objectFit="cover"
        className="rounded-lg"
      />
      <div className="absolute top-2 left-2 bg-white px-2 py-1 rounded-full text-xs text-black font-semibold">
        {category}
      </div>
      {isHovered && (
        <div className="absolute inset-0 bg-black bg-opacity-75 p-4 flex flex-col justify-between text-white">
          <div>
            <h3 className="font-bold text-lg">{title}</h3>
            <p className="text-sm">{author}</p>
          </div>
          {episodeRef && (
            <p className="text-sm">
              Source for S{episodeRef.seasonNumber}, E{episodeRef.episodeNumber} - {episodeRef.name}
            </p>
          )}
          <a
            href={amazonUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-sm hover:underline"
          >
            {isAcquiredPodcast ? 'Listen' : 'View on Amazon'} <ExternalLink size={16} className="ml-1" />
          </a>
        </div>
      )}
    </div>
  )
}

