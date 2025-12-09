import { Db, ObjectId } from 'mongodb';
import { connectToDatabase, COLLECTIONS } from './database';
import { generateId } from './models';
import { TemplateSystem } from './template-system';
import type { 
  QuestionTemplate, 
  InstantiatedQuestion, 
  VariableDefinition,
  VariableValue 
} from '@/app/homework/types';
import type { 
  QuestionTemplateModel, 
  InstantiatedQuestionModel 
} from './models';

/**
 * Service for managing question templates and instantiated questions
 */
export class TemplateService {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /**
   * Create a new question template
   */
  async createTemplate(templateData: Omit<QuestionTemplate, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<QuestionTemplate> {
    // Validate template and variables
    const validation = TemplateSystem.validateVariables(templateData.template, templateData.variables);
    if (!validation.isValid) {
      throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
    }

    const template = TemplateSystem.createTemplate(templateData);
    
    const templateModel: QuestionTemplateModel = {
      id: template.id,
      name: template.name,
      description: template.description,
      template: template.template,
      variables: template.variables,
      expectedResultSchema: template.expectedResultSchema,
      starterSql: template.starterSql,
      instructions: template.instructions,
      gradingRubric: template.gradingRubric,
      datasetId: template.datasetId,
      maxAttempts: template.maxAttempts,
      points: template.points,
      evaluationMode: template.evaluationMode,
      version: template.version,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };

    await this.db.collection<QuestionTemplateModel>(COLLECTIONS.QUESTION_TEMPLATES).insertOne(templateModel);

    return template;
  }

  /**
   * Get all question templates
   */
  async getTemplates(): Promise<QuestionTemplate[]> {
    const templates = await this.db
      .collection<QuestionTemplateModel>(COLLECTIONS.QUESTION_TEMPLATES)
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return templates.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      template: template.template,
      variables: template.variables,
      expectedResultSchema: template.expectedResultSchema,
      starterSql: template.starterSql,
      instructions: template.instructions,
      gradingRubric: template.gradingRubric,
      datasetId: template.datasetId,
      maxAttempts: template.maxAttempts,
      points: template.points,
      evaluationMode: template.evaluationMode,
      version: template.version,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    }));
  }

  /**
   * Get a template by ID
   */
  async getTemplateById(id: string): Promise<QuestionTemplate | null> {
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    
    const template = await this.db
      .collection<QuestionTemplateModel>(COLLECTIONS.QUESTION_TEMPLATES)
      .findOne({ 
        $or: isValidObjectId 
          ? [{ _id: new ObjectId(id) }, { id: id }]
          : [{ id: id }]
      });

    if (!template) return null;

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      template: template.template,
      variables: template.variables,
      expectedResultSchema: template.expectedResultSchema,
      starterSql: template.starterSql,
      instructions: template.instructions,
      gradingRubric: template.gradingRubric,
      datasetId: template.datasetId,
      maxAttempts: template.maxAttempts,
      points: template.points,
      evaluationMode: template.evaluationMode,
      version: template.version,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }

  /**
   * Update a template
   */
  async updateTemplate(id: string, updates: Partial<Omit<QuestionTemplate, 'id' | 'version' | 'createdAt'>>): Promise<QuestionTemplate | null> {
    const existingTemplate = await this.getTemplateById(id);
    if (!existingTemplate) return null;

    // If template or variables are being updated, validate them
    if (updates.template || updates.variables) {
      const template = updates.template || existingTemplate.template;
      const variables = updates.variables || existingTemplate.variables;
      
      const validation = TemplateSystem.validateVariables(template, variables);
      if (!validation.isValid) {
        throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
      }
    }

    const updateData = {
      ...updates,
      version: existingTemplate.version + 1,
      updatedAt: new Date().toISOString(),
    };

    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    
    const result = await this.db
      .collection<QuestionTemplateModel>(COLLECTIONS.QUESTION_TEMPLATES)
      .findOneAndUpdate(
        { 
          $or: isValidObjectId 
            ? [{ _id: new ObjectId(id) }, { id: id }]
            : [{ id: id }]
        },
        { $set: updateData },
        { returnDocument: 'after' }
      );

    if (!result) return null;

    return {
      id: result.id,
      name: result.name,
      description: result.description,
      template: result.template,
      variables: result.variables,
      expectedResultSchema: result.expectedResultSchema,
      starterSql: result.starterSql,
      instructions: result.instructions,
      gradingRubric: result.gradingRubric,
      datasetId: result.datasetId,
      maxAttempts: result.maxAttempts,
      points: result.points,
      evaluationMode: result.evaluationMode,
      version: result.version,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: string): Promise<boolean> {
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    
    const result = await this.db
      .collection<QuestionTemplateModel>(COLLECTIONS.QUESTION_TEMPLATES)
      .deleteOne({ 
        $or: isValidObjectId 
          ? [{ _id: new ObjectId(id) }, { id: id }]
          : [{ id: id }]
      });

    return result.deletedCount > 0;
  }

  /**
   * Preview a template with sample values
   */
  async previewTemplate(id: string, sampleCount: number = 3): Promise<Array<{ variables: VariableValue[]; preview: string }> | null> {
    const template = await this.getTemplateById(id);
    if (!template) return null;

    return TemplateSystem.previewTemplate(template, sampleCount);
  }

  /**
   * Instantiate a question from a template for a specific student
   */
  async instantiateQuestion(
    templateId: string, 
    studentId: string, 
    homeworkSetId: string,
    seed?: string
  ): Promise<InstantiatedQuestion | null> {
    const template = await this.getTemplateById(templateId);
    if (!template) return null;

    // Check if question already exists for this student and template
    const existing = await this.getInstantiatedQuestion(templateId, studentId, homeworkSetId);
    if (existing) {
      return existing;
    }

    const instantiatedQuestion = TemplateSystem.instantiateQuestion(template, studentId, homeworkSetId, seed);
    
    const questionModel: InstantiatedQuestionModel = {
      id: instantiatedQuestion.id,
      templateId: instantiatedQuestion.templateId,
      studentId: instantiatedQuestion.studentId,
      homeworkSetId: instantiatedQuestion.homeworkSetId,
      variables: instantiatedQuestion.variables,
      prompt: instantiatedQuestion.prompt,
      instructions: instantiatedQuestion.instructions,
      starterSql: instantiatedQuestion.starterSql,
      expectedResultSchema: instantiatedQuestion.expectedResultSchema,
      gradingRubric: instantiatedQuestion.gradingRubric,
      datasetId: instantiatedQuestion.datasetId,
      maxAttempts: instantiatedQuestion.maxAttempts,
      points: instantiatedQuestion.points,
      evaluationMode: instantiatedQuestion.evaluationMode,
      createdAt: instantiatedQuestion.createdAt,
    };

    await this.db.collection<InstantiatedQuestionModel>(COLLECTIONS.INSTANTIATED_QUESTIONS).insertOne(questionModel);

    return instantiatedQuestion;
  }

  /**
   * Get an instantiated question for a specific student and template
   */
  async getInstantiatedQuestion(templateId: string, studentId: string, homeworkSetId: string): Promise<InstantiatedQuestion | null> {
    const question = await this.db
      .collection<InstantiatedQuestionModel>(COLLECTIONS.INSTANTIATED_QUESTIONS)
      .findOne({ 
        templateId, 
        studentId, 
        homeworkSetId 
      });

    if (!question) return null;

    return {
      id: question.id,
      templateId: question.templateId,
      studentId: question.studentId,
      homeworkSetId: question.homeworkSetId,
      variables: question.variables,
      prompt: question.prompt,
      instructions: question.instructions,
      starterSql: question.starterSql,
      expectedResultSchema: question.expectedResultSchema,
      gradingRubric: question.gradingRubric,
      datasetId: question.datasetId,
      maxAttempts: question.maxAttempts,
      points: question.points,
      evaluationMode: question.evaluationMode,
      createdAt: question.createdAt,
    };
  }

  /**
   * Get all instantiated questions for a homework set
   */
  async getInstantiatedQuestionsByHomeworkSet(homeworkSetId: string): Promise<InstantiatedQuestion[]> {
    const questions = await this.db
      .collection<InstantiatedQuestionModel>(COLLECTIONS.INSTANTIATED_QUESTIONS)
      .find({ homeworkSetId })
      .sort({ createdAt: 1 })
      .toArray();

    return questions.map(question => ({
      id: question.id,
      templateId: question.templateId,
      studentId: question.studentId,
      homeworkSetId: question.homeworkSetId,
      variables: question.variables,
      prompt: question.prompt,
      instructions: question.instructions,
      starterSql: question.starterSql,
      expectedResultSchema: question.expectedResultSchema,
      gradingRubric: question.gradingRubric,
      datasetId: question.datasetId,
      maxAttempts: question.maxAttempts,
      points: question.points,
      evaluationMode: question.evaluationMode,
      createdAt: question.createdAt,
    }));
  }

  /**
   * Get instantiated questions for a specific student
   */
  async getInstantiatedQuestionsByStudent(studentId: string, homeworkSetId?: string): Promise<InstantiatedQuestion[]> {
    const filter: any = { studentId };
    if (homeworkSetId) {
      filter.homeworkSetId = homeworkSetId;
    }

    const questions = await this.db
      .collection<InstantiatedQuestionModel>(COLLECTIONS.INSTANTIATED_QUESTIONS)
      .find(filter)
      .sort({ createdAt: 1 })
      .toArray();

    return questions.map(question => ({
      id: question.id,
      templateId: question.templateId,
      studentId: question.studentId,
      homeworkSetId: question.homeworkSetId,
      variables: question.variables,
      prompt: question.prompt,
      instructions: question.instructions,
      starterSql: question.starterSql,
      expectedResultSchema: question.expectedResultSchema,
      gradingRubric: question.gradingRubric,
      datasetId: question.datasetId,
      maxAttempts: question.maxAttempts,
      points: question.points,
      evaluationMode: question.evaluationMode,
      createdAt: question.createdAt,
    }));
  }

  /**
   * Delete instantiated questions for a homework set
   */
  async deleteInstantiatedQuestionsByHomeworkSet(homeworkSetId: string): Promise<number> {
    const result = await this.db
      .collection<InstantiatedQuestionModel>(COLLECTIONS.INSTANTIATED_QUESTIONS)
      .deleteMany({ homeworkSetId });

    return result.deletedCount;
  }

  /**
   * Delete instantiated questions for a specific student
   */
  async deleteInstantiatedQuestionsByStudent(studentId: string, homeworkSetId?: string): Promise<number> {
    const filter: any = { studentId };
    if (homeworkSetId) {
      filter.homeworkSetId = homeworkSetId;
    }

    const result = await this.db
      .collection<InstantiatedQuestionModel>(COLLECTIONS.INSTANTIATED_QUESTIONS)
      .deleteMany(filter);

    return result.deletedCount;
  }

  /**
   * Validate a template without saving it
   */
  async validateTemplate(template: string, variables: VariableDefinition[]): Promise<{ isValid: boolean; errors: string[] }> {
    return TemplateSystem.validateVariables(template, variables);
  }

  /**
   * Parse a template and extract variables
   */
  async parseTemplate(template: string): Promise<{ variables: string[]; isValid: boolean; errors: string[] }> {
    const result = TemplateSystem.parseTemplate(template);
    return {
      variables: result.variables,
      isValid: result.isValid,
      errors: result.errors
    };
  }
}

