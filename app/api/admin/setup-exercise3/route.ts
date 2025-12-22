import { NextResponse } from "next/server";
import { 
  getHomeworkService, 
  createHomeworkSet, 
  updateHomeworkSet, 
  deleteHomeworkSet 
} from "@/lib/homework";
import { 
  createQuestion, 
  getQuestionsByHomeworkSet, 
  getQuestionsService 
} from "@/lib/questions";
import { 
  createDataset, 
  getDatasetService 
} from "@/lib/datasets";

export async function POST() {
  try {
    const homeworkService = await getHomeworkService();
    const questionsService = await getQuestionsService();
    const datasetService = await getDatasetService();
    
    // Step 1: Get all homework sets
    const allHomeworkSets = await homeworkService.listHomeworkSets({ pageSize: 1000 });
    
    // Step 2: Delete all homework sets, including duplicates of "תרגיל 3"
    // We'll keep the most recent "תרגיל 3" if it exists, otherwise create a new one
    const exercise3Sets = allHomeworkSets.items.filter(hw => hw.title === "תרגיל 3");
    let exercise3SetId: string | null = exercise3Sets.length > 0 
      ? exercise3Sets.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0].id
      : null;
    
    // Delete all homework sets (including old duplicates of "תרגיל 3")
    for (const hw of allHomeworkSets.items) {
      // Skip the one we want to keep
      if (exercise3SetId && hw.id === exercise3SetId) {
        continue;
      }
      
      // Delete all questions for this homework set first
      const questions = await getQuestionsByHomeworkSet(hw.id);
      for (const question of questions) {
        await questionsService.deleteQuestion(question.id);
      }
      // Delete the homework set
      await deleteHomeworkSet(hw.id);
      console.log(`Deleted homework set: ${hw.title} (ID: ${hw.id})`);
    }
    
    // Step 3: Create or update "תרגיל 3" with correct instructions
    const backgroundStory = `בתרגיל זה, עליכם לבנות מסד נתונים הקשור לניהול מערכת סטודנטים וקורסים במכללה. הנכם מגלמים תפקיד של מנהל/מנהלת מערכת קורסים במכללה האחראי/ת על ניהול קורסים, סטודנטים, מרצים ונרשמים לקורסים. מסד הנתונים שלכם יכלול 4 טבלאות:

1) מידע על הסטודנטים:
Students (StudentID, FirstName, LastName, BirthDate, City, Email)

2) מידע על הקורסים:
Courses (CourseID, CourseName, Credits, Department)

3) מידע על המרצים:
Lecturers (LecturerID, FirstName, LastName, City, HireDate, CourseID, Seniority)

4) מידע על נתוני הנרשמים:
Enrollments (StudentID, CourseID, EnrollmentDate, Grade)

עמודת credits מייצגת את כמות נקודות הזכות שהסטודנט יקבל בסיום הקורס.`;

    const overview = `תרגיל בית מס' 3

זהו התרגיל השלישי והאחרון בקורס והוא מיועד לכל קבוצות התרגול. את התרגיל, יש להגיש דרך אתר הקורס ב MOODLE עד לתאריך XXXX בשעה 23:59.

זהו תרגיל מעשי ולכן על מנת לפתור תרגיל זה תצטרכו להשתמש בתוכנת MySql (הלינק להורדה והסבר על התוכנה ותפעולה מופיע באתר הקורס), אין להגיש תרגילים בכתב יד.

תרגיל זה מבוסס על החומר שנלמד בהרצאות ובתרגולים מתחילת הסמסטר.

ההגשה תתבצע ביחידים בלבד, פורמט ההגשה של התרגיל יהיה ב PDF או WORD.

על כל תרגיל יש לרשום את הפרטים הבאים: שם הסטודנט, תעודת זהות, מס' קבוצת התרגול (או שעת תרגול) - תרגיל שלא יכיל את 3 הפרטים הללו – לא ייבדק!

ההגשה צריכה לכלול את הפלטים הבאים:
- בניית מסד הנתונים: פקודות CREATE, INSERT, ו-SELECT לכל טבלה
- בניית שאילתא ב MySQL: הערה, פקודת SQL עובדת, ותוצאת השאילתא`;

    if (!exercise3SetId) {
      // Create new homework set
      const newSet = await createHomeworkSet({
        title: "תרגיל 3",
        courseId: "sql-course",
        dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        published: true,
        datasetPolicy: "shared",
        questionOrder: [],
        visibility: "published",
        createdBy: "admin",
        overview: overview,
        backgroundStory: backgroundStory,
      });
      exercise3SetId = newSet.id;
    } else {
      // Update existing homework set and ensure it's published
      await updateHomeworkSet(exercise3SetId, {
        overview: overview,
        backgroundStory: backgroundStory,
        published: true,
        visibility: "published",
      });
    }
    
    // Step 4: Delete existing questions and create new ones
    const existingQuestions = await getQuestionsByHomeworkSet(exercise3SetId);
    for (const question of existingQuestions) {
      await questionsService.deleteQuestion(question.id);
    }
    
    // Step 5: Create dataset for the exercise if it doesn't exist
    const datasetName = "תרגיל 3 - מסד נתונים מכללה";
    const allDatasets = await datasetService.listDatasets({ pageSize: 1000 });
    let exercise3Dataset = allDatasets.items.find(ds => ds.name === datasetName);
    
    if (!exercise3Dataset) {
      exercise3Dataset = await createDataset({
        name: datasetName,
        description: "מסד נתונים לניהול מערכת סטודנטים וקורסים במכללה",
        scenario: "מסד נתונים עם 4 טבלאות: Students, Courses, Lecturers, Enrollments",
        story: backgroundStory,
        connectionUri: "sandbox://datasets/exercise3-college",
        previewTables: [
          {
            name: "Students",
            columns: ["StudentID", "FirstName", "LastName", "BirthDate", "City", "Email"]
          },
          {
            name: "Courses",
            columns: ["CourseID", "CourseName", "Credits", "Department"]
          },
          {
            name: "Lecturers",
            columns: ["LecturerID", "FirstName", "LastName", "City", "HireDate", "CourseID", "Seniority"]
          },
          {
            name: "Enrollments",
            columns: ["StudentID", "CourseID", "EnrollmentDate", "Grade"]
          }
        ],
        tags: ["תרגיל 3", "מכללה", "סטודנטים", "קורסים"]
      });
    }
    
    // Step 6: Create all 10 questions
    const questions = [
      {
        prompt: "הציגו את כל ההרשמות לקורסים שהסטודנטים נרשמו אליהם בסמסטר האחרון (3 חודשים מתאריך הגשת התרגיל הנוכחי).",
        instructions: "(סכמה: תעודת זהות של הסטודנט, שם הסטודנט, קוד קורס, תאריך ההרשמה).",
        starterSql: "",
        expectedResultSchema: [
          { column: "תעודת זהות", type: "string" },
          { column: "שם הסטודנט", type: "string" },
          { column: "קוד קורס", type: "string" },
          { column: "תאריך ההרשמה", type: "date" }
        ],
        points: 10,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      {
        prompt: "הציגו את שם הסטודנט עם ממוצע הציונים הגבוה ביותר בכל הקורסים.",
        instructions: "(סכמה : תעודת זהות של הסטודנט, שם הסטודנט, ממוצע הציונים של הסטודנט).",
        starterSql: "",
        expectedResultSchema: [
          { column: "תעודת זהות", type: "string" },
          { column: "שם הסטודנט", type: "string" },
          { column: "ממוצע הציונים", type: "number" }
        ],
        points: 10,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      {
        prompt: "הציגו את רשימת הקורסים הנלמדים במחלקת 'מדעי המחשב' ומועברים על ידי מרצים בעלי ותק של לפחות 7 שנים.",
        instructions: "לכל קורס יש להציג את הסכמה: שם הקורס, שם המרצה, ותק המרצה, ומספר נקודות זכות. יש למיין את רשימת הקורסים לפי מספר נקודות זכות מהנמוך לגבוה.",
        starterSql: "",
        expectedResultSchema: [
          { column: "שם הקורס", type: "string" },
          { column: "שם המרצה", type: "string" },
          { column: "ותק המרצה", type: "number" },
          { column: "מספר נקודות זכות", type: "number" }
        ],
        points: 10,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      {
        prompt: "מה שם המחלקה בה מתקיים הקורס שקיבל את הציון הגבוה ביותר (מבין כלל הקורסים)?",
        instructions: "",
        starterSql: "",
        expectedResultSchema: [
          { column: "שם המחלקה", type: "string" }
        ],
        points: 10,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      {
        prompt: "הציגו את רשימת שמות המחלקות שבהן מועסקים לפחות שלושה מרצים עם ותק של מעל 12 שנים",
        instructions: "(סכמה: שם מחלקה, כמות מרצים העונים על התנאי).",
        starterSql: "",
        expectedResultSchema: [
          { column: "שם מחלקה", type: "string" },
          { column: "כמות מרצים", type: "number" }
        ],
        points: 10,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      {
        prompt: "מנהל המכללה מעוניין לדעת מה אחוז הסטודנטים שנרשמו לכל קורס מתחילת השנה מכלל הסטודנטים שנרשמו לקורסים.",
        instructions: "עליכם לבנות שאילתת SQL שתציג את אחוז הסטודנטים שנרשמו לכל קורס מתחילת השנה מתוך כלל ההרשמות לקורסים. (סכמה: קוד הקורס, שם הקורס, מספר הסטודנטים הרשומים בקורס, ואחוז הסטודנטים שנרשמו לקורס מתוך סך כל ההרשמות).",
        starterSql: "",
        expectedResultSchema: [
          { column: "קוד הקורס", type: "string" },
          { column: "שם הקורס", type: "string" },
          { column: "מספר הסטודנטים הרשומים בקורס", type: "number" },
          { column: "אחוז הסטודנטים", type: "number" }
        ],
        points: 10,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      {
        prompt: "עליכם לבדוק (על ידי פונקציה ייעודית) האם עיר המגורים של הסטודנט עם הציון הנמוך ביותר בקורס Database זהה לעיר המגורים של המרצה בעל הותק הגבוה ביותר.",
        instructions: "",
        starterSql: "",
        expectedResultSchema: [
          { column: "תוצאה", type: "string" }
        ],
        points: 10,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      {
        prompt: "הנהלת המכללה החליטה לקבל את ערעור הסטודנטים שלומדים במחלקת מדעי המחשב במבחן סיום בקורס Introduction to CS והעניקה לסטודנטים פקטור של 10% לציון המקורי לסטודנטים שנבחנו גם בקורס Introduction to CS וגם בקורס Calculus I בשל הקרבה של מועדי הבחינה.",
        instructions: "לאור כך עליכם להציג את רשימת כל הסטודנטים שלמדו קורסים במחלקת \"מדעי המחשב\" ונבחנו גם בקורס Calculus I, את תעודת זהות הסטודנט ואת הציון המעודכן. מיין את הרשימה לפי הציון המעודכן מהגבוה לנמוך, ולאחר מכן לפי שם המחלקה בסדר אלפביתי. (סכמה: תעודת זהות סטודנט, ציון מעודכן, מחלקה).",
        starterSql: "",
        expectedResultSchema: [
          { column: "תעודת זהות סטודנט", type: "string" },
          { column: "ציון מעודכן", type: "number" },
          { column: "מחלקה", type: "string" }
        ],
        points: 10,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      {
        prompt: "הציגו את רשימת הקורסים שכל מרצה מעביר. אם מרצה מסוים לא מעביר אף קורס, יהיה עליכם להציג את שם המרצה בלבד ופרטי הקורסים יישארו ריקים.",
        instructions: "מיינו את הרשימה לפי שם המרצה בסדר אלפביתי. (סכמה: שם המרצה, שם הקורס).",
        starterSql: "",
        expectedResultSchema: [
          { column: "שם המרצה", type: "string" },
          { column: "שם הקורס", type: "string" }
        ],
        points: 10,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      {
        prompt: "עדכנו את הציונים של כל הסטודנטים בקורס \"Calculus I\" כך שיתווסף להם פקטור של 6 נקודות וזאת רק עבור הסטודנטים בעלי ציון הנמוך מ-70.",
        instructions: "השתמשו בעדכון על פי הציון הקיים והקורסים המתאימים. (סכמה: תעודת הזהות של הסטודנט, שם הקורס, הציון הקודם, והציון החדש לאחר העדכון – בהנחה ועודכן).",
        starterSql: "",
        expectedResultSchema: [
          { column: "תעודת זהות", type: "string" },
          { column: "שם הקורס", type: "string" },
          { column: "ציון קודם", type: "number" },
          { column: "ציון חדש", type: "number" }
        ],
        points: 10,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
    ];

    const questionIds: string[] = [];

    // Create all questions
    for (const questionData of questions) {
      const question = await createQuestion({
        homeworkSetId: exercise3SetId,
        prompt: questionData.prompt,
        instructions: questionData.instructions,
        starterSql: questionData.starterSql,
        expectedResultSchema: questionData.expectedResultSchema,
        gradingRubric: [],
        maxAttempts: questionData.maxAttempts,
        points: questionData.points,
        evaluationMode: questionData.evaluationMode,
        datasetId: exercise3Dataset.id,
      });
      questionIds.push(question.id);
    }

    // Update homework set with question order and dataset
    await updateHomeworkSet(exercise3SetId, {
      questionOrder: questionIds,
      selectedDatasetId: exercise3Dataset.id,
    });

    return NextResponse.json({
      success: true,
      homeworkSetId: exercise3SetId,
      datasetId: exercise3Dataset.id,
      questionsCreated: questionIds.length,
      deletedHomeworkSets: allHomeworkSets.items.length - 1,
      message: "תרגיל 3 הוגדר בהצלחה עם כל השאלות והמסד נתונים",
    });
  } catch (error) {
    console.error("Error setting up Exercise 3:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to setup Exercise 3",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

