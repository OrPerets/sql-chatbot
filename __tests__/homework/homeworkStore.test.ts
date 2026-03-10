import {
  createHomework,
  executeSqlForSubmission,
  getSubmissionForStudent,
  getSubmissionProgressForStudent,
  gradeSubmissionRecord,
  listAnalyticsForSet,
  listHomeworkSets,
  publishGradesForSet,
  saveSubmissionDraftRecord,
} from "../../app/api/_mock/homeworkStore";
import { getHomeworkAvailabilityInfo } from "../../lib/deadline-utils";

const SET_ID = "hw-set-analytics";
const STUDENT_ID = "student-demo";

describe("homeworkStore runner and grading flows", () => {
  it("saves drafts and executes SQL for runner", () => {
    const draft = saveSubmissionDraftRecord(SET_ID, {
      studentId: STUDENT_ID,
      answers: {
        q1: { sql: "SELECT 1" },
      },
    });

    expect(draft).toBeDefined();
    expect(draft?.answers.q1?.sql).toBe("SELECT 1");

    const result = executeSqlForSubmission({
      setId: SET_ID,
      submissionId: draft!.id,
      studentId: STUDENT_ID,
      questionId: "q1",
      sql: "SELECT name FROM orders",
      attemptNumber: 1,
    });

    expect(result).toBeDefined();
    expect(result?.columns).toContain("name");

    const submission = getSubmissionForStudent(SET_ID, STUDENT_ID);
    expect(submission?.answers.q1?.feedback?.score).toBeGreaterThan(0);
  });

  it("tracks question progress for student", () => {
    const progress = getSubmissionProgressForStudent(SET_ID, STUDENT_ID);
    expect(progress).toBeDefined();
    expect(progress![0]?.questionId).toBe("q1");
  });

  it("allows instructor grading overrides", () => {
    const submission = getSubmissionForStudent(SET_ID, "student-rose");
    expect(submission).toBeDefined();

    const updated = gradeSubmissionRecord(submission!.id, {
      answers: {
        q1: {
          feedback: {
            questionId: "q1",
            score: 9,
            autoNotes: "",
            instructorNotes: "Override",
            rubricBreakdown: [],
          },
        },
      },
      overallScore: 29,
      status: "graded",
    });

    expect(updated?.overallScore).toBe(29);
    expect(updated?.answers.q1?.feedback?.instructorNotes).toBe("Override");
  });

  it("publishes grades and records analytics", () => {
    const publishResult = publishGradesForSet(SET_ID);
    expect(publishResult.updated).toBeGreaterThanOrEqual(0);

    const events = listAnalyticsForSet(SET_ID);
    const publishEvent = events.find((event) => event.type === "builder.publish_grades");
    expect(publishEvent).toBeDefined();
  });

  it("preserves availability fields and expected output descriptions for created homework", () => {
    const created = createHomework({
      id: "hw-store-sprint5-fields",
      title: "Sprint 5 Store Coverage",
      courseId: "CS401",
      dueAt: "2026-03-12T20:00:00.000Z",
      availableFrom: "2026-03-10T08:00:00.000Z",
      availableUntil: "2026-03-12T20:00:00.000Z",
      entryMode: "direct",
      published: true,
      visibility: "published",
      questions: [
        {
          id: "q-store-1",
          prompt: "Return the ten latest orders.",
          instructions: "Sort descending by order_date.",
          expectedOutputDescription: "The output should contain order ID and order date for the ten latest orders.",
          expectedResultSchema: [],
          gradingRubric: [],
          maxAttempts: 3,
          points: 10,
        },
      ],
    });

    const listed = listHomeworkSets({ courseId: "CS401" }).items.find((item) => item.id === created.id);

    expect(created.availableFrom).toBe("2026-03-10T08:00:00.000Z");
    expect(created.availableUntil).toBe("2026-03-12T20:00:00.000Z");
    expect(created.entryMode).toBe("direct");
    expect(listed?.questionOrder).toEqual(["q-store-1"]);
  });

  it("supports multi-homework listing with open, upcoming, and closed windows", () => {
    const openHomework = createHomework({
      id: "hw-store-open",
      title: "Open Homework",
      courseId: "CS402",
      dueAt: "2026-03-10T00:00:00.000Z",
      availableFrom: "2026-03-01T00:00:00.000Z",
      availableUntil: "2026-03-10T00:00:00.000Z",
      published: true,
      visibility: "published",
      questions: [],
    });
    const upcomingHomework = createHomework({
      id: "hw-store-upcoming",
      title: "Upcoming Homework",
      courseId: "CS402",
      dueAt: "2026-03-20T00:00:00.000Z",
      availableFrom: "2026-03-10T00:00:00.000Z",
      availableUntil: "2026-03-20T00:00:00.000Z",
      published: true,
      visibility: "published",
      questions: [],
    });
    const closedHomework = createHomework({
      id: "hw-store-closed",
      title: "Closed Homework",
      courseId: "CS402",
      dueAt: "2026-03-04T00:00:00.000Z",
      availableFrom: "2026-03-01T00:00:00.000Z",
      availableUntil: "2026-03-04T00:00:00.000Z",
      published: true,
      visibility: "published",
      questions: [],
    });

    const now = new Date("2026-03-06T10:00:00.000Z");
    const listed = listHomeworkSets({ courseId: "CS402" }).items;
    const states = new Map(
      listed.map((item) => [item.id, getHomeworkAvailabilityInfo(item, null, now).availabilityState]),
    );

    expect(states.get(openHomework.id)).toBe("open");
    expect(states.get(upcomingHomework.id)).toBe("upcoming");
    expect(states.get(closedHomework.id)).toBe("closed");
  });
});