/**
 * Static service instance
 */
let templateService: TemplateService | null = null;

export async function getTemplateService(): Promise<TemplateService> {
  if (!templateService) {
    const { db } = await connectToDatabase();
    templateService = new TemplateService(db);
  }
  return templateService;
}

/**
 * Convenience functions that use the service
 */
export async function createTemplate(templateData: Omit<QuestionTemplate, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<QuestionTemplate> {
  const service = await getTemplateService();
  return service.createTemplate(templateData);
}

export async function getTemplates(): Promise<QuestionTemplate[]> {
  const service = await getTemplateService();
  return service.getTemplates();
}

export async function getTemplateById(id: string): Promise<QuestionTemplate | null> {
  const service = await getTemplateService();
  return service.getTemplateById(id);
}

export async function updateTemplate(id: string, updates: Partial<Omit<QuestionTemplate, 'id' | 'version' | 'createdAt'>>): Promise<QuestionTemplate | null> {
  const service = await getTemplateService();
  return service.updateTemplate(id, updates);
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const service = await getTemplateService();
  return service.deleteTemplate(id);
}

export async function previewTemplate(id: string, sampleCount?: number): Promise<Array<{ variables: VariableValue[]; preview: string }> | null> {
  const service = await getTemplateService();
  return service.previewTemplate(id, sampleCount);
}

export async function instantiateQuestion(templateId: string, studentId: string, homeworkSetId: string, seed?: string): Promise<InstantiatedQuestion | null> {
  const service = await getTemplateService();
  return service.instantiateQuestion(templateId, studentId, homeworkSetId, seed);
}

export async function getInstantiatedQuestion(templateId: string, studentId: string, homeworkSetId: string): Promise<InstantiatedQuestion | null> {
  const service = await getTemplateService();
  return service.getInstantiatedQuestion(templateId, studentId, homeworkSetId);
}

export async function getInstantiatedQuestionsByHomeworkSet(homeworkSetId: string): Promise<InstantiatedQuestion[]> {
  const service = await getTemplateService();
  return service.getInstantiatedQuestionsByHomeworkSet(homeworkSetId);
}

export async function getInstantiatedQuestionsByStudent(studentId: string, homeworkSetId?: string): Promise<InstantiatedQuestion[]> {
  const service = await getTemplateService();
  return service.getInstantiatedQuestionsByStudent(studentId, homeworkSetId);
}
