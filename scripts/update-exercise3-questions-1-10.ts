import { connectToDatabase } from '../lib/database';
import { getHomeworkService } from '../lib/homework';
import { getQuestionsService, updateQuestion } from '../lib/questions';

/**
 * Script to update the first 10 questions of תרגיל בית 3
 * Questions 11-13 will remain unchanged
 */

// New questions data - only the first 10
const updatedQuestions = [
  {
    prompt: "הציגו את כל ההרשמות לקורסים שהסטודנטים נרשמו אליהם בסמסטר האחרון (3 חודשים מתאריך הגשת התרגיל הנוכחי).",
    instructions: "יש להציג את הסכמה: תעודת זהות של הסטודנט, שם הסטודנט, קוד קורס, תאריך ההרשמה.",
    expectedResultSchema: [
      { column: "תעודת זהות", type: "string" },
      { column: "שם הסטודנט", type: "string" },
      { column: "קוד קורס", type: "string" },
      { column: "תאריך ההרשמה", type: "date" }
    ],
  },
  {
    prompt: "הציגו את שם הסטודנט עם ממוצע הציונים הגבוה ביותר בכל הקורסים.",
    instructions: "יש להציג את הסכמה : תעודת זהות של הסטודנט, שם הסטודנט, ממוצע הציונים של הסטודנט.",
    expectedResultSchema: [
      { column: "תעודת זהות", type: "string" },
      { column: "שם הסטודנט", type: "string" },
      { column: "ממוצע הציונים", type: "number" }
    ],
  },
  {
    prompt: "הציגו את רשימת הקורסים הנלמדים במחלקת 'מדעי המחשב' ומועברים על ידי מרצים בעלי ותק של לפחות 7 שנים.",
    instructions: "לכל קורס יש להציג את הסכמה: שם הקורס, שם המרצה, ותק המרצה, ומספר נקודות זכות. יש למיין את רשימת הקורסים לפי מספר נקודות זכות מהנמוך לגבוה.",
    expectedResultSchema: [
      { column: "שם הקורס", type: "string" },
      { column: "שם המרצה", type: "string" },
      { column: "ותק המרצה", type: "number" },
      { column: "מספר נקודות זכות", type: "number" }
    ],
  },
  {
    prompt: "מה שם המחלקה בה מתקיים הקורס שקיבל את הציון הגבוה ביותר (מבין כלל הקורסים)?",
    instructions: "",
    expectedResultSchema: [
      { column: "שם המחלקה", type: "string" }
    ],
  },
  {
    prompt: "הציגו את רשימת שמות המחלקות שבהן מועסקים לפחות שלושה מרצים עם ותק של מעל 12 שנים.",
    instructions: "יש להציג את הסכמה: שם מחלקה, כמות מרצים העונים על התנאי.",
    expectedResultSchema: [
      { column: "שם מחלקה", type: "string" },
      { column: "כמות מרצים", type: "number" }
    ],
  },
  {
    prompt: "מנהל המכללה מעוניין לדעת מה אחוז הסטודנטים שנרשמו לכל קורס מתחילת השנה מכלל הסטודנטים שנרשמו לקורסים. עליכם לבנות שאילתת SQL שתציג את אחוז הסטודנטים שנרשמו לכל קורס מתחילת השנה מתוך כלל ההרשמות לקורסים.",
    instructions: "יש להציג את הסכמה: קוד הקורס, שם הקורס, מספר הסטודנטים הרשומים בקורס, ואחוז הסטודנטים שנרשמו לקורס מתוך סך כל ההרשמות.",
    expectedResultSchema: [
      { column: "קוד הקורס", type: "string" },
      { column: "שם הקורס", type: "string" },
      { column: "מספר הסטודנטים הרשומים בקורס", type: "number" },
      { column: "אחוז הסטודנטים", type: "number" }
    ],
  },
  {
    prompt: "עליכם לבדוק (על ידי פונקציה ייעודית) האם עיר המגורים של הסטודנט עם הציון הנמוך ביותר בקורס Database זהה לעיר המגורים של המרצה בעל הותק הגבוה ביותר.",
    instructions: "",
    expectedResultSchema: [
      { column: "תוצאה", type: "string" }
    ],
  },
  {
    prompt: "הנהלת המכללה החליטה לקבל את ערעור הסטודנטים שלומדים במחלקת מדעי המחשב במבחן סיום בקורס Introduction to CS והעניקה לסטודנטים פקטור של 10% לציון המקורי לסטודנטים שנבחנו גם בקורס Introduction to CS וגם בקורס Calculus I בשל הקרבה של מועדי הבחינה. לאור כך עליכם להציג את רשימת כל הסטודנטים שלמדו קורסים במחלקת \"מדעי המחשב\" ונבחנו גם בקורס Calculus I, את תעודת זהות הסטודנט ואת הציון המעודכן. מיין את הרשימה לפי הציון המעודכן מהגבוה לנמוך, ולאחר מכן לפי שם המחלקה בסדר אלפביתי.",
    instructions: "יש להציג את הסכמה: תעודת זהות סטודנט, ציון מעודכן, מחלקה.",
    expectedResultSchema: [
      { column: "תעודת זהות סטודנט", type: "string" },
      { column: "ציון מעודכן", type: "number" },
      { column: "מחלקה", type: "string" }
    ],
  },
  {
    prompt: "הציגו את רשימת הקורסים שכל מרצה מעביר. אם מרצה מסוים לא מעביר אף קורס, יהיה עליכם להציג את שם המרצה בלבד ופרטי הקורסים יישארו ריקים.",
    instructions: "מיינו את הרשימה לפי שם המרצה בסדר אלפביתי. יש להציג את הסכמה: שם המרצה, שם הקורס.",
    expectedResultSchema: [
      { column: "שם המרצה", type: "string" },
      { column: "שם הקורס", type: "string" }
    ],
  },
  {
    prompt: "עדכנו את הציונים של כל הסטודנטים בקורס \"Calculus I\" כך שיתווסף להם פקטור של 6 נקודות וזאת רק עבור הסטודנטים בעלי ציון הנמוך מ-70. השתמשו בעדכון על פי הציון הקיים והקורסים המתאימים.",
    instructions: "יש להציג את הסכמה: תעודת הזהות של הסטודנט, שם הקורס, הציון הקודם, והציון החדש לאחר העדכון – בהנחה ועודכן.",
    expectedResultSchema: [
      { column: "תעודת זהות", type: "string" },
      { column: "שם הקורס", type: "string" },
      { column: "ציון קודם", type: "number" },
      { column: "ציון חדש", type: "number" }
    ],
  },
];

