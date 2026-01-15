import { connectToDatabase } from '../lib/database';
import { getHomeworkService } from '../lib/homework';
import { getQuestionsService, updateQuestion } from '../lib/questions';

/**
 * Script to update Q6 in תרגיל בית 3
 * Updates the question about percentage of students enrolled in each course
 */
async function updateQ6() {
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

    // Find question 6 - the one about percentage of students enrolled
    // The old text contains "מנהל המכללה מעוניין לדעת מה אחוז הסטודנטים"
    const oldQuestionText = "מנהל המכללה מעוניין לדעת מה אחוז הסטודנטים";
    const questionToUpdate = existingQuestions.find(q => 
      q.prompt && q.prompt.includes(oldQuestionText)
    );

    if (!questionToUpdate) {
      console.log('ℹ️  No question found with the old text. Looking for question 6 by index...');
      
      // If questionOrder exists, use it
      const questionOrder = exercise3Set.questionOrder || [];
      let q6: typeof existingQuestions[0] | null = null;
      
      if (questionOrder.length >= 6) {
        const q6Id = questionOrder[5]; // Question 6 is at index 5
        q6 = existingQuestions.find(q => q.id === q6Id) || null;
      }
      
      if (!q6 && existingQuestions.length >= 6) {
        q6 = existingQuestions[5]; // Fallback to index
      }
      
      if (!q6) {
        console.log('\nExisting questions:');
        existingQuestions.forEach((q, i) => {
          console.log(`  ${i + 1}. ${q.prompt?.substring(0, 60)}...`);
        });
        console.error('❌ Could not find question 6');
        process.exit(1);
      }
      
      // Check if already updated
      if (q6.prompt.includes("מנכ\"ל שנקר")) {
        console.log('✅ Question 6 has already been updated!');
        console.log(`   Current prompt: ${q6.prompt}`);
        process.exit(0);
      }
      
      console.log(`\n🔄 Found question 6 to update (ID: ${q6.id})`);
      console.log(`   Current prompt: ${q6.prompt.substring(0, 80)}...`);
      
      // Update with new data
      await doUpdate(q6.id);
      process.exit(0);
    }

    console.log(`\n🔄 Found question to update (ID: ${questionToUpdate.id})`);
    console.log(`   Current prompt: ${questionToUpdate.prompt.substring(0, 80)}...`);

    await doUpdate(questionToUpdate.id);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating Q6:', error);
    process.exit(1);
  }
}

async function doUpdate(questionId: string) {
  // New question data - keeping the same schema
  const newQuestionData = {
    prompt: "מנכ\"ל שנקר מעוניין לדעת מה אחוז הסטודנטים שנרשמו לכל קורס מתחילת שנת 2023 מקרב כל הסטודנטים. עליכם לכתוב שאילתא שתתן מענה לכך.",
    instructions: "(סכמה: קוד הקורס, שם הקורס, מספר הסטודנטים הרשומים בקורס, ואחוז הסטודנטים שנרשמו לקורס מתוך סך כל ההרשמות).",
  };

  // Update the question
  const updated = await updateQuestion(questionId, newQuestionData);

  if (updated) {
    console.log(`\n✅ Successfully updated question 6!`);
    console.log(`   New prompt: ${updated.prompt}`);
    console.log(`   New instructions: ${updated.instructions}`);
  } else {
    console.error(`❌ Failed to update question`);
    process.exit(1);
  }
}

// Run the script
updateQ6();
