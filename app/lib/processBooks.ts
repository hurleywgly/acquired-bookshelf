import { mapToTargetCategory } from './categoryMapping';

export interface Book {
  title: string;
  author: string;
  category: string;
  id: string;
  amazonUrl: string;
  coverUrl: string;
  episodeRef: {
    name: string;
    seasonNumber: number;
    episodeNumber: number;
  } | null;
}

export function processBookData(books: Book[]) {
  return books.map(book => ({
    ...book,
    category: mapToTargetCategory(book)
  }));
}