/**
 * @jest-environment node
 */

const mockInsertOne = jest.fn()
const mockUpdateOne = jest.fn()
const mockFindOne = jest.fn()
const mockCollection = jest.fn((name: string) => {
  if (name === 'student_activities') {
    return { insertOne: mockInsertOne }
  }

  if (name === 'student_profiles') {
    return { updateOne: mockUpdateOne, findOne: mockFindOne }
  }

  return { insertOne: jest.fn(), updateOne: jest.fn(), findOne: jest.fn() }
})

const mockDb = {
  collection: mockCollection,
}

const mockExecuteWithRetry = jest.fn(async (operation: (db: unknown) => Promise<unknown>) =>
  operation(mockDb)
)
const mockResolveLearnerIdentityFromDb = jest.fn(async () => ({
  canonicalId: 'student-1',
  email: 'student@example.com',
  identifiers: ['student-1', 'student@example.com'],
}))
const mockNormalizeLearnerRecords = jest.fn(async () => {})

jest.mock('@/lib/database', () => ({
  executeWithRetry: (...args: unknown[]) => mockExecuteWithRetry(...args),
  connectToDatabase: jest.fn(async () => ({ db: mockDb })),
  COLLECTIONS: {
    STUDENT_ACTIVITIES: 'student_activities',
    STUDENT_PROFILES: 'student_profiles',
  },
}))

jest.mock('@/lib/learner-identity', () => ({
  resolveLearnerIdentityFromDb: (...args: unknown[]) => mockResolveLearnerIdentityFromDb(...args),
  normalizeLearnerRecords: (...args: unknown[]) => mockNormalizeLearnerRecords(...args),
}))

describe('ActivityTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFindOne.mockResolvedValue(null)
    mockUpdateOne.mockResolvedValue({ modifiedCount: 1, upsertedCount: 0 })
    mockInsertOne.mockResolvedValue({ insertedId: 'activity-1' })
  })

  it('uses real Mongo operators for chat, homework, practice, and help-request updates', async () => {
    const { ActivityTracker } = await import('@/lib/activity-tracker')
    const tracker = new ActivityTracker(mockDb as never)

    await tracker.trackChatActivity('student@example.com', 3, 'joins', 'intermediate', true, 'session-1')
    await tracker.trackHomeworkSubmission('student@example.com', 'hw-1', 'q-1', 75, 120, 2, ['JOIN logic'])
    await tracker.trackPracticeActivity('student@example.com', 'sql', 'easy', true)
    await tracker.trackHelpRequest('student@example.com', 'hint', 'medium', false)

    expect(mockInsertOne).toHaveBeenCalledTimes(4)
    expect(mockUpdateOne).toHaveBeenCalledTimes(4)

    expect(mockUpdateOne).toHaveBeenNthCalledWith(
      1,
      { userId: 'student-1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          lastActivity: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
        $inc: {
          'engagementMetrics.chatSessions': 1,
          'engagementMetrics.helpRequests': 1,
        },
        $max: {
          'engagementMetrics.averageSessionDuration': 3,
        },
      }),
      { upsert: true }
    )

    expect(mockUpdateOne).toHaveBeenNthCalledWith(
      2,
      { userId: 'student-1' },
      expect.objectContaining({
        $inc: {
          homeworkSubmissions: 1,
          totalQuestions: 1,
          correctAnswers: 1,
        },
        $addToSet: {
          commonChallenges: { $each: ['JOIN logic'] },
        },
      }),
      { upsert: true }
    )

    expect(mockUpdateOne).toHaveBeenNthCalledWith(
      3,
      { userId: 'student-1' },
      expect.objectContaining({
        $inc: {
          totalQuestions: 1,
          correctAnswers: 1,
        },
      }),
      { upsert: true }
    )

    expect(mockUpdateOne).toHaveBeenNthCalledWith(
      4,
      { userId: 'student-1' },
      expect.objectContaining({
        $inc: {
          'engagementMetrics.helpRequests': 1,
        },
      }),
      { upsert: true }
    )
  })

  it('repairs corrupted operator-shaped metric fields before applying new activity updates', async () => {
    mockFindOne.mockResolvedValue({
      userId: 'student-1',
      totalQuestions: { $inc: 1 },
      correctAnswers: { $inc: 1 },
      homeworkSubmissions: { $inc: 1 },
      averageGrade: { $set: 80 },
      commonChallenges: { $addToSet: { $each: ['old'] } },
      engagementMetrics: {
        chatSessions: { $inc: 1 },
        averageSessionDuration: { $inc: 3 },
        helpRequests: { $inc: 1 },
        selfCorrections: { $inc: 1 },
      },
    })

    const { ActivityTracker } = await import('@/lib/activity-tracker')
    const tracker = new ActivityTracker(mockDb as never)

    await tracker.trackHomeworkSubmission('student@example.com', 'hw-1', 'q-1', 40, 60, 1, ['syntax'])

    expect(mockUpdateOne).toHaveBeenNthCalledWith(
      1,
      { userId: 'student-1' },
      {
        $set: expect.objectContaining({
          totalQuestions: 0,
          correctAnswers: 0,
          homeworkSubmissions: 0,
          averageGrade: 0,
          commonChallenges: [],
          'engagementMetrics.chatSessions': 0,
          'engagementMetrics.averageSessionDuration': 0,
          'engagementMetrics.helpRequests': 0,
          'engagementMetrics.selfCorrections': 0,
          updatedAt: expect.any(Date),
        }),
      }
    )

    expect(mockUpdateOne).toHaveBeenNthCalledWith(
      2,
      { userId: 'student-1' },
      expect.objectContaining({
        $inc: {
          homeworkSubmissions: 1,
          totalQuestions: 1,
        },
        $addToSet: {
          commonChallenges: { $each: ['syntax'] },
        },
      }),
      { upsert: true }
    )
  })
})
