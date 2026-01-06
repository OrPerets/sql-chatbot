import { connectToDatabase } from '../lib/database';
import { getHomeworkService } from '../lib/homework';
import { getQuestionsService, updateQuestion } from '../lib/questions';

/**
 * Script to update all questions in תרגיל בית 3
 * Fixes text refinements: questions should be in bold (prompt) and only schema in sub-header (instructions)
 */
async function updateAllQuestions() {
  try {
    const { db } = await connectToDatabase();
    const homeworkService = await getHomeworkService();
    const questionsService = await getQuestionsService();

    // Find the homework set "תרגיל 3" or "תרגיל בית 3"
    const allHomeworkSets = await homeworkService.listHomeworkSets({ pageSize: 1000 });
    const exercise3Set = allHomeworkSets.items.find(hw => hw.title === "תרגיל 3" || hw.title === "תרגיל בית 3");

    if (!exercise3Set) {
      console.error('❌ Homework set "תרגיל 3" or "תרגיל בית 3" not found');
      process.exit(1);
    }

    console.log(`✅ Found homework set: ${exercise3Set.title} (ID: ${exercise3Set.id})`);

    // Get all questions for this homework set
    const existingQuestions = await questionsService.getQuestionsByHomeworkSet(exercise3Set.id);
    console.log(`📋 Found ${existingQuestions.length} existing questions\n`);

    // Sort questions by their order in the homework set
    const questionOrder = exercise3Set.questionOrder || [];
    const sortedQuestions = [...existingQuestions].sort((a, b) => {
      const indexA = questionOrder.indexOf(a.id);
      const indexB = questionOrder.indexOf(b.id);
      return indexA - indexB;
    });

    // Define all question updates
    const questionUpdates = [
      // Q1: Change "3 חודשים" to "14 שבועות"
      {
        index: 0,
        searchText: "הרשמות לקורסים",
        prompt: "הציגו את כל ההרשמות לקורסים שהסטודנטים נרשמו אליהם בסמסטר האחרון (14 שבועות מתאריך הגשת התרגיל הנוכחי).",
        instructions: "סכמה: תעודת זהות של הסטודנט, שם הסטודנט, קוד קורס, תאריך ההרשמה",
      },
      // Q2: Add LIMIT/TOP restriction
      {
        index: 1,
        searchText: "ממוצע הציונים הגבוה ביותר",
        prompt: "הציגו את פרטי הסטודנט עם ממוצע הציונים הגבוה ביותר בכל הקורסים. בשאלה זו אין להשתמש ב-LIMIT / TOP.",
        instructions: "סכמה: תעודת זהות של הסטודנט, שם הסטודנט, ממוצע הציונים של הסטודנט",
      },
      // Q3: Move sorting instruction to prompt
      {
        index: 2,
        searchText: "מחלקת 'מדעי המחשב'",
        prompt: "הציגו את רשימת הקורסים הנלמדים במחלקת 'מדעי המחשב' ומועברים על ידי מרצים בעלי ותק של לפחות 7 שנים. יש למיין את רשימת הקורסים לפי מספר נקודות זכות מהנמוך לגבוה.",
        instructions: "סכמה: שם הקורס, שם המרצה, ותק המרצה, מספר נקודות זכות",
      },
      // Q4: Keep as is (no changes needed)
      // Q5: Update text for "מרצים שונים"
      {
        index: 4,
        searchText: "שמות המחלקות שבהן מועסקים",
        prompt: "הציגו את רשימת שמות המחלקות שבהן מועסקים לפחות שלושה מרצים שונים עם ותק של מעל 12 שנים.",
        instructions: "סכמה: שם מחלקה, כמות מרצים העונים על התנאי",
      },
      // Q6: Move SQL instruction to prompt, keep only schema in instructions
      {
        index: 5,
        searchText: "אחוז הסטודנטים",
        prompt: "מנהל המכללה מעוניין לדעת מה אחוז הסטודנטים שנרשמו לכל קורס מתחילת השנה מכלל הסטודנטים שנרשמו לקורסים. עליכם לבנות שאילתת SQL שתציג את אחוז הסטודנטים שנרשמו לכל קורס מתחילת השנה מתוך כלל ההרשמות לקורסים.",
        instructions: "סכמה: קוד הקורס, שם הקורס, מספר הסטודנטים הרשומים בקורס, אחוז הסטודנטים שנרשמו לקורס מתוך סך כל ההרשמות",
      },
      // Q7: Keep as is (no changes needed)
      // Q8: Keep only schema in sub-header
      {
        index: 7,
        searchText: "פקטור של 10%",
        prompt: "הנהלת המכללה החליטה לקבל את ערעור הסטודנטים שלומדים במחלקת מדעי המחשב במבחן סיום בקורס Introduction to CS והעניקה לסטודנטים פקטור של 10% לציון המקורי לסטודנטים שנבחנו גם בקורס Introduction to CS וגם בקורס Calculus I בשל הקרבה של מועדי הבחינה. לאור כך עליכם להציג את רשימת כל הסטודנטים שלמדו קורסים במחלקת \"מדעי המחשב\" ונבחנו גם בקורס Calculus I, את תעודת זהות הסטודנט ואת הציון המעודכן. מיינו את הרשימה לפי הציון לאחר הפקטור מהגבוה לנמוך, ולאחר מכן לפי שם המחלקה בסדר אלפביתי.",
        instructions: "סכמה: תעודת זהות סטודנט, ציון מעודכן, מחלקה",
      },
      // Q9: Move everything to prompt, keep only schema in instructions
      {
        index: 8,
        searchText: "רשימת הקורסים שכל מרצה מעביר",
        prompt: "הציגו את רשימת הקורסים שכל מרצה מעביר. אם מרצה מסוים לא מעביר אף קורס, יהיה עליכם להציג את שם המרצה בלבד ופרטי הקורסים יישארו ריקים. מיינו את הרשימה לפי שם המרצה בסדר אלפביתי.",
        instructions: "סכמה: שם המרצה, שם הקורס",
      },
      // Q10: Split into 2 parts with א. and ב.
      {
        index: 9,
        searchText: "עדכנו את הציונים",
        prompt: "א. עדכנו את הציונים של כל הסטודנטים בקורס \"Calculus I\" כך שיתווסף להם פקטור של 6 נקודות וזאת רק עבור הסטודנטים בעלי ציון הנמוך מ-70.\nב. לאחר מכן, הציגו את תעודת הזהות של הסטודנט, שם הקורס, הציון הקודם, והציון החדש לאחר העדכון – בהנחה ועודכן.",
        instructions: "סכמה: תעודת הזהות של הסטודנט, שם הקורס, הציון הקודם, הציון החדש לאחר העדכון",
      },
      // Q11: Remove redundant text about displaying and sorting
      {
        index: 10,
        searchText: "גרים באותה עיר כמו המרצה",
        prompt: "הציגו את רשימת הסטודנטים שגרים באותה עיר כמו המרצה של הקורס שבו הם נרשמו.",
        instructions: "סכמה: תעודת זהות, שם סטודנט, עיר מגורים, שם קורס, שם מרצה",
      },
      // Q12: Update with new text and simplified schema
      {
        index: 11,
        searchText: "מחלקת 'מדעי המחשב' וגם לקורסים",
        prompt: "הציגו את הסטודנטים שנרשמו לקורסים במחלקת 'מדעי המחשב', יחד עם ממוצע הציונים שלהם. הציגו רק סטודנטים שקיבלו ציון גבוה מהממוצע הכולל של הקורסים במחלקה.",
        instructions: "סכמה: תעודת זהות, שם סטודנט, ממוצע ציונים",
        expectedResultSchema: [
          { column: "תעודת זהות", type: "string" },
          { column: "שם סטודנט", type: "string" },
          { column: "ממוצע ציונים", type: "number" }
        ],
      },
      // Q13: Already updated but verify
      {
        index: 12,
        searchText: "שלושת הקורסים עם הממוצע הגבוה",
        prompt: "הציגו את שלושת הקורסים עם הממוצע הגבוה ביותר של ציונים, עליכם להציג את קוד הקורס, שם הקורס, ממוצע הציונים בקורס וכמות הסטודנטים שנרשמו לקורס. יש למיין את הרשימה לפי ממוצע הציונים מהגבוה לנמוך.",
        instructions: "סכמה: קוד הקורס, שם הקורס, ממוצע הציונים בקורס, כמות הסטודנטים",
        expectedResultSchema: [
          { column: "קוד הקורס", type: "string" },
          { column: "שם הקורס", type: "string" },
          { column: "ממוצע הציונים בקורס", type: "number" },
          { column: "כמות הסטודנטים", type: "number" }
        ],
      },
    ];

    // Process each update
    for (const update of questionUpdates) {
      const question = sortedQuestions[update.index];
      
      if (!question) {
        console.log(`⚠️  Question ${update.index + 1} not found at expected index`);
        continue;
      }

      // Verify we have the right question
      if (!question.prompt?.includes(update.searchText)) {
        console.log(`⚠️  Question ${update.index + 1} doesn't match expected text "${update.searchText}"`);
        console.log(`   Found: "${question.prompt?.substring(0, 50)}..."`);
        continue;
      }

      console.log(`🔄 Updating Question ${update.index + 1}...`);
      console.log(`   Before: ${question.prompt.substring(0, 60)}...`);

      const updateData: any = {
        prompt: update.prompt,
        instructions: update.instructions,
      };

      if (update.expectedResultSchema) {
        updateData.expectedResultSchema = update.expectedResultSchema;
      }

      const updated = await updateQuestion(question.id, updateData);

      if (updated) {
        console.log(`   ✅ Updated: ${updated.prompt.substring(0, 60)}...`);
        console.log(`   Instructions: ${updated.instructions}\n`);
      } else {
        console.log(`   ❌ Failed to update question ${update.index + 1}\n`);
      }
    }

    console.log('\n✅ All question updates complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating questions:', error);
    process.exit(1);
  }
}

// Run the script
updateAllQuestions();
