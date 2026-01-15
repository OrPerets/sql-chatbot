import { generateId } from './models';

/**
 * Variable types supported by the template system
 */
export type VariableType = 
  | 'number' 
  | 'string' 
  | 'date' 
  | 'list' 
  | 'range' 
  | 'sql_value'
  | 'table_name'
  | 'column_name';

/**
 * Variable constraint definitions
 */
export interface VariableConstraints {
  // For number type
  min?: number;
  max?: number;
  step?: number;
  
  // For string type
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  
  // For list type
  options?: string[];
  
  // For range type
  start?: number;
  end?: number;
  
  // For date type
  minDate?: string;
  maxDate?: string;
  format?: string;
  
  // For SQL-related types
  tableNames?: string[];
  columnNames?: string[];
  dataTypes?: string[];
}

/**
 * Variable definition for template system
 */
export interface VariableDefinition {
  id: string;
  name: string;
  type: VariableType;
  description?: string;
  constraints?: VariableConstraints;
  defaultValue?: any;
  required?: boolean;
}

/**
 * Generated variable value
 */
export interface VariableValue {
  variableId: string;
  value: any;
  generatedAt: string;
}

/**
 * Template parsing result
 */
export interface TemplateParseResult {
  variables: string[];
  isValid: boolean;
  errors: string[];
  template: string;
}

/**
 * Question template with variables
 */
export interface QuestionTemplate {
  id: string;
  name: string;
  description?: string;
  template: string;
  variables: VariableDefinition[];
  expectedResultSchema?: Array<{ column: string; type: string }>;
  starterSql?: string;
  instructions?: string;
  gradingRubric?: any[];
  datasetId?: string;
  maxAttempts?: number;
  points?: number;
  evaluationMode?: "auto" | "manual" | "custom";
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Instantiated question from template
 */
export interface InstantiatedQuestion {
  id: string;
  templateId: string;
  studentId: string;
  homeworkSetId: string;
  variables: VariableValue[];
  prompt: string;
  instructions: string;
  starterSql?: string;
  expectedResultSchema: Array<{ column: string; type: string }>;
  gradingRubric: any[];
  datasetId?: string;
  maxAttempts: number;
  points: number;
  evaluationMode?: "auto" | "manual" | "custom";
  createdAt: string;
}

/**
 * Template system for parsing and managing parametric questions
 */
export class TemplateSystem {
  private static readonly VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;
  private static readonly VARIABLE_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

  /**
   * Parse a template string and extract variables
   */
  static parseTemplate(template: string): TemplateParseResult {
    const variables: string[] = [];
    const errors: string[] = [];
    let isValid = true;

    // Find all variable references
    const matches = Array.from(template.matchAll(this.VARIABLE_PATTERN));
    
    for (const match of matches) {
      const variableName = match[1].trim();
      
      // Validate variable name
      if (!this.VARIABLE_NAME_PATTERN.test(variableName)) {
        errors.push(`Invalid variable name: "${variableName}". Variable names must start with a letter or underscore and contain only letters, numbers, and underscores.`);
        isValid = false;
      }
      
      // Check for duplicates
      if (variables.includes(variableName)) {
        errors.push(`Duplicate variable: "${variableName}"`);
        isValid = false;
      } else {
        // Only add if not already present (deduplicate)
        variables.push(variableName);
      }
    }

    return {
      variables,
      isValid,
      errors,
      template
    };
  }

