'use client'

import { useState } from 'react'
import Header from './components/Header'
import CategoryNav from './components/CategoryNav'
import BookGrid from './components/BookGrid'
import Footer from './components/Footer'
import { Book } from '@/lib/data'

interface ClientPageProps {
  initialBooks: Book[]
}

export default function ClientPage({ initialBooks }: ClientPageProps) {
  const [activeCategory, setActiveCategory] = useState('All Books')
  const [searchTerm, setSearchTerm] = useState('')

  const filteredBooks = initialBooks.filter(book => {
    const matchesCategory = activeCategory === 'All Books' || book.category === activeCategory
    
    const searchTermLower = searchTerm.toLowerCase()
    const matchesSearch = 
      book.title.toLowerCase().includes(searchTermLower) ||
      book.author.toLowerCase().includes(searchTermLower) ||
      (book.episodeRef?.name.toLowerCase().includes(searchTermLower) ?? false)

    return matchesCategory && matchesSearch
  })

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <Header searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
      <main className="flex-grow flex flex-col px-4 overflow-hidden">
        <div className="flex flex-col justify-center h-full">
          <h1 className="text-3xl md:text-6xl font-bold text-black text-center md:text-left">
            ACQUIRED PODCAST BOOKS
          </h1>
          <CategoryNav 
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
          />
          {filteredBooks.length > 0 ? (
            <BookGrid books={filteredBooks} className="mt-4" />
          ) : (
            <div className="mt-8 text-center">
              <p className="text-xl text-gray-600">
                No books found for &quot;{searchTerm}&quot;{activeCategory !== 'All Books' ? ` in ${activeCategory}` : ''}.
              </p>
              <button 
                onClick={() => {
                  setSearchTerm('')
                  setActiveCategory('All Books')
                }}
                className="mt-4 px-6 py-2 bg-[#5ebd9c] text-white rounded-full hover:bg-[#4ca98a] transition-colors"
              >
                Clear filters
              </button>
            </div>
          )}
          <p className="text-xl text-gray-600 mt-16">
            Discover books used by Ben and David to research<br />
            your favorite episodes of Acquired.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
} 