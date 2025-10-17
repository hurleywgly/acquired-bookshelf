'use client'

import { X } from 'lucide-react'
import Image from 'next/image'
import { Episode } from '@/lib/groupBooks'
import PodcastLinks from './PodcastLinks'

interface EpisodeTimelineProps {
  episodes: Episode[]
  activeEpisode?: string
  onEpisodeClick: (episodeId: string) => void
  showCloseButton?: boolean
  onClose?: () => void
}

export default function EpisodeTimeline({ episodes, activeEpisode, onEpisodeClick, showCloseButton, onClose }: EpisodeTimelineProps) {
  return (
    <div className="w-full h-full bg-sidebar-bg flex flex-col">
      {/* Header with logo */}
      <div className="py-7 px-6 border-b border-gray-400 flex-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/acq-bookshelf-logo.svg"
              alt="ACQUIRED Bookshelf"
              width={105}
              height={21}
              className="w-auto"
            />
          </div>
          {showCloseButton && onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-600 hover:text-black"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Episodes list - scrollable flex item */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {episodes.map((episode) => (
          <button
            key={episode.id}
            onClick={() => onEpisodeClick(episode.id)}
            className={`w-full text-left px-6 py-3 transition-all duration-200 ${
              activeEpisode === episode.id
                ? 'bg-active-green text-black'
                : 'hover:bg-hover-gray text-sidebar-text active:scale-95 active:bg-gray-400'
            }`}
          >
            <div className="flex flex-col gap-1 w-full">
              <div
                className={`font-mono font-extrabold text-xs ${
                  activeEpisode === episode.id ? 'text-black' : 'text-sidebar-code'
                }`}
              >
                S{episode.seasonNumber} E{episode.episodeNumber}
              </div>
              <div
                className={`font-medium text-sm line-clamp-2 ${
                  activeEpisode === episode.id ? 'text-black' : 'text-sidebar-text'
                }`}
              >
                {episode.name}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Listen to ACQUIRED banner - fixed at bottom */}
      <div className="flex-none border-t border-gray-400 px-6 py-3 bg-sidebar-bg">
        <div className="flex items-center justify-center">
          <PodcastLinks />
        </div>
      </div>
    </div>
  )
}