  /**
   * Validate variable definitions against template
   */
  static validateVariables(template: string, variables: VariableDefinition[]): { isValid: boolean; errors: string[] } {
    const parseResult = this.parseTemplate(template);
    const errors: string[] = [...parseResult.errors];
    
    if (!parseResult.isValid) {
      return { isValid: false, errors };
    }

    const templateVariables = parseResult.variables;
    const definedVariables = variables.map(v => v.name);

    // Check for undefined variables in template
    for (const templateVar of templateVariables) {
      if (!definedVariables.includes(templateVar)) {
        errors.push(`Variable "${templateVar}" is used in template but not defined`);
      }
    }

    // Check for unused variable definitions
    for (const definedVar of definedVariables) {
      if (!templateVariables.includes(definedVar)) {
        errors.push(`Variable "${definedVar}" is defined but not used in template`);
      }
    }

    // Validate individual variable definitions
    for (const variable of variables) {
      const variableErrors = this.validateVariableDefinition(variable);
      errors.push(...variableErrors);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate a single variable definition
   */
  private static validateVariableDefinition(variable: VariableDefinition): string[] {
    const errors: string[] = [];

    // Validate name
    if (!this.VARIABLE_NAME_PATTERN.test(variable.name)) {
      errors.push(`Invalid variable name: "${variable.name}"`);
    }

    // Validate type-specific constraints
    if (variable.constraints) {
      const constraints = variable.constraints;
      
      switch (variable.type) {
        case 'number':
          if (constraints.min !== undefined && constraints.max !== undefined && constraints.min > constraints.max) {
            errors.push(`Variable "${variable.name}": min value cannot be greater than max value`);
          }
          if (constraints.step !== undefined && constraints.step <= 0) {
            errors.push(`Variable "${variable.name}": step must be positive`);
          }
          break;
          
        case 'string':
          if (constraints.minLength !== undefined && constraints.maxLength !== undefined && constraints.minLength > constraints.maxLength) {
            errors.push(`Variable "${variable.name}": minLength cannot be greater than maxLength`);
          }
          break;
          
        case 'list':
          if (!constraints.options || constraints.options.length === 0) {
            errors.push(`Variable "${variable.name}": list type requires options`);
          }
          break;
          
        case 'range':
          if (constraints.start === undefined || constraints.end === undefined) {
            errors.push(`Variable "${variable.name}": range type requires start and end values`);
          } else if (constraints.start > constraints.end) {
            errors.push(`Variable "${variable.name}": start value cannot be greater than end value`);
          }
          break;
          
        case 'date':
          if (constraints.minDate && constraints.maxDate && constraints.minDate > constraints.maxDate) {
            errors.push(`Variable "${variable.name}": minDate cannot be greater than maxDate`);
          }
          break;
      }
    }

    return errors;
  }

  /**
   * Generate values for variables based on their definitions
   */
  static generateVariableValues(variables: VariableDefinition[], seed?: string): VariableValue[] {
    // Use seed for consistent generation if provided
    const random = seed ? this.seededRandom(seed) : Math.random;
    
    return variables.map(variable => ({
      variableId: variable.id,
      value: this.generateValueForVariable(variable, random),
      generatedAt: new Date().toISOString()
    }));
  }

  /**
   * Generate a value for a specific variable
   */
  private static generateValueForVariable(variable: VariableDefinition, random: () => number): any {
    const constraints = variable.constraints || {};
    
    switch (variable.type) {
      case 'number':
        const min = constraints.min || 1;
        const max = constraints.max || 100;
        const step = constraints.step || 1;
        const range = max - min;
        const steps = Math.floor(range / step);
        return min + Math.floor(random() * (steps + 1)) * step;
        
      case 'string':
        const minLength = constraints.minLength || 5;
        const maxLength = constraints.maxLength || 20;
        const length = minLength + Math.floor(random() * (maxLength - minLength + 1));
        return this.generateRandomString(length, random);
        
      case 'date':
        const minDate = constraints.minDate ? new Date(constraints.minDate) : new Date('2020-01-01');
        const maxDate = constraints.maxDate ? new Date(constraints.maxDate) : new Date('2030-12-31');
        const timeRange = maxDate.getTime() - minDate.getTime();
        const randomTime = minDate.getTime() + random() * timeRange;
        return new Date(randomTime).toISOString().split('T')[0];
        
      case 'list':
        const options = constraints.options || [];
        return options[Math.floor(random() * options.length)];
        
      case 'range':
        const start = constraints.start || 1;
        const end = constraints.end || 10;
        return start + Math.floor(random() * (end - start + 1));
        
      case 'sql_value':
        // Generate SQL-compatible values
        return this.generateSqlValue(constraints, random);
        
      case 'table_name':
        const tableNames = constraints.tableNames || ['users', 'orders', 'products'];
        return tableNames[Math.floor(random() * tableNames.length)];
        
      case 'column_name':
        const columnNames = constraints.columnNames || ['id', 'name', 'email', 'created_at'];
        return columnNames[Math.floor(random() * columnNames.length)];
        
      default:
        return variable.defaultValue || '';
    }
  }

  /**
   * Generate SQL-compatible values
   */
  private static generateSqlValue(constraints: VariableConstraints, random: () => number): any {
    const dataTypes = constraints.dataTypes || ['VARCHAR', 'INTEGER', 'DATE'];
    const dataType = dataTypes[Math.floor(random() * dataTypes.length)];
    
    switch (dataType) {
      case 'VARCHAR':
        return `'${this.generateRandomString(8, random)}'`;
      case 'INTEGER':
        return Math.floor(random() * 1000);
      case 'DATE':
        return `'${new Date(2020 + Math.floor(random() * 10), Math.floor(random() * 12), Math.floor(random() * 28) + 1).toISOString().split('T')[0]}'`;
      default:
        return `'${this.generateRandomString(5, random)}'`;
    }
  }

  /**
   * Generate random string
   */
  private static generateRandomString(length: number, random: () => number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(random() * chars.length));
    }
    return result;
  }