async function updateQuestions() {
  try {
    const { db } = await connectToDatabase();
    const homeworkService = await getHomeworkService();
    const questionsService = await getQuestionsService();

    // Find the homework set "תרגיל בית 3" or "תרגיל 3"
    const allHomeworkSets = await homeworkService.listHomeworkSets({ pageSize: 1000 });
    const exercise3Set = allHomeworkSets.items.find(hw => hw.title === "תרגיל 3" || hw.title === "תרגיל בית 3");

    if (!exercise3Set) {
      console.error('❌ Homework set "תרגיל 3" or "תרגיל בית 3" not found');
      process.exit(1);
    }

    console.log(`✅ Found homework set: ${exercise3Set.title} (ID: ${exercise3Set.id})`);

    // Get existing questions (should be 13)
    const existingQuestions = await questionsService.getQuestionsByHomeworkSet(exercise3Set.id);
    console.log(`📋 Found ${existingQuestions.length} existing questions`);

    if (existingQuestions.length < 10) {
      console.error(`❌ Expected at least 10 questions, but found only ${existingQuestions.length}`);
      process.exit(1);
    }

    if (updatedQuestions.length !== 10) {
      console.error(`❌ Expected 10 updated questions, but provided ${updatedQuestions.length}`);
      process.exit(1);
    }

    // Update the first 10 questions
    for (let i = 0; i < 10; i++) {
      const question = existingQuestions[i];
      const updatedData = updatedQuestions[i];

      if (!question) {
        console.error(`❌ Question ${i + 1} not found`);
        continue;
      }

      if (!updatedData) {
        console.error(`❌ Update data for question ${i + 1} not provided`);
        continue;
      }

      console.log(`\n🔄 Updating question ${i + 1} (ID: ${question.id})...`);
      console.log(`   Old prompt: ${question.prompt.substring(0, 50)}...`);
      console.log(`   New prompt: ${updatedData.prompt.substring(0, 50)}...`);

      const updated = await updateQuestion(question.id, {
        prompt: updatedData.prompt,
        instructions: updatedData.instructions,
        expectedResultSchema: updatedData.expectedResultSchema,
      });

      if (updated) {
        console.log(`✅ Successfully updated question ${i + 1}`);
      } else {
        console.error(`❌ Failed to update question ${i + 1}`);
      }
    }

    console.log(`\n✅ Successfully updated questions 1-10 of ${exercise3Set.title}`);
    console.log(`📋 Questions 11-13 remain unchanged`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating questions:', error);
    process.exit(1);
  }
}

// Run the script
updateQuestions();
