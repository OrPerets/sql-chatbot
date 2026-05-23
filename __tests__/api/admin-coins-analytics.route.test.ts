/**
 * @jest-environment node
 */

const mockGetCoinsAdminOverview = jest.fn()
const mockRequireAdmin = jest.fn()

class MockAdminAuthError extends Error {
  status = 403 as const
}

jest.mock('@/lib/coins', () => ({
  getCoinsAdminOverview: (...args: any[]) => mockGetCoinsAdminOverview(...args),
}))

jest.mock('@/lib/admin-auth', () => ({
  AdminAuthError: MockAdminAuthError,
  requireAdmin: (...args: any[]) => mockRequireAdmin(...args),
}))

describe('/api/admin/coins/analytics route', () => {
  const adminEmail = 'orperets11@gmail.com'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 403 when admin auth fails', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new MockAdminAuthError('Forbidden'))
    const { GET } = await import('../../app/api/admin/coins/analytics/route')
    const request = new Request('http://localhost:3000/api/admin/coins/analytics')

    const response = await GET(request)
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload.error).toBe('Forbidden')
    expect(mockGetCoinsAdminOverview).not.toHaveBeenCalled()
  })

  it('returns overview for authenticated admin sessions', async () => {
    mockRequireAdmin.mockResolvedValueOnce({ email: adminEmail })
    mockGetCoinsAdminOverview.mockResolvedValue({
      users: [{ user: 'student@example.com', coins: 5, totalSpent: 3 }],
      summary: { totalUsers: 1, totalSpent: 3 },
      config: { status: 'ON' },
    })

    const { GET } = await import('../../app/api/admin/coins/analytics/route')
    const request = new Request('http://localhost:3000/api/admin/coins/analytics')

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
