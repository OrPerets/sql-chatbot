/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { AdminAuthError } from '@/lib/admin-auth';
import { GET, POST } from '@/app/api/users/route';

const mockGetAllUsers = jest.fn();
const mockCreateUser = jest.fn();
const mockUpdatePassword = jest.fn();
const mockGetUserByEmail = jest.fn();
const mockRequireAdmin = jest.fn();

jest.mock('@/lib/users', () => ({
  getAllUsers: (...args: unknown[]) => mockGetAllUsers(...args),
  createUser: (...args: unknown[]) => mockCreateUser(...args),
  updatePassword: (...args: unknown[]) => mockUpdatePassword(...args),
  getUsersService: jest.fn(async () => ({
    getUserByEmail: mockGetUserByEmail,
  })),
}));

jest.mock('@/lib/admin-auth', () => {
  class AdminAuthError extends Error {}
  return {
    AdminAuthError,
    requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
  };
});

function request(url: string, options: RequestInit = {}) {
  return new NextRequest(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
}

describe('/api/users', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAdmin.mockRejectedValue(new AdminAuthError('Forbidden'));
  });

  it('blocks anonymous user listing', async () => {
    const response = await GET(request('http://localhost:3000/api/users'));

    expect(response.status).toBe(403);
    expect(mockGetAllUsers).not.toHaveBeenCalled();
  });

  it('sanitizes admin user listing', async () => {
    mockGetAllUsers.mockResolvedValue([
      { email: 'student@example.com', password: 'secret', firstName: 'Student' },
    ]);
    mockRequireAdmin.mockResolvedValue({ email: 'orperets11@gmail.com' });

    const response = await GET(request('http://localhost:3000/api/users'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([{ email: 'student@example.com', firstName: 'Student' }]);
  });

  it('allows first-login password change only with the current default password', async () => {
    mockGetUserByEmail.mockResolvedValue({ email: 'student@example.com', password: 'shenkar' });
    mockUpdatePassword.mockResolvedValue({ modifiedCount: 1 });

    const response = await POST(
      request('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'student@example.com',
          currentPassword: 'shenkar',
          password: 'new-password',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mockUpdatePassword).toHaveBeenCalledWith('student@example.com', 'new-password');
  });

  it('blocks anonymous arbitrary password changes', async () => {
    mockGetUserByEmail.mockResolvedValue({ email: 'student@example.com', password: 'existing' });

    const response = await POST(
      request('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'student@example.com',
          currentPassword: 'wrong',
          password: 'new-password',
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });
});
