import { getAllEpisodes, getSourceDocument } from '../scraper'
import * as fs from 'fs'

// Mock global fetch
const originalFetch = global.fetch
beforeAll(() => {
  global.fetch = jest.fn()
})

afterAll(() => {
  global.fetch = originalFetch
})

describe('Episode Scraper', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock filesystem operations
    jest.spyOn(fs.promises, 'readFile').mockRejectedValue(new Error('No cache'))
    jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined)
    jest.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined)
  })

  test('filters out ACQ2 episodes', async () => {
    // Mock HTML for page 1
    const mockHtml = `
      <div role="listitem">
        <div class="blog-title">Regular Episode</div>
        <div class="preview-text">Season 14, Episode 1</div>
        <div class="thumbnail-date">2024-01-01</div>
        <a href="/episode/1">Link</a>
      </div>
      <div role="listitem">
        <div class="blog-title">ACQ2 Episode</div>
        <div class="preview-text">Season 1, Episode 2</div>
        <div class="category-tag---top-10">ACQ2</div>
        <div class="thumbnail-date">2024-01-02</div>
        <a href="/episode/2">Link</a>
      </div>
    `

    ;(global.fetch as jest.Mock).mockImplementation(() => ({
      ok: true,
      text: async () => mockHtml,
    }))

    const episodes = await getAllEpisodes()
    
    expect(episodes.filter(e => !e.isACQ2)).toHaveLength(1)
    expect(episodes[0].name).toBe('Regular Episode')
    expect(episodes[0].page).toBe(1)
  })

  test('handles different episode number formats', async () => {
    const mockHtml = `
      <article>
        <h2>Season Episode</h2>
        <h3>Season 14, Episode 1</h3>
      </article>
      <article>
        <h2>Fall Episode</h2>
        <h3>Fall 2024, Episode 3</h3>
      </article>
    `

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      text: async () => mockHtml,
      ok: true,
    })

    const episodes = await getAllEpisodes()
    
    expect(episodes).toHaveLength(2)
    expect(episodes[0].seasonNumber).toBe(14)
    expect(episodes[0].episodeNumber).toBe(1)
    expect(episodes[1].seasonNumber).toBe(2024)
    expect(episodes[1].episodeNumber).toBe(3)
  })

  test('handles source document links', async () => {
    const mockHtml = `
      <article>
        <h2>Episode with Sources</h2>
        <h3>Season 14, Episode 1</h3>
        <a href="https://docs.google.com/document/source1">Episode sources</a>
      </article>
    `

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      text: async () => mockHtml,
      ok: true,
    })

    const episodes = await getAllEpisodes()
    
    expect(episodes[0].sourceUrl).toBe('https://docs.google.com/document/source1')
  })

  test('handles source document extraction', async () => {
    const mockHtml = `
      <a href="https://amazon.com/dp/B00123ABC4">Book 1</a>
      <a href="https://amazon.com/B00456XYZ7">Book 2</a>
      <a href="https://amazon.com/gp/product/C00789DEF1">Book 3</a>
    `

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      text: async () => mockHtml,
      ok: true,
    })

    const bookUrls = await getSourceDocument('https://example.com/sources')
    
    expect(bookUrls).toHaveLength(3)
    expect(bookUrls).toContain('https://amazon.com/dp/B00123ABC4')
    expect(bookUrls).toContain('https://amazon.com/dp/B00456XYZ7')
    expect(bookUrls).toContain('https://amazon.com/dp/C00789DEF1')
  })
})