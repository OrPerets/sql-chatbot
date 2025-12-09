import { connectToDatabase, executeWithRetry, COLLECTIONS } from './database'

export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  keyGenerator?: (request: any) => string // Custom key generator
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: Date
  retryAfter?: number // Seconds to wait before retry
}

export class RateLimiter {
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = config
  }

  async checkLimit(identifier: string): Promise<RateLimitResult> {
    return executeWithRetry(async (db) => {
      const now = new Date()
      const windowStart = new Date(now.getTime() - this.config.windowMs)
      
      // Get current request count for this identifier
      const currentCount = await db.collection('rate_limits').countDocuments({
        identifier,
        timestamp: { $gte: windowStart }
      })

      const remaining = Math.max(0, this.config.maxRequests - currentCount)
      const allowed = currentCount < this.config.maxRequests

      if (allowed) {
        // Record this request
        await db.collection('rate_limits').insertOne({
          identifier,
          timestamp: now,
          expiresAt: new Date(now.getTime() + this.config.windowMs)
        })
      }

      // Find the oldest request to calculate reset time
      const oldestRequest = await db.collection('rate_limits').findOne(
        { identifier, timestamp: { $gte: windowStart } },
        { sort: { timestamp: 1 } }
      )

      const resetTime = oldestRequest 
        ? new Date(oldestRequest.timestamp.getTime() + this.config.windowMs)
        : new Date(now.getTime() + this.config.windowMs)

      const retryAfter = allowed ? undefined : Math.ceil((resetTime.getTime() - now.getTime()) / 1000)

      return {
        allowed,
        remaining,
        resetTime,
        retryAfter
      }
    })
  }

  async cleanup(): Promise<void> {
    return executeWithRetry(async (db) => {
      const now = new Date()
      await db.collection('rate_limits').deleteMany({
        expiresAt: { $lt: now }
      })
    })
  }
}

// Pre-configured rate limiters for different use cases
export const passwordResetRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3 // 3 password reset requests per hour
})

export const loginRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5 // 5 login attempts per 15 minutes
})

export const apiRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100 // 100 API requests per 15 minutes
})

// IP-based rate limiter for additional security
export class IPRateLimiter {
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = config
  }

  async checkIPLimit(ip: string, endpoint: string): Promise<RateLimitResult> {
    const identifier = `${ip}:${endpoint}`
    return executeWithRetry(async (db) => {
      const now = new Date()
      const windowStart = new Date(now.getTime() - this.config.windowMs)
      
      const currentCount = await db.collection('ip_rate_limits').countDocuments({
        identifier,
        timestamp: { $gte: windowStart }
      })

      const remaining = Math.max(0, this.config.maxRequests - currentCount)
      const allowed = currentCount < this.config.maxRequests

      if (allowed) {
        await db.collection('ip_rate_limits').insertOne({
          identifier,
          ip,
          endpoint,
          timestamp: now,
          expiresAt: new Date(now.getTime() + this.config.windowMs)
        })
      }

      const oldestRequest = await db.collection('ip_rate_limits').findOne(
        { identifier, timestamp: { $gte: windowStart } },
        { sort: { timestamp: 1 } }
      )

      const resetTime = oldestRequest 
        ? new Date(oldestRequest.timestamp.getTime() + this.config.windowMs)
        : new Date(now.getTime() + this.config.windowMs)

      const retryAfter = allowed ? undefined : Math.ceil((resetTime.getTime() - now.getTime()) / 1000)

      return {
        allowed,
        remaining,
        resetTime,
        retryAfter
      }
    })
  }

  async cleanup(): Promise<void> {
    return executeWithRetry(async (db) => {
      const now = new Date()
      await db.collection('ip_rate_limits').deleteMany({
        expiresAt: { $lt: now }
      })
    })
  }
}

export const ipPasswordResetRateLimiter = new IPRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5 // 5 password reset attempts per IP per hour
})

// Utility function to get client IP from request
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  if (realIP) {
    return realIP
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP
  }
  
  return 'unknown'
}
