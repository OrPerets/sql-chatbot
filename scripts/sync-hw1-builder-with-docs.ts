#!/usr/bin/env tsx

import "dotenv/config";

import { getHomeworkService } from "../lib/homework";
import { getQuestionsService } from "../lib/questions";
import { HW1_DOC_SYNC_QUESTIONS } from "../lib/hw1-doc-sync";

async function main() {
  const homeworkService = await getHomeworkService();
  const questionsService = await getQuestionsService();

  const homeworkSets = await homeworkService.listHomeworkSets({
    pageSize: 200,
    status: ["draft", "scheduled", "published", "archived"],
  });

  const hw1 = homeworkSets.items.find((item) => item.title === "תרגיל בית 1");
  if (!hw1) {
    throw new Error('לא נמצא סט שיעורי בית בשם "תרגיל בית 1"');
  }

  const existingQuestions = await questionsService.getQuestionsByHomeworkSet(hw1.id);
  if (existingQuestions.length !== HW1_DOC_SYNC_QUESTIONS.length) {
    throw new Error(
      `נמצאו ${existingQuestions.length} שאלות ב-HW1, אבל קובץ הסנכרון מכיל ${HW1_DOC_SYNC_QUESTIONS.length} שאלות. הסקריפט עוצר כדי לא לשנות מזהים קיימים.`,
    );
  }

  for (let index = 0; index < HW1_DOC_SYNC_QUESTIONS.length; index += 1) {
    const current = existingQuestions[index];
    const target = HW1_DOC_SYNC_QUESTIONS[index];

    if (!current || !target) continue;

    await questionsService.updateQuestion(current.id, {
      prompt: target.prompt,
      instructions: target.instructions,
      expectedOutputDescription: target.expectedOutputDescription,
      starterSql: target.starterSql,
      expectedResultSchema: target.expectedResultSchema,
      parameterMode: target.parameterMode,
      parameters: target.parameters ?? [],
    });

    console.log(
      `סונכרנה ${target.prompt}: ${target.parameterMode === "parameterized" ? `${target.parameters?.length ?? 0} פרמטרים` : "ללא פרמטרים"}`,
    );
  }

  console.log(`הסנכרון הושלם עבור HW1 (${hw1.id}).`);
}

main().catch((error) => {
  console.error("סנכרון HW1 נכשל:", error);
  process.exit(1);
});
