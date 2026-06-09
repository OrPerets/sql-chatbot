import { config } from "dotenv";
import { resolve } from "path";
import { connectToDatabase, COLLECTIONS } from "../lib/database";
import { getHomeworkSetById } from "../lib/homework";
import { getQuestionsByHomeworkSet } from "../lib/questions";
import { getRenderedQuestionsForStudent } from "../lib/student-questions";
import { evaluateSubmission, type AIGradingInput } from "../lib/ai-grading";
import { buildHomeworkSetIdQuery } from "../lib/homework-set-ids";
import { getAnswerText, hasAnswerText } from "../app/homework/utils/answers";
import type { Question, SqlAnswer, Submission } from "../app/homework/types";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

interface Args {
  homeworkSetId: string;
  dryRun: boolean;
  limit?: number;
  forceGraded: boolean;
  overwriteNotes: boolean;
  studentId?: string;
  baseQuestions: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const homeworkSetId = args.find((arg) => !arg.startsWith("--"));

  if (!homeworkSetId) {
    console.log("Usage:");
    console.log("  npx ts-node -r tsconfig-paths/register --project tsconfig.scripts.json scripts/grade-relational-algebra-local.ts <homeworkSetId> [--write] [--limit N] [--force-graded] [--overwrite-notes] [--student-id ID]");
    process.exit(1);
  }

  const limitIndex = args.indexOf("--limit");
  const studentIndex = args.indexOf("--student-id");

  return {
    homeworkSetId,
    dryRun: !args.includes("--write"),
    limit: limitIndex >= 0 ? Number(args[limitIndex + 1]) : undefined,
    forceGraded: args.includes("--force-graded"),
    overwriteNotes: args.includes("--overwrite-notes"),
    studentId: studentIndex >= 0 ? args[studentIndex + 1] : undefined,
    baseQuestions: args.includes("--base-questions"),
  };
}

function buildQuestionLookup(questions: Question[]) {
  const lookup = new Map<string, Question>();
  questions.forEach((question) => {
    lookup.set(question.id, question);
  });
  return lookup;
}

function buildGradingInputs(submission: Submission, questionsById: Map<string, Question>): AIGradingInput[] {
  const inputs: AIGradingInput[] = [];

  for (const [questionId, answer] of Object.entries(submission.answers || {})) {
    const sqlAnswer = answer as SqlAnswer;
    const question = questionsById.get(questionId);

    if (!question || !hasAnswerText(sqlAnswer)) {
      continue;
    }

    inputs.push({
      questionId,
      questionPrompt: question.prompt,
      questionInstructions: question.instructions,
      referenceSql: question.starterSql,
      answerType: "relational_algebra",
      expectedSchema: question.expectedResultSchema || [],
      maxPoints: question.points || 10,
      rubricCriteria: (question.gradingRubric || []).map((criterion) => ({
        id: criterion.id,
        label: criterion.label,
        description: criterion.description,
        weight: criterion.weight,
      })),
      studentSql: getAnswerText(sqlAnswer),
      studentResults: undefined,
    });
  }

  return inputs;
}

function normalizeSubmission(doc: any): Submission {
  return {
    id: doc._id?.toString() || doc.id,
    homeworkSetId: doc.homeworkSetId,
    studentId: doc.studentId,
    attemptNumber: doc.attemptNumber || 1,
    answers: doc.answers || {},
    overallScore: doc.overallScore || 0,
    status: doc.status || "in_progress",
    submittedAt: doc.submittedAt,
    gradedAt: doc.gradedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    studentTableData: doc.studentTableData,
    aiCommitment: doc.aiCommitment,
  };
}

