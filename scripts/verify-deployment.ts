#!/usr/bin/env ts-node

import { connectToDatabase, COLLECTIONS } from '../lib/database'
import { secureEmailService } from '../app/utils/secure-email-service'
import { getSecurityService } from '../lib/security'
import { passwordResetRateLimiter, ipPasswordResetRateLimiter } from '../lib/rate-limiter'

interface VerificationResult {
  test: string
  status: 'PASS' | 'FAIL' | 'WARN'
  message: string
  details?: any
}

class DeploymentVerifier {
  private results: VerificationResult[] = []

  private addResult(test: string, status: 'PASS' | 'FAIL' | 'WARN', message: string, details?: any) {
    this.results.push({ test, status, message, details })
  }

  async verifyDatabaseConnection(): Promise<void> {
    try {
      const { db } = await connectToDatabase()
      await db.admin().ping()
      this.addResult('Database Connection', 'PASS', 'Successfully connected to MongoDB')
    } catch (error) {
      this.addResult('Database Connection', 'FAIL', `Failed to connect to database: ${error}`)
    }
  }

  async verifyCollections(): Promise<void> {
    try {
      const { db } = await connectToDatabase()
      const requiredCollections = [
        COLLECTIONS.USERS,
        COLLECTIONS.PASSWORD_RESET_TOKENS,
        COLLECTIONS.RATE_LIMITS,
        COLLECTIONS.IP_RATE_LIMITS,
        COLLECTIONS.SECURITY_EVENTS
      ]

      const existingCollections = await db.listCollections().toArray()
      const existingCollectionNames = existingCollections.map(col => col.name)

      for (const collection of requiredCollections) {
        if (existingCollectionNames.includes(collection)) {
          this.addResult(`Collection: ${collection}`, 'PASS', 'Collection exists')
        } else {
          this.addResult(`Collection: ${collection}`, 'FAIL', 'Collection does not exist')
        }
      }
    } catch (error) {
      this.addResult('Collections Verification', 'FAIL', `Failed to verify collections: ${error}`)
    }
  }

  async verifyEmailService(): Promise<void> {
    try {
      const isConnected = await secureEmailService.verifyConnection()
      if (isConnected) {
        this.addResult('Email Service', 'PASS', 'SMTP connection is working')
      } else {
        this.addResult('Email Service', 'FAIL', 'SMTP connection failed')
      }
    } catch (error) {
      this.addResult('Email Service', 'FAIL', `Email service verification failed: ${error}`)
    }
  }

  async verifySecurityService(): Promise<void> {
    try {
      const securityService = await getSecurityService()
      
      // Test email validation
      const validEmail = await securityService.validateEmail('test@example.com')
      const invalidEmail = await securityService.validateEmail('invalid-email')
      
      if (validEmail && !invalidEmail) {
        this.addResult('Security Service - Email Validation', 'PASS', 'Email validation is working')
      } else {
        this.addResult('Security Service - Email Validation', 'FAIL', 'Email validation is not working correctly')
      }

      // Test token generation
      const token = await securityService.generateSecureToken()
      if (token && token.length === 64) {
        this.addResult('Security Service - Token Generation', 'PASS', 'Secure token generation is working')
      } else {
        this.addResult('Security Service - Token Generation', 'FAIL', 'Token generation failed')
      }
    } catch (error) {
      this.addResult('Security Service', 'FAIL', `Security service verification failed: ${error}`)
    }
  }

  async verifyRateLimiters(): Promise<void> {
    try {
      // Test password reset rate limiter
      const testEmail = 'test@example.com'
      const rateLimitResult = await passwordResetRateLimiter.checkLimit(testEmail)
      
      if (rateLimitResult.allowed !== undefined) {
        this.addResult('Rate Limiter - Password Reset', 'PASS', 'Password reset rate limiter is working')
      } else {
        this.addResult('Rate Limiter - Password Reset', 'FAIL', 'Password reset rate limiter failed')
      }

      // Test IP rate limiter
      const testIP = '127.0.0.1'
      const ipRateLimitResult = await ipPasswordResetRateLimiter.checkIPLimit(testIP, 'test')
      
      if (ipRateLimitResult.allowed !== undefined) {
        this.addResult('Rate Limiter - IP Based', 'PASS', 'IP-based rate limiter is working')
      } else {
        this.addResult('Rate Limiter - IP Based', 'FAIL', 'IP-based rate limiter failed')
      }
    } catch (error) {
      this.addResult('Rate Limiters', 'FAIL', `Rate limiter verification failed: ${error}`)
    }
  }

