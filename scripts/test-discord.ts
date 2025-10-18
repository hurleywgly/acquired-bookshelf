#!/usr/bin/env node

/**
 * Test Discord Webhook
 * Quick test to verify Discord notifications are working
 */

import 'dotenv/config'
import { createDiscordNotifierFromEnv } from '../lib/discord-notifier.js'

async function testDiscord() {
  console.log('🧪 Testing Discord webhook...\n')

  const discord = createDiscordNotifierFromEnv()

  if (!discord) {
    console.log('❌ Discord webhook URL not configured')
    console.log('Set DISCORD_WEBHOOK_URL in your .env file')
    process.exit(1)
  }

  try {
    // Test 1: Books added notification
    console.log('📚 Sending "books added" test notification...')
    await discord.notifyBooksAdded([
      {
        title: 'Test Book 1',
        author: 'Test Author',
        episode: 'Test Episode'
      },
      {
        title: 'Test Book 2',
        author: 'Another Author',
        episode: 'Test Episode'
      }
    ])
    console.log('✅ Books added notification sent\n')

    // Wait a bit between notifications
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Test 2: Unknown metadata notification
    console.log('⚠️  Sending "unknown metadata" test notification...')
    await discord.notifyUnknownMetadata([
      {
        title: 'Unknown Title',
        author: 'Unknown Author',
        amazonUrl: 'https://amazon.com/test',
        episode: 'Test Episode'
      }
    ])
    console.log('✅ Unknown metadata notification sent\n')

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Test 3: Error notification
    console.log('❌ Sending "error" test notification...')
    await discord.notifyError('This is a test error', 'Discord webhook test')
    console.log('✅ Error notification sent\n')

    console.log('🎉 All Discord tests completed! Check your Discord channel.')
  } catch (error) {
    console.error('❌ Discord test failed:', error)
    process.exit(1)
  }
}

testDiscord()
