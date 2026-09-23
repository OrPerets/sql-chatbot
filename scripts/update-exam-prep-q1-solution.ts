/**
 * Set question 1 of "הכנה למבחן" solution to use DATEDIFF (not DATEADD).
 * Run: npx tsx scripts/update-exam-prep-q1-solution.ts
 */

import { connectToDatabase } from "../lib/database";
import { getHomeworkService } from "../lib/homework";
import { getQuestionsByHomeworkSet, updateQuestion } from "../lib/questions";

const Q1_SOLUTION_DATEDIFF =
  "SELECT e.ExamID, e.CourseCode, e.ExamDate, COUNT(r.RegistrationID) AS approved_count FROM Exams e LEFT JOIN Registrations r ON r.ExamID = e.ExamID AND r.Status = 'approved' WHERE DATEDIFF(e.ExamDate, CURDATE()) >= 0 AND DATEDIFF(e.ExamDate, CURDATE()) <= 14 GROUP BY e.ExamID, e.CourseCode, e.ExamDate ORDER BY e.ExamDate";

async function main() {
  await connectToDatabase();
  const homeworkService = await getHomeworkService();
  const allSets = await homeworkService.listHomeworkSets({ pageSize: 1000 });
  const examPrepSet = allSets.items.find(
    (hw) => hw.title === "תרגיל הכנה למבחן" || hw.title === "הכנה למבחן"
  );

  if (!examPrepSet) {
    console.error('❌ Homework set "הכנה למבחן" / "תרגיל הכנה למבחן" not found');
    process.exit(1);
  }

  const questionOrder = examPrepSet.questionOrder || [];
  const existingQuestions = await getQuestionsByHomeworkSet(examPrepSet.id);
  const firstQuestionId = questionOrder[0];
  const q1 = existingQuestions.find((q) => q.id === firstQuestionId);

  if (!q1) {
    console.error("❌ Question 1 not found");
    process.exit(1);
  }

  const updated = await updateQuestion(q1.id, { starterSql: Q1_SOLUTION_DATEDIFF });
  if (updated) {
    console.log("✅ Question 1 solution updated to use DATEDIFF.");
    console.log("   Refresh the runner and click 'הצג חלופה לפתרון' for Q1 to see the new solution.");
  } else {
    console.error("❌ Failed to update question 1");
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
