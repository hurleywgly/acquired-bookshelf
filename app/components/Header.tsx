import { Search } from 'lucide-react'

interface HeaderProps {
  searchTerm: string
  setSearchTerm: (term: string) => void
}

export default function Header({ searchTerm, setSearchTerm }: HeaderProps) {
  return (
    <header className="flex items-center justify-between p-3 bg-black text-white">
      <h2 className="text-xl font-semibold flex items-center gap-4 text-[#33ffcc] tracking-wider">
        ACQUIRED BOOKSHELF
      </h2>
      <div className="relative">
        <input
          type="text"
          placeholder="Search books..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-[300px] pl-10 pr-4 py-2 rounded-full border border-gray-600 bg-gray-900 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5ebd9c]"
        />
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
      </div>
    </header>
  )
}