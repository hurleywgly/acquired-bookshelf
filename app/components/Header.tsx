import { Search } from 'lucide-react'

interface HeaderProps {
  searchTerm: string
  setSearchTerm: (term: string) => void
  showIntroModal: () => void
}

export default function Header({ searchTerm, setSearchTerm, showIntroModal }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 p-4">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex-1 max-w-2xl">
          <div className="relative">
            <input
              type="text"
              placeholder="Search books, authors, episodes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-active-green focus:border-transparent text-base"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          </div>
        </div>
        
        <button
          onClick={showIntroModal}
          className="ml-4 text-sm text-gray-600 hover:text-gray-900 font-medium"
        >
          What is this?
        </button>
      </div>
      
      {/* Quote Section */}
      <div className="max-w-7xl mx-auto mt-6 mb-2">
        <blockquote className="text-gray-600 italic text-lg">
          &ldquo;Spend each day trying to be a little wiser than you were when you woke up.&rdquo;
        </blockquote>
        <div className="mt-2 text-sm text-gray-500">
          <span className="font-medium">Charles T. Munger</span> &mdash; Poor Charlie&apos;s Almanack
        </div>
      </div>
    </header>
  )
}