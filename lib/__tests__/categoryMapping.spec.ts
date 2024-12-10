import { readFileSync } from 'fs';
import path from 'path';
import { processBookData } from '../../app/lib/processBooks';
import { TARGET_CATEGORIES } from '../../app/lib/categoryMapping';
import type { Book } from '../../app/lib/processBooks';

describe('Category Mapping', () => {
  test('processes all books and maps to valid categories', () => {
    // Read books from the current books.json
    const booksPath = path.join(process.cwd(), 'public', 'data', 'books.json');
    const books = JSON.parse(readFileSync(booksPath, 'utf-8')) as Book[];
    const processedBooks = processBookData(books);

    // Test category distribution
    const categoryCount = processedBooks.reduce((acc: Record<string, number>, book: Book) => {
      acc[book.category] = (acc[book.category] || 0) + 1;
      return acc;
    }, {});

    console.log('Category Distribution:', categoryCount);

    // Verify every book has a valid category
    processedBooks.forEach(book => {
      expect(TARGET_CATEGORIES.includes(book.category as any)).toBe(true);
    });

    // Log some sample mappings for manual review
    console.log('\nSample category mappings:');
    processedBooks.slice(0, 5).forEach(book => {
      console.log(`"${book.title}" -> ${book.category}`);
      console.log(`Original category: ${book.category}\n`);
    });
  });
});