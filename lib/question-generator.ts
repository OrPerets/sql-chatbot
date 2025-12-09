import { getTemplateService } from './template-service';
import { getQuestionsService } from './questions';
import type { Question, QuestionTemplate, InstantiatedQuestion } from '@/app/homework/types';

/**
 * Service for generating questions from templates and managing question variants
 */
export class QuestionGenerator {
  private templateService: Promise<any>;
  private questionsService: Promise<any>;

  constructor() {
    this.templateService = getTemplateService();
    this.questionsService = getQuestionsService();
  }

  private async getServices() {
    const [templateService, questionsService] = await Promise.all([
      this.templateService,
      this.questionsService
    ]);
    return { templateService, questionsService };
  }

  /**
   * Generate questions for a homework set from templates
   */
  async generateQuestionsForHomeworkSet(
    homeworkSetId: string, 
    templateIds: string[], 
    studentIds: string[]
  ): Promise<{ success: boolean; generated: number; errors: string[] }> {
    const errors: string[] = [];
    let generated = 0;

    try {
      const { templateService, questionsService } = await this.getServices();

      for (const templateId of templateIds) {
        for (const studentId of studentIds) {
          try {
            // Check if question already exists
            const existing = await templateService.getInstantiatedQuestion(
              templateId, 
              studentId, 
              homeworkSetId
            );

            if (existing) {
              continue; // Skip if already exists
            }

            // Generate unique seed for this student and template
            const seed = `${homeworkSetId}-${templateId}-${studentId}`;
            
            // Instantiate the question
            const instantiatedQuestion = await templateService.instantiateQuestion(
              templateId,
              studentId,
              homeworkSetId,
              seed
            );

            if (instantiatedQuestion) {
              // Convert to regular question format and save to questions collection
              const question: Omit<Question, 'id'> & { homeworkSetId: string } = {
                homeworkSetId,
                prompt: instantiatedQuestion.prompt,
                instructions: instantiatedQuestion.instructions,
                starterSql: instantiatedQuestion.starterSql,
                expectedResultSchema: instantiatedQuestion.expectedResultSchema,
                gradingRubric: instantiatedQuestion.gradingRubric,
                datasetId: instantiatedQuestion.datasetId,
                maxAttempts: instantiatedQuestion.maxAttempts,
                points: instantiatedQuestion.points,
                evaluationMode: instantiatedQuestion.evaluationMode,
                isTemplate: false,
                templateId: instantiatedQuestion.templateId,
                variables: instantiatedQuestion.variables,
              };

              await questionsService.createQuestion(question);
              generated++;
            }
          } catch (error) {
            const errorMsg = `Failed to generate question for student ${studentId} from template ${templateId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            errors.push(errorMsg);
            console.error(errorMsg, error);
          }
        }
      }

      return { success: errors.length === 0, generated, errors };
    } catch (error) {
      const errorMsg = `Failed to generate questions for homework set ${homeworkSetId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.error(errorMsg, error);
      return { success: false, generated, errors };
    }
  }

  /**
   * Generate questions for a specific student from templates
   */
  async generateQuestionsForStudent(
    homeworkSetId: string,
    studentId: string,
    templateIds: string[]
  ): Promise<{ success: boolean; generated: number; errors: string[] }> {
    const errors: string[] = [];
    let generated = 0;

    try {
      const templateService = await this.templateService;
      
      for (const templateId of templateIds) {
        try {
          // Check if question already exists
          const existing = await templateService.getInstantiatedQuestion(
            templateId, 
            studentId, 
            homeworkSetId
          );

          if (existing) {
            continue; // Skip if already exists
          }

          // Generate unique seed for this student and template
          const seed = `${homeworkSetId}-${templateId}-${studentId}`;
          
          // Instantiate the question
          const instantiatedQuestion = await templateService.instantiateQuestion(
            templateId,
            studentId,
            homeworkSetId,
            seed
          );

          if (instantiatedQuestion) {
            // Convert to regular question format and save to questions collection
            const question: Omit<Question, 'id'> & { homeworkSetId: string } = {
              homeworkSetId,
              prompt: instantiatedQuestion.prompt,
              instructions: instantiatedQuestion.instructions,
              starterSql: instantiatedQuestion.starterSql,
              expectedResultSchema: instantiatedQuestion.expectedResultSchema,
              gradingRubric: instantiatedQuestion.gradingRubric,
              datasetId: instantiatedQuestion.datasetId,
              maxAttempts: instantiatedQuestion.maxAttempts,
              points: instantiatedQuestion.points,
              evaluationMode: instantiatedQuestion.evaluationMode,
              isTemplate: false,
              templateId: instantiatedQuestion.templateId,
              variables: instantiatedQuestion.variables,
            };

            const questionsService = await this.questionsService;
            await questionsService.createQuestion(question);
            generated++;
          }
        } catch (error) {
          const errorMsg = `Failed to generate question for student ${studentId} from template ${templateId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(errorMsg, error);
        }
      }

      return { success: errors.length === 0, generated, errors };
    } catch (error) {
      const errorMsg = `Failed to generate questions for student ${studentId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.error(errorMsg, error);
      return { success: false, generated, errors };
    }
  }

  /**
   * Get questions for a student (both regular and instantiated)
   */
  async getQuestionsForStudent(homeworkSetId: string, studentId: string): Promise<Question[]> {
    try {
      // Get instantiated questions for this student only
      const templateService = await this.templateService;
      const instantiatedQuestions = await templateService.getInstantiatedQuestionsByStudent(
        studentId, 
        homeworkSetId
      );

      // Convert instantiated questions to regular question format
      const convertedQuestions: Question[] = instantiatedQuestions.map(instantiated => ({
        id: instantiated.id,
        prompt: instantiated.prompt,
        instructions: instantiated.instructions,
        starterSql: instantiated.starterSql,
        expectedResultSchema: instantiated.expectedResultSchema,
        gradingRubric: instantiated.gradingRubric,
        datasetId: instantiated.datasetId,
        maxAttempts: instantiated.maxAttempts,
        points: instantiated.points,
        evaluationMode: instantiated.evaluationMode,
        isTemplate: false,
        templateId: instantiated.templateId,
        variables: instantiated.variables,
      }));

      // Return only student-specific questions
      return convertedQuestions;
    } catch (error) {
      console.error('Error getting questions for student:', error);
      throw error;
    }
  }

  /**
   * Preview how questions will look for a student
   */
  async previewQuestionsForStudent(
    homeworkSetId: string,
    studentId: string,
    templateIds: string[]
  ): Promise<Array<{ templateId: string; question: Question; variables: any[] }>> {
    const previews = [];

    try {
      const templateService = await this.templateService;
      
      for (const templateId of templateIds) {
        const template = await templateService.getTemplateById(templateId);
        if (!template) continue;

        // Generate preview with student-specific seed
        const seed = `${homeworkSetId}-${templateId}-${studentId}`;
        const instantiatedQuestion = await templateService.instantiateQuestion(
          templateId,
          studentId,
          homeworkSetId,
          seed
        );

        if (instantiatedQuestion) {
          const question: Question = {
            id: `preview-${templateId}`,
            prompt: instantiatedQuestion.prompt,
            instructions: instantiatedQuestion.instructions,
            starterSql: instantiatedQuestion.starterSql,
            expectedResultSchema: instantiatedQuestion.expectedResultSchema,
            gradingRubric: instantiatedQuestion.gradingRubric,
            datasetId: instantiatedQuestion.datasetId,
            maxAttempts: instantiatedQuestion.maxAttempts,
            points: instantiatedQuestion.points,
            evaluationMode: instantiatedQuestion.evaluationMode,
            isTemplate: false,
            templateId: instantiatedQuestion.templateId,
            variables: instantiatedQuestion.variables,
          };

          previews.push({
            templateId,
            question,
            variables: instantiatedQuestion.variables
          });
        }
      }

      return previews;
    } catch (error) {
      console.error('Error previewing questions for student:', error);
      throw error;
    }
  }

  /**
   * Clean up instantiated questions for a homework set
   */
  async cleanupQuestionsForHomeworkSet(homeworkSetId: string): Promise<number> {
    try {
      const deletedCount = await this.templateService.deleteInstantiatedQuestionsByHomeworkSet(homeworkSetId);
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up questions for homework set:', error);
      throw error;
    }
  }

  /**
   * Clean up instantiated questions for a specific student
   */
  async cleanupQuestionsForStudent(studentId: string, homeworkSetId?: string): Promise<number> {
    try {
      const deletedCount = await this.templateService.deleteInstantiatedQuestionsByStudent(studentId, homeworkSetId);
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up questions for student:', error);
      throw error;
    }
  }
}

/**
 * Static service instance
 */
let questionGenerator: QuestionGenerator | null = null;

export async function getQuestionGenerator(): Promise<QuestionGenerator> {
  if (!questionGenerator) {
    questionGenerator = new QuestionGenerator();
  }
  return questionGenerator;
}

/**
 * Convenience functions
 */
export async function generateQuestionsForHomeworkSet(
  homeworkSetId: string, 
  templateIds: string[], 
  studentIds: string[]
): Promise<{ success: boolean; generated: number; errors: string[] }> {
  const generator = await getQuestionGenerator();
  return generator.generateQuestionsForHomeworkSet(homeworkSetId, templateIds, studentIds);
}

export async function generateQuestionsForStudent(
  homeworkSetId: string,
  studentId: string,
  templateIds: string[]
): Promise<{ success: boolean; generated: number; errors: string[] }> {
  const generator = await getQuestionGenerator();
  return generator.generateQuestionsForStudent(homeworkSetId, studentId, templateIds);
}

export async function getQuestionsForStudent(homeworkSetId: string, studentId: string): Promise<Question[]> {
  const generator = await getQuestionGenerator();
  return generator.getQuestionsForStudent(homeworkSetId, studentId);
}

export async function previewQuestionsForStudent(
  homeworkSetId: string,
  studentId: string,
  templateIds: string[]
): Promise<Array<{ templateId: string; question: Question; variables: any[] }>> {
  const generator = await getQuestionGenerator();
  return generator.previewQuestionsForStudent(homeworkSetId, studentId, templateIds);
}
