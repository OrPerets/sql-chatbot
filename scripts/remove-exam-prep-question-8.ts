/**
 * Remove question 8 from "הכנה למבחן" / "תרגיל הכנה למבחן" so the set has 14 questions.
 * Run this once to update the existing DB without re-seeding.
 *
 * Usage: npx tsx scripts/remove-exam-prep-question-8.ts
 */

import { getHomeworkService } from "../lib/homework";
import { getQuestionsByHomeworkSet, deleteQuestion } from "../lib/questions";

const EXAM_PREP_TITLES = ["תרגיל הכנה למבחן", "הכנה למבחן"];
const QUESTION_INDEX_TO_REMOVE = 7; // 0-based: 8th question

async function main() {
  const homeworkService = await getHomeworkService();
  const all = await homeworkService.listHomeworkSets({ pageSize: 1000 });
  const examPrep = all.items.find((hw) =>
    EXAM_PREP_TITLES.some((t) => hw.title === t)
  );

  if (!examPrep) {
    console.error("No homework set 'הכנה למבחן' or 'תרגיל הכנה למבחן' found.");
    process.exit(1);
  }

  const questionOrder = examPrep.questionOrder ?? [];
  if (questionOrder.length < 8) {
    console.log(
      `Set "${examPrep.title}" has only ${questionOrder.length} questions. Nothing to remove.`
    );
    process.exit(0);
  }

  const questionIdToRemove = questionOrder[QUESTION_INDEX_TO_REMOVE];
  if (!questionIdToRemove) {
    console.error("No question ID at index 8.");
    process.exit(1);
  }

  const deleted = await deleteQuestion(questionIdToRemove);
  if (!deleted) {
    console.error(`Failed to delete question ${questionIdToRemove}`);
    process.exit(1);
  }

  const newOrder = questionOrder.filter((id) => id !== questionIdToRemove);
  await homeworkService.updateHomeworkSet(examPrep.id, {
    questionOrder: newOrder,
  });

  console.log(`Removed question 8 from "${examPrep.title}" (ID: ${examPrep.id}).`);
  console.log(`Question count: ${questionOrder.length} → ${newOrder.length}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
