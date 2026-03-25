import { NextResponse } from "next/server";
import { createDataset, getDatasetService } from "@/lib/datasets";
import { createHomeworkSet, getHomeworkService } from "@/lib/homework";
import { getQuestionsService } from "@/lib/questions";
import { HW1_DOC_SYNC_QUESTIONS } from "@/lib/hw1-doc-sync";
import type { Dataset, Question } from "@/app/homework/types";

/**
 * One-time seeding endpoint for Homework 1 (HW1)
 * Creates:
 * - Dataset: Employees/Jobs/Departments/Locations (preview columns)
 * - Homework Set: "תרגיל בית 1"
 * - Questions: 10 questions extracted from the HW1 instructions
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
      "זהו התרגיל הראשון בקורס והוא מיועד לכל קבוצות התרגול. התרגיל הינו לשבוע ימים, ויש להגיש אותו דרך אתר הקורס ב-MOODLE עד השעה 23:59.",
      "זהו תרגיל מעשי ולכן יש לפתור אותו בתוכנת MySQL. אין להגיש תרגילים בכתב יד.",
      "התרגיל מבוסס על החומר שנלמד בהרצאות ובתרגולים מתחילת הסמסטר, ללא שאלות על חומר מתקדם.",
      "ההגשה תתבצע ביחידים בלבד, ובפורמט PDF או WORD.",
      "על כל תרגיל יש לרשום: שם הסטודנט, תעודת זהות, ומספר קבוצת התרגול. תרגיל ללא שלושת הפרטים הללו לא ייבדק.",
      "ההגשה צריכה לכלול את הפלטים הבאים: פקודות CREATE לכל טבלה, פקודות INSERT לכל טבלה, ופקודת SELECT המציגה את תוכן כל טבלה שנבנתה.",
      "לכל שאילתה יש לכלול שלושה שלבים: הערה עם מספר השאלה לפני פקודת ה-SELECT, פקודת SQL עובדת, וצילום מסך ברור של תוצאת ההרצה.",
      "אי צירוף של אחד מהשלבים יגרור הורדת נקודות.",
    ].join("\n\n");
    const backgroundStory = [
      "בבסיס הנתונים הבא מפורטים פרטי עובדים השייכים למחלקות שונות במפעל, כמו כן מתוארים תפקידים המשויכים לתנאי שכר שונים.",
      "המפעל המתואר הוא מפעל גלובלי המכיל מחלקות במקומות שונים על גבי הגלובוס. בתור מיישמי מערכות מידע עליכם להתמקד ב-4 הטבלאות הבאות שאותן תצטרכו לבנות, ועליהן להריץ את השאילתות המפורטות בהמשך לצורך בדיקת תקינות המערכת.",
      "תזכורת: אין הגבלה לכמות חיבורי הטבלאות שניתן לבצע בשאילתה.",
      "הנחייה חשובה: נא למלא את הטבלה לפי מספר תעודת הזהות באופן הבא: הספרה הראשונה ב-ת.ז. תהיה A, הספרה השנייה B וכך הלאה. דוגמה: אם ת.ז. היא 321654987 (ABCDEFGHI), אז ABC = 321, DEF = 654, GHI = 987.",
    ].join("\n\n");
    const dataStructureNotes = [
      "מבנה הסכמות ונתוני הטבלאות:",
      "Employees(Employee_id, First_name, Last_name, Birth_date, Hire_date, Job_id, Salary, Department_id)",
      "Jobs(Job_id, Job_title, Min_salary, Max_salary)",
      "Departments(Department_id, Department_name, Location_id)",
      "Locations(Location_id, Country, City, Street)",
      "Employees מקושרת ל-Jobs דרך Job_id ול-Departments דרך Department_id. Departments מקושרת ל-Locations דרך Location_id.",
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
          backgroundStory,
          dataStructureNotes,
          selectedDatasetId: dataset.id,
        });

    if (!homework) {
      return NextResponse.json({ error: "Failed to create or fetch homework set" }, { status: 500 });
    }

    await homeworkService.updateHomeworkSet(homework.id, {
      courseId,
      dueAt,
      overview: hwOverview,
      backgroundStory,
      dataStructureNotes,
      selectedDatasetId: dataset.id,
    });

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

      const items: Array<Omit<Question, "id"> & { homeworkSetId: string }> = HW1_DOC_SYNC_QUESTIONS.map(
        (question) => ({
          homeworkSetId: homework.id,
          prompt: question.prompt,
          instructions: question.instructions,
          expectedOutputDescription: question.expectedOutputDescription,
          starterSql: question.starterSql,
          expectedResultSchema: question.expectedResultSchema,
          gradingRubric: baseRubric,
          datasetId: dataset.id,
          maxAttempts: 5,
          points: 10,
          evaluationMode: "manual",
          parameterMode: question.parameterMode,
          parameters: question.parameters ?? [],
        }),
      );

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
