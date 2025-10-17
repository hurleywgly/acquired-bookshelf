import MobileMenu from './MobileMenu'
import { Episode } from '@/lib/groupBooks'

interface TopBarProps {
  episodes: Episode[]
  showIntroModal: () => void
  activeEpisode?: string
  onEpisodeClick: (episodeId: string) => void
}

export default function TopBar({ episodes, showIntroModal, activeEpisode, onEpisodeClick }: TopBarProps) {
  return (
    <header className="fixed top-0 left-0 right-0 bg-sidebar-bg border-b border-gray-400 p-4 z-50 md:hidden">
      <div className="flex items-center justify-between gap-4">
        <MobileMenu
          episodes={episodes}
          activeEpisode={activeEpisode}
          onEpisodeClick={onEpisodeClick}
        />

        <button
          onClick={showIntroModal}
          className="text-sm text-gray-900 font-medium whitespace-nowrap bg-white hover:bg-gray-50 px-4 py-2 rounded-lg border border-gray-300 transition-colors"
        >
          What is this?
        </button>
      </div>
    </header>
  )
}
