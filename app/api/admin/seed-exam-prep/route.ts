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
import { createDataset, getDatasetService } from "@/lib/datasets";

export async function POST() {
  try {
    const homeworkService = await getHomeworkService();
    const questionsService = await getQuestionsService();
    const datasetService = await getDatasetService();

    const allHomeworkSets = await homeworkService.listHomeworkSets({ pageSize: 1000 });
    let homeworkSet = allHomeworkSets.items.find(
      (hw) => hw.title === "תרגיל הכנה למבחן" || hw.title === "הכנה למבחן"
    );

    const overview = "סט תרגול להכנה למבחן SQL המתמקד בניתוח נתוני מבחנים, רישומים וציונים.";
    const backgroundStory = `בתרגיל זה נשתמש במסד נתונים המתאר מבחנים אקדמיים במוסד לימודים. הנתונים כוללים מבחנים, סטודנטים, רישומים למבחנים ותוצאות.

הטבלאות המרכזיות הן:
1) Exams (ExamID, CourseCode, ExamDate, DurationMinutes, Room)
2) Students (StudentID, FirstName, LastName, Major, Year)
3) Registrations (RegistrationID, StudentID, ExamID, RegisteredAt, Status)
4) Scores (ScoreID, StudentID, ExamID, Score, GradedAt, Attempt)

המטרה היא לכתוב שאילתות שמסייעות להערכת היערכות למבחן והבנת דפוסי רישום והישגים.`;

    if (!homeworkSet) {
      const createdHomeworkSet = await createHomeworkSet({
        title: "תרגיל הכנה למבחן",
        courseId: "sql-course",
        dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        published: false,
        datasetPolicy: "shared",
        questionOrder: [],
        visibility: "draft",
        createdBy: "admin",
        overview,
        backgroundStory,
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
        overview,
        backgroundStory,
        published: false,
        visibility: "draft",
      });
    }

    const datasetName = "הכנה למבחן - מסד מבחנים";
    const allDatasets = await datasetService.listDatasets({ pageSize: 1000 });
    let examPrepDataset = allDatasets.items.find((ds) => ds.name === datasetName);

    if (!examPrepDataset) {
      examPrepDataset = await createDataset({
        name: datasetName,
        description: "מסד נתונים לניהול מבחנים, רישומים וציונים לקראת מבחן.",
        scenario: "המוסד מבקש לנתח רישומים למבחנים ותוצאות כדי לזהות דפוסי הצלחה והיערכות.",
        story: backgroundStory,
        connectionUri: "sandbox://datasets/exam-prep",
        previewTables: [
          {
            name: "Exams",
            columns: ["ExamID", "CourseCode", "ExamDate", "DurationMinutes", "Room"],
          },
          {
            name: "Students",
            columns: ["StudentID", "FirstName", "LastName", "Major", "Year"],
          },
          {
            name: "Registrations",
            columns: [
              "RegistrationID",
              "StudentID",
              "ExamID",
              "RegisteredAt",
              "Status",
            ],
          },
          {
            name: "Scores",
            columns: ["ScoreID", "StudentID", "ExamID", "Score", "GradedAt", "Attempt"],
          },
        ],
        tags: ["הכנה למבחן", "מבחנים", "רישומים", "ציונים"],
      });
    }

    const questions = [
      {
        prompt: "הציגו את כל המבחנים שמתקיימים בשבועיים הקרובים יחד עם מספר הנרשמים לכל מבחן.",
        instructions: "מיינו לפי תאריך מבחן מהקרוב לרחוק. (סכמה: מזהה מבחן, קוד קורס, תאריך מבחן, כמות נרשמים).",
        starterSql: "",
        expectedResultSchema: [
          { column: "מזהה מבחן", type: "number" },
          { column: "קוד קורס", type: "string" },
          { column: "תאריך מבחן", type: "date" },
          { column: "כמות נרשמים", type: "number" },
        ],
        points: 10,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      {
        prompt: "הציגו את הסטודנטים שלא נרשמו לשום מבחן.",
        instructions: "הציגו את התעודה ושם מלא, ומיינו לפי שם משפחה ושם פרטי. (סכמה: תעודת סטודנט, שם מלא).",
        starterSql: "",
        expectedResultSchema: [
          { column: "תעודת סטודנט", type: "number" },
          { column: "שם מלא", type: "string" },
        ],
        points: 10,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      {
        prompt: "הציגו לכל מבחן את הציון הגבוה ביותר ואת הציון הנמוך ביותר.",
        instructions: "הציגו רק מבחנים שיש להם ציונים. (סכמה: מזהה מבחן, קוד קורס, ציון מקסימלי, ציון מינימלי).",
        starterSql: "",
        expectedResultSchema: [
          { column: "מזהה מבחן", type: "number" },
          { column: "קוד קורס", type: "string" },
          { column: "ציון מקסימלי", type: "number" },
          { column: "ציון מינימלי", type: "number" },
        ],
        points: 10,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      {
        prompt: "הציגו את ממוצע הציון לכל חוג בכל קורס מבחן.",
        instructions: "מיינו לפי חוג ולאחר מכן לפי קוד קורס. (סכמה: חוג, קוד קורס, ממוצע ציון).",
        starterSql: "",
        expectedResultSchema: [
          { column: "חוג", type: "string" },
          { column: "קוד קורס", type: "string" },
          { column: "ממוצע ציון", type: "number" },
        ],
        points: 10,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      {
        prompt: "הציגו את הסטודנטים שניגשו ליותר ממבחן אחד, כולל מספר המבחנים.",
        instructions: "חשבו לפי מבחנים שונים שהסטודנט נרשם אליהם. הציגו רק סטודנטים עם יותר ממבחן אחד. (סכמה: תעודת סטודנט, שם מלא, מספר מבחנים).",
        starterSql: "",
        expectedResultSchema: [
          { column: "תעודת סטודנט", type: "number" },
          { column: "שם מלא", type: "string" },
          { column: "מספר מבחנים", type: "number" },
        ],
        points: 10,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      {
        prompt: "הציגו את המבחנים שהתקיימו בחדר 'A1' או שמשכם מעל 120 דקות.",
        instructions: "מיינו לפי משך מבחן מהארוך לקצר. (סכמה: מזהה מבחן, קוד קורס, משך דקות, חדר).",
        starterSql: "",
        expectedResultSchema: [
          { column: "מזהה מבחן", type: "number" },
          { column: "קוד קורס", type: "string" },
          { column: "משך דקות", type: "number" },
          { column: "חדר", type: "string" },
        ],
        points: 10,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      {
        prompt: "הציגו את רשימת הסטודנטים עם סטטוס הרשמה 'waitlist' יחד עם פרטי המבחן.",
        instructions: "מיינו לפי תאריך מבחן ולאחר מכן לפי שם משפחה. (סכמה: תעודת סטודנט, שם מלא, מזהה מבחן, קוד קורס, תאריך מבחן, סטטוס).",
        starterSql: "",
        expectedResultSchema: [
          { column: "תעודת סטודנט", type: "number" },
          { column: "שם מלא", type: "string" },
          { column: "מזהה מבחן", type: "number" },
          { column: "קוד קורס", type: "string" },
          { column: "תאריך מבחן", type: "date" },
          { column: "סטטוס", type: "string" },
        ],
        points: 10,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      {
        prompt: "הציגו לכל סטודנט את תאריך ההרשמה האחרון שלו למבחן.",
        instructions: "הציגו גם סטודנטים שלא נרשמו, עם ערך ריק לתאריך. מיינו לפי שם מלא. (סכמה: תעודת סטודנט, שם מלא, תאריך הרשמה אחרון).",
        starterSql: "",
        expectedResultSchema: [
          { column: "תעודת סטודנט", type: "number" },
          { column: "שם מלא", type: "string" },
          { column: "תאריך הרשמה אחרון", type: "date" },
        ],
        points: 10,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      {
        prompt: "הציגו את הסטודנטים שנרשמו למבחן אך עדיין לא קיבלו ציון.",
        instructions: "הציגו את הסטודנט, פרטי המבחן וסטטוס הרשמה. (סכמה: תעודת סטודנט, שם מלא, מזהה מבחן, קוד קורס, סטטוס).",
        starterSql: "",
        expectedResultSchema: [
          { column: "תעודת סטודנט", type: "number" },
          { column: "שם מלא", type: "string" },
          { column: "מזהה מבחן", type: "number" },
          { column: "קוד קורס", type: "string" },
          { column: "סטטוס", type: "string" },
        ],
        points: 10,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      {
        prompt: "הציגו את הסטודנטים שקיבלו ציון גבוה מהממוצע במבחן שלהם.",
        instructions: "מיינו לפי מזהה מבחן ולאחר מכן לפי ציון מהגבוה לנמוך. (סכמה: תעודת סטודנט, שם מלא, מזהה מבחן, ציון, ממוצע מבחן).",
        starterSql: "",
        expectedResultSchema: [
          { column: "תעודת סטודנט", type: "number" },
          { column: "שם מלא", type: "string" },
          { column: "מזהה מבחן", type: "number" },
          { column: "ציון", type: "number" },
          { column: "ממוצע מבחן", type: "number" },
        ],
        points: 10,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
    ];

    const questionIds: string[] = [];

    for (const questionData of questions) {
      const question = await createQuestion({
        homeworkSetId: homeworkSet.id,
        prompt: questionData.prompt,
        instructions: questionData.instructions,
        starterSql: questionData.starterSql,
        expectedResultSchema: questionData.expectedResultSchema,
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
      message: "הכנה למבחן נוצר בהצלחה",
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
