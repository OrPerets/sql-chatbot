import nodemailer from 'nodemailer'
import { getSecurityService } from '@/lib/security'

export interface SecureEmailOptions {
  to: string
  subject: string
  text?: string
  html?: string
  priority?: 'high' | 'normal' | 'low'
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentType?: string
  }>
}

export interface EmailSecurityConfig {
  maxEmailsPerHour: number
  maxEmailsPerDay: number
  allowedDomains?: string[]
  blockedDomains?: string[]
  requireVerification?: boolean
}

class SecureEmailService {
  private transporter: nodemailer.Transporter
  private securityConfig: EmailSecurityConfig
  private emailCounts: Map<string, { hourly: number; daily: number; lastReset: Date }>

  constructor() {
    this.securityConfig = {
      maxEmailsPerHour: 10,
      maxEmailsPerDay: 50,
      allowedDomains: [],
      blockedDomains: ['tempmail.com', '10minutemail.com', 'guerrillamail.com'],
      requireVerification: true
    }

    this.emailCounts = new Map()

    // Initialize nodemailer transporter
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    })
  }

  private async validateEmailAddress(email: string): Promise<{ valid: boolean; reason?: string }> {
    const securityService = await getSecurityService()
    
    // Basic email format validation
    if (!await securityService.validateEmail(email)) {
      return { valid: false, reason: 'Invalid email format' }
    }

    const domain = email.split('@')[1]?.toLowerCase()

    // Check blocked domains
    if (this.securityConfig.blockedDomains?.includes(domain)) {
      return { valid: false, reason: 'Email domain is blocked' }
    }

    // Check allowed domains (if specified)
    if (this.securityConfig.allowedDomains?.length && !this.securityConfig.allowedDomains.includes(domain)) {
      return { valid: false, reason: 'Email domain not allowed' }
    }

    return { valid: true }
  }

  private async checkRateLimit(email: string): Promise<{ allowed: boolean; reason?: string }> {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const counts = this.emailCounts.get(email) || { hourly: 0, daily: 0, lastReset: now }

    // Reset counters if needed
    if (counts.lastReset < oneDayAgo) {
      counts.daily = 0
    }
    if (counts.lastReset < oneHourAgo) {
      counts.hourly = 0
    }

    // Check limits
    if (counts.hourly >= this.securityConfig.maxEmailsPerHour) {
      return { allowed: false, reason: 'Hourly email limit exceeded' }
    }

    if (counts.daily >= this.securityConfig.maxEmailsPerDay) {
      return { allowed: false, reason: 'Daily email limit exceeded' }
    }

    // Update counters
    counts.hourly++
    counts.daily++
    counts.lastReset = now
    this.emailCounts.set(email, counts)

    return { allowed: true }
  }

  private async sanitizeContent(content: string): Promise<string> {
    const securityService = await getSecurityService()
    
    // Remove potentially dangerous HTML/JavaScript
    let sanitized = content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/<iframe\b[^>]*>/gi, '')
      .replace(/<object\b[^>]*>/gi, '')
      .replace(/<embed\b[^>]*>/gi, '')

    // Sanitize input
    sanitized = await securityService.sanitizeInput(sanitized)

    return sanitized
  }

  private async logEmailEvent(
    email: string, 
    subject: string, 
    success: boolean, 
    error?: string
  ): Promise<void> {
    const securityService = await getSecurityService()
    
    await securityService.logSecurityEvent({
      type: 'password_reset',
      email,
      ip: 'system',
      details: {
        action: 'email_sent',
        subject,
        success,
        error,
        timestamp: new Date().toISOString()
      },
      severity: success ? 'low' : 'medium'
    })
  }

  async sendSecureEmail(options: SecureEmailOptions): Promise<boolean> {
    try {
      // Validate email address
      const emailValidation = await this.validateEmailAddress(options.to)
      if (!emailValidation.valid) {
        console.error(`Email validation failed: ${emailValidation.reason}`)
        await this.logEmailEvent(options.to, options.subject, false, emailValidation.reason)
        return false
      }

      // Check rate limits
      const rateLimitCheck = await this.checkRateLimit(options.to)
      if (!rateLimitCheck.allowed) {
        console.error(`Rate limit exceeded: ${rateLimitCheck.reason}`)
        await this.logEmailEvent(options.to, options.subject, false, rateLimitCheck.reason)
        return false
      }

      // Sanitize content
      const sanitizedText = options.text ? await this.sanitizeContent(options.text) : undefined
      const sanitizedHtml = options.html ? await this.sanitizeContent(options.html) : undefined

      // Prepare email
      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: options.to,
        subject: options.subject,
        text: sanitizedText,
        html: sanitizedHtml,
        priority: options.priority || 'normal',
        attachments: options.attachments,
        headers: {
          'X-Mailer': 'Michael SQL Assistant',
          'X-Priority': options.priority === 'high' ? '1' : options.priority === 'low' ? '5' : '3',
          'X-Security-Level': 'high'
        }
      }

      // Send email
      const result = await this.transporter.sendMail(mailOptions)
      
      if (result.messageId) {
        await this.logEmailEvent(options.to, options.subject, true)
        console.log(`Email sent successfully to ${options.to}: ${result.messageId}`)
        return true
      } else {
        await this.logEmailEvent(options.to, options.subject, false, 'No message ID returned')
        return false
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`Failed to send email to ${options.to}:`, errorMessage)
      await this.logEmailEvent(options.to, options.subject, false, errorMessage)
      return false
    }
  }

  async sendPasswordResetEmail(email: string, resetUrl: string): Promise<boolean> {
    const subject = 'איפוס סיסמה - Michael SQL Assistant'
    const text = `איפוס סיסמה - Michael SQL Assistant\n\nשלום,\nקיבלת בקשה לאיפוס הסיסמה שלך במערכת Michael SQL Assistant.\nלחץ על הקישור הבא כדי לאפס את הסיסמה שלך:\n${resetUrl}\n\nהקישור יהיה תקף למשך שעה אחת בלבד.\nאם לא ביקשת איפוס סיסמה, אנא התעלם מהמייל הזה.\n\nMichael SQL Assistant Team`
    
    const html = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Michael SQL Assistant</h1>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-bottom: 20px;">איפוס סיסמה</h2>
          <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">שלום,</p>
          <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">קיבלת בקשה לאיפוס הסיסמה שלך במערכת Michael SQL Assistant.</p>
          <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">לחץ על הקישור הבא כדי לאפס את הסיסמה שלך:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: linear-gradient(135deg, #007bff, #0056b3); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">איפוס סיסמה</a>
          </div>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #666; margin: 0; font-size: 14px;"><strong>חשוב:</strong> הקישור יהיה תקף למשך שעה אחת בלבד.</p>
          </div>
          <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">אם לא ביקשת איפוס סיסמה, אנא התעלם מהמייל הזה.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">Michael SQL Assistant Team</p>
        </div>
      </div>
    `

    return this.sendSecureEmail({
      to: email,
      subject,
      text,
      html,
      priority: 'high'
    })
  }

  async sendPasswordResetConfirmationEmail(email: string): Promise<boolean> {
    const subject = 'סיסמה עודכנה בהצלחה - Michael SQL Assistant'
    const text = `סיסמה עודכנה בהצלחה - Michael SQL Assistant\n\nשלום,\nהסיסמה שלך במערכת Michael SQL Assistant עודכנה בהצלחה.\nאם לא ביצעת שינוי זה, אנא צור קשר עם התמיכה הטכנית מיד.\n\nMichael SQL Assistant Team`
    
    const html = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Michael SQL Assistant</h1>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #28a745; margin-bottom: 20px;">סיסמה עודכנה בהצלחה</h2>
          <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">שלום,</p>
          <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">הסיסמה שלך במערכת Michael SQL Assistant עודכנה בהצלחה.</p>
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #856404; margin: 0; font-size: 14px;"><strong>אבטחה:</strong> אם לא ביצעת שינוי זה, אנא צור קשר עם התמיכה הטכנית מיד.</p>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">Michael SQL Assistant Team</p>
        </div>
      </div>
    `

    return this.sendSecureEmail({
      to: email,
      subject,
      text,
      html,
      priority: 'normal'
    })
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify()
      return true
    } catch (error) {
      console.error('Email service connection verification failed:', error)
      return false
    }
  }

  // Cleanup method to reset rate limits (call periodically)
  resetRateLimits(): void {
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    for (const [email, counts] of Array.from(this.emailCounts.entries())) {
      if (counts.lastReset < oneDayAgo) {
        this.emailCounts.delete(email)
      }
    }
  }
}

// Export singleton instance
export const secureEmailService = new SecureEmailService()

// Export the sendEmail function for backward compatibility
export async function sendEmail(options: SecureEmailOptions): Promise<boolean> {
  return secureEmailService.sendSecureEmail(options)
}
