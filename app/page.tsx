import { getBooks } from '@/lib/books'
import ClientPage from './ClientPage'

export const revalidate = 604800 // revalidate every 7 days

export default async function Home() {
  const books = await getBooks()
  
  return <ClientPage initialBooks={books} />
}