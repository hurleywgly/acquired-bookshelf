// components/CategoryNav.tsx
'use client'

import { useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { TARGET_CATEGORIES } from '@/lib/categoryMapping'

interface CategoryNavProps {
  activeCategory: string;
  setActiveCategory: (category: string) => void;
}

export default function CategoryNav({ activeCategory, setActiveCategory }: CategoryNavProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
    }
  }

  useEffect(() => {
    const container = scrollContainerRef.current
    if (container) {
      const handleWheel = (e: WheelEvent) => {
        e.preventDefault()
        container.scrollLeft += e.deltaY
      }
      container.addEventListener('wheel', handleWheel, { passive: false })
      return () => container.removeEventListener('wheel', handleWheel)
    }
  }, [])

  return (
    <div className={`relative flex items-center my-4`}>
      <button 
        onClick={() => scroll('left')} 
        className="p-2 bg-white rounded-full z-10 shadow-md hover:bg-gray-50"
        aria-label="Scroll left"
      >
        <ChevronLeft size={24} />
      </button>
      <div className="overflow-hidden mx-4 flex-grow">
        <div
          ref={scrollContainerRef}
          className="flex space-x-4 overflow-x-auto scrollbar-hide"
          style={{ scrollBehavior: 'smooth' }}
        >
          {TARGET_CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`whitespace-nowrap px-4 py-2 rounded-full ${
                activeCategory === category
                  ? 'bg-[#5ebd9c] text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
      <button 
        onClick={() => scroll('right')} 
        className="p-2 bg-white rounded-full z-10 shadow-md hover:bg-gray-50"
        aria-label="Scroll right"
      >
        <ChevronRight size={24} />
      </button>
    </div>
  )
}