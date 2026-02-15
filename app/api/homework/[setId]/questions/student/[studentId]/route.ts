import { NextRequest, NextResponse } from 'next/server';
import { getQuestionGenerator } from '@/lib/question-generator';
import { getHomeworkService } from '@/lib/homework';
import { getQuestionsService } from '@/lib/questions';

interface RouteParams {
  params: Promise<{
    setId: string;
    studentId: string;
  }>;
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
      return NextResponse.json(regularQuestions);
    }
    
    // Otherwise, check if it uses parametric templates
    const isParametric = homeworkSet.questionOrder && homeworkSet.questionOrder.length > 0;
    
    if (isParametric) {
      console.log(`📝 Homework set ${setId} uses parametric templates, generating questions for student ${studentId}`);
      
      // Generate parametric questions for this student
      const result = await generator.generateQuestionsForStudent(
        setId,
        studentId,
        homeworkSet.questionOrder
      );
      
      if (!result.success) {
        console.error(`❌ Failed to generate questions for student ${studentId}:`, result.errors);
        return NextResponse.json(
          { 
            success: false, 
            error: 'Failed to generate parametric questions',
            details: result.errors
          },
          { status: 500 }
        );
      }
      
      console.log(`✅ Generated ${result.generated} parametric questions for student ${studentId}`);
    }
    
    // Get all questions for this student (both regular and instantiated)
    const questions = await generator.getQuestionsForStudent(setId, studentId);
    
    console.log(`📋 Returning ${questions.length} questions for student ${studentId}`);
    
    return NextResponse.json(questions);
    
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
