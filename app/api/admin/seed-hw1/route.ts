import { NextResponse } from "next/server";
import { createDataset, getDatasetService } from "@/lib/datasets";
import { createHomeworkSet, getHomeworkService } from "@/lib/homework";
import { getQuestionsService } from "@/lib/questions";
import type { Dataset, Question } from "@/app/homework/types";

/**
 * One-time seeding endpoint for Homework 1 (HW1)
 * Creates:
 * - Dataset: Employees/Jobs/Departments/Locations (preview columns)
 * - Homework Set: "תרגיל בית 1"
 * - Questions: 9 questions extracted from the HW1 instructions
 *
 * Usage (POST): /api/admin/seed-hw1
 */
async function runSeed(params?: { courseId?: string; dueAt?: string }) {
  try {
    const courseId: string = params?.courseId || "SQL101";
    const dueAt: string = params?.dueAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // 1) Ensure dataset exists or create it
    const datasetPayload: Omit<Dataset, "id" | "updatedAt"> = {
      name: "HW1 Company Employees",
      description: "Dataset for SQL HW1: employees, jobs, departments, locations",
      scenario: "מערכת משאבי אנוש ארגונית – עובדים משויכים למחלקות ולתפקידים, עם נתוני שכר.",
      story: "הסט נתונים משמש לתרגול שאילתות SQL על עובדים, מחלקות, מיקומים ותפקידים.",
      connectionUri: "sandbox://datasets/hw1-company-employees",
      previewTables: [
        { name: "Employees", columns: [
          "Employee_id", "First_name", "Last_name", "Birth_date", "Hire_date", "Job_id", "Salary", "Department_id"
        ]},
        { name: "Jobs", columns: ["Job_id", "Job_title", "Min_salary", "Max_salary"]},
        { name: "Departments", columns: ["Department_id", "Department_name", "Location_id"]},
        { name: "Locations", columns: ["Location_id", "Country", "City", "Street"]},
      ],
      tags: ["hw1", "employees", "intro"],
    };

    const datasetService = await getDatasetService();
    const existingDatasets = await datasetService.listDatasets({ search: "HW1 Company Employees", pageSize: 1 });
    const dataset = existingDatasets.items[0] || await createDataset(datasetPayload);

    // 2) Ensure homework set exists or create it
    const homeworkService = await getHomeworkService();
    const existingSets = await homeworkService.listHomeworkSets({ pageSize: 1, status: ["draft", "published"] });
    const already = (await homeworkService.listHomeworkSets({ pageSize: 50 })).items.find(i => i.title === "תרגיל בית 1");

    const hwOverview = [
      "זהו התרגיל הראשון בקורס ומיועד לכל קבוצות התרגול. יש להגיש עד השעה 23:59.",
      "יש להשתמש ב-MySQL. ההגשה מתבצעת ביחידים בלבד. הקובץ יכלול את פקודות CREATE/INSERT/SELECT.",
      "הקדימו: הדביקו מספר שאלה והערה קצרה /* remark */ לפני ה-SELECT שמציג את התוצאה.",
      "לכל שאלה: הראו את פקודת ה-SQL, הציגו את תוצאת ההרצה, והסבירו בקצרה אם יש.",
    ].join("\n");

    const homework = already
      ? await homeworkService.getHomeworkSetById(already.id)
      : await createHomeworkSet({
          title: "תרגיל בית 1",
          courseId,
          dueAt,
          published: false,
          datasetPolicy: "shared",
          questionOrder: [],
          visibility: "draft",
          createdBy: "system",
          overview: hwOverview,
        });

    if (!homework) {
      return NextResponse.json({ error: "Failed to create or fetch homework set" }, { status: 500 });
    }

    // 3) Clear existing questions and insert new ones
    const questionsService = await getQuestionsService();
    const existingQs = await questionsService.getQuestionsByHomeworkSet(homework.id);
    
    // Delete existing questions to replace them with new ones
    if (existingQs.length > 0) {
      console.log(`Deleting ${existingQs.length} existing questions for homework set ${homework.id}`);
      for (const q of existingQs) {
        await questionsService.deleteQuestion(q.id);
      }
    }

    // Create new questions
    const baseRubric = [
        { id: "correctness", label: "Correctness", description: "נכונות השאילתא והתוצאה", weight: 80, autoGraded: false },
        { id: "style", label: "Style", description: "קריאות ושימוש נכון בפונקציות", weight: 20, autoGraded: false },
      ];

      const items: Array<Omit<Question, "id"> & { homeworkSetId: string }> = [
        {
          homeworkSetId: homework.id,
          prompt: "שאלה 1",
          instructions: "הציגו את השם הפרטי, שם המשפחה ושנת הלידה, עבור העובדים שנולדו בין השנים 1999 ל-2025 (כולל קצוות) והמשכורת שלהם נעה בין 6,930 ל 9,030 ₪ (לא כולל קצוות).",
          starterSql: "",
          expectedResultSchema: [],
          gradingRubric: baseRubric,
          datasetId: dataset.id,
          maxAttempts: 5,
          points: 10,
          evaluationMode: "manual",
        },
        {
          homeworkSetId: homework.id,
          prompt: "שאלה 2",
          instructions: "הציגו את שם המשפחה והשם הפרטי של העובדים אשר גילם פחות מ-31 ומשכורתם גדולה מ-2,230 אירו, לפי השער היציג כיום של 3.92 ₪ ל-1 אירו.",
          starterSql: "",
          expectedResultSchema: [],
          gradingRubric: baseRubric,
          datasetId: dataset.id,
          maxAttempts: 5,
          points: 10,
          evaluationMode: "manual",
        },
        {
          homeworkSetId: homework.id,
          prompt: "שאלה 3",
          instructions: "לאור המצב בארץ, הוחלט שכל מי שעובד בתפקיד פקידותי (clerk) בישראל, יקבל העלאה, לאור כך נרצה לבדוק מה תהיה המשכורת לאחר תוספת של 13.5%. עליכם להציג בתוצאה שם משפחה, שם פרטי, השכר לפני התוספת והשכר החדש לאחר התוספת.",
          starterSql: "",
          expectedResultSchema: [],
          gradingRubric: baseRubric,
          datasetId: dataset.id,
          maxAttempts: 5,
          points: 10,
          evaluationMode: "manual",
        },
        {
          homeworkSetId: homework.id,
          prompt: "שאלה 4",
          instructions: "הציגו את מס' ת.ז של העובדים שעובדים בעיר ששמה מכיל בדיוק 5 תווים ושהמדינה בה הם עובדים מכילה אות \"a\" אך לא מכילה את אות \"e\". יש למיין את רשימת העובדים לפי תעודת הזהות של העובד בסדר יורד.",
          starterSql: "",
          expectedResultSchema: [],
          gradingRubric: baseRubric,
          datasetId: dataset.id,
          maxAttempts: 5,
          points: 10,
          evaluationMode: "manual",
        },
        {
          homeworkSetId: homework.id,
          prompt: "שאלה 5",
          instructions: "הציגו את ת.ז. של העובד, קוד העבודה, שם המחלקה והמשכורת רק עבור העובדים שמשכורתם היא לפחות 9,888 ₪ וששם המשפחה שלהם מכיל את האות \"M\" וששם המחלקה בה הם עובדים, לא מכיל את האות \"D\". עליכם לדאוג למיין את התוצאה לפי משכורת בסדר יורד.",
          starterSql: "",
          expectedResultSchema: [],
          gradingRubric: baseRubric,
          datasetId: dataset.id,
          maxAttempts: 5,
          points: 12,
          evaluationMode: "manual",
        },
        {
          homeworkSetId: homework.id,
          prompt: "שאלה 6",
          instructions: "לגבי העובדים הבאים הציגו את ת.ז. של העובד ואת הגיל שלו רק עבור העובדים שעובדים ברחוב שמכיל את האות \"a\". יש לסדר את העובדים לפי גיל בסדר יורד (מיון ראשי) ובמידה וקיימים כמה עובדים עם גיל זהה, יש לסדר אותם לפי תאריך תחילת העסקה בסדר עולה (מיון משני).",
          starterSql: "",
          expectedResultSchema: [],
          gradingRubric: baseRubric,
          datasetId: dataset.id,
          maxAttempts: 5,
          points: 10,
          evaluationMode: "manual",
        },
        {
          homeworkSetId: homework.id,
          prompt: "שאלה 7",
          instructions: "עבור כל תחום עיסוק בטבלת JOBS, הציגו את קטגורית התפקיד ואת השכר הממוצע לאותו תפקיד בדולרים לפי שער של 3.37 ₪ (סכמת היחס תהיה: job_title, average_of_salary_in_dollars)",
          starterSql: "",
          expectedResultSchema: [],
          gradingRubric: baseRubric,
          datasetId: dataset.id,
          maxAttempts: 5,
          points: 10,
          evaluationMode: "manual",
        },
        {
          homeworkSetId: homework.id,
          prompt: "שאלה 8",
          instructions: "הציגו את שם משפחה, שם פרטי ותיאור התפקיד של העובדים שעובדים בטוקיו. יש למיין את התוצאה לפי משכורת בסדר עולה ואם קיימים מספר עובדים עם משכורת זהה, אז יש לסדר אותם לפי תאריך תחילת העסקה בסדר יורד.",
          starterSql: "",
          expectedResultSchema: [],
          gradingRubric: baseRubric,
          datasetId: dataset.id,
          maxAttempts: 5,
          points: 10,
          evaluationMode: "manual",
        },
        {
          homeworkSetId: homework.id,
          prompt: "שאלה 9",
          instructions: "עבור המחלקה שמכילה 3 פעמים לפחות את האות e בשם המחלקה (לא בהכרח ברצף), יש להציג את כל פרטי העובדים (כל העמודות מטבלת עובדים) שעובדים במחלקה זו מלבד אלו שהם מהנדסים.",
          starterSql: "",
          expectedResultSchema: [],
          gradingRubric: baseRubric,
          datasetId: dataset.id,
          maxAttempts: 5,
          points: 10,
          evaluationMode: "manual",
        },
        {
          homeworkSetId: homework.id,
          prompt: "שאלה 10",
          instructions: "הציגו את שמות המשפחה של העובדים ששם המשפחה שלהם מתחיל באות \"A\" או ששמם הפרטי מסתיים באות \"A\" ובנוסף ששם העיר בה הם עובדים מכילה \"-\" (מקף אמצעי) או ששם הרחוב בו הם עובדים מכיל \"-\" (מקף אמצעי).",
          starterSql: "",
          expectedResultSchema: [],
          gradingRubric: baseRubric,
          datasetId: dataset.id,
          maxAttempts: 5,
          points: 10,
          evaluationMode: "manual",
        },
      ];

    // Create questions and collect their IDs
    const questionIds: string[] = [];
    for (const q of items) {
      // eslint-disable-next-line no-await-in-loop
      const createdQuestion = await questionsService.createQuestion(q);
      questionIds.push(createdQuestion.id);
    }

    // Update homework set with new question order
    await homeworkService.updateHomeworkSet(homework.id, {
      questionOrder: questionIds,
    });

    console.log(`Created ${questionIds.length} questions for homework set ${homework.id}`);

    return NextResponse.json({
      success: true,
      datasetId: dataset.id,
      homeworkSetId: homework.id,
      message: "HW1 seed completed (idempotent)",
    });
  } catch (error) {
    console.error("Failed to seed HW1:", error);
    return NextResponse.json({ error: "Failed to seed HW1" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return runSeed({ courseId: body.courseId, dueAt: body.dueAt });
}

// Convenience GET to allow seeding via browser navigation
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId") || undefined;
  const dueAt = searchParams.get("dueAt") || undefined;
  return runSeed({ courseId: courseId || undefined, dueAt: dueAt || undefined });
}


