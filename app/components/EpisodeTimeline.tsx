'use client'

import { useState, useEffect } from 'react'

interface Episode {
  id: string
  name: string
  seasonNumber: number
  episodeNumber: number
  date?: string
  sourceUrl?: string
}

interface EpisodeTimelineProps {
  activeEpisode?: string
  onEpisodeClick: (episodeId: string) => void
}

export default function EpisodeTimeline({ activeEpisode, onEpisodeClick }: EpisodeTimelineProps) {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadEpisodes = async () => {
      try {
        const response = await fetch('/data/episode-cache.json')
        const episodeData = await response.json()
        setEpisodes(episodeData)
      } catch (error) {
        console.error('Failed to load episodes:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadEpisodes()
  }, [])

  if (isLoading) {
    return (
      <div className="w-80 bg-white border-r border-gray-200 p-4">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          {[...Array(10)].map((_, i) => (
            <div key={i} className="mb-3">
              <div className="h-4 bg-gray-200 rounded mb-1"></div>
              <div className="h-3 bg-gray-100 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-72 xl:w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-3 lg:p-4 border-b border-gray-200 flex-shrink-0">
        <h2 className="text-base lg:text-lg font-semibold text-black">Episodes</h2>
        <p className="text-xs lg:text-sm text-gray-600">{episodes.length} episodes</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-2">
        {episodes.map((episode) => (
          <button
            key={episode.id}
            onClick={() => onEpisodeClick(episode.id)}
            className={`w-full text-left p-2 lg:p-3 rounded-lg border transition-colors ${
              activeEpisode === episode.id
                ? 'bg-active-green/10 border-active-green text-black'
                : 'border-gray-200 text-gray-700 hover:bg-hover-gray/20 hover:border-hover-gray'
            }`}
          >
            <div className="text-xs lg:text-sm font-medium mb-1 line-clamp-2">{episode.name}</div>
            <div className="text-xs text-gray-500">
              S{episode.seasonNumber} E{episode.episodeNumber}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}