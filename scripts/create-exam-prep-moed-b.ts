import { createDataset, getDatasetService, updateDataset } from "../lib/datasets";
import { connectToDatabase } from "../lib/database";
import { createHomeworkSet, getHomeworkService, updateHomeworkSet } from "../lib/homework";
import { createQuestion, getQuestionsByHomeworkSet, getQuestionsService } from "../lib/questions";
import {
  EXAM_PREP_MOED_B_BACKGROUND_STORY,
  EXAM_PREP_MOED_B_DATASET_NAME,
  EXAM_PREP_MOED_B_OVERVIEW,
  EXAM_PREP_MOED_B_PREVIEW_TABLES,
  EXAM_PREP_MOED_B_QUESTIONS,
  EXAM_PREP_MOED_B_TITLE,
} from "../lib/exam-prep-content";

const COURSE_ID = "sql-course";
const AVAILABLE_FROM = "2026-06-08T08:00:00.000+03:00";
const AVAILABLE_UNTIL = "2026-07-16T08:00:00.000+03:00";

async function main() {
  const { client } = await connectToDatabase();

  try {
    const homeworkService = await getHomeworkService();
    const questionsService = await getQuestionsService();
    const datasetService = await getDatasetService();

    const allHomework = await homeworkService.listHomeworkSets({ pageSize: 1000 });
    let moedB: { id: string } | undefined = allHomework.items.find((hw) => hw.title === EXAM_PREP_MOED_B_TITLE);

    if (!moedB) {
      moedB = await createHomeworkSet({
        title: EXAM_PREP_MOED_B_TITLE,
        courseId: COURSE_ID,
        dueAt: AVAILABLE_UNTIL,
        availableFrom: AVAILABLE_FROM,
        availableUntil: AVAILABLE_UNTIL,
        published: true,
        entryMode: "listed",
        homeworkType: "sql",
        datasetPolicy: "shared",
        questionOrder: [],
        visibility: "published",
        createdBy: "admin",
        overview: EXAM_PREP_MOED_B_OVERVIEW,
        backgroundStory: EXAM_PREP_MOED_B_BACKGROUND_STORY,
      });
    } else {
      const existingQuestions = await getQuestionsByHomeworkSet(moedB.id);
      for (const question of existingQuestions) {
        await questionsService.deleteQuestion(question.id);
      }

      const updated = await updateHomeworkSet(moedB.id, {
        title: EXAM_PREP_MOED_B_TITLE,
        courseId: COURSE_ID,
        dueAt: AVAILABLE_UNTIL,
        availableFrom: AVAILABLE_FROM,
        availableUntil: AVAILABLE_UNTIL,
        published: true,
        entryMode: "listed",
        homeworkType: "sql",
        datasetPolicy: "shared",
        visibility: "published",
        overview: EXAM_PREP_MOED_B_OVERVIEW,
        backgroundStory: EXAM_PREP_MOED_B_BACKGROUND_STORY,
      });

      if (!updated) {
        throw new Error(`Failed to update existing homework set ${moedB.id}`);
      }

      moedB = updated;
    }

    const allDatasets = await datasetService.listDatasets({ pageSize: 1000 });
    const existingDataset = allDatasets.items.find((dataset) => dataset.name === EXAM_PREP_MOED_B_DATASET_NAME);
    const datasetPayload = {
      name: EXAM_PREP_MOED_B_DATASET_NAME,
      description: "מסד נתונים לניהול פסטיבל קולנוע, הקרנות, הזמנות ודירוגים.",
      scenario:
        "צוות הפסטיבל מבקש לנתח ביקוש להקרנות, סטטוס הזמנות, דפוסי צפייה ודירוגי סרטים.",
      story: EXAM_PREP_MOED_B_BACKGROUND_STORY,
      connectionUri: "sandbox://datasets/exam-prep-moed-b",
      previewTables: EXAM_PREP_MOED_B_PREVIEW_TABLES,
      tags: ["הכנה למבחן", "מועד ב", "קולנוע", "הזמנות", "דירוגים"],
    };

    const dataset = existingDataset
      ? await updateDataset(existingDataset.id, datasetPayload)
      : await createDataset(datasetPayload);

    if (!dataset) {
      throw new Error("Failed to prepare Moed B dataset.");
    }

    const questionIds: string[] = [];
    for (const questionData of EXAM_PREP_MOED_B_QUESTIONS) {
      const question = await createQuestion({
        homeworkSetId: moedB.id,
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

    const updatedHomework = await updateHomeworkSet(moedB.id, {
      questionOrder: questionIds,
      selectedDatasetId: dataset.id,
    });

    if (!updatedHomework) {
      throw new Error(`Failed to attach questions to ${moedB.id}`);
    }

    console.log(`Created/updated "${EXAM_PREP_MOED_B_TITLE}" (${updatedHomework.id}).`);
    console.log(`Dataset: ${dataset.name} (${dataset.id}) with ${dataset.previewTables.length} tables.`);
    console.log(`Questions: ${questionIds.length}`);
    console.log(`Window: ${updatedHomework.availableFrom} - ${updatedHomework.availableUntil}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
