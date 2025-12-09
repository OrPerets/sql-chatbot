import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Check environment variables
    const smtpConfig = {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS ? '***configured***' : 'NOT_SET',
      from: process.env.SMTP_FROM,
      secure: process.env.SMTP_PORT === '465'
    }

    const missingVars = []
    if (!process.env.SMTP_HOST) missingVars.push('SMTP_HOST')
    if (!process.env.SMTP_PORT) missingVars.push('SMTP_PORT')
    if (!process.env.SMTP_USER) missingVars.push('SMTP_USER')
    if (!process.env.SMTP_PASS) missingVars.push('SMTP_PASS')
    if (!process.env.SMTP_FROM) missingVars.push('SMTP_FROM')

    return NextResponse.json({
      success: missingVars.length === 0,
      smtpConfig,
      missingVariables: missingVars,
      recommendations: [
        'Set SMTP_HOST to your email provider (e.g., smtp.gmail.com)',
        'Set SMTP_PORT to 587 for TLS or 465 for SSL',
        'Set SMTP_USER to your email address',
        'Set SMTP_PASS to your email password or app password',
        'Set SMTP_FROM to your email address'
      ],
      commonProviders: {
        gmail: {
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          note: 'Use App Password, not regular password'
        },
        outlook: {
          host: 'smtp-mail.outlook.com',
          port: 587,
          secure: false
        },
        yahoo: {
          host: 'smtp.mail.yahoo.com',
          port: 587,
          secure: false
        }
      }
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
