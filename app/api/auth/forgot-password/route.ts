import { NextRequest, NextResponse } from 'next/server'
import { createPasswordResetToken, checkPasswordResetRateLimit } from '@/lib/users'
import { sendEmail } from '@/app/utils/mock-email-service'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Check rate limit (disabled for development)
    const rateLimit = await checkPasswordResetRateLimit(email)
    console.log('Rate limit check:', rateLimit)
    
    // Uncomment the following lines to enable rate limiting:
    // if (!rateLimit.allowed) {
    //   return NextResponse.json({ 
    //     error: `Too many requests. Please wait ${rateLimit.remainingTime} minutes before trying again.`,
    //     rateLimited: true,
    //     remainingTime: rateLimit.remainingTime
    //   }, { status: 429 })
    // }

    try {
      // Create reset token
      const token = await createPasswordResetToken(email)
      
      // Generate reset URL
      const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/reset-password?token=${token}`
      
      // Send email
      console.log('About to send email to:', email)
      console.log('Reset URL:', resetUrl)
      
      const emailSent = await sendEmail({
        to: email,
        subject: 'איפוס סיסמה - Michael SQL Assistant',
        text: `איפוס סיסמה - Michael SQL Assistant\n\nשלום,\nקיבלת בקשה לאיפוס הסיסמה שלך במערכת Michael SQL Assistant.\nלחץ על הקישור הבא כדי לאפס את הסיסמה שלך:\n${resetUrl}\n\nהקישור יהיה תקף למשך שעה אחת בלבד.\nאם לא ביקשת איפוס סיסמה, אנא התעלם מהמייל הזה.\n\nMichael SQL Assistant Team`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>איפוס סיסמה</h2>
            <p>שלום,</p>
            <p>קיבלת בקשה לאיפוס הסיסמה שלך במערכת Michael SQL Assistant.</p>
            <p>לחץ על הקישור הבא כדי לאפס את הסיסמה שלך:</p>
            <p><a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">איפוס סיסמה</a></p>
            <p>הקישור יהיה תקף למשך שעה אחת בלבד.</p>
            <p>אם לא ביקשת איפוס סיסמה, אנא התעלם מהמייל הזה.</p>
            <hr>
            <p style="font-size: 12px; color: #666;">Michael SQL Assistant Team</p>
          </div>
        `
      })
      
      console.log('Email sent result:', emailSent)

      if (!emailSent) {
        return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Password reset email sent successfully' 
      })

    } catch (error) {
      // Always return success to prevent email enumeration
      return NextResponse.json({ 
        success: true, 
        message: 'If the email exists, a password reset link has been sent' 
      })
    }

  } catch (error) {
    console.error('Error in forgot password:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
