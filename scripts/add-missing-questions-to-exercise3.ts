import { connectToDatabase, COLLECTIONS } from '../lib/database';
import { getHomeworkService } from '../lib/homework';
import { getQuestionsService, createQuestion } from '../lib/questions';
import { getDatasetService } from '../lib/datasets';

/**
 * Script to add the 3 missing questions to תרגיל 3
 * This adds questions 11, 12, and 13 without deleting existing questions
 */
async function addMissingQuestions() {
  try {
    const { db } = await connectToDatabase();
    const homeworkService = await getHomeworkService();
    const questionsService = await getQuestionsService();
    const datasetService = await getDatasetService();

    // Find the homework set "תרגיל 3"
    const allHomeworkSets = await homeworkService.listHomeworkSets({ pageSize: 1000 });
    const exercise3Set = allHomeworkSets.items.find(hw => hw.title === "תרגיל 3" || hw.title === "תרגיל בית 3");

    if (!exercise3Set) {
      console.error('❌ Homework set "תרגיל 3" not found');
      process.exit(1);
    }

    console.log(`✅ Found homework set: ${exercise3Set.title} (ID: ${exercise3Set.id})`);

    // Get existing questions
    const existingQuestions = await questionsService.getQuestionsByHomeworkSet(exercise3Set.id);
    console.log(`📋 Found ${existingQuestions.length} existing questions`);

    // Get the dataset for this homework set
    const datasetId = exercise3Set.selectedDatasetId;
    if (!datasetId) {
      console.error('❌ No dataset found for this homework set');
      process.exit(1);
    }
    console.log(`📊 Using dataset ID: ${datasetId}`);

    // The 3 new questions to add
    const newQuestions = [
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

    // Create the new questions
    const newQuestionIds: string[] = [];
    for (let i = 0; i < newQuestions.length; i++) {
      const questionData = newQuestions[i]!;
      console.log(`\n➕ Creating question ${existingQuestions.length + i + 1}...`);
      
      const question = await createQuestion({
        homeworkSetId: exercise3Set.id,
        prompt: questionData.prompt,
        instructions: questionData.instructions,
        starterSql: questionData.starterSql,
        expectedResultSchema: questionData.expectedResultSchema,
        gradingRubric: [],
        maxAttempts: questionData.maxAttempts,
        points: questionData.points,
        evaluationMode: questionData.evaluationMode,
        datasetId: datasetId,
      });
      
      newQuestionIds.push(question.id);
      console.log(`✅ Created question ${existingQuestions.length + i + 1} (ID: ${question.id})`);
    }

    // Update questionOrder to include the new questions
    const existingQuestionIds = existingQuestions.map(q => q.id);
    const updatedQuestionOrder = [...existingQuestionIds, ...newQuestionIds];
    
    await homeworkService.updateHomeworkSet(exercise3Set.id, {
      questionOrder: updatedQuestionOrder,
    });

    console.log(`\n✅ Successfully added ${newQuestions.length} questions to תרגיל 3`);
    console.log(`📊 Total questions now: ${updatedQuestionOrder.length}`);
    console.log(`📝 Question IDs: ${updatedQuestionOrder.join(', ')}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding questions:', error);
    process.exit(1);
  }
}

// Run the script
addMissingQuestions();

