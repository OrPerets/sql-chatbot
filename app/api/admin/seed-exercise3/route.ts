import { NextResponse } from "next/server";
import { createHomeworkSet, updateHomeworkSet, getHomeworkService } from "@/lib/homework";
import { createQuestion, getQuestionsByHomeworkSet, getQuestionsService } from "@/lib/questions";

export async function POST() {
  try {
    // Check if homework set "תרגיל 3" already exists
    const homeworkService = await getHomeworkService();
    const allHomeworkSets = await homeworkService.listHomeworkSets({ pageSize: 1000 });
    
    let homeworkSet = allHomeworkSets.items.find(hw => hw.title === "תרגיל 3");
    
    if (!homeworkSet) {
      // Create homework set for Exercise 3 if it doesn't exist
      const createdHomeworkSet = await createHomeworkSet({
        title: "תרגיל 3",
        courseId: "sql-course",
        dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        published: false,
        datasetPolicy: "shared",
        questionOrder: [],
        visibility: "draft",
        createdBy: "admin",
        overview: "תרגיל 3 - שאלות SQL מתקדמות",
        backgroundStory: "תרגיל זה כולל שאלות SQL מתקדמות על מסד נתונים של מכללה",
      });
      // Add missing properties to match HomeworkSummary type
      homeworkSet = {
        ...createdHomeworkSet,
        draftQuestionCount: 0,
        submissionCount: 0,
      };
    } else {
      // If homework set exists, get existing questions and delete them
      const existingQuestions = await getQuestionsByHomeworkSet(homeworkSet.id);
      const questionsService = await getQuestionsService();
      
      // Delete existing questions
      for (const question of existingQuestions) {
        await questionsService.deleteQuestion(question.id);
      }
    }

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
        instructions: "לאור כך עליכם להציג את רשימת כל הסטודנטים שלמדו קורסים במחלקת 'מדעי המחשב' ונבחנו גם בקורס Calculus I, את תעודת זהות הסטודנט ואת הציון המעודכן. מיין את הרשימה לפי הציון המעודכן מהגבוה לנמוך, ולאחר מכן לפי שם המחלקה בסדר אלפביתי. (סכמה: תעודת זהות סטודנט, ציון מעודכן, מחלקה).",
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
        prompt: "עדכנו את הציונים של כל הסטודנטים בקורס 'Calculus I' כך שיתווסף להם פקטור של 6 נקודות וזאת רק עבור הסטודנטים בעלי ציון הנמוך מ-70.",
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
      {
        prompt: "הציגו את רשימת הסטודנטים שגרים באותה עיר כמו המרצה של הקורס שבו הם נרשמו.",
        instructions: "עליכם להציג את תעודת הזהות של הסטודנט, שם הסטודנט, עיר המגורים, שם הקורס, ושם המרצה. מיינו את הרשימה לפי שם הסטודנט בסדר אלפביתי. (סכמה: תעודת זהות, שם סטודנט, עיר מגורים, שם קורס, שם מרצה).",
        starterSql: "",
        expectedResultSchema: [
          { column: "תעודת זהות", type: "string" },
          { column: "שם סטודנט", type: "string" },
          { column: "עיר מגורים", type: "string" },
          { column: "שם קורס", type: "string" },
          { column: "שם מרצה", type: "string" }
        ],
        points: 10,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      {
        prompt: "הנהלת המכללה מעוניינת לקטלג את הסטודנטים לפי טווחי ציונים. הציגו את כל הסטודנטים עם קטגוריזציה של הציונים שלהם: 'מצוין' (90-100), 'טוב מאוד' (80-89), 'טוב' (70-79), 'מספיק' (60-69), 'לא מספיק' (מתחת ל-60).",
        instructions: "עליכם להציג את תעודת הזהות של הסטודנט, שם הסטודנט, ממוצע הציונים, וקטגוריית הציון. מיינו את הרשימה לפי ממוצע הציונים מהגבוה לנמוך. (סכמה: תעודת זהות, שם סטודנט, ממוצע ציונים, קטגוריית ציון).",
        starterSql: "",
        expectedResultSchema: [
          { column: "תעודת זהות", type: "string" },
          { column: "שם סטודנט", type: "string" },
          { column: "ממוצע ציונים", type: "number" },
          { column: "קטגוריית ציון", type: "string" }
        ],
        points: 10,
        maxAttempts: 3,
        evaluationMode: "auto" as const,
      },
      {
        prompt: "הציגו את שלושת הקורסים עם הממוצע הגבוה ביותר של ציונים. אם יש קשרים, הציגו את כל הקורסים עם אותו ממוצע.",
        instructions: "עליכם להציג את קוד הקורס, שם הקורס, ממוצע הציונים, ומספר הסטודנטים שנרשמו לקורס. מיינו את הרשימה לפי ממוצע הציונים מהגבוה לנמוך. (סכמה: קוד קורס, שם קורס, ממוצע ציונים, מספר סטודנטים).",
        starterSql: "",
        expectedResultSchema: [
          { column: "קוד קורס", type: "string" },
          { column: "שם קורס", type: "string" },
          { column: "ממוצע ציונים", type: "number" },
          { column: "מספר סטודנטים", type: "number" }
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
        homeworkSetId: homeworkSet.id,
        prompt: questionData.prompt,
        instructions: questionData.instructions,
        starterSql: questionData.starterSql,
        expectedResultSchema: questionData.expectedResultSchema,
        gradingRubric: [],
        maxAttempts: questionData.maxAttempts,
        points: questionData.points,
        evaluationMode: questionData.evaluationMode,
      });
      questionIds.push(question.id);
    }

    // Update homework set with question order
    await updateHomeworkSet(homeworkSet.id, {
      questionOrder: questionIds,
    });

    return NextResponse.json({
      success: true,
      homeworkSetId: homeworkSet.id,
      questionsCreated: questionIds.length,
      message: "תרגיל 3 נוצר בהצלחה עם 13 שאלות",
    });
  } catch (error) {
    console.error("Error seeding Exercise 3:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create Exercise 3",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
