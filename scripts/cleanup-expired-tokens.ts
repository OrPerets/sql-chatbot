#!/usr/bin/env ts-node

import { connectToDatabase, COLLECTIONS } from '../lib/database'

interface CleanupResult {
  collection: string
  deletedCount: number
  error?: string
}

class TokenCleanupService {
  private db: any

  async connect(): Promise<void> {
    const { db } = await connectToDatabase()
    this.db = db
  }

  async cleanupExpiredPasswordResetTokens(): Promise<CleanupResult> {
    try {
      const result = await this.db.collection(COLLECTIONS.PASSWORD_RESET_TOKENS).deleteMany({
        $or: [
          { expiresAt: { $lt: new Date() } },
          { used: true }
        ]
      })

      return {
        collection: COLLECTIONS.PASSWORD_RESET_TOKENS,
        deletedCount: result.deletedCount || 0
      }
    } catch (error: any) {
      return {
        collection: COLLECTIONS.PASSWORD_RESET_TOKENS,
        deletedCount: 0,
        error: error.message
      }
    }
  }

  async cleanupExpiredRateLimits(): Promise<CleanupResult> {
    try {
      const result = await this.db.collection(COLLECTIONS.RATE_LIMITS).deleteMany({
        expiresAt: { $lt: new Date() }
      })

      return {
        collection: COLLECTIONS.RATE_LIMITS,
        deletedCount: result.deletedCount || 0
      }
    } catch (error: any) {
      return {
        collection: COLLECTIONS.RATE_LIMITS,
        deletedCount: 0,
        error: error.message
      }
    }
  }

  async cleanupExpiredIPRateLimits(): Promise<CleanupResult> {
    try {
      const result = await this.db.collection(COLLECTIONS.IP_RATE_LIMITS).deleteMany({
        expiresAt: { $lt: new Date() }
      })

      return {
        collection: COLLECTIONS.IP_RATE_LIMITS,
        deletedCount: result.deletedCount || 0
      }
    } catch (error: any) {
      return {
        collection: COLLECTIONS.IP_RATE_LIMITS,
        deletedCount: 0,
        error: error.message
      }
    }
  }

  async cleanupOldSecurityEvents(): Promise<CleanupResult> {
    try {
      // Delete security events older than 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const result = await this.db.collection(COLLECTIONS.SECURITY_EVENTS).deleteMany({
        timestamp: { $lt: thirtyDaysAgo }
      })

      return {
        collection: COLLECTIONS.SECURITY_EVENTS,
        deletedCount: result.deletedCount || 0
      }
    } catch (error: any) {
      return {
        collection: COLLECTIONS.SECURITY_EVENTS,
        deletedCount: 0,
        error: error.message
      }
    }
  }

  async getCollectionStats(): Promise<void> {
    console.log('\n📊 Collection Statistics:')

    const collections = [
      COLLECTIONS.PASSWORD_RESET_TOKENS,
      COLLECTIONS.RATE_LIMITS,
      COLLECTIONS.IP_RATE_LIMITS,
      COLLECTIONS.SECURITY_EVENTS
    ]

    for (const collectionName of collections) {
      try {
        const collection = this.db.collection(collectionName)
        const totalCount = await collection.countDocuments()
        
        // Get counts by status for password reset tokens
        if (collectionName === COLLECTIONS.PASSWORD_RESET_TOKENS) {
          const usedCount = await collection.countDocuments({ used: true })
          const expiredCount = await collection.countDocuments({ expiresAt: { $lt: new Date() } })
          const activeCount = await collection.countDocuments({ 
            used: false, 
            expiresAt: { $gte: new Date() } 
          })
          
          console.log(`  ${collectionName}:`)
          console.log(`    Total: ${totalCount}`)
          console.log(`    Active: ${activeCount}`)
          console.log(`    Used: ${usedCount}`)
          console.log(`    Expired: ${expiredCount}`)
        } else {
          console.log(`  ${collectionName}: ${totalCount} documents`)
        }
      } catch (error: any) {
        console.error(`  ❌ Failed to get stats for ${collectionName}:`, error.message)
      }
    }
  }

  async runCleanup(): Promise<void> {
    console.log('🧹 Starting cleanup of expired tokens and rate limits...\n')

    await this.connect()

    // Get initial stats
    await this.getCollectionStats()

    console.log('\n🗑️  Running cleanup...')

    // Run cleanup operations
    const results = await Promise.all([
      this.cleanupExpiredPasswordResetTokens(),
      this.cleanupExpiredRateLimits(),
      this.cleanupExpiredIPRateLimits(),
      this.cleanupOldSecurityEvents()
    ])

    // Report results
    console.log('\n📋 Cleanup Results:')
    let totalDeleted = 0

    for (const result of results) {
      if (result.error) {
        console.log(`  ❌ ${result.collection}: ${result.error}`)
      } else {
        console.log(`  ✅ ${result.collection}: ${result.deletedCount} documents deleted`)
        totalDeleted += result.deletedCount
      }
    }

    console.log(`\n🎉 Cleanup completed! Total documents deleted: ${totalDeleted}`)

    // Get final stats
    await this.getCollectionStats()
  }

  async runStatsOnly(): Promise<void> {
    console.log('📊 Database Statistics Report\n')

    await this.connect()
    await this.getCollectionStats()
  }
}

// Run cleanup if this script is executed directly
if (require.main === module) {
  const cleanup = new TokenCleanupService()
  
  const args = process.argv.slice(2)
  if (args.includes('--stats-only')) {
    cleanup.runStatsOnly().catch(error => {
      console.error('Stats report failed:', error)
      process.exit(1)
    })
  } else {
    cleanup.runCleanup().catch(error => {
      console.error('Cleanup failed:', error)
      process.exit(1)
    })
  }
}

export { TokenCleanupService }
