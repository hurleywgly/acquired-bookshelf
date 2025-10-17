import { Book } from './data'

export interface Quote {
  text: string
  author: string
  source: string
}

export interface Episode {
  id: string
  name: string
  seasonNumber: number
  episodeNumber: number
  books: Book[]
  quote?: Quote
}

export function groupBooksByEpisode(books: Book[]): Episode[] {
  const episodeMap = new Map<string, Episode>()
  
  // Group books by episode
  books.forEach(book => {
    if (book.episodeRef) {
      const episodeId = `${book.episodeRef.seasonNumber}-${book.episodeRef.episodeNumber}`
      
      if (!episodeMap.has(episodeId)) {
        episodeMap.set(episodeId, {
          id: episodeId,
          name: book.episodeRef.name,
          seasonNumber: book.episodeRef.seasonNumber,
          episodeNumber: book.episodeRef.episodeNumber,
          books: []
        })
      }
      
      episodeMap.get(episodeId)!.books.push(book)
    }
  })
  
  // Convert to array and sort by season/episode
  const episodes = Array.from(episodeMap.values()).sort((a, b) => {
    if (a.seasonNumber !== b.seasonNumber) {
      return b.seasonNumber - a.seasonNumber // Newer seasons first
    }
    return b.episodeNumber - a.episodeNumber // Newer episodes first
  })

  // Add quote to the first episode
  if (episodes.length > 0) {
    episodes[0].quote = {
      text: "Spend each day trying to be a little wiser than you were when you woke up.",
      author: "Charles T. Munger",
      source: "Poor Charlie's Almanack"
    }
  }

  return episodes
}