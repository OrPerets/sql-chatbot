import { NextResponse } from "next/server";
import { updateHomeworkSet } from "@/lib/homework";
import { upsertQuestion, getQuestionsService } from "@/lib/questions";
import { globalKeyedMutex } from "@/lib/mutex";
import type { SaveHomeworkDraftPayload } from "@/app/homework/services/homeworkService";
import type { Question } from "@/app/homework/types";

interface RouteParams {
  params: Promise<{ setId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { setId } = await params;
    const payload = (await request.json()) as SaveHomeworkDraftPayload;
    const { questions, ...homeworkData } = payload;
    
    console.log('Draft save request:', {
      setId,
      questionsCount: questions?.length || 0,
      homeworkData: Object.keys(homeworkData)
    });
    
    // Serialize per-set saves to avoid overlapping delete/recreate sequences
    const result = await globalKeyedMutex.runExclusive(setId, async () => {
      // Update the homework set metadata first
      const updated = await updateHomeworkSet(setId, homeworkData);
      if (!updated) {
        return { status: 404 as const, body: { message: "Not found" } };
      }

      // If no questions provided, return updated set only
      if (!questions) {
        return { status: 200 as const, body: updated };
      }

      console.log('Processing questions:', questions.length);

      const service = await getQuestionsService();
      const existingQuestions = await service.getQuestionsByHomeworkSet(setId);
      const existingQuestionIds = new Set(existingQuestions.map((question) => question.id));
      const desiredQuestionIds = new Set<string>();
      const savedQuestions: Question[] = [];

      // Reconcile questions deterministically in payload order.
      for (let index = 0; index < questions.length; index++) {
        const question = questions[index]!;
        try {
          console.log(`Creating question ${index}:`, {
            id: question.id,
            prompt: question.prompt?.substring(0, 50) + '...',
            instructions: question.instructions?.substring(0, 50) + '...'
          });

          const savedQuestion = await upsertQuestion(setId, {
            ...question,
            evaluationMode: question.evaluationMode || "auto",
          });
          desiredQuestionIds.add(savedQuestion.id);
          savedQuestions.push(savedQuestion);
        } catch (error) {
          console.error(`Error creating question ${index}:`, error);
          throw error;
        }
      }

      const staleQuestionIds = existingQuestions
        .map((question) => question.id)
        .filter((questionId) => existingQuestionIds.has(questionId) && !desiredQuestionIds.has(questionId));

      for (const questionId of staleQuestionIds) {
        await service.deleteQuestion(questionId);
      }

      const finalOrder = savedQuestions.map((question) => question.id);
      console.log('Updating questionOrder (authoritative):', finalOrder);

      const finalUpdated = await updateHomeworkSet(setId, {
        questionOrder: finalOrder,
      });

      console.log('Final update completed');
      return { status: 200 as const, body: { ...finalUpdated, questions: savedQuestions } };
    });

    if (result.status !== 200) {
      return NextResponse.json(result.body as any, { status: result.status });
    }
    return NextResponse.json(result.body as any);
  } catch (error) {
    console.error('Error saving homework draft:', error);
    return NextResponse.json(
      { error: 'Failed to save homework draft' },
      { status: 500 }
    );
  }
}