  async verifyEnvironmentVariables(): Promise<void> {
    const requiredEnvVars = [
      'MONGODB_URI',
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_USER',
      'SMTP_PASS',
      'SMTP_FROM'
    ]

    const missingVars: string[] = []
    const presentVars: string[] = []

    for (const envVar of requiredEnvVars) {
      if (process.env[envVar]) {
        presentVars.push(envVar)
      } else {
        missingVars.push(envVar)
      }
    }

    if (missingVars.length === 0) {
      this.addResult('Environment Variables', 'PASS', 'All required environment variables are set')
    } else {
      this.addResult('Environment Variables', 'FAIL', `Missing environment variables: ${missingVars.join(', ')}`)
    }

    // Check optional variables
    if (!process.env.NEXT_PUBLIC_BASE_URL) {
      this.addResult('Environment Variables - Base URL', 'WARN', 'NEXT_PUBLIC_BASE_URL is not set, will use localhost fallback')
    } else {
      this.addResult('Environment Variables - Base URL', 'PASS', 'NEXT_PUBLIC_BASE_URL is set')
    }
  }

  async verifyAPIRoutes(): Promise<void> {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const routes = [
      '/api/auth/forgot-password',
      '/api/auth/reset-password/validate',
      '/api/auth/reset-password'
    ]

    for (const route of routes) {
      try {
        const response = await fetch(`${baseUrl}${route}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
        
        // We expect 400 for missing data, which means the route exists
        if (response.status === 400 || response.status === 405) {
          this.addResult(`API Route: ${route}`, 'PASS', 'Route is accessible')
        } else {
          this.addResult(`API Route: ${route}`, 'WARN', `Unexpected response status: ${response.status}`)
        }
      } catch (error) {
        this.addResult(`API Route: ${route}`, 'FAIL', `Route is not accessible: ${error}`)
      }
    }
  }

  async verifyFrontendPages(): Promise<void> {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const pages = [
      '/',
      '/auth/reset-password'
    ]

    for (const page of pages) {
      try {
        const response = await fetch(`${baseUrl}${page}`)
        
        if (response.status === 200) {
          this.addResult(`Frontend Page: ${page}`, 'PASS', 'Page is accessible')
        } else {
          this.addResult(`Frontend Page: ${page}`, 'FAIL', `Page returned status: ${response.status}`)
        }
      } catch (error) {
        this.addResult(`Frontend Page: ${page}`, 'FAIL', `Page is not accessible: ${error}`)
      }
    }
  }

  async runAllVerifications(): Promise<void> {
    console.log('🔍 Starting deployment verification...\n')

    await this.verifyEnvironmentVariables()
    await this.verifyDatabaseConnection()
    await this.verifyCollections()
    await this.verifyEmailService()
    await this.verifySecurityService()
    await this.verifyRateLimiters()
    await this.verifyAPIRoutes()
    await this.verifyFrontendPages()

    this.printResults()
  }

  private printResults(): void {
    console.log('\n📊 Verification Results:\n')
    
    const passed = this.results.filter(r => r.status === 'PASS').length
    const failed = this.results.filter(r => r.status === 'FAIL').length
    const warnings = this.results.filter(r => r.status === 'WARN').length

    console.log(`✅ Passed: ${passed}`)
    console.log(`❌ Failed: ${failed}`)
    console.log(`⚠️  Warnings: ${warnings}\n`)

    for (const result of this.results) {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️'
      console.log(`${icon} ${result.test}: ${result.message}`)
      
      if (result.details) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`)
      }
    }

    console.log('\n' + '='.repeat(50))
    
    if (failed === 0) {
      console.log('🎉 All critical verifications passed! Deployment is ready.')
      if (warnings > 0) {
        console.log('⚠️  Please review the warnings above.')
      }
    } else {
      console.log('❌ Some verifications failed. Please fix the issues before deployment.')
      process.exit(1)
    }
  }
}

// Run verification if this script is executed directly
if (require.main === module) {
  const verifier = new DeploymentVerifier()
  verifier.runAllVerifications().catch(error => {
    console.error('Verification failed:', error)
    process.exit(1)
  })
}

export { DeploymentVerifier }
