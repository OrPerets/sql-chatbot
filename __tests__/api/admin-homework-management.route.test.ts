/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { AdminAuthError } from '@/lib/admin-auth';
import { GET as GET_MANAGEMENT } from '@/app/api/admin/homework-management/route';
import { PUT as PUT_ACCESS, DELETE as DELETE_ACCESS } from '@/app/api/admin/homework-management/access/route';
import { GET as GET_SUBMISSION } from '@/app/api/admin/homework-management/submission/route';
import { POST as POST_SUBMISSION_ACTION } from '@/app/api/admin/homework-management/submission-actions/route';

const mockRequireAdmin = jest.fn();
const mockGetManagementPayload = jest.fn();
const mockGetSubmissionPayload = jest.fn();
const mockReopenSubmission = jest.fn();
const mockUpsertOverride = jest.fn();
const mockDeleteOverride = jest.fn();

jest.mock('@/lib/admin-auth', () => {
  class AdminAuthError extends Error {}
  return {
    AdminAuthError,
    requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
  };
});

jest.mock('@/lib/admin-homework-management', () => ({
  getAdminHomeworkManagementPayload: (...args: unknown[]) => mockGetManagementPayload(...args),
  getAdminHomeworkSubmissionPayload: (...args: unknown[]) => mockGetSubmissionPayload(...args),
  reopenHomeworkSubmission: (...args: unknown[]) => mockReopenSubmission(...args),
}));

jest.mock('@/lib/homework-access-overrides', () => ({
  upsertHomeworkAccessOverride: (...args: unknown[]) => mockUpsertOverride(...args),
  deleteHomeworkAccessOverride: (...args: unknown[]) => mockDeleteOverride(...args),
}));

function request(url: string, options: RequestInit = {}) {
  return new NextRequest(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
}

describe('/api/admin/homework-management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ email: 'orperets11@gmail.com' });
  });

  it('blocks anonymous management reads', async () => {
    mockRequireAdmin.mockRejectedValue(new AdminAuthError('Forbidden'));

    const response = await GET_MANAGEMENT(request('http://localhost:3000/api/admin/homework-management'));

    expect(response.status).toBe(403);
    expect(mockGetManagementPayload).not.toHaveBeenCalled();
  });

  it('returns management rows from the service for the selected homework set', async () => {
    mockGetManagementPayload.mockResolvedValue({
      homeworkSets: [{ id: 'set-1', title: 'HW1' }],
      selectedSet: { id: 'set-1', title: 'HW1' },
      rows: [{ user: { email: 'student@example.com' }, submission: { status: 'none' } }],
      summary: { totalUsers: 1 },
    });

    const response = await GET_MANAGEMENT(request('http://localhost:3000/api/admin/homework-management?setId=set-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetManagementPayload).toHaveBeenCalledWith('set-1');
    expect(data.rows).toHaveLength(1);
  });

  it('upserts one student homework access override', async () => {
    mockUpsertOverride.mockResolvedValue({ homeworkSetId: 'set-1', userEmail: 'student@example.com' });

    const response = await PUT_ACCESS(request('http://localhost:3000/api/admin/homework-management/access', {
      method: 'PUT',
      body: JSON.stringify({
        homeworkSetId: 'set-1',
        userEmail: 'student@example.com',
        availableFrom: '2026-07-01T09:00:00.000Z',
        availableUntil: '2026-07-02T09:00:00.000Z',
      }),
    }));

    expect(response.status).toBe(200);
    expect(mockUpsertOverride).toHaveBeenCalledWith(expect.objectContaining({
      homeworkSetId: 'set-1',
      userEmail: 'student@example.com',
      actorEmail: 'orperets11@gmail.com',
    }));
  });

  it('clears one student homework access override', async () => {
    mockDeleteOverride.mockResolvedValue(true);

    const response = await DELETE_ACCESS(
      request('http://localhost:3000/api/admin/homework-management/access?homeworkSetId=set-1&userEmail=student%40example.com', {
        method: 'DELETE',
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.deleted).toBe(true);
    expect(mockDeleteOverride).toHaveBeenCalledWith('set-1', 'student@example.com');
  });

  it('loads a submission popup payload without creating a draft', async () => {
    mockGetSubmissionPayload.mockResolvedValue({
      user: { email: 'student@example.com' },
      homeworkSet: { id: 'set-1' },
      questions: [],
      submission: null,
    });

    const response = await GET_SUBMISSION(
      request('http://localhost:3000/api/admin/homework-management/submission?setId=set-1&studentId=student%40example.com'),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.submission).toBeNull();
    expect(mockGetSubmissionPayload).toHaveBeenCalledWith('set-1', 'student@example.com');
  });

  it('reopens a submitted homework through the archive-first service action', async () => {
    mockReopenSubmission.mockResolvedValue({
      id: 'sub-1',
      homeworkSetId: 'set-1',
      studentId: 'student@example.com',
      status: 'in_progress',
      answers: { q1: { sql: 'SELECT 1' } },
    });

    const response = await POST_SUBMISSION_ACTION(request('http://localhost:3000/api/admin/homework-management/submission-actions', {
      method: 'POST',
      body: JSON.stringify({
        action: 'reopen',
        homeworkSetId: 'set-1',
        studentId: 'student@example.com',
      }),
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.submission.status).toBe('in_progress');
    expect(data.submission.answers.q1.sql).toBe('SELECT 1');
    expect(mockReopenSubmission).toHaveBeenCalledWith('set-1', 'student@example.com', 'orperets11@gmail.com');
  });
});
