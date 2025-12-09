#!/usr/bin/env ts-node

import { connectToDatabase, COLLECTIONS } from '../lib/database'

interface IndexDefinition {
  collection: string
  index: any
  options?: any
}

class DatabaseSecuritySetup {
  private db: any

  async connect(): Promise<void> {
    const { db } = await connectToDatabase()
    this.db = db
  }

  async createCollections(): Promise<void> {
    console.log('📁 Creating required collections...')

    const collections = [
      COLLECTIONS.PASSWORD_RESET_TOKENS,
      COLLECTIONS.RATE_LIMITS,
      COLLECTIONS.IP_RATE_LIMITS,
      COLLECTIONS.SECURITY_EVENTS
    ]

    for (const collectionName of collections) {
      try {
        await this.db.createCollection(collectionName)
        console.log(`✅ Created collection: ${collectionName}`)
      } catch (error: any) {
        if (error.code === 48) { // Collection already exists
          console.log(`ℹ️  Collection already exists: ${collectionName}`)
        } else {
          console.error(`❌ Failed to create collection ${collectionName}:`, error.message)
        }
      }
    }
  }

  async createIndexes(): Promise<void> {
    console.log('\n📊 Creating database indexes...')

    const indexes: IndexDefinition[] = [
      // Password reset tokens indexes
      {
        collection: COLLECTIONS.PASSWORD_RESET_TOKENS,
        index: { token: 1 },
        options: { unique: true }
      },
      {
        collection: COLLECTIONS.PASSWORD_RESET_TOKENS,
        index: { email: 1 }
      },
      {
        collection: COLLECTIONS.PASSWORD_RESET_TOKENS,
        index: { expiresAt: 1 },
        options: { expireAfterSeconds: 0 } // TTL index
      },
      {
        collection: COLLECTIONS.PASSWORD_RESET_TOKENS,
        index: { createdAt: 1 }
      },
      {
        collection: COLLECTIONS.PASSWORD_RESET_TOKENS,
        index: { used: 1 }
      },

      // Rate limits indexes
      {
        collection: COLLECTIONS.RATE_LIMITS,
        index: { identifier: 1, timestamp: 1 }
      },
      {
        collection: COLLECTIONS.RATE_LIMITS,
        index: { expiresAt: 1 },
        options: { expireAfterSeconds: 0 } // TTL index
      },

      // IP rate limits indexes
      {
        collection: COLLECTIONS.IP_RATE_LIMITS,
        index: { identifier: 1, timestamp: 1 }
      },
      {
        collection: COLLECTIONS.IP_RATE_LIMITS,
        index: { ip: 1, endpoint: 1, timestamp: 1 }
      },
      {
        collection: COLLECTIONS.IP_RATE_LIMITS,
        index: { expiresAt: 1 },
        options: { expireAfterSeconds: 0 } // TTL index
      },

      // Security events indexes
      {
        collection: COLLECTIONS.SECURITY_EVENTS,
        index: { type: 1, timestamp: 1 }
      },
      {
        collection: COLLECTIONS.SECURITY_EVENTS,
        index: { email: 1, timestamp: 1 }
      },
      {
        collection: COLLECTIONS.SECURITY_EVENTS,
        index: { ip: 1, timestamp: 1 }
      },
      {
        collection: COLLECTIONS.SECURITY_EVENTS,
        index: { severity: 1, timestamp: 1 }
      },
      {
        collection: COLLECTIONS.SECURITY_EVENTS,
        index: { timestamp: 1 },
        options: { expireAfterSeconds: 30 * 24 * 60 * 60 } // 30 days TTL
      }
    ]

    for (const indexDef of indexes) {
      try {
        await this.db.collection(indexDef.collection).createIndex(indexDef.index, indexDef.options)
        console.log(`✅ Created index on ${indexDef.collection}: ${JSON.stringify(indexDef.index)}`)
      } catch (error: any) {
        if (error.code === 85) { // Index already exists
          console.log(`ℹ️  Index already exists on ${indexDef.collection}: ${JSON.stringify(indexDef.index)}`)
        } else {
          console.error(`❌ Failed to create index on ${indexDef.collection}:`, error.message)
        }
      }
    }
  }

