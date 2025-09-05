'use client'

import { useState } from 'react'
import Header from './components/Header'
import EpisodeTimeline from './components/EpisodeTimeline'
import MasonryBookGallery from './components/MasonryBookGallery'
import BookQuote from './components/BookQuote'
import IntroModal from './components/IntroModal'
import PodcastLinks from './components/PodcastLinks'
import Footer from './components/Footer'
import { Book } from '@/lib/data'

interface ClientPageProps {
  initialBooks: Book[]
}

export default function ClientPage({ initialBooks }: ClientPageProps) {
  const [activeEpisode, setActiveEpisode] = useState<string>()
  const [searchTerm, setSearchTerm] = useState('')
  const [showIntroModal, setShowIntroModal] = useState(true)

  // Filter books based on search term
  const filteredBooks = initialBooks.filter(book => {
    const searchTermLower = searchTerm.toLowerCase()
    return (
      book.title.toLowerCase().includes(searchTermLower) ||
      book.author.toLowerCase().includes(searchTermLower) ||
      (book.episodeRef?.name.toLowerCase().includes(searchTermLower) ?? false)
    )
  })

  const handleEpisodeClick = (episodeId: string) => {
    setActiveEpisode(episodeId)
  }

  const handleGalleryScroll = (episodeId: string) => {
    setActiveEpisode(episodeId)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Episode Timeline Sidebar - Hidden on mobile */}
        <div className="hidden lg:block">
          <EpisodeTimeline 
            activeEpisode={activeEpisode}
            onEpisodeClick={handleEpisodeClick}
          />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Header with Title and Quote */}
          <div className="p-4 lg:p-6 bg-white border-b border-gray-200">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4 lg:gap-8">
              <div className="flex-1">
                <h1 className="text-2xl lg:text-4xl font-bold text-black mb-2">
                  ACQUIRED Bookshelf
                </h1>
                <p className="text-gray-600 text-sm lg:text-base mb-4">
                  This is a fan-made site of books researched by Ben & David for episodes of the Acquired Podcast
                </p>
                <PodcastLinks />
              </div>
              <div className="hidden lg:block flex-shrink-0">
                <BookQuote />
              </div>
            </div>
          </div>

          {/* Book Gallery */}
          {filteredBooks.length > 0 ? (
            <MasonryBookGallery 
              books={filteredBooks}
              activeEpisode={activeEpisode}
              onScroll={handleGalleryScroll}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-xl text-gray-600 mb-4">
                  No books found for &quot;{searchTerm}&quot;.
                </p>
                <button 
                  onClick={() => setSearchTerm('')}
                  className="px-6 py-2 bg-active-green text-white rounded-full hover:bg-active-green/80 transition-colors"
                >
                  Clear search
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
      
      {/* Intro Modal */}
      {showIntroModal && (
        <IntroModal onClose={() => setShowIntroModal(false)} />
      )}
    </div>
  )
} 