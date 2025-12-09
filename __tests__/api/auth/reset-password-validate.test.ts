import { GET } from '@/app/api/auth/reset-password/validate/route'
import { validatePasswordResetToken } from '@/lib/users'

// Mock dependencies
jest.mock('@/lib/users')

const mockValidatePasswordResetToken = validatePasswordResetToken as jest.MockedFunction<typeof validatePasswordResetToken>

describe('/api/auth/reset-password/validate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return 400 if token is missing', async () => {
    const request = new Request('http://localhost:3000/api/auth/reset-password/validate')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Token is required')
  })

  it('should return 400 if token is empty string', async () => {
    const request = new Request('http://localhost:3000/api/auth/reset-password/validate?token=')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Token is required')
  })

  it('should return 400 if token is invalid', async () => {
    mockValidatePasswordResetToken.mockResolvedValue({
      valid: false,
      error: 'Invalid token'
    })

    const request = new Request('http://localhost:3000/api/auth/reset-password/validate?token=invalid-token')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.valid).toBe(false)
    expect(data.error).toBe('Invalid token')
    expect(mockValidatePasswordResetToken).toHaveBeenCalledWith('invalid-token')
  })

  it('should return 400 if token is expired', async () => {
    mockValidatePasswordResetToken.mockResolvedValue({
      valid: false,
      error: 'Token expired'
    })

    const request = new Request('http://localhost:3000/api/auth/reset-password/validate?token=expired-token')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.valid).toBe(false)
    expect(data.error).toBe('Token expired')
    expect(mockValidatePasswordResetToken).toHaveBeenCalledWith('expired-token')
  })

  it('should return 400 if token is already used', async () => {
    mockValidatePasswordResetToken.mockResolvedValue({
      valid: false,
      error: 'Token already used'
    })

    const request = new Request('http://localhost:3000/api/auth/reset-password/validate?token=used-token')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.valid).toBe(false)
    expect(data.error).toBe('Token already used')
    expect(mockValidatePasswordResetToken).toHaveBeenCalledWith('used-token')
  })

  it('should return 200 with valid token and email', async () => {
    mockValidatePasswordResetToken.mockResolvedValue({
      valid: true,
      email: 'test@example.com'
    })

    const request = new Request('http://localhost:3000/api/auth/reset-password/validate?token=valid-token')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.valid).toBe(true)
    expect(data.email).toBe('test@example.com')
    expect(mockValidatePasswordResetToken).toHaveBeenCalledWith('valid-token')
  })

  it('should handle multiple query parameters', async () => {
    mockValidatePasswordResetToken.mockResolvedValue({
      valid: true,
      email: 'test@example.com'
    })

    const request = new Request('http://localhost:3000/api/auth/reset-password/validate?token=valid-token&other=param')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.valid).toBe(true)
    expect(data.email).toBe('test@example.com')
    expect(mockValidatePasswordResetToken).toHaveBeenCalledWith('valid-token')
  })

  it('should handle URL encoded tokens', async () => {
    mockValidatePasswordResetToken.mockResolvedValue({
      valid: true,
      email: 'test@example.com'
    })

    const encodedToken = encodeURIComponent('token-with-special-chars!@#$%')
    const request = new Request(`http://localhost:3000/api/auth/reset-password/validate?token=${encodedToken}`)

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.valid).toBe(true)
    expect(data.email).toBe('test@example.com')
    expect(mockValidatePasswordResetToken).toHaveBeenCalledWith('token-with-special-chars!@#$%')
  })

  it('should handle validation service errors', async () => {
    mockValidatePasswordResetToken.mockRejectedValue(new Error('Database connection failed'))

    const request = new Request('http://localhost:3000/api/auth/reset-password/validate?token=test-token')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Internal server error')
  })
})
