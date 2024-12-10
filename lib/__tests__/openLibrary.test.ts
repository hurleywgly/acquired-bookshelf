import { getBookMetadata, getBatchBookMetadata } from '../openLibrary'

// Mock timer functions
jest.useFakeTimers()

describe('Open Library API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  test('getBookMetadata returns book data when found', async () => {
    const mockResponse = {
      docs: [{
        title: 'Zero to One',
        author_name: ['Peter Thiel'],
        cover_i: 123456,
        first_publish_year: 2014,
        isbn: ['0123456789'],
        key: '/works/OL123M'
      }]
    }

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse
    })

    const metadata = await getBookMetadata('Zero to One Peter Thiel')
    
    expect(metadata).toEqual({
      title: 'Zero to One',
      author: 'Peter Thiel',
      coverUrl: 'https://covers.openlibrary.org/b/id/123456-L.jpg',
      firstPublishYear: 2014,
      isbn: '0123456789',
      olid: 'OL123M'
    })
  })

  test('handles rate limiting with retries', async () => {
    jest.setTimeout(10000) // Increase timeout to 10 seconds
    
    const mockSuccessResponse = {
      docs: [{ title: 'Test Book', author_name: ['Test Author'] }]
    }

    global.fetch = jest.fn()
      .mockResolvedValueOnce({ 
        ok: false, 
        status: 429 
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSuccessResponse
      })

    const metadataPromise = getBookMetadata('Test Book')
    await jest.runAllTimersAsync()
    const metadata = await metadataPromise
    
    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(metadata).not.toBeNull()
  })

  test('getBatchBookMetadata processes books in batches', async () => {
    jest.setTimeout(10000)
    
    jest.spyOn(global, 'setTimeout')
    
    const mockBooks = [
      { title: 'Book 1', author_name: ['Author 1'] },
      { title: 'Book 2', author_name: ['Author 2'] },
      { title: 'Book 3', author_name: ['Author 3'] }
    ].map(book => ({...book}))

    let callCount = 0
    global.fetch = jest.fn().mockImplementation(() => {
      const currentBook = mockBooks[callCount++]
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ docs: [currentBook] })
      })
    })

    const urls = [
      'amazon.com/book1',
      'amazon.com/book2',
      'amazon.com/book3'
    ]

    const resultsPromise = getBatchBookMetadata(urls)
    await jest.runAllTimersAsync()
    const results = await resultsPromise

    expect(results).toHaveLength(3)
    expect(results.filter(r => r !== null)).toHaveLength(3)
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000)
  })

  test('handles empty batch gracefully', async () => {
    const results = await getBatchBookMetadata([])
    expect(results).toEqual([])
  })

  test('continues processing batch even if some requests fail', async () => {
    jest.setTimeout(10000)
    
    // Temporarily suppress console.warn for this test
    const originalWarn = console.warn
    console.warn = jest.fn()
    
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ 
        ok: true,
        status: 200,
        json: async () => ({ docs: [{ title: 'Book 1', author_name: ['Author 1'] }] })
      })
      .mockRejectedValueOnce({
        ok: false,
        status: 500,
        message: 'Network error'
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ docs: [{ title: 'Book 3', author_name: ['Author 3'] }] })
      })
  
    const urls = [
      'amazon.com/book1',
      'amazon.com/book2',
      'amazon.com/book3'
    ]
  
    const resultsPromise = getBatchBookMetadata(urls)
    await jest.runAllTimersAsync()
    const results = await resultsPromise
    
    expect(results).toHaveLength(3)
    expect(results[0]).not.toBeNull()
    expect(results[1]).toBeNull()
    expect(results[2]).not.toBeNull()

    // Restore console.warn after the test
    console.warn = originalWarn
  })
})