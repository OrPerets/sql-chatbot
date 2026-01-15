import { connectToDatabase } from '../lib/database';
import { getHomeworkService } from '../lib/homework';
import { getQuestionsService, updateQuestion } from '../lib/questions';

/**
 * Script to fix Q13 (or Q12) in תרגיל בית 3
 * Finds the question with the old "הנהלת המכללה מעוניינת לקטלג..." text
 * and replaces it with the new question requiring sub-queries + joins
 */
async function fixQ13() {
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
    const oldQuestionText = "הנהלת המכללה מעוניינת לקטלג";
    const questionToUpdate = existingQuestions.find(q => 
      q.prompt && q.prompt.includes(oldQuestionText)
    );

    if (!questionToUpdate) {
      console.log('ℹ️  No question found with the old text. It may have already been updated.');
      process.exit(0);
    }

    console.log(`\n🔄 Found question to update (ID: ${questionToUpdate.id})`);
    console.log(`   Current prompt: ${questionToUpdate.prompt.substring(0, 80)}...`);

    // New question data
    const newQuestionData = {
      prompt: "הציגו את כל הסטודנטים שנרשמו לקורסים במחלקת 'מדעי המחשב' וגם לקורסים במחלקת 'מערכות מידע', יחד עם ממוצע הציונים שלהם בכל אחת מהמחלקות. הציגו רק סטודנטים שקיבלו ציון גבוה מהממוצע הכולל של הקורסים במחלקת 'מדעי המחשב'.",
      instructions: "(סכמה: תעודת זהות, שם סטודנט, ממוצע ציונים במדעי המחשב, ממוצע ציונים במערכות מידע).",
      expectedResultSchema: [
        { column: "תעודת זהות", type: "string" },
        { column: "שם סטודנט", type: "string" },
        { column: "ממוצע ציונים במדעי המחשב", type: "number" },
        { column: "ממוצע ציונים במערכות מידע", type: "number" }
      ],
    };

    // Update the question
    const updated = await updateQuestion(questionToUpdate.id, newQuestionData);

    if (updated) {
      console.log(`✅ Successfully updated question!`);
      console.log(`   New prompt: ${updated.prompt.substring(0, 80)}...`);
      console.log(`   New instructions: ${updated.instructions}`);
    } else {
      console.error(`❌ Failed to update question`);
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing Q13:', error);
    process.exit(1);
  }
}

// Run the script
fixQ13();
