import { NextResponse } from "next/server";
import { getHomeworkService } from "@/lib/homework";
import { getQuestionsService, updateQuestion } from "@/lib/questions";

/**
 * API endpoint to fix Q13 (or Q12) in תרגיל בית 3
 * Finds and updates the question with the old "הנהלת המכללה מעוניינת לקטלג..." text
 */
export async function POST() {
  try {
    const homeworkService = await getHomeworkService();
    const questionsService = await getQuestionsService();

    // Find the homework set "תרגיל 3" or "תרגיל בית 3"
    const allHomeworkSets = await homeworkService.listHomeworkSets({ pageSize: 1000 });
    const exercise3Set = allHomeworkSets.items.find(hw => hw.title === "תרגיל 3" || hw.title === "תרגיל בית 3");

    if (!exercise3Set) {
      return NextResponse.json(
        { success: false, error: 'Homework set "תרגיל 3" or "תרגיל בית 3" not found' },
        { status: 404 }
      );
    }

    // Get all questions for this homework set
    const existingQuestions = await questionsService.getQuestionsByHomeworkSet(exercise3Set.id);

    // Find the question with the old text
    const oldQuestionText = "הנהלת המכללה מעוניינת לקטלג";
    const questionToUpdate = existingQuestions.find(q => 
      q.prompt && q.prompt.includes(oldQuestionText)
    );

    if (!questionToUpdate) {
      return NextResponse.json({
        success: true,
        message: "No question found with the old text. It may have already been updated.",
        updated: false
      });
    }

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

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Failed to update question" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Question updated successfully",
      questionId: updated.id,
      updated: true
    });
  } catch (error) {
    console.error("Error fixing Q13:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fix Q13",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
