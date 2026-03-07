import { NextResponse } from "next/server";
import { createDataset, getDatasetService } from "@/lib/datasets";
import { createHomeworkSet, getHomeworkService } from "@/lib/homework";
import {
  getQuestionsByHomeworkSet,
  getQuestionsService,
} from "@/lib/questions";
import type { Dataset, Question } from "@/app/homework/types";

/**
 * One-time seeding endpoint for Homework 2 (HW2) - תרגיל בית 2
 * Based on ex_SQL_02.docx: relational algebra on Researchers, Universities, Publications.
 *
 * Creates:
 * - Dataset: HW2 Researchers/Universities/Publications (schema preview)
 * - Homework Set: "תרגיל בית 2"
 * - Questions: exactly 10 questions from the exercise
 *
 * Usage (POST): /api/admin/seed-hw2
 */
async function runSeed(params?: { courseId?: string; dueAt?: string }) {
  try {
    const courseId: string = params?.courseId ?? "sql-course";
    const dueAt: string =
      params?.dueAt ??
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const availableFrom = "2025-12-16T00:00:00.000Z";
    const availableUntil = "2025-12-23T21:59:00.000Z";

    // 1) Ensure HW2 dataset exists or create it
    const datasetPayload: Omit<Dataset, "id" | "updatedAt"> = {
      name: "HW2 Researchers Universities Publications",
      description:
        "Dataset for SQL HW2 (relational algebra): researchers, universities, publications",
      scenario:
        "מסד הנתונים מתאר מוסדות אקדמיים וחוקרים, יחד עם מאמרים שפורסמו. התרגיל באלגברת יחסים.",
      story:
        "הטבלאות: Researchers, Universities, Publications. חוקר מזוהה כמחבר, שם האוניברסיטה מקשר.",
      connectionUri: "sandbox://datasets/hw2-relational-algebra",
      previewTables: [
        {
          name: "Researchers",
          columns: [
            "researcherName",
            "universityName",
            "researcherAddress",
            "researcherGrant",
          ],
        },
        {
          name: "Universities",
          columns: ["universityName", "state", "NumberOfPublications"],
        },
        {
          name: "Publications",
          columns: ["articleName", "field", "authorName", "year"],
        },
      ],
      tags: ["hw2", "relational-algebra", "researchers"],
    };

    const datasetService = await getDatasetService();
    const existingDatasets = await datasetService.listDatasets({
      search: "HW2 Researchers",
      pageSize: 1,
    });
    const dataset =
      existingDatasets.items[0] ?? (await createDataset(datasetPayload));

    // 2) Ensure homework set exists or create it
    const homeworkService = await getHomeworkService();
    const allSets = (await homeworkService.listHomeworkSets({ pageSize: 50 }))
      .items;
    const existing = allSets.find(
      (s) => s.title === "תרגיל בית 2" || s.title === "תרגיל 2"
    );

    const overview = [
      "תרגיל באלגברת יחסים על חוקרים, אוניברסיטאות ופרסומים אקדמיים.",
      "מסד הנתונים מתאר מוסדות אקדמיים וחוקרים מרחבי העולם, יחד עם מאמרים שפורסמו בתחום תעשייה וניהול.",
      "התרגיל מתמקד בכתיבת ביטויי אלגברת יחסים על גבי סכמות הנתונים ללא רשומות בפועל.",
    ].join("\n");

    const backgroundStory =
      "מסד הנתונים מתאר מוסדות אקדמיים וחוקרים מרחבי העולם, יחד עם מאמרים שפורסמו בתחום תעשייה וניהול. התרגיל מתמקד בכתיבת ביטויי אלגברת יחסים על גבי סכמות הנתונים ללא רשומות בפועל.";
    const dataStructureNotes =
      "הטבלאות הן Researchers(researcherName, universityName, researcherAddress, researcherGrant), Universities(universityName, state, NumberOfPublications), Publications(articleName, field, authorName, year). חוקר מזוהה גם כמחבר במאמרים, ושם האוניברסיטה קושר בין Researchers ל-Universities.";

    const homework = existing
      ? await homeworkService.getHomeworkSetById(existing.id)
      : await createHomeworkSet({
          title: "תרגיל בית 2",
          courseId,
          dueAt,
          availableFrom,
          availableUntil,
          published: false,
          datasetPolicy: "shared",
          questionOrder: [],
          visibility: "draft",
          createdBy: "system",
          overview,
          backgroundStory,
          dataStructureNotes,
        });

    if (!homework) {
      return NextResponse.json(
        { error: "Failed to create or fetch homework set" },
        { status: 500 }
      );
    }

    await homeworkService.updateHomeworkSet(homework.id, {
      courseId,
      dueAt,
      availableFrom,
      availableUntil,
      overview,
      backgroundStory,
      dataStructureNotes,
      selectedDatasetId: dataset.id,
    });

    // 3) Remove all existing questions so we have exactly 10
    const questionsService = await getQuestionsService();
    const existingQs = await getQuestionsByHomeworkSet(homework.id);
    if (existingQs.length > 0) {
      for (const q of existingQs) {
        await questionsService.deleteQuestion(q.id);
      }
    }

    const baseRubric = [
      {
        id: "correctness",
        label: "Correctness",
        description: "נכונות הביטוי באלגברת יחסים",
        weight: 80,
        autoGraded: false,
      },
      {
        id: "style",
        label: "Style",
        description: "קריאות ושימוש נכון בפעולות",
        weight: 20,
        autoGraded: false,
      },
    ];

    const questionsInput: Array<
      Omit<Question, "id"> & { homeworkSetId: string }
    > = [
      {
        homeworkSetId: homework.id,
        prompt:
          "הציגו את שמות האוניברסיטאות שנמצאות באיטליה, פורטוגל וספרד. הפתרון צריך לכלול את פקודת האיחוד או החיתוך.",
        instructions: "אלגברת יחסים בלבד.",
        expectedOutputDescription:
          "הפלט צריך לכלול שמות אוניברסיטאות ללא שדות נוספים.",
        starterSql: `π universityName (σ state = 'IT' (Universities))
∪ π universityName (σ state = 'PO' (Universities))
∪ π universityName (σ state = 'SP' (Universities))`,
        expectedResultSchema: [{ column: "universityName", type: "string" }],
        gradingRubric: baseRubric,
        datasetId: dataset.id,
        maxAttempts: 3,
        points: 10,
        evaluationMode: "manual",
      },
      {
        homeworkSetId: homework.id,
        prompt:
          "הציגו את רשימת הארצות בהן יש אוניברסיטאות שפרסמו מעל 16 מאמרים. יש להציג את רשימת הארצות ללא כפילויות.",
        instructions: "השתמשו בהטלה לאחר סינון.",
        expectedOutputDescription:
          "הפלט צריך לכלול רשימת מדינות ללא כפילויות.",
        starterSql: `π state (σ NumberOfPublications > 16 (Universities))`,
        expectedResultSchema: [{ column: "state", type: "string" }],
        gradingRubric: baseRubric,
        datasetId: dataset.id,
        maxAttempts: 3,
        points: 10,
        evaluationMode: "manual",
      },
      {
        homeworkSetId: homework.id,
        prompt:
          "הציגו את שם וסכום מלגת המחקר של החוקרים השייכים לאוניברסיטה שפרסמה פחות מ-8 מאמרים. יש לפתור בשתי דרכים שונות.",
        instructions:
          "רצוי להראות גם פתרון עם מכפלה וגם פתרון יעיל יותר עם צירוף.",
        expectedOutputDescription:
          "הפלט צריך לכלול researcherName ו-researcherGrant.",
        starterSql: `אפשרות יעילה:
π researcherName, researcherGrant
(σ NumberOfPublications < 8 (Universities ⨝ Researchers))`,
        expectedResultSchema: [
          { column: "researcherName", type: "string" },
          { column: "researcherGrant", type: "number" },
        ],
        gradingRubric: baseRubric,
        datasetId: dataset.id,
        maxAttempts: 3,
        points: 10,
        evaluationMode: "manual",
      },
      {
        homeworkSetId: homework.id,
        prompt:
          "הציגו את שמות החוקרים ושמות האוניברסיטאות בהן הם מלמדים, רק עבור חוקרים הגרים במדינה בה הם מלמדים.",
        instructions:
          "בדקו התאמה בין researcherAddress לבין state לאחר הצירוף.",
        expectedOutputDescription:
          "הפלט צריך לכלול researcherName ו-universityName.",
        starterSql: `π researcherName, universityName
(σ researcherAddress = state (Universities ⨝ Researchers))`,
        expectedResultSchema: [
          { column: "researcherName", type: "string" },
          { column: "universityName", type: "string" },
        ],
        gradingRubric: baseRubric,
        datasetId: dataset.id,
        maxAttempts: 3,
        points: 10,
        evaluationMode: "manual",
      },
      {
        homeworkSetId: homework.id,
        prompt:
          "הציגו את שמות וכתובות החוקרים שפרסמו מאמר ביחד עם החוקרת Prof. Nadya Segev.",
        instructions:
          "אפשר להשתמש בשינוי שם לטבלת Publications כדי להשוות מחברים על אותו articleName.",
        expectedOutputDescription:
          "הפלט צריך לכלול שמות וכתובות של חוקרים שפרסמו יחד עם Nadya Segev.",
        starterSql: `π P1.authorName, P1.authorAddress
(σ Publications.articleName = P1.articleName
 ∧ Publications.authorName = 'Prof. Nadya Segev'
 ∧ P1.authorName <> 'Prof. Nadya Segev'
 (Publications × ρ P1(Publications)))`,
        expectedResultSchema: [
          { column: "authorName", type: "string" },
          { column: "authorAddress", type: "string" },
        ],
        gradingRubric: baseRubric,
        datasetId: dataset.id,
        maxAttempts: 3,
        points: 10,
        evaluationMode: "manual",
      },
      {
        homeworkSetId: homework.id,
        prompt:
          "שמות החוקרים שפרסמו מאמר בנושא AI אך לא פרסמו אף מאמר בנושא DB.",
        instructions: "השתמשו בפעולת הפרש בין שתי הטלות.",
        expectedOutputDescription: "הפלט צריך לכלול שמות חוקרים בלבד.",
        starterSql: `π authorName (σ field = 'AI' (Publications))
−
π authorName (σ field = 'DB' (Publications))`,
        expectedResultSchema: [{ column: "authorName", type: "string" }],
        gradingRubric: baseRubric,
        datasetId: dataset.id,
        maxAttempts: 3,
        points: 10,
        evaluationMode: "manual",
      },
      {
        homeworkSetId: homework.id,
        prompt:
          "שמות המאמרים שפורסמו על ידי חוקרים השייכים לאחת מהאוניברסיטאות בישראל. יש לפתור בדרך היעילה ביותר.",
        instructions: "צמצמו יחסים לפני המכפלה/הצירוף.",
        expectedOutputDescription: "הפלט צריך לכלול שמות מאמרים בלבד.",
        starterSql: `π articleName
(σ state = 'Israel' ((Universities ⨝ Researchers) ⨝ Publications))`,
        expectedResultSchema: [{ column: "articleName", type: "string" }],
        gradingRubric: baseRubric,
        datasetId: dataset.id,
        maxAttempts: 3,
        points: 10,
        evaluationMode: "manual",
      },
      {
        homeworkSetId: homework.id,
        prompt:
          "שמות כל האוניברסיטאות שפרסמו מעל 13 מאמרים אך אין בהן חוקר שפרסם מאמר בנושא SQL בשנת 2025.",
        instructions: "השתמשו בפעולת הפרש.",
        expectedOutputDescription:
          "הפלט צריך לכלול שמות אוניברסיטאות בלבד.",
        starterSql: `π universityName (σ NumberOfPublications > 13 (Universities))
−
π universityName
(σ field = 'SQL' ∧ year = 2025
 ((Universities ⨝ Researchers) ⨝ Publications))`,
        expectedResultSchema: [{ column: "universityName", type: "string" }],
        gradingRubric: baseRubric,
        datasetId: dataset.id,
        maxAttempts: 3,
        points: 10,
        evaluationMode: "manual",
      },
      {
        homeworkSetId: homework.id,
        prompt:
          'שמות האוניברסיטאות בסין שפרסמו יותר מאמרים מאשר אוניברסיטת ייל בארה"ב.',
        instructions:
          "אפשר להשתמש בשינוי שם לאותה טבלה או בפתרון דו-שלבי.",
        expectedOutputDescription:
          "הפלט צריך לכלול שמות אוניברסיטאות בסין שעומדות בתנאי ההשוואה.",
        starterSql: `π U1.universityName
(σ U1.state = 'China'
 ∧ U2.universityName = 'Yale'
 ∧ U2.state = 'US'
 ∧ U1.NumberOfPublications > U2.NumberOfPublications
 (ρ U1(Universities) × ρ U2(Universities)))`,
        expectedResultSchema: [{ column: "universityName", type: "string" }],
        gradingRubric: baseRubric,
        datasetId: dataset.id,
        maxAttempts: 3,
        points: 10,
        evaluationMode: "manual",
      },
      {
        homeworkSetId: homework.id,
        prompt:
          "עליכם לכתוב שאילתא באלגברת יחסים עם לפחות 4 פעולות, ולהסביר בשורה אחת מה עושה השאילתא.",
        instructions:
          "זוהי שאלה פתוחה. יש לצרף גם הסבר מילולי קצר.",
        expectedOutputDescription:
          "הפלט הוא ביטוי אלגברת יחסים תקין והסבר מילולי קצר על מטרתו.",
        starterSql: "",
        expectedResultSchema: [],
        gradingRubric: baseRubric,
        datasetId: dataset.id,
        maxAttempts: 3,
        points: 10,
        evaluationMode: "manual",
      },
    ];

    const questionIds: string[] = [];
    for (const q of questionsInput) {
      const created = await questionsService.createQuestion(q);
      questionIds.push(created.id);
    }

    await homeworkService.updateHomeworkSet(homework.id, {
      questionOrder: questionIds,
      overview,
      backgroundStory,
      dataStructureNotes,
      dueAt,
      availableFrom,
      availableUntil,
    });

    return NextResponse.json({
      success: true,
      datasetId: dataset.id,
      homeworkSetId: homework.id,
      questionCount: questionIds.length,
      message: "HW2 seed completed (10 questions, idempotent)",
    });
  } catch (error) {
    console.error("Failed to seed HW2:", error);
    return NextResponse.json(
      { error: "Failed to seed HW2" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return runSeed({ courseId: body.courseId, dueAt: body.dueAt });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId") ?? undefined;
  const dueAt = searchParams.get("dueAt") ?? undefined;
  return runSeed({ courseId, dueAt });
}
