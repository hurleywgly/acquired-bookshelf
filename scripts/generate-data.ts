import { getBatchBookMetadata } from '../lib/openLibrary.js'
import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import manualSources from '../app/lib/data/manual-sources.json' assert { type: "json" }

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OUTPUT_PATHS = {
    BOOKS_JSON: './public/data/books.json',
    STATS_JSON: './public/data/stats.json'
};

// Add manual covers path
const MANUAL_COVERS_PATH = './data/manual-covers.json';

async function loadManualCovers() {
  try {
    console.log('Loading manual covers from:', MANUAL_COVERS_PATH);
    const data = await fs.readFile(MANUAL_COVERS_PATH, 'utf8');
    const covers = JSON.parse(data);
    console.log('Loaded manual covers count:', Object.keys(covers).length);
    return covers;
  } catch (error) {
    console.error('Error loading manual covers:', error);
    return {};
  }
}

async function ensureDirectoryExists(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function generateData() {
  try {
    console.log('Starting data generation...')
    
    // Load manual covers first
    const manualCovers = await loadManualCovers();
    
    // Process manual sources
    console.log('Processing manual sources...')
    const bookUrls: { url: string; episode: { name: string; seasonNumber: number; episodeNumber: number } }[] = []
    
    for (const [episodeId, sourceData] of Object.entries(manualSources)) {
      const [seasonNumber, episodeNumber] = episodeId.split('-').map(Number)
      
      if (!Array.isArray(sourceData.bookUrls)) {
        console.warn(`Warning: Invalid bookUrls for episode ${episodeId}`)
        continue
      }

      for (const url of sourceData.bookUrls) {
        if (typeof url === 'string' && url.includes('amazon.com')) {
          bookUrls.push({
            url,
            episode: {
              name: sourceData.episodeName,
              seasonNumber,
              episodeNumber
            }
          })
        }
      }
    }
    
    console.log(`Found ${bookUrls.length} book URLs from manual sources`)

    // Get book metadata from Open Library
    console.log('Fetching book metadata from Open Library...')
    const booksMetadata = await getBatchBookMetadata(
      bookUrls.map(b => b.url)
    )

    // Combine data
    const books = booksMetadata
      .map((metadata, index) => {
        if (!metadata) return null
        
        const { url, episode } = bookUrls[index]
        const id = url.split('/dp/')[1]?.split('/')[0] || `book-${index}`
        
        // Create base book object
        const book = {
          id,
          title: metadata.title,
          author: metadata.author,
          coverUrl: metadata.coverUrl || '/placeholder.svg',
          amazonUrl: url,
          category: metadata.subjects?.[0] || 'Uncategorized',
          episodeRef: episode
        }

        // Check for manual cover
        if (manualCovers[id]) {
          console.log(`Applying manual cover for book: ${id} - ${book.title}`);
          book.coverUrl = manualCovers[id].coverUrl;
        } else {
          console.log(`No manual cover found for: ${id} - ${book.title}`);
        }

        return book;
      })
      .filter((book): book is NonNullable<typeof book> => book !== null)

    // Deduplicate books based on their ID
    const uniqueBooks = Array.from(new Map(books.map(book => [book.id, book])).values())

    // Generate stats
    const stats = {
      totalBooks: uniqueBooks.length,
      manualSourcesCount: Object.keys(manualSources).length,
      manualCoversCount: Object.keys(manualCovers).length,
      lastUpdated: new Date().toISOString()
    }

    // Save files
    await ensureDirectoryExists(OUTPUT_PATHS.BOOKS_JSON);
    await ensureDirectoryExists(OUTPUT_PATHS.STATS_JSON);

    await Promise.all([
      fs.writeFile(OUTPUT_PATHS.BOOKS_JSON, JSON.stringify(uniqueBooks, null, 2)),
      fs.writeFile(OUTPUT_PATHS.STATS_JSON, JSON.stringify(stats, null, 2))
    ]);

    console.log('Data generation complete!')
    console.log('Stats:', stats)

  } catch (error) {
    console.error('Error generating data:', error)
    process.exit(1)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateData()
}

export { generateData }