import { filterShelf } from '../shelfSearch'
import { Book } from '../data'
const book = (title: string, author: string, episode = 1): Book => ({ id: title, title, author, category: 'Business & Leadership', coverUrl: '', amazonUrl: '', episodeRef: { name: episode === 1 ? 'Vanguard' : 'Nike', seasonNumber: 2026, episodeNumber: episode } })
const books = [book('Stay the Course', 'John C. Bogle'), book('Bogle Effect', 'Eric Balchunas'), book('Shoe Dog', 'Phil Knight', 2)]
test('matches individual records, across fields and normalized punctuation', () => {
  expect(filterShelf(books, ' BOGLE ')).toHaveLength(2)
  expect(filterShelf(books, 'john vanguard')).toEqual([books[0]])
  expect(filterShelf(books, 'zzzz-no-match')).toEqual([])
  expect(filterShelf([book('Hermès', 'Author')], 'hermes')).toHaveLength(1)
})
test('combines episode and search, resets without stale cards, retains categories', () => {
  expect(filterShelf(books, 'bogle', '2026-2')).toEqual([])
  expect(filterShelf(books, '', '2026-2')).toEqual([books[2]])
  expect(filterShelf(books, 'leadership')).toHaveLength(3)
  expect(filterShelf(books, '')).toEqual(books)
})
