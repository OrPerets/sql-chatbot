/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET as GET_HOMEWORK_LIST, POST as POST_HOMEWORK } from '@/app/api/homework/route';
import { GET as GET_HOMEWORK_SET } from '@/app/api/homework/[setId]/route';

const mockListHomeworkSets = jest.fn();
const mockCreateHomeworkSet = jest.fn();
const mockGetHomeworkSetById = jest.fn();
const mockUpdateHomeworkSet = jest.fn();
const mockDeleteHomeworkSet = jest.fn();
const mockPublishHomeworkSet = jest.fn();
const mockFindUserByIdOrEmail = jest.fn();

jest.mock('@/lib/homework', () => ({
  listHomeworkSets: (...args: unknown[]) => mockListHomeworkSets(...args),
  createHomeworkSet: (...args: unknown[]) => mockCreateHomeworkSet(...args),
  getHomeworkSetById: (...args: unknown[]) => mockGetHomeworkSetById(...args),
  updateHomeworkSet: (...args: unknown[]) => mockUpdateHomeworkSet(...args),
  deleteHomeworkSet: (...args: unknown[]) => mockDeleteHomeworkSet(...args),
  publishHomeworkSet: (...args: unknown[]) => mockPublishHomeworkSet(...args),
}));

jest.mock('@/lib/users', () => ({
  getUsersService: jest.fn(async () => ({
    findUserByIdOrEmail: mockFindUserByIdOrEmail,
  })),
}));

