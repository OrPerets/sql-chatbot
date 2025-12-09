import { POST } from '@/app/api/auth/forgot-password/route'
import { createPasswordResetToken, checkPasswordResetRateLimit } from '@/lib/users'
import { sendEmail } from '@/app/utils/email-service'

// Mock dependencies
jest.mock('@/lib/users')
jest.mock('@/app/utils/email-service')

const mockCreatePasswordResetToken = createPasswordResetToken as jest.MockedFunction<typeof createPasswordResetToken>
const mockCheckPasswordResetRateLimit = checkPasswordResetRateLimit as jest.MockedFunction<typeof checkPasswordResetRateLimit>
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>

describe('/api/auth/forgot-password', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return 400 if email is missing', async () => {
    const request = new Request('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Email is required')
  })

  it('should return 400 if email is empty string', async () => {
    const request = new Request('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: '' }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Email is required')
  })

  it('should return 429 if rate limit exceeded', async () => {
    mockCheckPasswordResetRateLimit.mockResolvedValue({
      allowed: false,
      remainingTime: 30
    })

    const request = new Request('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(data.rateLimited).toBe(true)
    expect(data.remainingTime).toBe(30)
    expect(mockCheckPasswordResetRateLimit).toHaveBeenCalledWith('test@example.com')
  })

  it('should send reset email successfully', async () => {
    mockCheckPasswordResetRateLimit.mockResolvedValue({ allowed: true })
    mockCreatePasswordResetToken.mockResolvedValue('test-token-123')
    mockSendEmail.mockResolvedValue(true)

    const request = new Request('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockCheckPasswordResetRateLimit).toHaveBeenCalledWith('test@example.com')
    expect(mockCreatePasswordResetToken).toHaveBeenCalledWith('test@example.com')
    expect(mockSendEmail).toHaveBeenCalledWith({
      to: 'test@example.com',
      subject: 'איפוס סיסמה - Michael SQL Assistant',
      text: expect.stringContaining('איפוס סיסמה'),
      html: expect.stringContaining('איפוס סיסמה')
    })
  })

  it('should return success even if user does not exist (prevent email enumeration)', async () => {
    mockCheckPasswordResetRateLimit.mockResolvedValue({ allowed: true })
    mockCreatePasswordResetToken.mockRejectedValue(new Error('User not found'))

    const request = new Request('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'nonexistent@example.com' }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.message).toBe('If the email exists, a password reset link has been sent')
  })

  it('should return 500 if email sending fails', async () => {
    mockCheckPasswordResetRateLimit.mockResolvedValue({ allowed: true })
    mockCreatePasswordResetToken.mockResolvedValue('test-token-123')
    mockSendEmail.mockResolvedValue(false)

    const request = new Request('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to send email')
  })

  it('should handle malformed JSON request', async () => {
    const request = new Request('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      body: 'invalid json',
      headers: { 'Content-Type': 'application/json' }
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Internal server error')
  })

  it('should generate correct reset URL with environment variable', async () => {
    const originalBaseUrl = process.env.NEXT_PUBLIC_BASE_URL
    process.env.NEXT_PUBLIC_BASE_URL = 'https://test.example.com'

    mockCheckPasswordResetRateLimit.mockResolvedValue({ allowed: true })
    mockCreatePasswordResetToken.mockResolvedValue('test-token-123')
    mockSendEmail.mockResolvedValue(true)

    const request = new Request('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
      headers: { 'Content-Type': 'application/json' }
    })

    await POST(request)

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('https://test.example.com/auth/reset-password?token=test-token-123')
      })
    )

    // Restore original value
    process.env.NEXT_PUBLIC_BASE_URL = originalBaseUrl
  })

  it('should use localhost as fallback URL when NEXT_PUBLIC_BASE_URL is not set', async () => {
    const originalBaseUrl = process.env.NEXT_PUBLIC_BASE_URL
    delete process.env.NEXT_PUBLIC_BASE_URL

    mockCheckPasswordResetRateLimit.mockResolvedValue({ allowed: true })
    mockCreatePasswordResetToken.mockResolvedValue('test-token-123')
    mockSendEmail.mockResolvedValue(true)

    const request = new Request('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
      headers: { 'Content-Type': 'application/json' }
    })

    await POST(request)

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('http://localhost:3000/auth/reset-password?token=test-token-123')
      })
    )

    // Restore original value
    process.env.NEXT_PUBLIC_BASE_URL = originalBaseUrl
  })
})
