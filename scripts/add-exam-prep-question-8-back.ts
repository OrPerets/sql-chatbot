/**
 * Add back the "question 8" that was removed by running remove-exam-prep-question-8 twice.
 * Restores the set to 14 questions (registered but no score yet).
 *
 * Usage: npx tsx scripts/add-exam-prep-question-8-back.ts
 */

import { getHomeworkService } from "../lib/homework";
import { createQuestion } from "../lib/questions";

const EXAM_PREP_TITLES = ["תרגיל הכנה למבחן", "הכנה למבחן"];
const INSERT_AT_INDEX = 7; // 0-based: add as 8th question

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

  const datasetId = examPrep.selectedDatasetId;
  if (!datasetId) {
    console.error("Exam prep set has no selectedDatasetId.");
    process.exit(1);
  }

  const questionOrder = examPrep.questionOrder ?? [];
  if (questionOrder.length !== 13) {
    console.log(
      `Set has ${questionOrder.length} questions. This script expects 13 (after double-remove). Run anyway? Inserting at index ${INSERT_AT_INDEX}.`
    );
  }

  const newQuestion = await createQuestion({
    homeworkSetId: examPrep.id,
    datasetId,
    prompt:
      "הציגו את הסטודנטים שנרשמו למבחן אך עדיין לא קיבלו ציון. כללו רק הרשמות מאושרות. הציגו את הסטודנט, פרטי המבחן וסטטוס הרשמה.",
    instructions: "סכמה: תעודת סטודנט, שם מלא, מזהה מבחן, קוד קורס, סטטוס",
    starterSql: "",
    expectedResultSchema: [
      { column: "תעודת סטודנט", type: "number" },
      { column: "שם מלא", type: "string" },
      { column: "מזהה מבחן", type: "number" },
      { column: "קוד קורס", type: "string" },
      { column: "סטטוס", type: "string" },
    ],
    gradingRubric: [],
    maxAttempts: 3,
    points: 10,
    evaluationMode: "auto",
  });

  const newOrder = [...questionOrder];
  newOrder.splice(INSERT_AT_INDEX, 0, newQuestion.id);

  await homeworkService.updateHomeworkSet(examPrep.id, {
    questionOrder: newOrder,
  });

  console.log(
    `Added question back to "${examPrep.title}" (ID: ${examPrep.id}) at position 8.`
  );
  console.log(`Question count: ${questionOrder.length} → ${newOrder.length}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
