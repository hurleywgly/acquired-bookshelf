import { Search } from 'lucide-react'
import MobileMenu from './MobileMenu'
import { Episode } from '@/lib/groupBooks'

interface TopBarProps {
  episodes: Episode[]
  showIntroModal: () => void
  activeEpisode?: string
  onEpisodeClick: (episodeId: string) => void
  searchTerm: string
  setSearchTerm: (term: string) => void
}

export default function TopBar({ episodes, showIntroModal, activeEpisode, onEpisodeClick, searchTerm, setSearchTerm }: TopBarProps) {
  return (
    <header className="fixed top-0 left-0 right-0 bg-sidebar-bg border-b border-gray-400 z-50 md:hidden">
      <div className="p-4">
        <div className="flex items-center justify-between gap-4 mb-3">
          <MobileMenu
            episodes={episodes}
            activeEpisode={activeEpisode}
            onEpisodeClick={onEpisodeClick}
          />

          <button
            onClick={showIntroModal}
            className="text-sm text-gray-900 font-medium whitespace-nowrap bg-white hover:bg-gray-50 px-4 py-2 rounded-lg border border-gray-300 transition-colors focus:outline-none"
          >
            What is this?
          </button>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search books, authors, episodes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-[44px] pl-10 pr-4 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-active-green focus:border-transparent text-sm"
            style={{ backgroundColor: '#AEAEAE' }}
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
        </div>
      </div>
    </header>
  )
}
