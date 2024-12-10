# Acquired Bookshelf - Product 1-Pager

## Description
Acquired Bookshelf is an automated resource aggregator that creates a comprehensive, searchable library of all books and resources mentioned in Acquired podcast episodes. The platform automatically scrapes episode notes and website content to build a curated collection of learning materials referenced by Ben and David.

## Problem
Acquired listeners who want to dive deeper into specific topics or company stories currently have to manually search through episode notes or rely on memory to find book recommendations and resources. There's no central repository of these valuable learning materials, making it difficult for listeners to fully leverage the podcast's rich reference material.

## Why
- Acquired has a highly engaged audience of entrepreneurs, investors, and business enthusiasts who consistently seek to deepen their knowledge
- Episode notes contain numerous high-quality book recommendations and resources, but they're scattered across hundreds of episodes
- Community members frequently ask about book recommendations in Discord and social media
- The podcast's comprehensive research approach means their sources are particularly valuable for listeners

## Success
Primary Metrics:
- Monthly Active Users (target: 1000+ in first 3 months)
- Average Time on Site (target: 5+ minutes per session)
- Return Visitor Rate (target: 40%+ monthly return rate)

Secondary Metrics:
- Number of resources successfully indexed
- Click-through rate to purchase links
- Resource coverage (% of episodes with at least one indexed resource)
- Scraping success rate (% of episodes where sources are successfully retrieved)

## Audience
Primary: Active Acquired podcast listeners who:
- Want to deepen their knowledge of specific companies or topics
- Are looking for structured learning paths based on episode themes
- Regularly engage with the show's content beyond just listening

Secondary: Business/tech enthusiasts who might discover Acquired through the resource library

## What
1. Data Pipeline:
   a. Manual Source Management:
      - Maintain manual-sources.json with Amazon book URLs
      - Associate books with episodes via season/episode numbers
      - Track episode metadata (name, season, episode number)

   b. Metadata Enrichment:
      - Process Amazon URLs for basic book info
      - Fetch book covers from Open Library API
      - Retrieve subject categorization from Open Library
      - Implement rate limiting and batch processing
      - Cache successful responses

   c. Data Storage:
      - Generate static JSON files
      - Maintain data integrity
      - Version control book dataset
      - Track processing success metrics

2. User Interface:
   - Horizontal scrolling book tile layout
   - First tile: Acquired Podcast artwork (cropped, links to acquired.fm)
   - Book tiles with cover art and hover states showing:
     * Title and author
     * Episode reference
     * Amazon purchase link (opens in new tab)
   - Horizontally scrollable category tags with chevron navigation
   - Clean search bar for text-based filtering
   - Responsive design maintaining horizontal scroll pattern

3. Core Interactions:
   - Hover-based information reveal on book tiles
   - Category-based filtering via tag selection
   - Text search across all book metadata
   - External linking to Amazon and acquired.fm

## How
Rapid Development Approach using AI Coding Assistants and Static Generation:

Phase 1 - Frontend MVP (2-3 hours):
- Use Cursor/V0 to scaffold Next.js website
- Implement UI components matching mockups
- Set up static data structure with sample data
- Deploy to Vercel

Phase 2 - Data Pipeline (2-3 hours):
- Set up manual-sources.json structure
- Implement Open Library API integration
- Build batch processing system
- Generate initial static dataset
- Document metadata enrichment process

Phase 3 - Testing & Deployment (2 hours):
- Set up repository structure
- Test data generation pipeline
- Validate book metadata enrichment
- Deploy initial version
- Share with community

## When
Same-Day Timeline:

Hour 0-3:
- Set up development environment
- Build core UI components
- Implement search and filtering

Hour 3-6:
- Develop scraping script with robust pattern matching
- Test with sample episodes
- Generate initial dataset
- Clean up UI

Hour 6-8:
- Deploy first version
- Share with community

Additional efforts:
- Github Action to automate pipeline
- Not needed for first version

Key Milestones:
1. Working frontend with sample data (Hour 3)
2. Manual data pipeline working (Hour 5)
3. Community launch (Hour 8)
4. Automate pipline (TBD)