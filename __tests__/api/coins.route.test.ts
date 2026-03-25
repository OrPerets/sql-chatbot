/**
 * @jest-environment node
 */

const mockGetCoinsAdminOverview = jest.fn()
const mockGetCoinsConfig = jest.fn()
const mockSetCoinsConfig = jest.fn()
const mockAdjustBalanceAdmin = jest.fn()

jest.mock('@/lib/coins', () => ({
  getCoinsAdminOverview: (...args: any[]) => mockGetCoinsAdminOverview(...args),
  getCoinsConfig: (...args: any[]) => mockGetCoinsConfig(...args),
  setCoinsConfig: (...args: any[]) => mockSetCoinsConfig(...args),
  adjustBalanceAdmin: (...args: any[]) => mockAdjustBalanceAdmin(...args),
}))

describe('/api/users/coins route', () => {
  const adminEmail = 'orperets11@gmail.com'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('GET ?status=1 is public and returns full config', async () => {
    mockGetCoinsConfig.mockResolvedValue({
      status: 'ON',
      messageCost: 1,
      starterBalance: 20,
      modules: { mainChat: true, homeworkHints: false, sqlPractice: false },
      costs: { mainChatMessage: 1, sqlPracticeOpen: 1, homeworkHintOpen: 1 },
    })
    const { GET } = await import('../../app/api/users/coins/route')
    const request = new Request('http://localhost:3000/api/users/coins?status=1')

    const response = await GET(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      status: 'ON',
      messageCost: 1,
      starterBalance: 20,
      modules: { mainChat: true, homeworkHints: false, sqlPractice: false },
      costs: { mainChatMessage: 1, sqlPracticeOpen: 1, homeworkHintOpen: 1 },
    })
    expect(mockGetCoinsConfig).toHaveBeenCalledTimes(1)
    expect(mockGetCoinsAdminOverview).not.toHaveBeenCalled()
  })

  it('GET ?all=1 returns 403 without admin header', async () => {
    const { GET } = await import('../../app/api/users/coins/route')
    const request = new Request('http://localhost:3000/api/users/coins?all=1')

    const response = await GET(request)
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload.error).toBe('Forbidden')
    expect(mockGetCoinsAdminOverview).not.toHaveBeenCalled()
  })

  it('GET ?all=1 returns overview for valid admin header', async () => {
    mockGetCoinsAdminOverview.mockResolvedValue({
      users: [{ user: 'student@example.com', coins: 7 }],
      summary: { totalUsers: 1 },
      config: { status: 'OFF' },
    })
    const { GET } = await import('../../app/api/users/coins/route')
    const request = new Request('http://localhost:3000/api/users/coins?all=1', {
      headers: { 'x-user-email': adminEmail },
    })

    const response = await GET(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      users: [{ user: 'student@example.com', coins: 7 }],
      summary: { totalUsers: 1 },
      config: { status: 'OFF' },
    })
    expect(mockGetCoinsAdminOverview).toHaveBeenCalledTimes(1)
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

  it('POST with admin header updates config', async () => {
    mockSetCoinsConfig.mockResolvedValue({ status: 'ON' })
    const { POST } = await import('../../app/api/users/coins/route')
    const request = new Request('http://localhost:3000/api/users/coins', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': 'OrPerets11@gmail.com',
      },
      body: JSON.stringify({
        config: {
          modules: { mainChat: true, homeworkHints: true },
          costs: { mainChatMessage: 2 },
          starterBalance: 15,
        },
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({ status: 'ON' })
    expect(mockSetCoinsConfig).toHaveBeenCalledWith(
      {
        modules: { mainChat: true, homeworkHints: true },
        costs: { mainChatMessage: 2 },
        starterBalance: 15,
      },
      adminEmail
    )
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
