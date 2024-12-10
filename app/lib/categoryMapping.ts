// app/lib/categoryMapping.ts
export const TARGET_CATEGORIES = [
    "All Books",
    "Podcast",
    "Business & Leadership",
    "Technology & Innovation",
    "Startups & Venture Capital", 
    "Biographies & History",
    "Science & Engineering",
    "Economics & Finance",
    "Fiction & Literature"
  ] as const;
  
  export type TargetCategory = typeof TARGET_CATEGORIES[number];
  
  interface BookInfo {
    title: string;
    author: string;
    category: string;
  }
  
  export function mapToTargetCategory(book: BookInfo): TargetCategory {
    const searchText = `${book.title} ${book.author} ${book.category}`.toLowerCase();
  
    // Order matters - check most specific categories first
    if (searchText.match(/venture|startup|entrepreneur|vc|founder/)) {
      return "Startups & Venture Capital";
    }
  
    if (searchText.match(/comput|software|programming|tech|internet|digital|code|silicon valley/)) {
      return "Technology & Innovation";  
    }
  
    if (searchText.match(/business|leadership|management|strategy|ceo|executive/)) {
      return "Business & Leadership";
    }
  
    if (searchText.match(/biography|memoir|life|history|historical/)) {
      return "Biographies & History";
    }
  
    if (searchText.match(/economics|finance|market|stock|investment|capital/)) {
      return "Economics & Finance";
    }
  
    if (searchText.match(/science|engineering|physics|research/)) {
      return "Science & Engineering";
    }
  
    if (searchText.match(/fiction|novel|story|fantasy|sci-fi|literature/)) {
      return "Fiction & Literature";
    }
  
    return "Business & Leadership";
  }