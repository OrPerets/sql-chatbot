import { orderQuestionsByHomeworkSet } from "@/lib/student-questions";
import type { HomeworkSet, Question } from "@/app/homework/types";

function createQuestion(id: string): Question {
  return {
    id,
    prompt: `Question ${id}`,
    instructions: "",
    expectedResultSchema: [],
    gradingRubric: [],
    maxAttempts: 3,
    points: 10,
  };
}

describe("student questions", () => {
  it("orders regular questions by the homework set questionOrder", () => {
    const questions = [createQuestion("q3"), createQuestion("q1"), createQuestion("q2"), createQuestion("unlisted")];
    const homeworkSet = {
      questionOrder: ["q1", "q2", "q3"],
    } as Pick<HomeworkSet, "questionOrder">;

    const orderedQuestions = orderQuestionsByHomeworkSet(questions, homeworkSet);

    expect(orderedQuestions.map((question) => question.id)).toEqual(["q1", "q2", "q3", "unlisted"]);
  });
});
