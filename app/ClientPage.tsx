'use client'

import { useState, useEffect, useMemo } from 'react'
import { Search } from 'lucide-react'
import TopBar from './components/TopBar'
import EpisodeTimeline from './components/EpisodeTimeline'
import ShelfGrid, { GridItem } from './components/ShelfGrid'
import IntroModal from './components/IntroModal'
import { Book } from '@/lib/data'
import { Episode, groupBooksByEpisode } from '@/lib/groupBooks'
import { useScrollSpy } from '@/hooks/useScrollSpy'

interface ClientPageProps {
  initialBooks: Book[]
}

export default function ClientPage({ initialBooks }: ClientPageProps) {
  const [activeEpisode, setActiveEpisode] = useState<string>()
  const [searchTerm, setSearchTerm] = useState('')
  const [showIntroModal, setShowIntroModal] = useState(false)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile viewport for quote positioning
  useEffect(() => {
    const checkMobile = () => {
      // Mobile is when we'd have 2 columns (width < 600px approximately)
      // Using same logic as ShelfGrid column calculation
      const width = window.innerWidth
      setIsMobile(width < 768) // md breakpoint
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])


  // Group books by episode
  useEffect(() => {
    const groupedEpisodes = groupBooksByEpisode(initialBooks)
    setEpisodes(groupedEpisodes)
  }, [initialBooks])

  // Filter episodes based on search term
  const filteredEpisodes = episodes.filter(episode => {
    if (!searchTerm) return true

    const searchTermLower = searchTerm.toLowerCase()

    // Check episode name
    if (episode.name.toLowerCase().includes(searchTermLower)) return true

    // Check if any books in the episode match
    return episode.books.some(book =>
      book.title.toLowerCase().includes(searchTermLower) ||
      book.author.toLowerCase().includes(searchTermLower)
    )
  })

  // Flatten all episodes into a single continuous array of grid items
  const gridItems = useMemo(() => {
    const items: GridItem[] = []

    filteredEpisodes.forEach((episode) => {
      // Add all books from this episode
      episode.books.forEach((book) => {
        items.push({
          type: 'book',
          book,
          episodeId: episode.id
        })
      })
    })

    // Insert quote at dynamic position based on viewport
    // Mobile (2 cols): position 8 (after 8 books, row 5)
    // Desktop (4+ cols): position 3 (column 4, row 1)
    if (filteredEpisodes.length > 0 && filteredEpisodes[0].quote) {
      const quotePosition = isMobile ? 8 : 3
      items.splice(quotePosition, 0, {
        type: 'quote',
        quote: filteredEpisodes[0].quote
      })
    }

    return items
  }, [filteredEpisodes, isMobile])

  // Build a key from the currently rendered episode section IDs for scroll spy
  const sectionsKey = filteredEpisodes.map(e => e.id).join('|')

  // Set up scroll spy (rebind when the set of visible sections changes)
  const { jumpTo } = useScrollSpy(setActiveEpisode, sectionsKey)

  const handleEpisodeClick = (episodeId: string) => {
    setActiveEpisode(episodeId)
    jumpTo(episodeId)
  }

  return (
    <main className="h-dvh">
      {/* Sidebar - Fixed positioning like mobile */}
      <aside
        id="sidebar"
        aria-label="Episodes navigation"
        className="hidden md:block fixed top-0 left-0 w-[330px] h-dvh z-40"
      >
        <EpisodeTimeline
          episodes={filteredEpisodes}
          activeEpisode={activeEpisode}
          onEpisodeClick={handleEpisodeClick}
        />
      </aside>

      {/* Content */}
      <section id="content" className="flex flex-col h-full md:ml-[330px]">
        {/* Mobile TopBar */}
        <TopBar
          episodes={filteredEpisodes}
          showIntroModal={() => setShowIntroModal(true)}
          activeEpisode={activeEpisode}
          onEpisodeClick={handleEpisodeClick}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />

        {/* Desktop Gray Header Bar - Fixed */}
        <div className="hidden md:block fixed top-0 left-[330px] right-0 z-40 px-8 lg:px-12 py-4" style={{ backgroundColor: '#B8B9B8' }}>
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-[350px]">
              <input
                type="text"
                placeholder="Search books, authors, episodes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-[50px] pl-10 pr-4 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-active-green focus:border-transparent text-sm"
                style={{ backgroundColor: '#AEAEAE' }}
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            </div>

            <button
              onClick={() => setShowIntroModal(true)}
              className="text-sm text-gray-900 font-medium whitespace-nowrap bg-white hover:bg-gray-50 px-4 py-2 rounded-lg border border-gray-300 transition-colors focus:outline-none"
            >
              What is this?
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div id="shelfScroll" className="flex-1 overflow-y-auto min-h-0 p-4 md:p-8 lg:p-12">
          <div className="pt-[130px] md:pt-[100px]">
            <ShelfGrid items={gridItems} />
          </div>
        </div>
      </section>

      {/* Intro modal */}
      <IntroModal 
        open={showIntroModal} 
        onClose={() => setShowIntroModal(false)} 
      />
    </main>
  )
}
