/**
 * @jest-environment node
 */

const mockGetCoinsBalance = jest.fn()
const mockSetCoinsBalance = jest.fn()

jest.mock('@/lib/users', () => ({
  getCoinsBalance: (...args: any[]) => mockGetCoinsBalance(...args),
  setCoinsBalance: (...args: any[]) => mockSetCoinsBalance(...args),
}))

describe('/api/users/balance route', () => {
  const adminEmail = 'orperets11@gmail.com'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('POST returns 403 without admin header', async () => {
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

  it('POST returns success with admin header and valid body', async () => {
    mockSetCoinsBalance.mockResolvedValue({ modifiedCount: 1 })
    const { POST } = await import('../../app/api/users/balance/route')
    const request = new Request('http://localhost:3000/api/users/balance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': adminEmail,
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
