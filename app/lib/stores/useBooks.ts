import { create } from 'zustand'
import { Book } from '@/lib/data'

interface BooksState {
  books: Book[]
  isLoading: boolean
  error: string | null
  fetchBooks: () => Promise<void>
}

export const useBooks = create<BooksState>((set) => ({
  books: [],
  isLoading: true,
  error: null,
  fetchBooks: async () => {
    try {
      const response = await fetch('/api/books', {
        next: { revalidate: 604800 } // Cache for 7 days
      })
      const data = await response.json()
      set({ books: data, isLoading: false })
    } catch (error) {
      set({ error: 'Failed to fetch books', isLoading: false })
    }
  }
})) 