/**
 * @jest-environment node
 */

const mockGetAllCoins = jest.fn()
const mockGetCoinsStatus = jest.fn()
const mockSetCoinsConfig = jest.fn()
const mockAdjustBalanceAdmin = jest.fn()

jest.mock('@/lib/coins', () => ({
  getAllCoins: (...args: any[]) => mockGetAllCoins(...args),
  getCoinsStatus: (...args: any[]) => mockGetCoinsStatus(...args),
  setCoinsConfig: (...args: any[]) => mockSetCoinsConfig(...args),
  adjustBalanceAdmin: (...args: any[]) => mockAdjustBalanceAdmin(...args),
}))

describe('/api/users/coins route', () => {
  const adminEmail = 'orperets11@gmail.com'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('GET ?status=1 is public and returns normalized status', async () => {
    mockGetCoinsStatus.mockResolvedValue([{ status: 'ON' }])
    const { GET } = await import('../../app/api/users/coins/route')
    const request = new Request('http://localhost:3000/api/users/coins?status=1')

    const response = await GET(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({ status: 'ON' })
    expect(mockGetCoinsStatus).toHaveBeenCalledTimes(1)
    expect(mockGetAllCoins).not.toHaveBeenCalled()
  })

  it('GET ?all=1 returns 403 without admin header', async () => {
    const { GET } = await import('../../app/api/users/coins/route')
    const request = new Request('http://localhost:3000/api/users/coins?all=1')

    const response = await GET(request)
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload.error).toBe('Forbidden')
    expect(mockGetAllCoins).not.toHaveBeenCalled()
  })

  it('GET ?all=1 returns list for valid admin header', async () => {
    mockGetAllCoins.mockResolvedValue([{ user: 'student@example.com', coins: 7 }])
    const { GET } = await import('../../app/api/users/coins/route')
    const request = new Request('http://localhost:3000/api/users/coins?all=1', {
      headers: { 'x-user-email': adminEmail },
    })

    const response = await GET(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual([{ user: 'student@example.com', coins: 7 }])
    expect(mockGetAllCoins).toHaveBeenCalledTimes(1)
  })

  it('POST returns 403 without admin header', async () => {
    const { POST } = await import('../../app/api/users/coins/route')
    const request = new Request('http://localhost:3000/api/users/coins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newStatus: 'ON' }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload.error).toBe('Forbidden')
    expect(mockSetCoinsConfig).not.toHaveBeenCalled()
    expect(mockAdjustBalanceAdmin).not.toHaveBeenCalled()
  })

  it('POST with admin header updates status', async () => {
    mockSetCoinsConfig.mockResolvedValue({ acknowledged: true })
    const { POST } = await import('../../app/api/users/coins/route')
    const request = new Request('http://localhost:3000/api/users/coins', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': 'OrPerets11@gmail.com',
      },
      body: JSON.stringify({ newStatus: 'ON' }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({ acknowledged: true })
    expect(mockSetCoinsConfig).toHaveBeenCalledWith({ status: 'ON' }, adminEmail)
  })

  it('POST with admin header adjusts balances for users', async () => {
    mockAdjustBalanceAdmin.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 })
    const { POST } = await import('../../app/api/users/coins/route')
    const request = new Request('http://localhost:3000/api/users/coins', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': adminEmail,
      },
      body: JSON.stringify({ users: ['student@example.com'], amount: 5 }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({ matchedCount: 1, modifiedCount: 1 })
    expect(mockAdjustBalanceAdmin).toHaveBeenCalledWith(['student@example.com'], 5, adminEmail)
  })
})
