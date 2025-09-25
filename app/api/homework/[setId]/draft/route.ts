import { NextResponse } from "next/server";
import { updateHomeworkSet } from "@/lib/homework";
import { upsertQuestion, getQuestionsService, getQuestionsByHomeworkSet } from "@/lib/questions";
import { globalKeyedMutex } from "@/lib/mutex";
import type { SaveHomeworkDraftPayload } from "@/app/homework/services/homeworkService";

interface RouteParams {
  params: { setId: string };
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const payload = (await request.json()) as SaveHomeworkDraftPayload;
    const { questions, ...homeworkData } = payload;
    
    console.log('Draft save request:', {
      setId: params.setId,
      questionsCount: questions?.length || 0,
      homeworkData: Object.keys(homeworkData)
    });
    
    // Serialize per-set saves to avoid overlapping delete/recreate sequences
    const result = await globalKeyedMutex.runExclusive(params.setId, async () => {
      // Update the homework set metadata first
      const updated = await updateHomeworkSet(params.setId, homeworkData);
      if (!updated) {
        return { status: 404 as const, body: { message: "Not found" } };
      }

      // If no questions provided, return updated set only
      if (!questions) {
        return { status: 200 as const, body: updated };
      }

      console.log('Processing questions:', questions.length);

      // Delete all existing questions for this set
      try {
        const service = await getQuestionsService();
        const deletedCount = await service.deleteQuestionsByHomeworkSet(params.setId);
        console.log('Deleted existing questions:', deletedCount);
      } catch (error) {
        console.error('Error deleting existing questions:', error);
      }

      // Recreate/update questions deterministically in provided order
      for (let index = 0; index < questions.length; index++) {
        const question = questions[index]!;
        try {
          console.log(`Creating question ${index}:`, {
            id: question.id,
            prompt: question.prompt?.substring(0, 50) + '...',
            instructions: question.instructions?.substring(0, 50) + '...'
          });

          await upsertQuestion(params.setId, {
            ...question,
            evaluationMode: question.evaluationMode || "auto",
          });
        } catch (error) {
          console.error(`Error creating question ${index}:`, error);
          throw error;
        }
      }

      // Read back authoritative questions from DB and set order accordingly
      const finalQuestions = await getQuestionsByHomeworkSet(params.setId);
      const finalOrder = finalQuestions.map((q) => q.id);
      console.log('Updating questionOrder (authoritative):', finalOrder);

      const finalUpdated = await updateHomeworkSet(params.setId, {
        questionOrder: finalOrder,
      });

      console.log('Final update completed');
      return { status: 200 as const, body: { ...finalUpdated, questions: finalQuestions } };
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
