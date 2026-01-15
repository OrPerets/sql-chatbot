import { connectToDatabase } from '../lib/database';
import { getHomeworkService } from '../lib/homework';
import { getQuestionsService, updateQuestion } from '../lib/questions';

/**
 * Script to update Q1 in תרגיל בית 3
 * Updates the schema to use "שרשור שם פרטי ומשפחה של הסטודנט" instead of "שם הסטודנט"
 */
async function updateQ1() {
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

    // Find question 1 - about enrollments in the last semester
    const oldQuestionText = "הציגו את כל ההרשמות לקורסים שהסטודנטים נרשמו אליהם בסמסטר האחרון";
    const questionToUpdate = existingQuestions.find(q => 
      q.prompt && q.prompt.includes(oldQuestionText)
    );

    if (!questionToUpdate) {
      console.log('ℹ️  No question found with the expected text. Looking for question 1 by index...');
      
      // If questionOrder exists, use it
      const questionOrder = exercise3Set.questionOrder || [];
      let q1: typeof existingQuestions[0] | null = null;
      
      if (questionOrder.length >= 1) {
        const q1Id = questionOrder[0]; // Question 1 is at index 0
        q1 = existingQuestions.find(q => q.id === q1Id) || null;
      }
      
      if (!q1 && existingQuestions.length >= 1) {
        q1 = existingQuestions[0]; // Fallback to index
      }
      
      if (!q1) {
        console.log('\nExisting questions:');
        existingQuestions.forEach((q, i) => {
          console.log(`  ${i + 1}. ${q.prompt?.substring(0, 60)}...`);
        });
        console.error('❌ Could not find question 1');
        process.exit(1);
      }
      
      // Check if already updated (without parentheses)
      if (q1.instructions === "סכמה: תעודת זהות של הסטודנט, שרשור שם פרטי ומשפחה של הסטודנט, קוד קורס, תאריך ההרשמה") {
        console.log('✅ Question 1 has already been updated!');
        console.log(`   Current instructions: ${q1.instructions}`);
        process.exit(0);
      }
      
      console.log(`\n🔄 Found question 1 to update (ID: ${q1.id})`);
      console.log(`   Current prompt: ${q1.prompt?.substring(0, 80)}...`);
      console.log(`   Current instructions: ${q1.instructions}`);
      
      await doUpdate(q1.id);
      process.exit(0);
    }

    // Check if already updated (without parentheses)
    if (questionToUpdate.instructions === "סכמה: תעודת זהות של הסטודנט, שרשור שם פרטי ומשפחה של הסטודנט, קוד קורס, תאריך ההרשמה") {
      console.log('✅ Question 1 has already been updated!');
      console.log(`   Current instructions: ${questionToUpdate.instructions}`);
      process.exit(0);
    }

    console.log(`\n🔄 Found question to update (ID: ${questionToUpdate.id})`);
    console.log(`   Current prompt: ${questionToUpdate.prompt?.substring(0, 80)}...`);
    console.log(`   Current instructions: ${questionToUpdate.instructions}`);

    await doUpdate(questionToUpdate.id);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating Q1:', error);
    process.exit(1);
  }
}

async function doUpdate(questionId: string) {
  // New question data - updated schema
  const newQuestionData = {
    instructions: "סכמה: תעודת זהות של הסטודנט, שרשור שם פרטי ומשפחה של הסטודנט, קוד קורס, תאריך ההרשמה",
    expectedResultSchema: [
      { column: "תעודת זהות", type: "string" },
      { column: "שרשור שם פרטי ומשפחה של הסטודנט", type: "string" },
      { column: "קוד קורס", type: "string" },
      { column: "תאריך ההרשמה", type: "date" }
    ],
  };

  // Update the question
  const updated = await updateQuestion(questionId, newQuestionData);

  if (updated) {
    console.log(`\n✅ Successfully updated question 1!`);
    console.log(`   New instructions: ${updated.instructions}`);
  } else {
    console.error(`❌ Failed to update question`);
    process.exit(1);
  }
}

// Run the script
updateQ1();
