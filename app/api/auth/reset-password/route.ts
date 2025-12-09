import { NextRequest, NextResponse } from 'next/server'
import { applyPasswordResetToken, validatePasswordResetToken } from '@/lib/users'
import { sendEmail } from '@/app/utils/mock-email-service'

function validatePasswordStrength(password: string): { isStrong: boolean; reasons: string[] } {
  const reasons: string[] = []
  
  if (password.length < 8) {
    reasons.push('must be at least 8 characters long')
  }
  
  if (!/[a-z]/.test(password)) {
    reasons.push('must contain at least one lowercase letter')
  }
  
  if (!/[A-Z]/.test(password)) {
    reasons.push('must contain at least one uppercase letter')
  }
  
  if (!/\d/.test(password)) {
    reasons.push('must contain at least one number')
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    reasons.push('must contain at least one special character')
  }
  
  // Check for common weak patterns
  const commonPasswords = ['password', '123456', 'qwerty', 'abc123', 'password123']
  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    reasons.push('contains common password patterns')
  }
  
  return {
    isStrong: reasons.length === 0,
    reasons
  }
}

export async function POST(request: NextRequest) {
  try {
    const { token, newPassword, confirmPassword } = await request.json()

    if (!token || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: 'Token, new password, and confirmation are required' }, { status: 400 })
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 })
    }

    if (newPassword === 'shenkar') {
      return NextResponse.json({ error: 'Cannot use default password' }, { status: 400 })
    }

    // Get email from token for confirmation email
    const validation = await validatePasswordResetToken(token)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const result = await applyPasswordResetToken(token, newPassword)
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // Send confirmation email
    try {
      await sendEmail({
        to: validation.email!,
        subject: 'סיסמה עודכנה בהצלחה - Michael SQL Assistant',
        text: `סיסמה עודכנה בהצלחה - Michael SQL Assistant\n\nשלום,\nהסיסמה שלך במערכת Michael SQL Assistant עודכנה בהצלחה.\nאם לא ביצעת שינוי זה, אנא צור קשר עם התמיכה הטכנית מיד.\n\nMichael SQL Assistant Team`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>סיסמה עודכנה בהצלחה</h2>
            <p>שלום,</p>
            <p>הסיסמה שלך במערכת Michael SQL Assistant עודכנה בהצלחה.</p>
            <p>אם לא ביצעת שינוי זה, אנא צור קשר עם התמיכה הטכנית מיד.</p>
            <hr>
            <p style="font-size: 12px; color: #666;">Michael SQL Assistant Team</p>
          </div>
        `
      })
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError)
      // Don't fail the request if email fails
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Password reset successfully' 
    })

  } catch (error) {
    console.error('Error resetting password:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
