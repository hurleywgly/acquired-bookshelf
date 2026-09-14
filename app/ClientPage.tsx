'use client'

import { useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { Search } from 'lucide-react'
import { Book } from '@/lib/data'
import { groupBooksByEpisode } from '@/lib/groupBooks'
import { episodeKey, filterShelf, normalizeSearch } from '@/lib/shelfSearch'
import IntroModal from './components/IntroModal'
import './bookshelf.css'

const podcastLinks = [
  { name: 'Spotify', icon: '/spotify-icon.svg', url: 'https://open.spotify.com/show/7Fj0XEuUQLUqoMZQdsLXqp' },
  { name: 'Apple Podcasts', icon: '/apple-podcast-icon.svg', url: 'https://podcasts.apple.com/us/podcast/acquired/id1050462261' },
  { name: 'YouTube', icon: '/youtube-icon.svg', url: 'https://www.youtube.com/c/AcquiredFM' },
]

function Cover({ book, priority }: { book: Book; priority: boolean }) {
  const [failed, setFailed] = useState(false)
  return <div className="cover">{failed ? <div className="cover-fallback">{book.title}</div> :
    <Image src={book.coverUrl} alt={`${book.title} cover`} fill
      sizes="(max-width: 539px) 45vw, (max-width: 1099px) 30vw, 250px"
      priority={priority} onError={() => setFailed(true)} />}</div>
}

export default function ClientPage({ initialBooks }: { initialBooks: Book[] }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState('')
  const [showIntro, setShowIntro] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const episodes = useMemo(() => groupBooksByEpisode(initialBooks), [initialBooks])
  const books = useMemo(() => [...episodes.flatMap(e => e.books), ...initialBooks.filter(b => !b.episodeRef)], [episodes, initialBooks])
  const filtered = useMemo(() => filterShelf(books, query, active), [books, query, active])
  const available = useMemo(() => new Set(filterShelf(books, query).map(episodeKey)), [books, query])
  const hasUnsorted = books.some(b => !b.episodeRef)
  const activeName = episodes.find(e => e.id === active)?.name || 'Other books'
  const reset = () => { setQuery(''); setActive(''); searchRef.current?.focus() }
  const selectEpisode = (id: string) => { setActive(id); window.scrollTo({ top: 0 }) }
  return <div className="bookshelf"><div className="layout">
    <aside className="rail" aria-label="Episode index">
      <div className="brand"><b>ACQUIRED</b> Bookshelf</div>
      <p className="rail-label">Browse episodes</p>
      <nav className="episodes">
        <button className="episode" aria-pressed={!active} onClick={() => selectEpisode('')}><small>THE COMPLETE SHELF</small><span>All episodes</span></button>
        {episodes.filter(e => available.has(e.id) || e.id === active).map(e =>
          <button key={e.id} className="episode" aria-pressed={e.id === active} onClick={() => selectEpisode(e.id)}>
            <small>{e.seasonName || `S${e.seasonNumber}`} · E{e.episodeNumber}</small><span>{e.name}</span>
          </button>)}
        {hasUnsorted && <button className="episode" aria-pressed={active === 'unsorted'} onClick={() => selectEpisode('unsorted')}><span>Other books</span></button>}
      </nav>
      <div className="rail-foot"><button className="about-button" onClick={() => setShowIntro(true)}>What is this?</button></div>
    </aside>
    <div className="page">
      <header className="topbar">
        <div className="mobile-brand"><b>ACQUIRED</b> Bookshelf</div>
        <div className="search-box" role="search">
          <Search className="search-icon" size={18} aria-hidden="true" />
          <input ref={searchRef} id="search" type="search" aria-label="Search books, authors, episodes and categories"
            placeholder="Search books, authors, episodes…" autoComplete="off" value={query}
            onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setQuery('') }} />
          {query && <button className="clear" aria-label="Clear search" onClick={() => { setQuery(''); searchRef.current?.focus() }}>Clear</button>}
        </div>
        <nav className="podcasts" aria-label="Listen to Acquired"><span className="listen-label">Listen</span>
          {podcastLinks.map(link => <a key={link.name} href={link.url} target="_blank" rel="noopener noreferrer" aria-label={`Listen on ${link.name}`} title={link.name}>
            <Image src={link.icon} alt="" width={23} height={23} /></a>)}
        </nav>
      </header>
      <main className="main">
        <div className="heading"><h1>Acquired Bookshelf</h1><button className="about-button" onClick={() => setShowIntro(true)}>What is this?</button></div>
        <div className="filters">
          <p id="status" role="status" aria-live="polite" aria-atomic="true">{filtered.length} {filtered.length === 1 ? 'book' : 'books'}{normalizeSearch(query) ? ` matching “${query.trim()}”` : ''}{active ? ` in ${activeName}` : ` · ${new Set(filtered.map(episodeKey)).size} episodes`}</p>
          <label className="mobile-filter"><span className="sr-only">Filter by episode</span><select aria-label="Filter by episode" value={active} onChange={e => selectEpisode(e.target.value)}>
            <option value="">All episodes</option>{episodes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            {hasUnsorted && <option value="unsorted">Other books</option>}
          </select></label>
          {(query || active) && <button id="reset" onClick={reset}>Show all books</button>}
        </div>
        <div className="shelf"><div className="grid">
          {!normalizeSearch(query) && !active && books.length > 0 && <aside className="quote" aria-label="Charles T. Munger quote">
            <blockquote>“Spend each day trying to be a little wiser than you were when you woke up.”</blockquote>
            <footer><b>Charles T. Munger</b>Poor Charlie&apos;s Almanack</footer>
          </aside>}
          {filtered.map((book, i) => <a className="book" key={`${episodeKey(book)}:${book.id}:${i}`} href={book.amazonUrl} target="_blank" rel="noopener noreferrer" aria-label={`${book.title} by ${book.author} — view on Amazon`}>
            <p className="episode-label"><span>{book.episodeRef?.name || 'Acquired'}</span></p><Cover book={book} priority={i < 6} />
            <div className="caption"><small className="category">{book.category || 'Books'}</small><h2 className="title">{book.title}</h2><p className="author">{book.author}</p></div>
          </a>)}
        </div></div>
        {!filtered.length && <section className="empty"><h2>No matching books</h2><p>Try a shorter title, an author’s name, or an episode. Clear your filters to browse the full shelf.</p><button className="clear" onClick={reset}>Clear search and filters</button></section>}
      </main>
    </div>
  </div><IntroModal open={showIntro} onClose={() => setShowIntro(false)} /></div>
}
