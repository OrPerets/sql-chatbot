import {
  executeSqlForSubmission,
  getSubmissionForStudent,
  getSubmissionProgressForStudent,
  gradeSubmissionRecord,
  listAnalyticsForSet,
  publishGradesForSet,
  saveSubmissionDraftRecord,
} from "../../app/api/_mock/homeworkStore";

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
});