  /**
   * Seeded random number generator for consistent results
   */
  private static seededRandom(seed: string): () => number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    let current = Math.abs(hash);
    return () => {
      current = (current * 9301 + 49297) % 233280;
      return current / 233280;
    };
  }

  /**
   * Substitute variables in template with values
   */
  static substituteVariables(template: string, variableValues: VariableValue[], variableDefinitions?: VariableDefinition[]): string {
    let result = template;
    
    for (const variableValue of variableValues) {
      // Find the variable name from the definition if available
      let variableName = variableValue.variableId;
      if (variableDefinitions) {
        const definition = variableDefinitions.find(def => def.id === variableValue.variableId);
        if (definition) {
          variableName = definition.name;
        }
      }
      
      const pattern = new RegExp(`\\{\\{${variableName}\\}\\}`, 'g');
      result = result.replace(pattern, String(variableValue.value));
    }
    
    return result;
  }

  /**
   * Create a new question template
   */
  static createTemplate(data: Omit<QuestionTemplate, 'id' | 'version' | 'createdAt' | 'updatedAt'>): QuestionTemplate {
    const now = new Date().toISOString();
    
    return {
      id: generateId(),
      version: 1,
      createdAt: now,
      updatedAt: now,
      ...data
    };
  }

  /**
   * Instantiate a question from a template
   */
  static instantiateQuestion(
    template: QuestionTemplate, 
    studentId: string, 
    homeworkSetId: string,
    seed?: string
  ): InstantiatedQuestion {
    const variableValues = this.generateVariableValues(template.variables, seed);
    
    return {
      id: generateId(),
      templateId: template.id,
      studentId,
      homeworkSetId,
      variables: variableValues,
      prompt: this.substituteVariables(template.template, variableValues, template.variables),
      instructions: template.instructions || '',
      starterSql: template.starterSql,
      expectedResultSchema: template.expectedResultSchema || [],
      gradingRubric: template.gradingRubric || [],
      datasetId: template.datasetId,
      maxAttempts: template.maxAttempts || 3,
      points: template.points || 10,
      evaluationMode: template.evaluationMode || 'auto',
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Preview template with sample values
   */
  static previewTemplate(template: QuestionTemplate, sampleCount: number = 3): Array<{ variables: VariableValue[]; preview: string }> {
    const previews = [];
    
    for (let i = 0; i < sampleCount; i++) {
      const seed = `${template.id}-preview-${i}`;
      const variableValues = this.generateVariableValues(template.variables, seed);
      const preview = this.substituteVariables(template.template, variableValues, template.variables);
      
      previews.push({
        variables: variableValues,
        preview
      });
    }
    
    return previews;
  }
}
