import { connectToDatabase } from '../lib/database';
import { getHomeworkService } from '../lib/homework';
import { getQuestionsService, updateQuestion } from '../lib/questions';

/**
 * Quick fix for Q1 and Q11 in תרגיל בית 3
 */
async function fixQuestions() {
  try {
    const { db } = await connectToDatabase();
    const homeworkService = await getHomeworkService();
    const questionsService = await getQuestionsService();

    // Find the homework set
    const allHomeworkSets = await homeworkService.listHomeworkSets({ pageSize: 1000 });
    const exercise3Set = allHomeworkSets.items.find(hw => hw.title === "תרגיל 3" || hw.title === "תרגיל בית 3");

    if (!exercise3Set) {
      console.error('❌ Homework set not found');
      process.exit(1);
    }

    console.log(`✅ Found homework set: ${exercise3Set.title}`);

    // Get all questions
    const existingQuestions = await questionsService.getQuestionsByHomeworkSet(exercise3Set.id);
    
    // Sort by question order
    const questionOrder = exercise3Set.questionOrder || [];
    const sortedQuestions = [...existingQuestions].sort((a, b) => {
      const indexA = questionOrder.indexOf(a.id);
      const indexB = questionOrder.indexOf(b.id);
      return indexA - indexB;
    });

    // Q1: Fix weeks (14 → 11)
    const q1 = sortedQuestions[0];
    if (q1 && q1.prompt?.includes("שבועות")) {
      console.log('\n🔄 Updating Q1...');
      await updateQuestion(q1.id, {
        prompt: "הציגו את כל ההרשמות לקורסים שהסטודנטים נרשמו אליהם בסמסטר האחרון (11 שבועות מתאריך הגשת התרגיל הנוכחי).",
      });
      console.log('   ✅ Q1 updated: 11 שבועות');
    }

    // Q11: Update text
    const q11 = sortedQuestions[10];
    if (q11 && q11.prompt?.includes("גרים באותה עיר")) {
      console.log('\n🔄 Updating Q11...');
      await updateQuestion(q11.id, {
        prompt: "הציגו את רשימת הסטודנטים שגרים באותה עיר כמו המרצה של הקורס אליו הם רשומים.",
      });
      console.log('   ✅ Q11 updated');
    }

    console.log('\n✅ Done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixQuestions();