describe('/api/homework routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('filters to currently available homework sets and adds availability metadata', async () => {
    mockListHomeworkSets.mockResolvedValue({
      items: [
        {
          id: 'open-set',
          title: 'Open',
          courseId: 'DB101',
          dueAt: '2026-03-10T00:00:00.000Z',
          availableFrom: '2026-03-01T00:00:00.000Z',
          availableUntil: '2099-03-10T00:00:00.000Z',
          published: true,
          entryMode: 'listed',
          datasetPolicy: 'shared',
          questionOrder: [],
          visibility: 'published',
          createdBy: 'teacher',
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
          draftQuestionCount: 0,
          submissionCount: 0,
        },
        {
          id: 'upcoming-set',
          title: 'Upcoming',
          courseId: 'DB101',
          dueAt: '2099-03-20T00:00:00.000Z',
          availableFrom: '2099-03-07T00:00:00.000Z',
          availableUntil: '2099-03-20T00:00:00.000Z',
          published: true,
          entryMode: 'listed',
          datasetPolicy: 'shared',
          questionOrder: [],
          visibility: 'published',
          createdBy: 'teacher',
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
          draftQuestionCount: 0,
          submissionCount: 0,
        },
      ],
      page: 1,
      totalPages: 1,
      totalItems: 2,
    });

    const request = new NextRequest('http://localhost:3000/api/homework?availableOnly=true');
    const response = await GET_HOMEWORK_LIST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe('open-set');
    expect(data.items[0].availabilityState).toBe('open');
    expect(data.items[0].accessible).toBe(true);
  });

  it('creates homework with explicit availability fields', async () => {
    mockCreateHomeworkSet.mockImplementation(async (payload) => payload);

    const request = new NextRequest('http://localhost:3000/api/homework', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Sprint 1 Homework',
        courseId: 'DB101',
        availableFrom: '2026-03-06T08:00:00.000Z',
        availableUntil: '2026-03-12T20:00:00.000Z',
        dataStructureNotes: 'Tables are preloaded.',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST_HOMEWORK(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(mockCreateHomeworkSet).toHaveBeenCalledWith(
      expect.objectContaining({
        availableFrom: '2026-03-06T08:00:00.000Z',
        availableUntil: '2026-03-12T20:00:00.000Z',
        dueAt: '2026-03-12T20:00:00.000Z',
        entryMode: 'listed',
      })
    );
    expect(data.dataStructureNotes).toBe('Tables are preloaded.');
  });

  it('blocks student access to upcoming homework sets', async () => {
    mockGetHomeworkSetById.mockResolvedValue({
      id: 'future-set',
      title: 'Future Homework',
      courseId: 'DB101',
      dueAt: '2099-03-12T20:00:00.000Z',
      availableFrom: '2099-03-10T08:00:00.000Z',
      availableUntil: '2099-03-12T20:00:00.000Z',
      published: true,
      entryMode: 'listed',
      datasetPolicy: 'shared',
      questionOrder: [],
      visibility: 'published',
      createdBy: 'teacher',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    });

    const request = new NextRequest('http://localhost:3000/api/homework/future-set');
    const response = await GET_HOMEWORK_SET(request, { params: Promise.resolve({ setId: 'future-set' }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.accessible).toBe(false);
    expect(data.availabilityState).toBe('upcoming');
  });

  it('allows builder access to homework outside the student availability window', async () => {
    mockGetHomeworkSetById.mockResolvedValue({
      id: 'future-set',
      title: 'Future Homework',
      courseId: 'DB101',
      dueAt: '2099-03-12T20:00:00.000Z',
      availableFrom: '2099-03-10T08:00:00.000Z',
      availableUntil: '2099-03-12T20:00:00.000Z',
      published: false,
      entryMode: 'hidden',
      datasetPolicy: 'shared',
      questionOrder: [],
      visibility: 'draft',
      createdBy: 'teacher',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    });

    const request = new NextRequest('http://localhost:3000/api/homework/future-set?role=builder');
    const response = await GET_HOMEWORK_SET(request, { params: Promise.resolve({ setId: 'future-set' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.accessible).toBe(true);
    expect(data.availabilityState).toBe('upcoming');
    expect(data.studentAccess.accessible).toBe(false);
    expect(data.studentAccess.availabilityState).toBe('upcoming');
  });

  it('blocks student access to closed homework sets and returns debug context', async () => {
    mockGetHomeworkSetById.mockResolvedValue({
      id: 'closed-set',
      title: 'Closed Homework',
      courseId: 'DB101',
      dueAt: '2026-03-02T20:00:00.000Z',
      availableFrom: '2026-03-01T08:00:00.000Z',
      availableUntil: '2026-03-02T20:00:00.000Z',
      published: true,
      entryMode: 'listed',
      datasetPolicy: 'shared',
      questionOrder: [],
      visibility: 'published',
      createdBy: 'teacher',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    });

    const request = new NextRequest('http://localhost:3000/api/homework/closed-set');
    const response = await GET_HOMEWORK_SET(request, { params: Promise.resolve({ setId: 'closed-set' }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.accessible).toBe(false);
    expect(data.availabilityState).toBe('closed');
    expect(data.studentAccess.visibility).toBe('published');
    expect(data.studentAccess.entryMode).toBe('listed');
  });

  it('lets builders inspect student access blockers for unpublished hidden homework', async () => {
    mockGetHomeworkSetById.mockResolvedValue({
      id: 'hidden-set',
      title: 'Hidden Homework',
      courseId: 'DB101',
      dueAt: '2099-03-12T20:00:00.000Z',
      availableFrom: '2026-03-01T08:00:00.000Z',
      availableUntil: '2099-03-12T20:00:00.000Z',
      published: false,
      entryMode: 'hidden',
      datasetPolicy: 'shared',
      questionOrder: [],
      visibility: 'draft',
      createdBy: 'teacher',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    });

    const request = new NextRequest('http://localhost:3000/api/homework/hidden-set?role=builder');
    const response = await GET_HOMEWORK_SET(request, { params: Promise.resolve({ setId: 'hidden-set' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.accessible).toBe(true);
    expect(data.studentAccess.published).toBe(false);
    expect(data.studentAccess.entryMode).toBe('hidden');
    expect(data.studentAccess.accessible).toBe(true);
  });
});