  async createValidationRules(): Promise<void> {
    console.log('\n🔒 Creating collection validation rules...')

    // Password reset tokens validation
    try {
      await this.db.command({
        collMod: COLLECTIONS.PASSWORD_RESET_TOKENS,
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['email', 'token', 'expiresAt', 'used', 'createdAt'],
            properties: {
              email: {
                bsonType: 'string',
                pattern: '^[^@]+@[^@]+\\.[^@]+$',
                description: 'Email must be a valid email address'
              },
              token: {
                bsonType: 'string',
                minLength: 32,
                description: 'Token must be at least 32 characters'
              },
              expiresAt: {
                bsonType: 'date',
                description: 'Expiration date must be a valid date'
              },
              used: {
                bsonType: 'bool',
                description: 'Used flag must be a boolean'
              },
              createdAt: {
                bsonType: 'date',
                description: 'Creation date must be a valid date'
              }
            }
          }
        }
      })
      console.log(`✅ Created validation rules for ${COLLECTIONS.PASSWORD_RESET_TOKENS}`)
    } catch (error: any) {
      console.error(`❌ Failed to create validation rules for ${COLLECTIONS.PASSWORD_RESET_TOKENS}:`, error.message)
    }

    // Security events validation
    try {
      await this.db.command({
        collMod: COLLECTIONS.SECURITY_EVENTS,
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['type', 'ip', 'details', 'timestamp', 'severity'],
            properties: {
              type: {
                enum: ['login_attempt', 'password_reset', 'suspicious_activity', 'rate_limit_exceeded'],
                description: 'Event type must be one of the allowed values'
              },
              email: {
                bsonType: 'string',
                pattern: '^[^@]+@[^@]+\\.[^@]+$',
                description: 'Email must be a valid email address if provided'
              },
              ip: {
                bsonType: 'string',
                description: 'IP address must be a string'
              },
              userAgent: {
                bsonType: 'string',
                description: 'User agent must be a string if provided'
              },
              details: {
                bsonType: 'object',
                description: 'Details must be an object'
              },
              timestamp: {
                bsonType: 'date',
                description: 'Timestamp must be a valid date'
              },
              severity: {
                enum: ['low', 'medium', 'high', 'critical'],
                description: 'Severity must be one of the allowed values'
              }
            }
          }
        }
      })
      console.log(`✅ Created validation rules for ${COLLECTIONS.SECURITY_EVENTS}`)
    } catch (error: any) {
      console.error(`❌ Failed to create validation rules for ${COLLECTIONS.SECURITY_EVENTS}:`, error.message)
    }
  }

  async verifySetup(): Promise<void> {
    console.log('\n🔍 Verifying database setup...')

    const collections = [
      COLLECTIONS.PASSWORD_RESET_TOKENS,
      COLLECTIONS.RATE_LIMITS,
      COLLECTIONS.IP_RATE_LIMITS,
      COLLECTIONS.SECURITY_EVENTS
    ]

    for (const collectionName of collections) {
      try {
        const collection = this.db.collection(collectionName)
        const count = await collection.countDocuments()
        const indexes = await collection.indexes()
        
        console.log(`✅ ${collectionName}: ${count} documents, ${indexes.length} indexes`)
      } catch (error: any) {
        console.error(`❌ Failed to verify ${collectionName}:`, error.message)
      }
    }
  }

  async runSetup(): Promise<void> {
    console.log('🚀 Setting up database for forgot password feature...\n')

    await this.connect()
    await this.createCollections()
    await this.createIndexes()
    await this.createValidationRules()
    await this.verifySetup()

    console.log('\n🎉 Database setup completed successfully!')
  }
}

// Run setup if this script is executed directly
if (require.main === module) {
  const setup = new DatabaseSecuritySetup()
  setup.runSetup().catch(error => {
    console.error('Database setup failed:', error)
    process.exit(1)
  })
}

export { DatabaseSecuritySetup }
