import { NextResponse } from "next/server";
import { updateHomeworkSet } from "@/lib/homework";
import { upsertQuestion, getQuestionsService } from "@/lib/questions";
import type { SaveHomeworkDraftPayload } from "@/app/homework/services/homeworkService";

interface RouteParams {
  params: { setId: string };
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const payload = (await request.json()) as SaveHomeworkDraftPayload;
    const { questions, ...homeworkData } = payload;
    
    // Update the homework set metadata
    const updated = await updateHomeworkSet(params.setId, homeworkData);
    if (!updated) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    // Handle questions if provided
    if (questions) {
      // First, delete all existing questions for this homework set
      try {
        // Use service method to delete all questions for this homework set
        const service = await getQuestionsService();
        await service.deleteQuestionsByHomeworkSet(params.setId);
      } catch (error) {
        console.error('Error deleting existing questions:', error);
      }
      
      // Then create/update the new questions
      const updatedQuestions = await Promise.all(
        questions.map(async (question, index) => {
          try {
            return await upsertQuestion(params.setId, {
              ...question,
              evaluationMode: question.evaluationMode || "auto"
            });
          } catch (error) {
            console.error(`Error creating question ${index}:`, error);
            throw error;
          }
        })
      );

      return NextResponse.json({
        ...updated,
        questions: updatedQuestions
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error saving homework draft:', error);
    return NextResponse.json(
      { error: 'Failed to save homework draft' },
      { status: 500 }
    );
  }
}
