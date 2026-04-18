/**
 * Discord Webhook Notifier
 * Sends scraper results and errors to Discord
 */

interface DiscordEmbedField {
  name: string
  value: string
  inline?: boolean
}

interface DiscordEmbed {
  title: string
  url?: string
  description?: string
  color: number
  fields?: DiscordEmbedField[]
  thumbnail?: { url: string }
  image?: { url: string }
  timestamp?: string
  footer?: {
    text: string
  }
}

export interface DiscordBookEntry {
  title: string
  author: string
  episode: string
  coverUrl?: string
  amazonUrl?: string
}

interface DiscordWebhookPayload {
  content?: string
  embeds?: DiscordEmbed[]
}

export class DiscordNotifier {
  private webhookUrl: string

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl
  }

  /**
   * Send a notification about successfully added books. Embeds include cover
   * thumbnails and Amazon links inline so the state can be validated directly
   * from Discord without opening the site.
   */
  async notifyBooksAdded(books: DiscordBookEntry[], siteUrl?: string): Promise<void> {
    if (books.length === 0) return

    const site = siteUrl || process.env.SITE_URL || 'https://acquired-bookshelf-git-main-hurleywglys-projects.vercel.app'

    const embeds: DiscordEmbed[] = []

    embeds.push({
      title: `📚 ${books.length} new book${books.length > 1 ? 's' : ''} added`,
      url: site,
      description: `[View on the bookshelf →](${site})\n\nCover thumbnails below are what's stored — click through to validate.`,
      color: 0x00ff00,
      timestamp: new Date().toISOString(),
      footer: { text: 'Acquired Bookshelf Scraper' }
    })

    const perBookEmbedLimit = 9
    const booksWithEmbeds = books.slice(0, perBookEmbedLimit)

    for (const book of booksWithEmbeds) {
      const linkParts: string[] = []
      if (book.amazonUrl) linkParts.push(`[Amazon](${book.amazonUrl})`)
      if (book.coverUrl) linkParts.push(`[Cover](${book.coverUrl})`)
      const description = [
        `**${book.author}**`,
        `Episode: ${book.episode}`,
        linkParts.length > 0 ? linkParts.join(' · ') : undefined
      ]
        .filter(Boolean)
        .join('\n')

      embeds.push({
        title: book.title,
        url: book.amazonUrl,
        description,
        color: 0x00ff00,
        thumbnail: book.coverUrl ? { url: book.coverUrl } : undefined
      })
    }

    if (books.length > perBookEmbedLimit) {
      const overflow = books.slice(perBookEmbedLimit)
      const lines = overflow.map(b => `• **${b.title}** — ${b.author}${b.amazonUrl ? ` ([Amazon](${b.amazonUrl}))` : ''}`)
      embeds.push({
        title: `+ ${overflow.length} more`,
        description: lines.slice(0, 20).join('\n'),
        color: 0x00ff00
      })
    }

    await this.sendWebhook({ embeds: embeds.slice(0, 10) })
  }

  /**
   * Send a notification about books with unknown metadata
   */
  async notifyUnknownMetadata(books: Array<{ title: string; author: string; amazonUrl: string; episode: string }>): Promise<void> {
    const fields: DiscordEmbedField[] = books.map((book, index) => ({
      name: `${index + 1}. ${book.title}`,
      value: `**Author:** ${book.author}\n**Episode:** ${book.episode}\n**URL:** ${book.amazonUrl}`,
      inline: false
    }))

    const embed: DiscordEmbed = {
      title: '⚠️ Unknown Metadata Detected',
      description: `Found ${books.length} book${books.length > 1 ? 's' : ''} with "Unknown" metadata. Manual review recommended.`,
      color: 0xffa500, // Orange
      fields: fields.slice(0, 25), // Discord max 25 fields
      timestamp: new Date().toISOString(),
      footer: { text: 'Acquired Bookshelf Scraper' }
    }

    await this.sendWebhook({ embeds: [embed] })
  }

  /**
   * Send a notification about scraper errors
   */
  async notifyError(error: string, context?: string): Promise<void> {
    const embed: DiscordEmbed = {
      title: '❌ Scraper Error',
      description: error,
      color: 0xff0000, // Red
      fields: context ? [{
        name: 'Context',
        value: context,
        inline: false
      }] : undefined,
      timestamp: new Date().toISOString(),
      footer: { text: 'Acquired Bookshelf Scraper' }
    }

    await this.sendWebhook({ embeds: [embed] })
  }

  /**
   * Send a notification about video products that were filtered out
   */
  async notifyVideoProductFiltered(url: string, episode: string): Promise<void> {
    const embed: DiscordEmbed = {
      title: '🎬 Video Product Filtered',
      description: `Detected and skipped a video product (not a book)`,
      color: 0x0099ff, // Blue
      fields: [{
        name: 'URL',
        value: url,
        inline: false
      }, {
        name: 'Episode',
        value: episode,
        inline: false
      }],
      timestamp: new Date().toISOString(),
      footer: { text: 'Acquired Bookshelf Scraper' }
    }

    await this.sendWebhook({ embeds: [embed] })
  }

  /**
   * Send a summary when no new books are found
   */
  async notifyNoNewBooks(): Promise<void> {
    const embed: DiscordEmbed = {
      title: '📭 No New Books',
      description: 'Scraper ran successfully but found no new books to add.',
      color: 0x808080, // Gray
      timestamp: new Date().toISOString(),
      footer: { text: 'Acquired Bookshelf Scraper' }
    }

    await this.sendWebhook({ embeds: [embed] })
  }

  /**
   * Send raw webhook payload to Discord
   */
  private async sendWebhook(payload: DiscordWebhookPayload): Promise<void> {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        console.error(`Discord webhook failed: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to send Discord notification:', error)
      // Don't throw - we don't want Discord failures to break the scraper
    }
  }
}

/**
 * Create a Discord notifier from environment variable
 */
export function createDiscordNotifierFromEnv(): DiscordNotifier | null {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL

  if (!webhookUrl) {
    console.log('⚠️  DISCORD_WEBHOOK_URL not set - Discord notifications disabled')
    return null
  }

  return new DiscordNotifier(webhookUrl)
}
