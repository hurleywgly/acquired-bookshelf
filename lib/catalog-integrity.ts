interface CatalogBook { id: string; title: string; author: string }
export function uniqueNewBooks<T extends CatalogBook>(existing: T[], candidates: T[]): T[] {
  const workKey = (book: T) => `${book.title.split(':')[0]}|${book.author}`.normalize('NFKD').toLowerCase().replace(/[^a-z0-9|]/g, '')
  const ids = new Set(existing.map(book => book.id))
  const works = new Set(existing.map(workKey))
  return candidates.filter(book => {
    const work = workKey(book)
    if (ids.has(book.id) || works.has(work)) return false
    ids.add(book.id); works.add(work)
    return true
  })
}
