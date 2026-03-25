/**
 * @jest-environment node
 */

const mockGetCoinsAdminOverview = jest.fn()

jest.mock('@/lib/coins', () => ({
  getCoinsAdminOverview: (...args: any[]) => mockGetCoinsAdminOverview(...args),
}))

describe('/api/admin/coins/analytics route', () => {
  const adminEmail = 'orperets11@gmail.com'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 403 without admin header', async () => {
    const { GET } = await import('../../app/api/admin/coins/analytics/route')
    const request = new Request('http://localhost:3000/api/admin/coins/analytics')

    const response = await GET(request)
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload.error).toBe('Forbidden')
    expect(mockGetCoinsAdminOverview).not.toHaveBeenCalled()
  })

  it('returns overview for valid admin header', async () => {
    mockGetCoinsAdminOverview.mockResolvedValue({
      users: [{ user: 'student@example.com', coins: 5, totalSpent: 3 }],
      summary: { totalUsers: 1, totalSpent: 3 },
      config: { status: 'ON' },
    })

    const { GET } = await import('../../app/api/admin/coins/analytics/route')
    const request = new Request('http://localhost:3000/api/admin/coins/analytics', {
      headers: { 'x-user-email': adminEmail },
    })

    const response = await GET(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      users: [{ user: 'student@example.com', coins: 5, totalSpent: 3 }],
      summary: { totalUsers: 1, totalSpent: 3 },
      config: { status: 'ON' },
    })
    expect(mockGetCoinsAdminOverview).toHaveBeenCalledTimes(1)
  })
})
