import { Book } from './data'

export const normalizeSearch = (value: string) => value.normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

export const episodeKey = (book: Book) => book.episodeRef
  ? book.episodeRef.slug || normalizeSearch(book.episodeRef.name) : 'unsorted'

export function filterShelf(books: Book[], query: string, episode = '') {
  const tokens = normalizeSearch(query).split(' ').filter(Boolean)
  return books.filter(book => {
    if (episode && episodeKey(book) !== episode) return false
    const text = normalizeSearch([book.title, book.author, book.category, book.episodeRef?.name].join(' '))
    return tokens.every(token => text.includes(token))
  })
}
