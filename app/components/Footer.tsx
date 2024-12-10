import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-transparent py-4 px-6">
      <div className="container mx-auto flex justify-end">
        <Link 
          href="https://www.linkedin.com/in/rywigs/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-gray-600 hover:text-gray-800 transition-colors"
        >
          🛠️ Built by Ryan
        </Link>
      </div>
    </footer>
  )
}