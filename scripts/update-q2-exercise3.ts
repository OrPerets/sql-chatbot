import { connectToDatabase } from '../lib/database';
import { getHomeworkService } from '../lib/homework';
import { getQuestionsService, updateQuestion } from '../lib/questions';

/**
 * Script to update Q2 in תרגיל בית 3
 * Updates the prompt and schema for question 2
 */
async function updateQ2() {
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

    // Find question 2 by index
    const questionOrder = exercise3Set.questionOrder || [];
    let q2: typeof existingQuestions[0] | null = null;
    
    if (questionOrder.length >= 2) {
      const q2Id = questionOrder[1]; // Question 2 is at index 1
      q2 = existingQuestions.find(q => q.id === q2Id) || null;
    }
    
    if (!q2 && existingQuestions.length >= 2) {
      q2 = existingQuestions[1]; // Fallback to index
    }
    
    if (!q2) {
      console.log('\nExisting questions:');
      existingQuestions.forEach((q, i) => {
        console.log(`  ${i + 1}. ${q.prompt?.substring(0, 60)}...`);
      });
      console.error('❌ Could not find question 2');
      process.exit(1);
    }

    // New question data
    const newPrompt = "עליכם למצוא עבור כל סטודנט את ממוצע הציונים שלו ולאחר מכן עליכם להציג את הסטודנט עם הממוצע הגבוה ביותר. בשאלה זו אין להשתמש ב LIMIT/TOP.";
    const newInstructions = "סכמה: תעודת זהות של הסטודנט, שם הסטודנט, ממוצע הציונים של הסטודנט";

    // Check if already updated
    if (q2.prompt === newPrompt && q2.instructions === newInstructions) {
      console.log('✅ Question 2 has already been updated!');
      console.log(`   Current prompt: ${q2.prompt}`);
      console.log(`   Current instructions: ${q2.instructions}`);
      process.exit(0);
    }
    
    console.log(`\n🔄 Found question 2 to update (ID: ${q2.id})`);
    console.log(`   Current prompt: ${q2.prompt?.substring(0, 80)}...`);
    console.log(`   Current instructions: ${q2.instructions}`);

    // Update the question
    const newQuestionData = {
      prompt: newPrompt,
      instructions: newInstructions,
      expectedResultSchema: [
        { column: "תעודת זהות של הסטודנט", type: "string" },
        { column: "שם הסטודנט", type: "string" },
        { column: "ממוצע הציונים של הסטודנט", type: "number" }
      ],
    };

    const updated = await updateQuestion(q2.id, newQuestionData);

    if (updated) {
      console.log(`\n✅ Successfully updated question 2!`);
      console.log(`   New prompt: ${updated.prompt}`);
      console.log(`   New instructions: ${updated.instructions}`);
    } else {
      console.error(`❌ Failed to update question`);
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating Q2:', error);
    process.exit(1);
  }
}

// Run the script
updateQ2();
