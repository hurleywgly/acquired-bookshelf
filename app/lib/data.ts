// Define interfaces
export interface EpisodeRef {
    name: string
    seasonNumber: number
    episodeNumber: number
  }
  
  export interface Book {
    id: string
    amazonUrl: string
    title: string
    author: string
    coverUrl: string
    category: string
    episodeRef: EpisodeRef | null
  }