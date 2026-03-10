import { getHomeworkService } from "../lib/homework";
import { createDataset, getDatasetService, updateDataset } from "../lib/datasets";
import { createQuestion, getQuestionsByHomeworkSet, getQuestionsService } from "../lib/questions";
import {
  EXAM_PREP_BACKGROUND_STORY,
  EXAM_PREP_DATASET_NAME,
  EXAM_PREP_OVERVIEW,
  EXAM_PREP_PREVIEW_TABLES,
  EXAM_PREP_QUESTIONS,
  EXAM_PREP_TITLE,
  EXAM_PREP_TITLES,
} from "../lib/exam-prep-content";

async function main() {
  const homeworkService = await getHomeworkService();
  const questionsService = await getQuestionsService();
  const datasetService = await getDatasetService();

  const allHomework = await homeworkService.listHomeworkSets({ pageSize: 1000 });
  const examPrep = allHomework.items.find((hw) => EXAM_PREP_TITLES.includes(hw.title as typeof EXAM_PREP_TITLES[number]));

  if (!examPrep) {
    throw new Error("Homework set 'הכנה למבחן' not found.");
  }

  const existingQuestions = await getQuestionsByHomeworkSet(examPrep.id);
  for (const question of existingQuestions) {
    await questionsService.deleteQuestion(question.id);
  }

  await homeworkService.updateHomeworkSet(examPrep.id, {
    title: EXAM_PREP_TITLE,
    overview: EXAM_PREP_OVERVIEW,
    backgroundStory: EXAM_PREP_BACKGROUND_STORY,
  });

  const allDatasets = await datasetService.listDatasets({ pageSize: 1000 });
  const existingDataset = allDatasets.items.find((dataset) => dataset.name === EXAM_PREP_DATASET_NAME);

  const dataset =
    existingDataset
      ? await updateDataset(existingDataset.id, {
          name: EXAM_PREP_DATASET_NAME,
          description: "מסד נתונים לניהול תחרות דיבייט, הרשמות, סבבים ותוצאות שיפוט.",
          scenario:
            "צוות ההפקה מבקש לנתח הרשמות לסבבי דיבייט ותוצאות כדי לזהות עומסים, דפוסי השתתפות וביצועים.",
          story: EXAM_PREP_BACKGROUND_STORY,
          previewTables: EXAM_PREP_PREVIEW_TABLES,
          tags: ["הכנה למבחן", "דיבייט", "הרשמות", "תוצאות"],
        })
      : await createDataset({
          name: EXAM_PREP_DATASET_NAME,
          description: "מסד נתונים לניהול תחרות דיבייט, הרשמות, סבבים ותוצאות שיפוט.",
          scenario:
            "צוות ההפקה מבקש לנתח הרשמות לסבבי דיבייט ותוצאות כדי לזהות עומסים, דפוסי השתתפות וביצועים.",
          story: EXAM_PREP_BACKGROUND_STORY,
          connectionUri: "sandbox://datasets/exam-prep",
          previewTables: EXAM_PREP_PREVIEW_TABLES,
          tags: ["הכנה למבחן", "דיבייט", "הרשמות", "תוצאות"],
        });

  if (!dataset) {
    throw new Error("Failed to prepare exam prep dataset.");
  }

  const questionIds: string[] = [];
  for (const questionData of EXAM_PREP_QUESTIONS) {
    const question = await createQuestion({
      homeworkSetId: examPrep.id,
      prompt: questionData.prompt,
      instructions: questionData.instructions,
      starterSql: questionData.starterSql,
      expectedResultSchema: [...questionData.expectedResultSchema],
      gradingRubric: [],
      maxAttempts: questionData.maxAttempts,
      points: questionData.points,
      evaluationMode: questionData.evaluationMode,
      datasetId: dataset.id,
    });
    questionIds.push(question.id);
  }

  await homeworkService.updateHomeworkSet(examPrep.id, {
    questionOrder: questionIds,
    selectedDatasetId: dataset.id,
  });

  console.log(`Updated "${EXAM_PREP_TITLE}" (${examPrep.id}) with ${questionIds.length} questions.`);
  console.log(`Dataset ${dataset.id} now includes preview rows for ${EXAM_PREP_PREVIEW_TABLES.length} tables.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
