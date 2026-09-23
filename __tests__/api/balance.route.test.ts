/**
 * @jest-environment node
 */

const mockGetCoinsBalance = jest.fn()
const mockSetCoinsBalance = jest.fn()
const mockRequireAdmin = jest.fn()

class MockAdminAuthError extends Error {
  status = 403 as const
}

jest.mock('@/lib/users', () => ({
  getCoinsBalance: (...args: any[]) => mockGetCoinsBalance(...args),
  setCoinsBalance: (...args: any[]) => mockSetCoinsBalance(...args),
}))

jest.mock('@/lib/admin-auth', () => ({
  AdminAuthError: MockAdminAuthError,
  requireAdmin: (...args: any[]) => mockRequireAdmin(...args),
}))

describe('/api/users/balance route', () => {
  const adminEmail = 'orperets11@gmail.com'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('POST returns 403 when admin auth fails', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new MockAdminAuthError('Forbidden'))
    const { POST } = await import('../../app/api/users/balance/route')
    const request = new Request('http://localhost:3000/api/users/balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@example.com', currentBalance: 10 }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload.error).toBe('Forbidden')
    expect(mockSetCoinsBalance).not.toHaveBeenCalled()
  })

  it('POST returns success for authenticated admins with valid body', async () => {
    mockRequireAdmin.mockResolvedValueOnce({ email: adminEmail })
    mockSetCoinsBalance.mockResolvedValue({ modifiedCount: 1 })
    const { POST } = await import('../../app/api/users/balance/route')
    const request = new Request('http://localhost:3000/api/users/balance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'student@example.com', currentBalance: 12 }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({ modifiedCount: 1 })
    expect(mockSetCoinsBalance).toHaveBeenCalledWith('student@example.com', 12)
  })
})
