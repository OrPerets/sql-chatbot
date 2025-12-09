import crypto from 'crypto'
import { connectToDatabase, executeWithRetry, COLLECTIONS } from './database'

export interface SecurityEvent {
  _id?: any
  type: 'login_attempt' | 'password_reset' | 'suspicious_activity' | 'rate_limit_exceeded'
  email?: string
  ip: string
  userAgent?: string
  details: any
  timestamp: Date
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export class SecurityService {
  private db: any

  constructor(db: any) {
    this.db = db
  }

  async logSecurityEvent(event: Omit<SecurityEvent, '_id' | 'timestamp'>): Promise<void> {
    return executeWithRetry(async (db) => {
      await db.collection('security_events').insertOne({
        ...event,
        timestamp: new Date()
      })
    })
  }

  async detectSuspiciousActivity(email: string, ip: string, userAgent?: string): Promise<{
    suspicious: boolean
    reasons: string[]
    riskScore: number
  }> {
    return executeWithRetry(async (db) => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

      const reasons: string[] = []
      let riskScore = 0

      // Check for multiple IPs for same email
      const recentIPs = await db.collection('security_events').distinct('ip', {
        email,
        timestamp: { $gte: oneDayAgo },
        type: { $in: ['login_attempt', 'password_reset'] }
      })

      if (recentIPs.length > 3) {
        reasons.push('Multiple IP addresses used for same email')
        riskScore += 30
      }

      // Check for rapid password reset attempts
      const recentPasswordResets = await db.collection('security_events').countDocuments({
        email,
        type: 'password_reset',
        timestamp: { $gte: oneHourAgo }
      })

      if (recentPasswordResets > 2) {
        reasons.push('Multiple password reset attempts in short time')
        riskScore += 25
      }

      // Check for failed login attempts
      const failedLogins = await db.collection('security_events').countDocuments({
        email,
        type: 'login_attempt',
        'details.success': false,
        timestamp: { $gte: oneHourAgo }
      })

      if (failedLogins > 3) {
        reasons.push('Multiple failed login attempts')
        riskScore += 20
      }

      // Check for rate limit violations
      const rateLimitViolations = await db.collection('security_events').countDocuments({
        $or: [{ email }, { ip }],
        type: 'rate_limit_exceeded',
        timestamp: { $gte: oneDayAgo }
      })

      if (rateLimitViolations > 2) {
        reasons.push('Multiple rate limit violations')
        riskScore += 15
      }

      // Check for unusual user agent patterns
      if (userAgent) {
        const suspiciousPatterns = [
          /bot/i,
          /crawler/i,
          /spider/i,
          /scraper/i,
          /curl/i,
          /wget/i,
          /python/i,
          /java/i
        ]

        if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
          reasons.push('Suspicious user agent detected')
          riskScore += 10
        }
      }

      const suspicious = riskScore > 30 || reasons.length > 2

      return {
        suspicious,
        reasons,
        riskScore
      }
    })
  }

  async generateSecureToken(length: number = 32): Promise<string> {
    return crypto.randomBytes(length).toString('hex')
  }

  async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
    return `${salt}:${hash}`
  }

  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    const [salt, hash] = hashedPassword.split(':')
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
    return hash === verifyHash
  }

  async validateEmail(email: string): Promise<boolean> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  async sanitizeInput(input: string): Promise<string> {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/['"]/g, '') // Remove quotes
      .replace(/[;]/g, '') // Remove semicolons
      .trim()
  }

  async generateCSRFToken(): Promise<string> {
    return crypto.randomBytes(32).toString('hex')
  }

  async validateCSRFToken(token: string, sessionToken: string): Promise<boolean> {
    return token === sessionToken
  }

  async encryptSensitiveData(data: string): Promise<string> {
    const algorithm = 'aes-256-gcm'
    const key = crypto.randomBytes(32)
    const iv = crypto.randomBytes(16)
    
    const cipher = crypto.createCipher(algorithm, key)
    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const authTag = cipher.getAuthTag()
    
    return `${key.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
  }

  async decryptSensitiveData(encryptedData: string): Promise<string> {
    const [keyHex, ivHex, authTagHex, encrypted] = encryptedData.split(':')
    const key = Buffer.from(keyHex, 'hex')
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    
    const decipher = crypto.createDecipher('aes-256-gcm', key)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }
}

let securityService: SecurityService | null = null

export async function getSecurityService(): Promise<SecurityService> {
  if (!securityService) {
    const { db } = await connectToDatabase()
    securityService = new SecurityService(db)
  }
  return securityService
}

// Security middleware for API routes
export async function withSecurity(
  handler: (request: Request, context?: any) => Promise<Response>,
  options: {
    requireAuth?: boolean
    rateLimit?: boolean
    logSecurity?: boolean
  } = {}
) {
  return async (request: Request, context?: any): Promise<Response> => {
    const securityService = await getSecurityService()
    const ip = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || 'unknown'

    try {
      // Log security event
      if (options.logSecurity) {
        await securityService.logSecurityEvent({
          type: 'login_attempt',
          ip,
          userAgent,
          details: {
            method: request.method,
            url: request.url,
            headers: Object.fromEntries(request.headers.entries())
          },
          severity: 'low'
        })
      }

      // Check for suspicious activity
      const suspiciousCheck = await securityService.detectSuspiciousActivity('', ip, userAgent)
      if (suspiciousCheck.suspicious) {
        await securityService.logSecurityEvent({
          type: 'suspicious_activity',
          ip,
          userAgent,
          details: {
            reasons: suspiciousCheck.reasons,
            riskScore: suspiciousCheck.riskScore
          },
          severity: suspiciousCheck.riskScore > 50 ? 'high' : 'medium'
        })

        if (suspiciousCheck.riskScore > 70) {
          return new Response(JSON.stringify({
            error: 'Request blocked due to suspicious activity'
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }

      // Call the original handler
      return await handler(request, context)

    } catch (error) {
      // Log security event for errors
      await securityService.logSecurityEvent({
        type: 'suspicious_activity',
        ip,
        userAgent,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        },
        severity: 'medium'
      })

      throw error
    }
  }
}

// Utility function to get client IP
function getClientIP(request: Request): string {
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
