import { NextRequest, NextResponse } from 'next/server';
import { getQuestionGenerator } from '@/lib/question-generator';
import { getHomeworkService } from '@/lib/homework';
import { getQuestionsService } from '@/lib/questions';
import { getTemplateService } from '@/lib/template-service';
import { extractQuestionVariableNames, renderQuestionVariables } from '@/lib/question-variable-rendering';
import type { Question, QuestionTemplate } from '@/app/homework/types';

interface RouteParams {
  params: Promise<{
    setId: string;
    studentId: string;
  }>;
}

async function getTemplatesIfNeeded(questions: Question[]): Promise<QuestionTemplate[]> {
  const needsTemplates = questions.some(
    (question) => Boolean(question.templateId) || extractQuestionVariableNames(question).length > 0,
  );
  if (!needsTemplates) return [];

  const templateService = await getTemplateService();
  return templateService.getTemplates();
}

function renderQuestionsForStudent(
  questions: Question[],
  options: {
    homeworkSetId: string;
    studentId: string;
    templates: QuestionTemplate[];
  },
): Question[] {
  return questions.map((question) => renderQuestionVariables(question, options));
}

/**
 * GET /api/homework/[setId]/questions/student/[studentId] - Get questions for a specific student
 * This endpoint automatically generates parametric questions if they don't exist
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { setId, studentId } = await params;
    
    console.log(`🎓 Getting questions for student ${studentId} in homework set ${setId}`);
    
    const generator = await getQuestionGenerator();
    const homeworkService = await getHomeworkService();
    
    // Get the homework set to check if it uses templates
    const homeworkSet = await homeworkService.getHomeworkSetById(setId);
    if (!homeworkSet) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Homework set not found' 
        },
        { status: 404 }
      );
    }
    
    // Check if this homework set uses parametric templates
    // A homework set uses templates if questionOrder contains template IDs (not regular question IDs)
    // We'll check by trying to get regular questions first
    const questionsService = await getQuestionsService();
    const regularQuestions = await questionsService.getQuestionsByHomeworkSet(setId);
    
    // If we have regular questions, this is not a parametric homework set
    if (regularQuestions.length > 0) {
      console.log(`📋 Homework set ${setId} has ${regularQuestions.length} regular questions, returning them for student ${studentId}`);
      const templateQuestions = regularQuestions.filter((question) => Boolean(question.templateId));

      if (templateQuestions.length > 0) {
        const templateService = await getTemplateService();
        const uniqueTemplateIds = Array.from(new Set(templateQuestions.map((question) => question.templateId!)));

        for (const templateId of uniqueTemplateIds) {
          const seed = `${setId}-${templateId}-${studentId}`;
          await templateService.instantiateQuestion(templateId, studentId, setId, seed);
        }

        const studentQuestions = await generator.getQuestionsForStudent(setId, studentId);
        const questionsByTemplateId = new Map(
          studentQuestions
            .filter((question) => Boolean(question.templateId))
            .map((question) => [question.templateId!, question]),
        );
        const templates = await templateService.getTemplates();
        const orderedQuestions = regularQuestions.map((question) => {
          if (!question.templateId) {
            return renderQuestionVariables(question, { homeworkSetId: setId, studentId, templates });
          }
          return questionsByTemplateId.get(question.templateId)
            ?? renderQuestionVariables(question, { homeworkSetId: setId, studentId, templates });
        });

        return NextResponse.json(orderedQuestions);
      }

      const templates = await getTemplatesIfNeeded(regularQuestions);
      return NextResponse.json(renderQuestionsForStudent(regularQuestions, {
        homeworkSetId: setId,
        studentId,
        templates,
      }));
    }
    
    // Otherwise, check if it uses parametric templates
    const isParametric = homeworkSet.questionOrder && homeworkSet.questionOrder.length > 0;
    
    if (isParametric) {
      console.log(`📝 Homework set ${setId} uses parametric templates, generating questions for student ${studentId}`);

      const templateService = await getTemplateService();
      const errors: string[] = [];
      let generated = 0;

      for (const templateId of homeworkSet.questionOrder) {
        try {
          const seed = `${setId}-${templateId}-${studentId}`;
          const question = await templateService.instantiateQuestion(templateId, studentId, setId, seed);
          if (question) generated++;
        } catch (error) {
          errors.push(`Failed to instantiate template ${templateId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      if (errors.length > 0) {
        console.error(`❌ Failed to generate questions for student ${studentId}:`, errors);
        return NextResponse.json(
          { 
            success: false, 
            error: 'Failed to generate parametric questions',
            details: errors,
          },
          { status: 500 }
        );
      }
      
      console.log(`✅ Generated ${generated} parametric questions for student ${studentId}`);
    }
    
    // Get all questions for this student (both regular and instantiated)
    const questions = await generator.getQuestionsForStudent(setId, studentId);
    const orderedQuestions = homeworkSet.questionOrder?.length
      ? homeworkSet.questionOrder
          .map((templateId) => questions.find((question) => question.templateId === templateId))
          .filter((question): question is Question => Boolean(question))
      : questions;
    
    console.log(`📋 Returning ${orderedQuestions.length} questions for student ${studentId}`);
    
    return NextResponse.json(orderedQuestions);
    
  } catch (error) {
    console.error('Error getting questions for student:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get questions for student',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
