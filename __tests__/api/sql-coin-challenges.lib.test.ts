/**
 * @jest-environment node
 */

const mockExecuteWithRetry = jest.fn();
const mockUpdateCoinsBalance = jest.fn();
const mockLogCoinTransaction = jest.fn();
const mockDb = {
  collection: jest.fn(),
};

jest.mock("@/lib/database", () => ({
  connectToDatabase: jest.fn(),
  executeWithRetry: (...args: unknown[]) => mockExecuteWithRetry(...args),
  COLLECTIONS: {
    SQL_COIN_CHALLENGES: "sql_coin_challenges",
    USERS: "users",
    PRACTICE_QUERIES: "practice_queries",
  },
}));

jest.mock("@/lib/coins", () => ({
  updateCoinsBalance: (...args: unknown[]) => mockUpdateCoinsBalance(...args),
  logCoinTransaction: (...args: unknown[]) => mockLogCoinTransaction(...args),
}));

import { SqlCoinChallengeService } from "@/lib/sql-coin-challenges";

describe("SqlCoinChallengeService", () => {
  let challengeCollection: any;
  let usersCollection: any;
  let practiceQueriesCollection: any;

  const activeChallenge = {
    id: "sql_coin_1",
    studentId: "student-1",
    studentEmail: "student@example.com",
    year: 2026,
    semester: 2,
    status: "active",
    createdBy: "admin@example.com",
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z",
    questions: [
      {
        queryId: "q1",
        practiceId: "p1",
        question: "Show all students",
        answerSql: "select * from students",
      },
      {
        queryId: "q2",
        practiceId: "p1",
        question: "Show all courses",
        answerSql: "select * from courses",
      },
      {
        queryId: "q3",
        practiceId: "p1",
        question: "Show all grades",
        answerSql: "select * from grades",
      },
    ],
    attempts: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    challengeCollection = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      insertOne: jest.fn(),
    };
    usersCollection = {
      findOne: jest.fn(),
    };
    practiceQueriesCollection = {
      find: jest.fn(),
    };
    mockDb.collection.mockImplementation((name: string) => {
      if (name === "sql_coin_challenges") return challengeCollection;
      if (name === "users") return usersCollection;
      if (name === "practice_queries") return practiceQueriesCollection;
      throw new Error(`Unexpected collection: ${name}`);
    });
    mockExecuteWithRetry.mockImplementation(async (operation: (db: any) => Promise<unknown>) => operation(mockDb));
    mockUpdateCoinsBalance.mockResolvedValue({ modifiedCount: 1 });
    mockLogCoinTransaction.mockResolvedValue({ insertedId: { toString: () => "ledger-1" } });
  });

  it("records failed challenge evidence without awarding coins", async () => {
    const service = new SqlCoinChallengeService({} as any);
    const updatedChallenge = {
      ...activeChallenge,
      attempts: [
        { questionId: "q1", answer: "select name from students", correct: false, feedbackLevel: "partially_correct", similarity: 50, submittedAt: "now" },
      ],
      score: { correctCount: 0, totalQuestions: 3, passingCorrectCount: 3, passed: false },
    };
    challengeCollection.findOne.mockResolvedValue(activeChallenge);
    challengeCollection.findOneAndUpdate.mockResolvedValue(updatedChallenge);

    const result = await service.submitChallenge({
      challengeId: "sql_coin_1",
      user: { id: "student-1", email: "student@example.com", year: 2026, semester: 2 },
      answers: [
        { questionId: "q1", answer: "select name from students" },
        { questionId: "q2", answer: "select name from courses" },
        { questionId: "q3", answer: "select name from grades" },
      ],
    });

    expect(result?.status).toBe("active");
    expect(result?.score).toEqual({ correctCount: 0, totalQuestions: 3, passingCorrectCount: 3, passed: false });
    expect(challengeCollection.findOneAndUpdate).toHaveBeenCalledWith(
      { id: "sql_coin_1", status: { $in: ["pending", "active"] } },
      expect.objectContaining({
        $set: expect.objectContaining({
          attempts: expect.arrayContaining([
            expect.objectContaining({ questionId: "q1", correct: false }),
          ]),
          score: { correctCount: 0, totalQuestions: 3, passingCorrectCount: 3, passed: false },
        }),
      }),
      { returnDocument: "after" }
    );
    expect(mockUpdateCoinsBalance).not.toHaveBeenCalled();
    expect(mockLogCoinTransaction).not.toHaveBeenCalled();
  });

  it("creates a challenge for a privileged admin test recipient without cohort fields", async () => {
    const service = new SqlCoinChallengeService({} as any);
    const questions = activeChallenge.questions.map((question) => ({
      _id: { toString: () => question.queryId },
      practiceId: question.practiceId,
      question: question.question,
      answerSql: question.answerSql,
    }));
    const queryCursor = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue(questions),
    };

    usersCollection.findOne.mockResolvedValue({
      id: "admin-1",
      email: "orperets11@gmail.com",
      role: "admin",
    });
    challengeCollection.findOne.mockResolvedValue(null);
    challengeCollection.insertOne.mockResolvedValue({ insertedId: "challenge-object-id" });
    practiceQueriesCollection.find.mockReturnValue(queryCursor);

    const result = await service.createChallenge({
      studentEmail: "orperets11@gmail.com",
      academicPeriod: { year: 2026, semester: 2 },
      createdBy: "admin@example.com",
      questionCount: 3,
    });

    expect(result.studentEmail).toBe("orperets11@gmail.com");
    expect(result.year).toBe(2026);
    expect(result.semester).toBe(2);
    expect(challengeCollection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: "admin-1",
        studentEmail: "orperets11@gmail.com",
        year: 2026,
        semester: 2,
      })
    );
  });

  it("creates a challenge for a student whose cohort fields are stored as numeric strings", async () => {
    const service = new SqlCoinChallengeService({} as any);
    const questions = activeChallenge.questions.map((question) => ({
      _id: { toString: () => question.queryId },
      practiceId: question.practiceId,
      question: question.question,
      answerSql: question.answerSql,
    }));
    const queryCursor = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue(questions),
    };

    usersCollection.findOne.mockResolvedValue({
      id: "student-1",
      email: "student@example.com",
      year: "2026",
      semester: "2",
    });
    challengeCollection.findOne.mockResolvedValue(null);
    challengeCollection.insertOne.mockResolvedValue({ insertedId: "challenge-object-id" });
    practiceQueriesCollection.find.mockReturnValue(queryCursor);

    const result = await service.createChallenge({
      studentEmail: "student@example.com",
      academicPeriod: { year: 2026, semester: 2 },
      createdBy: "admin@example.com",
      questionCount: 3,
    });

    expect(result.studentEmail).toBe("student@example.com");
    expect(result.status).toBe("active");
    expect(result.questions).toHaveLength(3);
    expect(result.questions[0]).not.toHaveProperty("answerSql");
    expect(challengeCollection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: "student-1",
        studentEmail: "student@example.com",
        year: 2026,
        semester: 2,
      })
    );
  });

  it("awards one coin once after a completed challenge and ignores duplicate completion", async () => {
    const service = new SqlCoinChallengeService({} as any);
    const completedPendingLedger = {
      ...activeChallenge,
      status: "completed",
      score: { correctCount: 3, totalQuestions: 3, passingCorrectCount: 3, passed: true },
      completedAt: "2026-07-03T00:01:00.000Z",
    };
    const completedFinal = {
      ...completedPendingLedger,
      coinLedgerTransactionId: "ledger-1",
    };

    challengeCollection.findOne
      .mockResolvedValueOnce(activeChallenge)
      .mockResolvedValueOnce(completedFinal);
    challengeCollection.findOneAndUpdate
      .mockResolvedValueOnce(completedPendingLedger)
      .mockResolvedValueOnce(completedFinal);

    const correctAnswers = [
      { questionId: "q1", answer: "SELECT * FROM students;" },
      { questionId: "q2", answer: "select * from courses" },
      { questionId: "q3", answer: "select * from grades" },
    ];

    const firstResult = await service.submitChallenge({
      challengeId: "sql_coin_1",
      user: { id: "student-1", email: "student@example.com", year: 2026, semester: 2 },
      answers: correctAnswers,
    });
    const duplicateResult = await service.submitChallenge({
      challengeId: "sql_coin_1",
      user: { id: "student-1", email: "student@example.com", year: 2026, semester: 2 },
      answers: correctAnswers,
    });

    expect(firstResult?.status).toBe("completed");
    expect(firstResult?.coinLedgerTransactionId).toBe("ledger-1");
    expect(duplicateResult?.status).toBe("completed");
    expect(mockUpdateCoinsBalance).toHaveBeenCalledTimes(1);
    expect(mockUpdateCoinsBalance).toHaveBeenCalledWith(["student@example.com"], 1);
    expect(mockLogCoinTransaction).toHaveBeenCalledTimes(1);
    expect(mockLogCoinTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        user: "student@example.com",
        delta: 1,
        reason: "sql_coin_challenge_completed",
        createdBy: "admin@example.com",
        metadata: expect.objectContaining({
          challengeId: "sql_coin_1",
          year: 2026,
          semester: 2,
          questionCount: 3,
          correctCount: 3,
        }),
      })
    );
  });

  it("lets a privileged test recipient load and complete a challenge without cohort fields", async () => {
    const service = new SqlCoinChallengeService({} as any);
    const adminChallenge = {
      ...activeChallenge,
      id: "sql_coin_admin",
      studentId: "admin-1",
      studentEmail: "orperets11@gmail.com",
    };
    const completedPendingLedger = {
      ...adminChallenge,
      status: "completed",
      score: { correctCount: 3, totalQuestions: 3, passingCorrectCount: 3, passed: true },
      completedAt: "2026-07-03T00:01:00.000Z",
    };
    const completedFinal = {
      ...completedPendingLedger,
      coinLedgerTransactionId: "ledger-1",
    };
    const cursor = {
      sort: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue([adminChallenge]),
    };

    challengeCollection.find.mockReturnValue(cursor);
    challengeCollection.findOne.mockResolvedValue(adminChallenge);
    challengeCollection.findOneAndUpdate
      .mockResolvedValueOnce(completedPendingLedger)
      .mockResolvedValueOnce(completedFinal);

    const current = await service.getCurrentChallengeForStudent({
      id: "admin-1",
      email: "orperets11@gmail.com",
      role: "admin",
    });
    const completed = await service.submitChallenge({
      challengeId: "sql_coin_admin",
      user: { id: "admin-1", email: "orperets11@gmail.com", role: "admin" },
      answers: [
        { questionId: "q1", answer: "select * from students" },
        { questionId: "q2", answer: "select * from courses" },
        { questionId: "q3", answer: "select * from grades" },
      ],
    });

    expect(current?.id).toBe("sql_coin_admin");
    expect(challengeCollection.find).toHaveBeenCalledWith({ studentEmail: "orperets11@gmail.com" });
    expect(completed?.status).toBe("completed");
    expect(mockUpdateCoinsBalance).toHaveBeenCalledWith(["orperets11@gmail.com"], 1);
    expect(mockLogCoinTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        user: "orperets11@gmail.com",
        reason: "sql_coin_challenge_completed",
      })
    );
  });
});
