/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

const mockResolveLearnerIdentity = jest.fn()
const mockResolveAuthenticatedSession = jest.fn()

jest.mock('@/lib/learner-identity', () => ({
  resolveLearnerIdentity: (...args: unknown[]) => mockResolveLearnerIdentity(...args),
}))

jest.mock('@/lib/session-auth', () => ({
  resolveAuthenticatedSession: (...args: unknown[]) => mockResolveAuthenticatedSession(...args),
}))

describe('requireAuthenticatedUser', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns the canonical learner id when header uses email', async () => {
    mockResolveAuthenticatedSession.mockResolvedValue({
      userId: 'student-1',
      user: {
        _id: { toString: () => 'student-1' },
        email: 'student@example.com',
      },
      session: {
        sub: 'student-1',
        email: 'student@example.com',
        role: 'student',
      },
    })
    mockResolveLearnerIdentity.mockResolvedValue({
      canonicalId: 'student-1',
      email: 'student@example.com',
      identifiers: ['student-1', 'student@example.com'],
      user: {
        _id: { toString: () => 'student-1' },
        email: 'student@example.com',
      },
    })

    const { requireAuthenticatedUser } = await import('@/lib/request-auth')
    const request = new NextRequest('http://localhost:3000/api/homework', {
      headers: {
        'x-user-id': 'student@example.com',
      },
    })

    const result = await requireAuthenticatedUser(request, 'student-1')

    expect(result).toEqual({
      ok: true,
      user: {
        _id: { toString: expect.any(Function) },
        email: 'student@example.com',
      },
      userId: 'student-1',
    })
    expect(mockResolveLearnerIdentity).toHaveBeenCalledWith(
      'student@example.com',
      'request-auth.headerUserId'
    )
    expect(mockResolveLearnerIdentity).toHaveBeenCalledWith(
      'student-1',
      'request-auth.expectedUserId'
    )
  })

  it('rejects mismatched canonical identities between header and authenticated session', async () => {
    mockResolveAuthenticatedSession.mockResolvedValue({
      userId: 'student-2',
      user: { email: 'student-2@example.com' },
      session: {
        sub: 'student-2',
        email: 'student-2@example.com',
        role: 'student',
      },
    })
    mockResolveLearnerIdentity.mockResolvedValue({
      canonicalId: 'student-1',
      email: 'student-1@example.com',
      identifiers: ['student-1'],
      user: { email: 'student-1@example.com' },
    })

    const { requireAuthenticatedUser } = await import('@/lib/request-auth')
    const request = new NextRequest('http://localhost:3000/api/homework', {
      headers: {
        'x-user-id': 'student-1',
      },
    })

    const result = await requireAuthenticatedUser(request)

    expect(result).toEqual({
      ok: false,
      status: 403,
      error: 'Unauthorized',
    })
  })

  it('returns 401 when no authenticated session is present', async () => {
    mockResolveAuthenticatedSession.mockResolvedValue(null)

    const { requireAuthenticatedUser } = await import('@/lib/request-auth')
    const request = new NextRequest('http://localhost:3000/api/homework')

    const result = await requireAuthenticatedUser(request)

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: 'Unauthorized',
    })
  })
})
