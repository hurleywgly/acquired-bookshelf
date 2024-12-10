import { unlink } from 'fs/promises';

const OLD_PATHS = [
  './data/books.json',
  './data/stats.json',
  './data/episode-cache.json',
  './public/data/books.json',
  './public/data/stats.json',
  './lib/data/episode-cache.json'
];

async function cleanup() {
  for (const path of OLD_PATHS) {
    try {
      await unlink(path);
      console.log(`Removed old file: ${path}`);
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
        console.error(`Error removing ${path}:`, error);
      }
    }
  }
}

cleanup(); 