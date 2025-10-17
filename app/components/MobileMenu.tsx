'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import EpisodeTimeline from './EpisodeTimeline'
import { Episode } from '@/lib/groupBooks'

interface MobileMenuProps {
  episodes: Episode[]
  activeEpisode?: string
  onEpisodeClick: (episodeId: string) => void
}

export default function MobileMenu({ episodes, activeEpisode, onEpisodeClick }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleEpisodeClick = (episodeId: string) => {
    onEpisodeClick(episodeId)
    setIsOpen(false) // Close menu after selection
  }

  return (
    <>
      {/* Hamburger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden p-2 text-gray-600 hover:text-gray-900"
        aria-label="Open episode menu"
      >
        <Menu size={24} />
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 md:hidden"
          aria-modal="true"
          role="dialog"
        >
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Sidebar */}
          <div className="fixed top-0 left-0 h-full w-80">
            <EpisodeTimeline 
              episodes={episodes}
              activeEpisode={activeEpisode}
              onEpisodeClick={handleEpisodeClick}
              showCloseButton={true}
              onClose={() => setIsOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}