async function main() {
  const options = parseArgs();

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  const { db } = await connectToDatabase();
  const homework = await getHomeworkSetById(options.homeworkSetId);
  if (!homework) {
    throw new Error(`Homework set not found: ${options.homeworkSetId}`);
  }

  if (homework.homeworkType !== "relational_algebra") {
    throw new Error(`Refusing to run: homeworkType is ${homework.homeworkType || "sql"}, not relational_algebra`);
  }

  const questions = await getQuestionsByHomeworkSet(options.homeworkSetId);
  const homeworkSetQuery = await buildHomeworkSetIdQuery(db, options.homeworkSetId);
  const questionLookupCache = new Map<string, Map<string, Question>>();
  const submissionFilter: any = {
    ...homeworkSetQuery,
  };

  if (options.studentId) {
    submissionFilter.studentId = options.studentId;
  }

  if (!options.forceGraded) {
    submissionFilter.status = { $ne: "graded" };
  }

  let submissions = await db
    .collection(COLLECTIONS.SUBMISSIONS)
    .find(submissionFilter)
    .sort({ submittedAt: 1, createdAt: 1 })
    .toArray();

  submissions = submissions.filter((submission) => {
    const normalized = normalizeSubmission(submission);
    return Object.values(normalized.answers || {}).some((answer) => hasAnswerText(answer as SqlAnswer));
  });

  if (options.limit && Number.isFinite(options.limit) && options.limit > 0) {
    submissions = submissions.slice(0, options.limit);
  }

  console.log(`Homework: ${homework.title} (${homework.id})`);
  console.log(`Mode: relational_algebra`);
  console.log(`Dry run: ${options.dryRun ? "YES" : "NO"}`);
  console.log(`Force graded: ${options.forceGraded ? "YES" : "NO"}`);
  console.log(`Overwrite notes: ${options.overwriteNotes ? "YES" : "NO"}`);
  console.log(`Question rendering: ${options.baseQuestions ? "base questions" : "student-rendered questions"}`);
  console.log(`Questions: ${questions.length}`);
  console.log(`Submissions to grade: ${submissions.length}`);

  if (submissions.length === 0) {
    console.log("No submissions to grade.");
    return;
  }

  let savedCount = 0;
  let totalAnswersGraded = 0;

  for (let index = 0; index < submissions.length; index++) {
    const doc = submissions[index];
    const submission = normalizeSubmission(doc);
    if (!questionLookupCache.has(submission.studentId)) {
      const studentQuestions = options.baseQuestions
        ? questions
        : await getRenderedQuestionsForStudent(options.homeworkSetId, submission.studentId);
      questionLookupCache.set(submission.studentId, buildQuestionLookup(studentQuestions));
    }
    const questionsById = questionLookupCache.get(submission.studentId)!;
    const gradingInputs = buildGradingInputs(submission, questionsById);

    console.log(`\n[${index + 1}/${submissions.length}] ${submission.id} student=${submission.studentId} answers=${gradingInputs.length}`);

    const result = await evaluateSubmission(submission.id, submission.studentId, gradingInputs);
    totalAnswersGraded += result.results.length;

    const updatedAnswers: Submission["answers"] = { ...submission.answers };
    for (const aiResult of result.results) {
      const answer = submission.answers[aiResult.questionId] as SqlAnswer | undefined;
      if (!answer) continue;

      const existingInstructorNotes = answer.feedback?.instructorNotes?.trim() || "";
      const instructorNotes = options.overwriteNotes
        ? aiResult.comment
        : existingInstructorNotes || aiResult.comment;

      updatedAnswers[aiResult.questionId] = {
        ...answer,
        feedback: {
          questionId: aiResult.questionId,
          score: aiResult.score,
          autoNotes: answer.feedback?.autoNotes || "",
          instructorNotes,
          rubricBreakdown: answer.feedback?.rubricBreakdown || [],
        },
      };
    }

    const overallScore = Object.values(updatedAnswers).reduce(
      (sum, answer) => sum + (answer.feedback?.score ?? 0),
      0,
    );

    const preview = result.results.slice(0, 2).map((item) => ({
      questionId: item.questionId,
      score: item.score,
      comment: item.comment,
    }));
    console.log("Preview:", JSON.stringify(preview, null, 2));
    console.log(`Total score: ${overallScore}`);

    if (!options.dryRun) {
      const now = new Date().toISOString();
      const updateResult = await db.collection(COLLECTIONS.SUBMISSIONS).updateOne(
        { _id: doc._id },
        {
          $set: {
            answers: updatedAnswers,
            overallScore,
            status: "graded",
            gradedAt: now,
            updatedAt: now,
          },
        },
      );

      if (updateResult.modifiedCount === 1 || updateResult.matchedCount === 1) {
        savedCount += 1;
        console.log("Saved: YES");
      } else {
        console.log("Saved: NO");
      }
    }
  }

  console.log("\nSummary");
  console.log(`Submissions processed: ${submissions.length}`);
  console.log(`Answers graded: ${totalAnswersGraded}`);
  console.log(`Submissions saved: ${savedCount}`);
  console.log(options.dryRun ? "Dry run only: database was not updated." : "Database update complete.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal:", error);
    process.exit(1);
  });
