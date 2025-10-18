/**
 * Cloudflare R2 Uploader
 * Handles uploading book cover images to R2 object storage
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

interface R2Config {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
  publicUrl: string
}

export class R2Uploader {
  private s3Client: S3Client
  private bucketName: string
  private publicUrl: string

  constructor(config: R2Config) {
    // R2 uses S3-compatible API
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    })

    this.bucketName = config.bucketName
    this.publicUrl = config.publicUrl.replace(/\/$/, '') // Remove trailing slash
  }

  /**
   * Check if a file already exists in R2
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      )
      return true
    } catch (error: unknown) {
      const err = error as { name?: string; $metadata?: { httpStatusCode?: number } }
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return false
      }
      throw error
    }
  }

  /**
   * Upload a file to R2
   * @param key - The file path/key in R2 (e.g., "covers/book-id.jpg")
   * @param buffer - The file buffer to upload
   * @param contentType - MIME type (default: image/jpeg)
   * @returns Public URL of the uploaded file
   */
  async uploadFile(
    key: string,
    buffer: Buffer,
    contentType: string = 'image/jpeg'
  ): Promise<string> {
    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        })
      )

      // Return public URL
      return `${this.publicUrl}/${key}`
    } catch (error) {
      console.error(`Error uploading to R2: ${key}`, error)
      throw error
    }
  }

  /**
   * Download image from URL and upload to R2
   * @param imageUrl - URL of the image to download
   * @param bookId - Book ID to use as filename
   * @param skipIfExists - Skip upload if file already exists (default: true)
   * @returns Public R2 URL or null if failed
   */
  async downloadAndUpload(
    imageUrl: string,
    bookId: string,
    skipIfExists: boolean = true
  ): Promise<string | null> {
    const key = `covers/${bookId}.jpg`

    try {
      // Check if file already exists
      if (skipIfExists && (await this.fileExists(key))) {
        console.log(`  ⏭️  Cover already exists in R2: ${bookId}.jpg`)
        return `${this.publicUrl}/${key}`
      }

      // Download image
      console.log(`  📥 Downloading: ${imageUrl}`)
      const response = await fetch(imageUrl)

      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Upload to R2
      console.log(`  📤 Uploading to R2: ${key}`)
      const publicUrl = await this.uploadFile(key, buffer)

      console.log(`  ✅ Uploaded: ${publicUrl}`)
      return publicUrl
    } catch (error) {
      console.error(`  ❌ Failed to download/upload ${bookId}:`, error)
      return null
    }
  }

  /**
   * Upload a local file to R2
   * @param filePath - Local file path
   * @param bookId - Book ID to use as filename
   * @param skipIfExists - Skip upload if file already exists (default: true)
   * @returns Public R2 URL or null if failed
   */
  async uploadLocalFile(
    filePath: string,
    bookId: string,
    skipIfExists: boolean = true
  ): Promise<string | null> {
    const key = `covers/${bookId}.jpg`

    try {
      // Check if file already exists
      if (skipIfExists && (await this.fileExists(key))) {
        console.log(`  ⏭️  Cover already exists in R2: ${bookId}.jpg`)
        return `${this.publicUrl}/${key}`
      }

      // Read local file
      const fs = await import('fs/promises')
      const buffer = await fs.readFile(filePath)

      // Upload to R2
      console.log(`  📤 Uploading to R2: ${key}`)
      const publicUrl = await this.uploadFile(key, buffer)

      console.log(`  ✅ Uploaded: ${publicUrl}`)
      return publicUrl
    } catch (error) {
      console.error(`  ❌ Failed to upload local file ${bookId}:`, error)
      return null
    }
  }
}

/**
 * Create R2 uploader instance from environment variables
 */
export function createR2UploaderFromEnv(): R2Uploader {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucketName = process.env.R2_BUCKET_NAME
  const publicUrl = process.env.R2_PUBLIC_URL

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
    throw new Error(
      'Missing R2 environment variables. Required: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL'
    )
  }

  return new R2Uploader({
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicUrl,
  })
}
