import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/app/utils/email-service'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    console.log('Testing email service for:', email)

    // Test email sending
    const emailSent = await sendEmail({
      to: email,
      subject: 'Test Email - Michael SQL Assistant',
      text: 'This is a test email to verify the email service is working correctly.',
      html: '<p>This is a test email to verify the email service is working correctly.</p>'
    })

    console.log('Email sent result:', emailSent)

    return NextResponse.json({ 
      success: true, 
      message: 'Email test completed',
      emailSent
    })

  } catch (error) {
    console.error('Error in email test:', error)
    return NextResponse.json({ 
      error: 'Email test failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
