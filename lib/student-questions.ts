import { getQuestionGenerator } from '@/lib/question-generator';
import { getHomeworkService } from '@/lib/homework';
import { getQuestionsService } from '@/lib/questions';
import { getTemplateService } from '@/lib/template-service';
import { extractQuestionVariableNames, renderQuestionVariables } from '@/lib/question-variable-rendering';
import type { HomeworkSet, Question, QuestionTemplate } from '@/app/homework/types';

const BATCH_CONCURRENCY = 4;

export class HomeworkSetNotFoundError extends Error {
  constructor(setId: string) {
    super(`Homework set not found: ${setId}`);
    this.name = 'HomeworkSetNotFoundError';
  }
}

interface StudentQuestionsContext {
  generator: Awaited<ReturnType<typeof getQuestionGenerator>>;
  homeworkSet: HomeworkSet;
  regularQuestions: Question[];
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];

  for (let index = 0; index < items.length; index += limit) {
    const slice = items.slice(index, index + limit);
    const mapped = await Promise.all(slice.map(mapper));
    results.push(...mapped);
  }

  return results;
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

export function orderQuestionsByHomeworkSet(questions: Question[], homeworkSet: Pick<HomeworkSet, 'questionOrder'>): Question[] {
  const questionOrder = homeworkSet.questionOrder ?? [];
  if (questionOrder.length === 0) return questions;

  const questionsById = new Map(questions.map((question) => [question.id, question]));
  const orderedQuestions = questionOrder
    .map((questionId) => questionsById.get(questionId))
    .filter((question): question is Question => Boolean(question));
  const orderedIds = new Set(orderedQuestions.map((question) => question.id));
  const remainingQuestions = questions.filter((question) => !orderedIds.has(question.id));

  return [...orderedQuestions, ...remainingQuestions];
}

async function getStudentQuestionsContext(setId: string): Promise<StudentQuestionsContext> {
  const [generator, homeworkService] = await Promise.all([
    getQuestionGenerator(),
    getHomeworkService(),
  ]);

  const homeworkSet = await homeworkService.getHomeworkSetById(setId);
  if (!homeworkSet) {
    throw new HomeworkSetNotFoundError(setId);
  }

  const questionsService = await getQuestionsService();
  const regularQuestions = await questionsService.getQuestionsByHomeworkSet(setId);

  return {
    generator,
    homeworkSet,
    regularQuestions,
  };
}

async function getRenderedQuestionsFromContext(
  context: StudentQuestionsContext,
  setId: string,
  studentId: string,
): Promise<Question[]> {
  const { generator, homeworkSet, regularQuestions } = context;

  if (regularQuestions.length > 0) {
    const templates = await getTemplatesIfNeeded(regularQuestions);
    return renderQuestionsForStudent(orderQuestionsByHomeworkSet(regularQuestions, homeworkSet), {
      homeworkSetId: setId,
      studentId,
      templates,
    });
  }

  const isParametric = homeworkSet.questionOrder && homeworkSet.questionOrder.length > 0;

  if (isParametric) {
    const templateService = await getTemplateService();
    const errors: string[] = [];

    for (const templateId of homeworkSet.questionOrder) {
      try {
        const seed = `${setId}-${templateId}-${studentId}`;
        await templateService.instantiateQuestion(templateId, studentId, setId, seed);
      } catch (error) {
        errors.push(`Failed to instantiate template ${templateId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Failed to generate parametric questions: ${errors.join('; ')}`);
    }
  }

  const questions = await generator.getQuestionsForStudent(setId, studentId);
  return homeworkSet.questionOrder?.length
    ? homeworkSet.questionOrder
        .map((templateId) => questions.find((question) => question.templateId === templateId))
        .filter((question): question is Question => Boolean(question))
    : questions;
}

export async function getRenderedQuestionsForStudent(setId: string, studentId: string): Promise<Question[]> {
  const context = await getStudentQuestionsContext(setId);
  return getRenderedQuestionsFromContext(context, setId, studentId);
}

export async function getRenderedQuestionsForStudents(
  setId: string,
  studentIds: string[],
): Promise<Record<string, Question[]>> {
  const uniqueStudentIds = Array.from(new Set(studentIds.filter(Boolean)));
  const context = await getStudentQuestionsContext(setId);
  const entries = await mapWithConcurrency(uniqueStudentIds, BATCH_CONCURRENCY, async (studentId) => {
    const questions = await getRenderedQuestionsFromContext(context, setId, studentId);
    return [studentId, questions] as const;
  });

  return Object.fromEntries(entries);
}
