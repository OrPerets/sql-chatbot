/**
 * @jest-environment node
 */

import { POST } from '@/app/api/auth/reset-password/route'
import { applyPasswordResetToken, validatePasswordResetToken } from '@/lib/users'
import { sendEmail } from '@/app/utils/mock-email-service'

// Mock dependencies
jest.mock('@/lib/users')
jest.mock('@/app/utils/mock-email-service')

const mockApplyPasswordResetToken = applyPasswordResetToken as jest.MockedFunction<typeof applyPasswordResetToken>
const mockValidatePasswordResetToken = validatePasswordResetToken as jest.MockedFunction<typeof validatePasswordResetToken>
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>

describe('/api/auth/reset-password', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return 400 if token is missing', async () => {
    const request = new Request('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ newPassword: 'newpass123', confirmPassword: 'newpass123' }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Token, new password, and confirmation are required')
  })

  it('should return 400 if newPassword is missing', async () => {
    const request = new Request('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'test-token', confirmPassword: 'newpass123' }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Token, new password, and confirmation are required')
  })

  it('should return 400 if confirmPassword is missing', async () => {
    const request = new Request('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'test-token', newPassword: 'newpass123' }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Token, new password, and confirmation are required')
  })

  it('should return 400 if passwords do not match', async () => {
    const request = new Request('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ 
        token: 'test-token', 
        newPassword: 'newpass123', 
        confirmPassword: 'differentpass' 
      }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Passwords do not match')
  })

  it('should return 400 if password is too short', async () => {
    const request = new Request('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ 
        token: 'test-token', 
        newPassword: '123', 
        confirmPassword: '123' 
      }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Password must be at least 6 characters long')
  })

  it('should return 400 if password is default password', async () => {
    const request = new Request('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ 
        token: 'test-token', 
        newPassword: 'shenkar', 
        confirmPassword: 'shenkar' 
      }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Cannot use default password')
  })

  it('should return 400 if token is invalid', async () => {
    mockValidatePasswordResetToken.mockResolvedValue({
      valid: false,
      error: 'Invalid token'
    })

    const request = new Request('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ 
        token: 'invalid-token', 
        newPassword: 'newpass123', 
        confirmPassword: 'newpass123' 
      }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid token')
    expect(mockValidatePasswordResetToken).toHaveBeenCalledWith('invalid-token')
  })

  it('should return 400 if token is expired', async () => {
    mockValidatePasswordResetToken.mockResolvedValue({
      valid: false,
      error: 'Token expired'
    })

    const request = new Request('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ 
        token: 'expired-token', 
        newPassword: 'newpass123', 
        confirmPassword: 'newpass123' 
      }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Token expired')
  })

  it('should return 400 if password reset fails', async () => {
    mockValidatePasswordResetToken.mockResolvedValue({
      valid: true,
      email: 'test@example.com'
    })
    mockApplyPasswordResetToken.mockResolvedValue({
      success: false,
      error: 'Failed to update password'
    })

    const request = new Request('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ 
        token: 'valid-token', 
        newPassword: 'newpass123', 
        confirmPassword: 'newpass123' 
      }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Failed to update password')
    expect(mockApplyPasswordResetToken).toHaveBeenCalledWith('valid-token', 'newpass123')
  })

  it('should reset password successfully', async () => {
    mockValidatePasswordResetToken.mockResolvedValue({
      valid: true,
      email: 'test@example.com'
    })
    mockApplyPasswordResetToken.mockResolvedValue({
      success: true
    })
    mockSendEmail.mockResolvedValue(true)

    const request = new Request('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ 
        token: 'valid-token', 
        newPassword: 'newpass123', 
        confirmPassword: 'newpass123' 
      }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.message).toBe('Password reset successfully')
    expect(mockValidatePasswordResetToken).toHaveBeenCalledWith('valid-token')
    expect(mockApplyPasswordResetToken).toHaveBeenCalledWith('valid-token', 'newpass123')
    expect(mockSendEmail).toHaveBeenCalledWith({
      to: 'test@example.com',
      subject: 'סיסמה עודכנה בהצלחה - Michael SQL Assistant',
      text: expect.stringContaining('סיסמה עודכנה בהצלחה'),
      html: expect.stringContaining('סיסמה עודכנה בהצלחה')
    })
  })

  it('should succeed even if confirmation email fails', async () => {
    mockValidatePasswordResetToken.mockResolvedValue({
      valid: true,
      email: 'test@example.com'
    })
    mockApplyPasswordResetToken.mockResolvedValue({
      success: true
    })
    mockSendEmail.mockRejectedValue(new Error('Email service unavailable'))

    const request = new Request('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ 
        token: 'valid-token', 
        newPassword: 'newpass123', 
        confirmPassword: 'newpass123' 
      }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.message).toBe('Password reset successfully')
  })

  it('should handle malformed JSON request', async () => {
    const request = new Request('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: 'invalid json',
      headers: { 'Content-Type': 'application/json' }
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Internal server error')
  })
})
