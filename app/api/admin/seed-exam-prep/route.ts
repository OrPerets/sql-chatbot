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
4) Scores (StudentID, ExamID, Score, GradedAt, FirstExamDate)

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
            columns: ["StudentID", "ExamID", "Score", "GradedAt", "FirstExamDate"],
          },
        ],
        tags: ["הכנה למבחן", "מבחנים", "רישומים", "ציונים"],
      });
    }

    const questions = [
      {
        prompt: "הציגו את כל המבחנים שמתקיימים בשבועיים הקרובים יחד עם מספר הנרשמים המאושרים לכל מבחן. כללו רק הרשמות בסטטוס 'approved'. מיינו לפי תאריך מבחן מהקרוב לרחוק.",
        instructions: "סכמה: מזהה מבחן, קוד קורס, תאריך מבחן, כמות נרשמים מאושרים",
        starterSql: "SELECT e.ExamID, e.CourseCode, e.ExamDate, COUNT(r.RegistrationID) AS approved_count FROM Exams e LEFT JOIN Registrations r ON r.ExamID = e.ExamID AND r.Status = 'approved' WHERE DATEDIFF(e.ExamDate, CURDATE()) >= 0 AND DATEDIFF(e.ExamDate, CURDATE()) <= 14 GROUP BY e.ExamID, e.CourseCode, e.ExamDate ORDER BY e.ExamDate",
        expectedResultSchema: [
          { column: "מזהה מבחן", type: "number" },
          { column: "קוד קורס", type: "string" },
          { column: "תאריך מבחן", type: "date" },
          { column: "כמות נרשמים מאושרים", type: "number" },
        ],
        points: 10,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      {
        prompt: "הציגו את שמות הסטודנטים אשר לא רשומים לאף מבחן, ממויינים בסדר יורד עפ״י שם.",
        instructions: "סכמה: תעודת סטודנט, שם מלא",
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
        prompt: "הציגו לכל מבחן את הציון הגבוה ביותר ואת הציון הנמוך ביותר ואת מספר הנבחנים. הציגו רק מבחנים שיש להם ציונים. מיינו לפי מזהה מבחן.",
        instructions: "סכמה: מזהה מבחן, קוד קורס, ציון מקסימלי, ציון מינימלי, מספר נבחנים",
        starterSql: "",
        expectedResultSchema: [
          { column: "מזהה מבחן", type: "number" },
          { column: "קוד קורס", type: "string" },
          { column: "ציון מקסימלי", type: "number" },
          { column: "ציון מינימלי", type: "number" },
          { column: "מספר נבחנים", type: "number" },
        ],
        points: 10,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      {
        prompt: "הציגו את ממוצע הציון לכל חוג בכל קורס מבחן, יחד עם מספר הסטודנטים שנבחנו. הציגו רק חוגים עם לפחות 3 נבחנים. מיינו לפי חוג ולאחר מכן לפי קוד קורס.",
        instructions: "סכמה: חוג, קוד קורס, ממוצע ציון, מספר נבחנים",
        starterSql: "",
        expectedResultSchema: [
          { column: "חוג", type: "string" },
          { column: "קוד קורס", type: "string" },
          { column: "ממוצע ציון", type: "number" },
          { column: "מספר נבחנים", type: "number" },
        ],
        points: 10,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      {
        prompt: "הציגו את הסטודנטים שניגשו ליותר ממבחן אחד, כולל מספר המבחנים וממוצע הציון שלהם. חשבו לפי מבחנים שונים שהסטודנט נרשם אליהם. הציגו רק סטודנטים עם יותר ממבחן אחד.",
        instructions: "סכמה: תעודת סטודנט, שם מלא, מספר מבחנים, ממוצע ציון",
        starterSql: "",
        expectedResultSchema: [
          { column: "תעודת סטודנט", type: "number" },
          { column: "שם מלא", type: "string" },
          { column: "מספר מבחנים", type: "number" },
          { column: "ממוצע ציון", type: "number" },
        ],
        points: 10,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      {
        prompt: "הציגו את המבחנים שהתקיימו בחדר 'A1' או שמשכם מעל 120 דקות. מיינו לפי משך מבחן מהארוך לקצר.",
        instructions: "סכמה: מזהה מבחן, קוד קורס, משך דקות, חדר",
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
        prompt: "הציגו את רשימת הסטודנטים עם סטטוס הרשמה 'waitlist' יחד עם פרטי המבחן. מיינו לפי תאריך מבחן ולאחר מכן לפי שם משפחה.",
        instructions: "סכמה: תעודת סטודנט, שם מלא, מזהה מבחן, קוד קורס, תאריך מבחן, סטטוס",
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
        prompt: "הציגו את הסטודנטים שנרשמו למבחן אך עדיין לא קיבלו ציון. כללו רק הרשמות מאושרות. הציגו את הסטודנט, פרטי המבחן וסטטוס הרשמה.",
        instructions: "סכמה: תעודת סטודנט, שם מלא, מזהה מבחן, קוד קורס, סטטוס",
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
        prompt: "הציגו את הסטודנטים שקיבלו ציון גבוה מהממוצע במבחן שלהם. מיינו לפי מזהה מבחן ולאחר מכן לפי ציון מהגבוה לנמוך.",
        instructions: "סכמה: תעודת סטודנט, שם מלא, מזהה מבחן, ציון, ממוצע מבחן",
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
      // --- תרגול: תת-שאילתות (Subqueries) ---
      {
        prompt: "הציגו את הסטודנטים שקיבלו ציון גבוה מהממוצע הכולל של כל הציונים במערכת. השתמשו בתת-שאילתה לחישוב הממוצע הכולל. הציגו תעודת סטודנט, שם מלא, ציון וממוצע כללי. מיינו לפי ציון יורד.",
        instructions: "סכמה: תעודת סטודנט, שם מלא, ציון, ממוצע כללי",
        starterSql: "",
        expectedResultSchema: [
          { column: "תעודת סטודנט", type: "number" },
          { column: "שם מלא", type: "string" },
          { column: "ציון", type: "number" },
          { column: "ממוצע כללי", type: "number" },
        ],
        points: 15,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      // --- תרגול: פונקציות מחרוזת (CONCAT, LENGTH וכו') ---
      {
        prompt: "הציגו רשימת סטודנטים עם השם המלא בפורמט 'משפחה, פרטי' (שרשור שם משפחה, פסיק ורווח, שם פרטי) ואורך השם המלא בתווים. מיינו לפי שם משפחה ואז לפי שם פרטי.",
        instructions: "סכמה: שם מלא (משפחה פרטי), אורך שם",
        starterSql: "",
        expectedResultSchema: [
          { column: "שם מלא (משפחה פרטי)", type: "string" },
          { column: "אורך שם", type: "number" },
        ],
        points: 15,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      // --- תרגול: חיבורי טבלאות (JOINs) ---
      {
        prompt: "הציגו טבלה שמקשרת סטודנטים, מבחנים וציונים: שם הסטודנט (שרשור פרטי ומשפחה), קוד הקורס, תאריך המבחן, החדר והציון. כלול רק נבחנים שקיבלו ציון. השתמשו ב-JOIN בין הטבלאות הרלוונטיות. מיינו לפי שם סטודנט ולפי תאריך מבחן.",
        instructions: "סכמה: שם סטודנט, קוד קורס, תאריך מבחן, חדר, ציון",
        starterSql: "",
        expectedResultSchema: [
          { column: "שם סטודנט", type: "string" },
          { column: "קוד קורס", type: "string" },
          { column: "תאריך מבחן", type: "date" },
          { column: "חדר", type: "string" },
          { column: "ציון", type: "number" },
        ],
        points: 15,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      // --- שאלה מתקדמת: דירוג (ranking) ---
      {
        prompt: "לכל מבחן, הציגו את שלושת הסטודנטים עם הציונים הגבוהים ביותר (מקום 1–3). הציגו מזהה מבחן, קוד קורס, דירוג (1/2/3), תעודת סטודנט, שם מלא וציון. במקרה שוויון בציון קבעו לפי מזהה סטודנט. שאלה מתקדמת – נדרש שימוש בתת-שאילתות או ב-JOIN מתאים.",
        instructions: "סכמה: מזהה מבחן, קוד קורס, דירוג, תעודת סטודנט, שם מלא, ציון",
        starterSql: "",
        expectedResultSchema: [
          { column: "מזהה מבחן", type: "number" },
          { column: "קוד קורס", type: "string" },
          { column: "דירוג", type: "number" },
          { column: "תעודת סטודנט", type: "number" },
          { column: "שם מלא", type: "string" },
          { column: "ציון", type: "number" },
        ],
        points: 20,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      // --- שאלה מתקדמת: אתגר ---
      {
        prompt: "הציגו את המבחנים שבהם פער הציונים (הפרש בין מקסימום למינימום) גדול מהפער הממוצע בכל המבחנים. הציגו מזהה מבחן, קוד קורס, ציון מינימלי, ציון מקסימלי, פער במבחן זה וממוצע הפער בכל המבחנים. מיינו לפי פער יורד. שאלה מתקדמת – נדרש חישוב ממוצע פערים בתת-שאילתה והשוואה.",
        instructions: "סכמה: מזהה מבחן, קוד קורס, ציון מינימלי, ציון מקסימלי, פער במבחן, ממוצע פער כללי",
        starterSql: "",
        expectedResultSchema: [
          { column: "מזהה מבחן", type: "number" },
          { column: "קוד קורס", type: "string" },
          { column: "ציון מינימלי", type: "number" },
          { column: "ציון מקסימלי", type: "number" },
          { column: "פער במבחן", type: "number" },
          { column: "ממוצע פער כללי", type: "number" },
        ],
        points: 20,
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
