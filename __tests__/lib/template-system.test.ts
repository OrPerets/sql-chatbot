import { TemplateSystem } from '@/lib/template-system';
import type { VariableDefinition, QuestionTemplate } from '@/app/homework/types';

describe('TemplateSystem', () => {
  describe('parseTemplate', () => {
    it('should parse simple template with one variable', () => {
      const template = 'Hello {{name}}, welcome to the course!';
      const result = TemplateSystem.parseTemplate(template);
      
      expect(result.variables).toEqual(['name']);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should parse template with multiple variables', () => {
      const template = 'Find all {{tableName}} where {{columnName}} = {{value}}';
      const result = TemplateSystem.parseTemplate(template);
      
      expect(result.variables).toEqual(['tableName', 'columnName', 'value']);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle duplicate variables', () => {
      const template = 'Hello {{name}}, {{name}} is a great name!';
      const result = TemplateSystem.parseTemplate(template);
      
      expect(result.variables).toEqual(['name']);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Duplicate variable: "name"');
    });

    it('should validate variable names', () => {
      const template = 'Hello {{123invalid}}, {{valid_name}}, {{also-valid}}';
      const result = TemplateSystem.parseTemplate(template);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(err => err.includes('Invalid variable name: "123invalid"'))).toBe(true);
      expect(result.errors.some(err => err.includes('Invalid variable name: "also-valid"'))).toBe(true);
    });

    it('should handle empty template', () => {
      const template = '';
      const result = TemplateSystem.parseTemplate(template);
      
      expect(result.variables).toHaveLength(0);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle template without variables', () => {
      const template = 'This is a static question without any variables.';
      const result = TemplateSystem.parseTemplate(template);
      
      expect(result.variables).toHaveLength(0);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateVariables', () => {
    const createVariable = (name: string, type: string, constraints?: any): VariableDefinition => ({
      id: '1',
      name,
      type: type as any,
      constraints,
      required: false
    });

    it('should validate correct template and variables', () => {
      const template = 'Find all {{tableName}} where {{columnName}} = {{value}}';
      const variables = [
        createVariable('tableName', 'table_name'),
        createVariable('columnName', 'column_name'),
        createVariable('value', 'sql_value')
      ];
      
      const result = TemplateSystem.validateVariables(template, variables);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect undefined variables in template', () => {
      const template = 'Find all {{tableName}} where {{undefinedVar}} = {{value}}';
      const variables = [
        createVariable('tableName', 'table_name'),
        createVariable('value', 'sql_value')
      ];
      
      const result = TemplateSystem.validateVariables(template, variables);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Variable "undefinedVar" is used in template but not defined');
    });

    it('should detect unused variable definitions', () => {
      const template = 'Find all {{tableName}} where {{columnName}} = {{value}}';
      const variables = [
        createVariable('tableName', 'table_name'),
        createVariable('columnName', 'column_name'),
        createVariable('value', 'sql_value'),
        createVariable('unusedVar', 'string')
      ];
      
      const result = TemplateSystem.validateVariables(template, variables);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Variable "unusedVar" is defined but not used in template');
    });

    it('should validate number constraints', () => {
      const template = 'Generate {{number}} records';
      const variables = [
        createVariable('number', 'number', { min: 10, max: 5 }) // Invalid: min > max
      ];
      
      const result = TemplateSystem.validateVariables(template, variables);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Variable "number": min value cannot be greater than max value');
    });

    it('should validate string constraints', () => {
      const template = 'Generate {{text}}';
      const variables = [
        createVariable('text', 'string', { minLength: 10, maxLength: 5 }) // Invalid: minLength > maxLength
      ];
      
      const result = TemplateSystem.validateVariables(template, variables);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Variable "text": minLength cannot be greater than maxLength');
    });

    it('should validate list constraints', () => {
      const template = 'Choose {{option}}';
      const variables = [
        createVariable('option', 'list', { options: [] }) // Invalid: empty options
      ];
      
      const result = TemplateSystem.validateVariables(template, variables);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Variable "option": list type requires options');
    });

    it('should validate range constraints', () => {
      const template = 'Generate {{range}}';
      const variables = [
        createVariable('range', 'range', { start: 10, end: 5 }) // Invalid: start > end
      ];
      
      const result = TemplateSystem.validateVariables(template, variables);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Variable "range": start value cannot be greater than end value');
    });
  });

  describe('generateVariableValues', () => {
    const createVariable = (name: string, type: string, constraints?: any): VariableDefinition => ({
      id: name,
      name,
      type: type as any,
      constraints,
      required: false
    });

    it('should generate number values within range', () => {
      const variables = [
        createVariable('number', 'number', { min: 1, max: 10 })
      ];
      
      const values = TemplateSystem.generateVariableValues(variables, 'test-seed');
      
      expect(values).toHaveLength(1);
      expect(values[0].variableId).toBe('number');
      expect(typeof values[0].value).toBe('number');
      expect(values[0].value).toBeGreaterThanOrEqual(1);
      expect(values[0].value).toBeLessThanOrEqual(10);
    });

    it('should generate string values with correct length', () => {
      const variables = [
        createVariable('text', 'string', { minLength: 5, maxLength: 10 })
      ];
      
      const values = TemplateSystem.generateVariableValues(variables, 'test-seed');
      
      expect(values).toHaveLength(1);
      expect(values[0].variableId).toBe('text');
      expect(typeof values[0].value).toBe('string');
      expect(values[0].value.length).toBeGreaterThanOrEqual(5);
      expect(values[0].value.length).toBeLessThanOrEqual(10);
    });

    it('should generate list values from options', () => {
      const variables = [
        createVariable('option', 'list', { options: ['A', 'B', 'C'] })
      ];
      
      const values = TemplateSystem.generateVariableValues(variables, 'test-seed');
      
      expect(values).toHaveLength(1);
      expect(values[0].variableId).toBe('option');
      expect(['A', 'B', 'C']).toContain(values[0].value);
    });

    it('should generate consistent values with same seed', () => {
      const variables = [
        createVariable('number', 'number', { min: 1, max: 100 })
      ];
      
      const values1 = TemplateSystem.generateVariableValues(variables, 'consistent-seed');
      const values2 = TemplateSystem.generateVariableValues(variables, 'consistent-seed');
      
      expect(values1[0].value).toBe(values2[0].value);
    });

    it('should generate different values with different seeds', () => {
      const variables = [
        createVariable('number', 'number', { min: 1, max: 100 })
      ];
      
      const values1 = TemplateSystem.generateVariableValues(variables, 'seed-1');
      const values2 = TemplateSystem.generateVariableValues(variables, 'seed-2');
      
      // Note: This test might occasionally fail due to randomness, but it's very unlikely
      expect(values1[0].value).not.toBe(values2[0].value);
    });
  });

  describe('substituteVariables', () => {
    it('should substitute single variable', () => {
      const template = 'Hello {{name}}, welcome!';
      const variableValues = [
        { variableId: 'name', value: 'John', generatedAt: new Date().toISOString() }
      ];
      
      const result = TemplateSystem.substituteVariables(template, variableValues);
      
      expect(result).toBe('Hello John, welcome!');
    });

    it('should substitute multiple variables', () => {
      const template = 'Find all {{tableName}} where {{columnName}} = {{value}}';
      const variableValues = [
        { variableId: 'tableName', value: 'users', generatedAt: new Date().toISOString() },
        { variableId: 'columnName', value: 'age', generatedAt: new Date().toISOString() },
        { variableId: 'value', value: '25', generatedAt: new Date().toISOString() }
      ];
      
      const result = TemplateSystem.substituteVariables(template, variableValues);
      
      expect(result).toBe('Find all users where age = 25');
    });

    it('should handle multiple occurrences of same variable', () => {
      const template = 'Hello {{name}}, {{name}} is a great name!';
      const variableValues = [
        { variableId: 'name', value: 'Alice', generatedAt: new Date().toISOString() }
      ];
      
      const result = TemplateSystem.substituteVariables(template, variableValues);
      
      expect(result).toBe('Hello Alice, Alice is a great name!');
    });

    it('should handle template without variables', () => {
      const template = 'This is a static template.';
      const variableValues: any[] = [];
      
      const result = TemplateSystem.substituteVariables(template, variableValues);
      
      expect(result).toBe('This is a static template.');
    });

    it('should handle missing variable values', () => {
      const template = 'Hello {{name}}, welcome!';
      const variableValues: any[] = [];
      
      const result = TemplateSystem.substituteVariables(template, variableValues);
      
      expect(result).toBe('Hello {{name}}, welcome!');
    });
  });

  describe('createTemplate', () => {
    it('should create template with all required fields', () => {
      const templateData = {
        name: 'Test Template',
        description: 'A test template',
        template: 'Hello {{name}}!',
        variables: [
          {
            id: '1',
            name: 'name',
            type: 'string' as any,
            required: false
          }
        ]
      };
      
      const template = TemplateSystem.createTemplate(templateData);
      
      expect(template.id).toBeDefined();
      expect(template.name).toBe('Test Template');
      expect(template.description).toBe('A test template');
      expect(template.template).toBe('Hello {{name}}!');
      expect(template.variables).toHaveLength(1);
      expect(template.version).toBe(1);
      expect(template.createdAt).toBeDefined();
      expect(template.updatedAt).toBeDefined();
    });
  });

  describe('instantiateQuestion', () => {
    it('should instantiate question from template', () => {
      const template: QuestionTemplate = {
        id: 'template-1',
        name: 'Test Template',
        template: 'Hello {{name}}!',
        variables: [
          {
            id: '1',
            name: 'name',
            type: 'string' as any,
            required: false
          }
        ],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const instantiated = TemplateSystem.instantiateQuestion(
        template,
        'student-1',
        'homework-1',
        'test-seed'
      );
      
      expect(instantiated.id).toBeDefined();
      expect(instantiated.templateId).toBe('template-1');
      expect(instantiated.studentId).toBe('student-1');
      expect(instantiated.homeworkSetId).toBe('homework-1');
      expect(instantiated.variables).toHaveLength(1);
      expect(instantiated.prompt).toContain('Hello');
      expect(instantiated.prompt).not.toContain('{{name}}');
      expect(instantiated.createdAt).toBeDefined();
    });
  });

  describe('previewTemplate', () => {
    it('should generate preview samples', () => {
      const template: QuestionTemplate = {
        id: 'template-1',
        name: 'Test Template',
        template: 'Hello {{name}}!',
        variables: [
          {
            id: '1',
            name: 'name',
            type: 'string' as any,
            required: false
          }
        ],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const previews = TemplateSystem.previewTemplate(template, 3);
      
      expect(previews).toHaveLength(3);
      previews.forEach((preview, index) => {
        expect(preview.variables).toHaveLength(1);
        expect(preview.preview).toContain('Hello');
        expect(preview.preview).not.toContain('{{name}}');
        expect(preview.variables[0].variableId).toBe('1');
      });
    });
  });
});
