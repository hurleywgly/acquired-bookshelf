import { getBookMetadata, getBatchBookMetadata } from '../openLibrary'
const originalFetch = global.fetch
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks() })
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers() })
const found = { title: 'Zero to One', author_name: ['Peter Thiel'], cover_i: 123456, isbn: ['0804139296'] }
const response = (docs: unknown[]) => ({ ok: true, status: 200, json: async () => ({docs}) })
test('uses exact ISBN lookup for a product URL', async () => {
  global.fetch = jest.fn().mockResolvedValue(response([found]))
  expect(await getBookMetadata('https://www.amazon.com/dp/0804139296')).toMatchObject({ title: 'Zero to One', author: 'Peter Thiel' })
  expect(global.fetch).toHaveBeenCalledWith('https://openlibrary.org/search.json?isbn=0804139296', expect.any(Object))
})
test('retries rate limits without switching to fuzzy search', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce({ok:false,status:429}).mockResolvedValue(response([found]))
  const pending = getBookMetadata('https://www.amazon.com/dp/0804139296')
  await jest.runAllTimersAsync()
  expect(await pending).toMatchObject({title:'Zero to One'})
  expect(global.fetch).toHaveBeenCalledTimes(2)
})
test('rejects unrelated general matches and cover-only products', async () => {
  global.fetch = jest.fn().mockImplementation(async (url: string) => url.startsWith('https://www.amazon.com')
    ? {ok:true,status:200,text:async()=>'<html>Robot check</html>'}
    : {ok:true,status:200,headers:{get:()=> 'image/jpeg'},json:async()=>({docs:[found]})})
  expect(await getBookMetadata('https://www.amazon.com/dp/B018BZ3SCM')).toBeNull()
  expect((global.fetch as jest.Mock).mock.calls.some(([url]) => String(url).includes('search.json?q='))).toBe(false)
})
test('batch keeps null entries aligned with their original URL', async () => {
  global.fetch = jest.fn().mockImplementation(async (url: string) => url.includes('0804139296')
    ? response([found]) : {ok:false,status:404})
  const pending = getBatchBookMetadata(['https://www.amazon.com/dp/0804139296','https://www.amazon.com/dp/B018BZ3SCM','https://www.amazon.com/dp/0804139296'])
  await jest.runAllTimersAsync()
  expect((await pending).map(x=>x?.title ?? null)).toEqual(['Zero to One', null, 'Zero to One'])
  expect(await getBatchBookMetadata([])).toEqual([])
})
