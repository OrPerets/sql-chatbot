import { connectToDatabase } from '../lib/database';
import { getHomeworkService } from '../lib/homework';
import { getQuestionsService, updateQuestion } from '../lib/questions';

/**
 * Script to update Q13 in תרגיל בית 3
 * Updates the question about top 3 courses with highest average grades
 */
async function updateQ13() {
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
    console.log(`📋 Found ${existingQuestions.length} existing questions`);

    // Find the question with the old text
    const oldQuestionText = "הציגו את שלושת הקורסים עם הממוצע הגבוה";
    const questionToUpdate = existingQuestions.find(q => 
      q.prompt && q.prompt.includes(oldQuestionText)
    );

    if (!questionToUpdate) {
      console.log('ℹ️  No question found with the text "הציגו את שלושת הקורסים...". It may have already been updated or doesn\'t exist.');
      console.log('\nExisting questions:');
      existingQuestions.forEach((q, i) => {
        console.log(`  ${i + 1}. ${q.prompt?.substring(0, 60)}...`);
      });
      process.exit(0);
    }

    console.log(`\n🔄 Found question to update (ID: ${questionToUpdate.id})`);
    console.log(`   Current prompt: ${questionToUpdate.prompt.substring(0, 80)}...`);

    // New question data
    const newQuestionData = {
      prompt: "הציגו את שלושת הקורסים עם הממוצע הגבוה ביותר של ציונים, עליכם להציג את קוד הקורס, שם הקורס, ממוצע הציונים בקורס וכמות הסטודנטים שנרשמו לקורס. יש למיין את הרשימה לפי ממוצע הציונים מהגבוה לנמוך.",
      instructions: "סכמה נדרשת: קוד הקורס, שם הקורס, ממוצע הציונים בקורס וכמות הסטודנטים",
      expectedResultSchema: [
        { column: "קוד הקורס", type: "string" },
        { column: "שם הקורס", type: "string" },
        { column: "ממוצע הציונים בקורס", type: "number" },
        { column: "כמות הסטודנטים", type: "number" }
      ],
    };

    // Update the question
    const updated = await updateQuestion(questionToUpdate.id, newQuestionData);

    if (updated) {
      console.log(`\n✅ Successfully updated question 13!`);
      console.log(`   New prompt: ${updated.prompt}`);
      console.log(`   New instructions: ${updated.instructions}`);
    } else {
      console.error(`❌ Failed to update question`);
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating Q13:', error);
    process.exit(1);
  }
}

// Run the script
updateQ13();
