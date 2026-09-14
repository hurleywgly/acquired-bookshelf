import { uniqueNewBooks } from '../catalog-integrity'
import { parseEpisodeFeed, slugify } from '../scraper'
import { extractAmazonLinksFromEpisodePage, parseSeasonEpisodeHint } from '../episode-page-parser'
import { URLValidator } from '../url-validator'
import * as cheerio from 'cheerio'

test('RSS identity is explicit, deduplicated and excludes bonus content', () => {
  const item = (extra: string) => `<item><title>Home Depot</title><link>https://www.acquired.fm/episodes/home-depot</link><pubDate>Sun, 13 Sep 2026 12:00:00 GMT</pubDate>${extra}</item>`
  const episodes = parseEpisodeFeed(`<rss><channel>${item('<itunes:episodeType>bonus</itunes:episodeType>')}${item('<itunes:season>20</itunes:season><itunes:episode>2</itunes:episode>')}${item('')}</channel></rss>`, '2026-09-14')
  expect(episodes).toHaveLength(1)
  expect(episodes[0]).toMatchObject({ seasonNumber: 20, episodeNumber: 2, year: 2026, slug: 'home-depot' })
  expect(parseEpisodeFeed('<urlset><url><loc>https://www.acquired.fm/episodes/old</loc><lastmod>2026-09-01</lastmod></url></urlset>', '2026')).toEqual([])
  expect(slugify("Trader Joe’s")).toBe('trader-joes')
  expect(slugify("Trader Joe's")).toBe('trader-joes')
})
test('source extraction excludes carve-outs and deduplicates product URL variants', () => {
  const $ = cheerio.load(`<h2>Links</h2><ul><li><a href="https://www.amazon.com/gp/product/0812933788">Book</a></li></ul><h2>Carve Outs</h2><ul><li><a href="https://www.amazon.com/dp/1234567890">Other</a></li></ul><div class="sources-rich-text"><a href="https://www.amazon.com/dp/0812933788?tag=abc">Same</a><a href="https://www.amazon.com/dp/0063259923">Source</a></div>`)
  expect(extractAmazonLinksFromEpisodePage($, new URLValidator())).toEqual(['https://www.amazon.com/dp/0812933788', 'https://www.amazon.com/dp/0063259923'])
  expect(extractAmazonLinksFromEpisodePage(cheerio.load('<a href="https://www.amazon.com/dp/1234567890">Unrelated</a>'), new URLValidator())).toEqual([])
})
test('official season badge wins over unrelated transcript numbering', () => {
  expect(parseSeasonEpisodeHint(cheerio.load('<p>Spring 2025 Episode 2</p><div><a href="/season/fall-2026">Fall 2026</a><div>Episode 2 • September 13, 2026</div></div>'))).toEqual({seasonNumber:2026, episodeNumber:2, seasonName:'Fall 2026'})
})
test('duplicate ASINs and editions are rejected within a batch and on repeat runs', () => {
  const a={id:'0812933788',title:'Built from Scratch',author:'Bernie Marcus'}
  const b={...a,id:'1665273631',title:'Built from Scratch: A Business Story'}
  expect(uniqueNewBooks([], [a,a,b])).toEqual([a])
  expect(uniqueNewBooks([a], [a,b])).toEqual([])
})
