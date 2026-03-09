import { NextResponse } from "next/server";
import {
  createHomeworkSet,
  getHomeworkService,
  updateHomeworkSet,
} from "@/lib/homework";
import {
  createQuestion,
  getQuestionsByHomeworkSet,
  getQuestionsService,
} from "@/lib/questions";
import { createDataset, getDatasetService, updateDataset } from "@/lib/datasets";
import {
  EXAM_PREP_BACKGROUND_STORY,
  EXAM_PREP_DATASET_NAME,
  EXAM_PREP_OVERVIEW,
  EXAM_PREP_PREVIEW_TABLES,
  EXAM_PREP_QUESTIONS,
  EXAM_PREP_TITLE,
  EXAM_PREP_TITLES,
} from "@/lib/exam-prep-content";

export async function POST() {
  try {
    const homeworkService = await getHomeworkService();
    const questionsService = await getQuestionsService();
    const datasetService = await getDatasetService();

    const allHomeworkSets = await homeworkService.listHomeworkSets({ pageSize: 1000 });
    let homeworkSet = allHomeworkSets.items.find((hw) => EXAM_PREP_TITLES.includes(hw.title as typeof EXAM_PREP_TITLES[number]));

    if (!homeworkSet) {
      const createdHomeworkSet = await createHomeworkSet({
        title: EXAM_PREP_TITLE,
        courseId: "sql-course",
        dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        published: false,
        datasetPolicy: "shared",
        questionOrder: [],
        visibility: "draft",
        createdBy: "admin",
        overview: EXAM_PREP_OVERVIEW,
        backgroundStory: EXAM_PREP_BACKGROUND_STORY,
      });

      homeworkSet = {
        ...createdHomeworkSet,
        draftQuestionCount: 0,
        submissionCount: 0,
      };
    } else {
      const existingQuestions = await getQuestionsByHomeworkSet(homeworkSet.id);
      for (const question of existingQuestions) {
        await questionsService.deleteQuestion(question.id);
      }

      await updateHomeworkSet(homeworkSet.id, {
        title: EXAM_PREP_TITLE,
        overview: EXAM_PREP_OVERVIEW,
        backgroundStory: EXAM_PREP_BACKGROUND_STORY,
        published: false,
        visibility: "draft",
      });
    }

    const allDatasets = await datasetService.listDatasets({ pageSize: 1000 });
    let examPrepDataset = allDatasets.items.find((ds) => ds.name === EXAM_PREP_DATASET_NAME);

    if (!examPrepDataset) {
      examPrepDataset = await createDataset({
        name: EXAM_PREP_DATASET_NAME,
        description: "מסד נתונים לניהול תחרות דיבייט, הרשמות, סבבים ותוצאות שיפוט.",
        scenario:
          "צוות ההפקה מבקש לנתח הרשמות לסבבי דיבייט ותוצאות כדי לזהות עומסים, דפוסי השתתפות וביצועים.",
        story: EXAM_PREP_BACKGROUND_STORY,
        connectionUri: "sandbox://datasets/exam-prep",
        previewTables: EXAM_PREP_PREVIEW_TABLES,
        tags: ["הכנה למבחן", "דיבייט", "הרשמות", "תוצאות"],
      });
    } else {
      examPrepDataset = await updateDataset(examPrepDataset.id, {
        name: EXAM_PREP_DATASET_NAME,
        description: "מסד נתונים לניהול תחרות דיבייט, הרשמות, סבבים ותוצאות שיפוט.",
        scenario:
          "צוות ההפקה מבקש לנתח הרשמות לסבבי דיבייט ותוצאות כדי לזהות עומסים, דפוסי השתתפות וביצועים.",
        story: EXAM_PREP_BACKGROUND_STORY,
        previewTables: EXAM_PREP_PREVIEW_TABLES,
        tags: ["הכנה למבחן", "דיבייט", "הרשמות", "תוצאות"],
      }) ?? examPrepDataset;
    }
    const questionIds: string[] = [];

    for (const questionData of EXAM_PREP_QUESTIONS) {
      const question = await createQuestion({
        homeworkSetId: homeworkSet.id,
        prompt: questionData.prompt,
        instructions: questionData.instructions,
        starterSql: questionData.starterSql,
        expectedResultSchema: [...questionData.expectedResultSchema],
        gradingRubric: [],
        maxAttempts: questionData.maxAttempts,
        points: questionData.points,
        evaluationMode: questionData.evaluationMode,
        datasetId: examPrepDataset.id,
      });
      questionIds.push(question.id);
    }

    await updateHomeworkSet(homeworkSet.id, {
      questionOrder: questionIds,
      selectedDatasetId: examPrepDataset.id,
    });

    return NextResponse.json({
      success: true,
      homeworkSetId: homeworkSet.id,
      datasetId: examPrepDataset.id,
      questionsCreated: questionIds.length,
      message: "תרגיל הכנה למבחן נוצר בהצלחה",
    });
  } catch (error) {
    console.error("Error seeding Exam Prep:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create Exam Prep homework",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
