# Acquired Bookshelf Weekly Scraper

This automated scraper system checks the Acquired podcast website for new episodes and extracts book recommendations from their Google Docs source documents.

## 🚀 Features

- **Automated Episode Detection**: Monitors https://www.acquired.fm/episodes for new episodes
- **Google Docs Integration**: Extracts Amazon book links from episode source documents
- **Open Library API**: Fetches book metadata and cover images
- **Weekly Scheduling**: Runs automatically every Monday via Render.com cron job
- **Duplicate Prevention**: Avoids adding books that already exist in the database
- **Smart Categorization**: Automatically categorizes books based on subjects and content

## 📁 File Structure

```
scripts/
├── weekly-scraper.ts      # Main scraper class and logic
├── test-scraper.ts        # Test script for development
└── deploy-scraper.js      # Render deployment script

render.yaml                # Render.com configuration
```

## 🔧 Setup Instructions

### 1. Local Development

```bash
# Install dependencies
npm install

# Test the scraper with IPL Cricket episode
npm run test-scraper

# Run the full weekly scraper
npm run scraper
```

### 2. Render.com Deployment

1. **Push to GitHub**: Ensure your code is in a GitHub repository

2. **Create Render Services**:
   - **Web Service**: For the main Next.js application
   - **Cron Job**: For the weekly scraper

3. **Configure the Cron Job**:
   - **Repository**: Link to your GitHub repo
   - **Build Command**: `npm ci`
   - **Start Command**: `npm run scraper`
   - **Schedule**: `0 10 * * 1` (Every Monday at 10 AM UTC)

4. **Environment Variables** (if needed):
   - `NODE_ENV=production`

### 3. Alternative Deployment Options

The `render.yaml` file provides Infrastructure as Code configuration. You can also:

- Use Render's dashboard to create services manually
- Deploy via Render CLI
- Use GitHub Actions for more complex workflows

## 🔍 How It Works

### Episode Detection

1. **Fetch Episode List**: Scrapes all episodes from acquired.fm/episodes
2. **Cache Management**: Stores episode data locally to avoid redundant API calls
3. **New Episode Detection**: Compares against last run timestamp
4. **Source Document Discovery**: Finds Google Docs links on episode pages

### Book Extraction

1. **Google Doc Access**: Tries multiple export formats to access episode sources
2. **Amazon Link Parsing**: Extracts amazon.com book URLs using regex patterns
3. **ASIN Extraction**: Identifies Amazon Standard Identification Numbers
4. **Metadata Enrichment**: Uses Open Library API for titles, authors, covers

### Data Processing

1. **Book Categorization**: Auto-categorizes as Business, Technology, or History
2. **Duplicate Prevention**: Checks existing database before adding books
3. **Data Structure**: Maintains consistent JSON format for frontend consumption
4. **Cover Images**: Downloads high-quality covers from Open Library

## 🧪 Testing

### Test with Specific Episode

```bash
npm run test-scraper
```

This will test the scraper using the Indian Premier League Cricket episode.

### Manual Testing Steps

1. **Check Episode Page**: Verify the episode has a Google Docs "Episode sources" link
2. **Inspect Google Doc**: Ensure the document contains Amazon book links
3. **Validate Extraction**: Confirm links are properly formatted Amazon URLs
4. **Test Metadata**: Check that Open Library returns book information

## 📊 Data Flow

```
acquired.fm/episodes → Episode List → New Episodes → Google Docs → Amazon Links → Open Library API → books.json
```

## 🔧 Configuration

### Scraper Settings

- **Batch Size**: 10 books processed simultaneously
- **Rate Limiting**: 1-second delay between API requests
- **Retry Logic**: 3 attempts for failed requests
- **Categories**: Business, Technology, History (auto-assigned)

### Render Schedule

- **Frequency**: Weekly (every Monday)
- **Time**: 10:00 AM UTC
- **Timezone**: UTC (adjust as needed)

## 🚨 Troubleshooting

### Common Issues

1. **Google Docs Access Denied**
   - Check if document is publicly accessible
   - Try different export formats (HTML, pub)
   - Verify document ID extraction

2. **No Amazon Links Found**
   - Inspect the Google Doc manually
   - Check for redirect wrappers
   - Verify Amazon URL patterns

3. **Open Library API Failures**
   - Rate limiting: Increase delays between requests
   - No matches: Try different search terms
   - Network issues: Implement exponential backoff

4. **Render Deployment Issues**
   - Check build logs for Node.js version compatibility
   - Verify environment variables
   - Review cron job syntax

### Debug Mode

Add logging to troubleshoot:

```typescript
console.log('Debug: Amazon URLs found:', amazonLinks)
console.log('Debug: Metadata results:', metadata)
```

## 📈 Monitoring

### Success Indicators

- New books added to `public/data/books.json`
- Last run timestamp updated in `data/last-scraper-run.json`
- No error logs in Render console

### Failure Indicators

- Empty results despite new episodes
- Repeated timeout errors
- Missing book covers or metadata

## 🔄 Maintenance

### Weekly Tasks

- Monitor Render logs for errors
- Check for changes in Acquired website structure
- Verify Google Docs accessibility

### Monthly Tasks

- Review book categorization accuracy
- Update Open Library API integration if needed
- Check for new Amazon URL patterns

## 🚀 Future Enhancements

- **Email Notifications**: Alert when new books are added
- **Manual Override**: Web interface for adding missed books
- **Enhanced Categorization**: Machine learning for better book classification
- **Multiple Sources**: Support for other podcast source formats
- **Analytics**: Track scraper performance and success rates

## 📝 Contributing

1. Test changes locally with `npm run test-scraper`
2. Ensure the scraper handles edge cases gracefully
3. Update this README with any configuration changes
4. Test deployment on Render staging environment before production