import { getBooks } from '@/lib/books'
import ClientPage from './ClientPage'

export const revalidate = 86400 // revalidate every 24 hours so new scraped books surface promptly

export default async function Home() {
  const books = await getBooks()
  
  return <ClientPage initialBooks={books} />
}