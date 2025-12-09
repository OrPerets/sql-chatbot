import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/templates/route';
import { GET as GET_TEMPLATE, PUT, DELETE } from '@/app/api/templates/[id]/route';
import { GET as GET_PREVIEW } from '@/app/api/templates/[id]/preview/route';
import { POST as POST_VALIDATE } from '@/app/api/templates/validate/route';
import { POST as POST_PARSE } from '@/app/api/templates/parse/route';

// Mock the template service
jest.mock('@/lib/template-service', () => ({
  getTemplateService: jest.fn(() => ({
    getTemplates: jest.fn(),
    createTemplate: jest.fn(),
    getTemplateById: jest.fn(),
    updateTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
    previewTemplate: jest.fn(),
    validateTemplate: jest.fn(),
    parseTemplate: jest.fn(),
  })),
}));

describe('/api/templates', () => {
  describe('GET /api/templates', () => {
    it('should return all templates', async () => {
      const mockTemplates = [
        {
          id: '1',
          name: 'Test Template',
          template: 'Hello {{name}}!',
          variables: [],
          version: 1,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      ];

      const { getTemplateService } = require('@/lib/template-service');
      const mockService = getTemplateService();
      mockService.getTemplates.mockResolvedValue(mockTemplates);

      const request = new NextRequest('http://localhost:3000/api/templates');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockTemplates);
    });

    it('should handle errors when fetching templates', async () => {
      const { getTemplateService } = require('@/lib/template-service');
      const mockService = getTemplateService();
      mockService.getTemplates.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/templates');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to fetch templates');
    });
  });

  describe('POST /api/templates', () => {
    it('should create a new template', async () => {
      const templateData = {
        name: 'New Template',
        template: 'Hello {{name}}!',
        variables: [
          {
            id: '1',
            name: 'name',
            type: 'string',
            required: false
          }
        ]
      };

      const createdTemplate = {
        id: '2',
        ...templateData,
        version: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      const { getTemplateService } = require('@/lib/template-service');
      const mockService = getTemplateService();
      mockService.createTemplate.mockResolvedValue(createdTemplate);

      const request = new NextRequest('http://localhost:3000/api/templates', {
        method: 'POST',
        body: JSON.stringify(templateData),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(createdTemplate);
    });

    it('should return error for missing required fields', async () => {
      const templateData = {
        name: 'Incomplete Template'
        // Missing template and variables
      };

      const request = new NextRequest('http://localhost:3000/api/templates', {
        method: 'POST',
        body: JSON.stringify(templateData),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Missing required fields: name, template, variables');
    });

    it('should handle creation errors', async () => {
      const templateData = {
        name: 'Error Template',
        template: 'Hello {{name}}!',
        variables: []
      };

      const { getTemplateService } = require('@/lib/template-service');
      const mockService = getTemplateService();
      mockService.createTemplate.mockRejectedValue(new Error('Validation error'));

      const request = new NextRequest('http://localhost:3000/api/templates', {
        method: 'POST',
        body: JSON.stringify(templateData),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to create template');
    });
  });
});

describe('/api/templates/[id]', () => {
  describe('GET /api/templates/[id]', () => {
    it('should return a specific template', async () => {
      const template = {
        id: '1',
        name: 'Test Template',
        template: 'Hello {{name}}!',
        variables: [],
        version: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      const { getTemplateService } = require('@/lib/template-service');
      const mockService = getTemplateService();
      mockService.getTemplateById.mockResolvedValue(template);

      const request = new NextRequest('http://localhost:3000/api/templates/1');
      const response = await GET_TEMPLATE(request, { params: { id: '1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(template);
    });

    it('should return 404 for non-existent template', async () => {
      const { getTemplateService } = require('@/lib/template-service');
      const mockService = getTemplateService();
      mockService.getTemplateById.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/templates/nonexistent');
      const response = await GET_TEMPLATE(request, { params: { id: 'nonexistent' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Template not found');
    });
  });

  describe('PUT /api/templates/[id]', () => {
    it('should update a template', async () => {
      const updateData = {
        name: 'Updated Template',
        template: 'Hello {{name}}!'
      };

      const updatedTemplate = {
        id: '1',
        ...updateData,
        variables: [],
        version: 2,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z'
      };

      const { getTemplateService } = require('@/lib/template-service');
      const mockService = getTemplateService();
      mockService.updateTemplate.mockResolvedValue(updatedTemplate);

      const request = new NextRequest('http://localhost:3000/api/templates/1', {
        method: 'PUT',
        body: JSON.stringify(updateData),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await PUT(request, { params: { id: '1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(updatedTemplate);
    });

    it('should return 404 for non-existent template', async () => {
      const { getTemplateService } = require('@/lib/template-service');
      const mockService = getTemplateService();
      mockService.updateTemplate.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/templates/nonexistent', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await PUT(request, { params: { id: 'nonexistent' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Template not found');
    });
  });

  describe('DELETE /api/templates/[id]', () => {
    it('should delete a template', async () => {
      const { getTemplateService } = require('@/lib/template-service');
      const mockService = getTemplateService();
      mockService.deleteTemplate.mockResolvedValue(true);

      const request = new NextRequest('http://localhost:3000/api/templates/1', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: { id: '1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Template deleted successfully');
    });

    it('should return 404 for non-existent template', async () => {
      const { getTemplateService } = require('@/lib/template-service');
      const mockService = getTemplateService();
      mockService.deleteTemplate.mockResolvedValue(false);

      const request = new NextRequest('http://localhost:3000/api/templates/nonexistent', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: { id: 'nonexistent' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Template not found');
    });
  });
});

describe('/api/templates/[id]/preview', () => {
  it('should return template preview', async () => {
    const previewData = [
      {
        variables: [{ variableId: 'name', value: 'John', generatedAt: '2024-01-01T00:00:00Z' }],
        preview: 'Hello John!'
      }
    ];

    const { getTemplateService } = require('@/lib/template-service');
    const mockService = getTemplateService();
    mockService.previewTemplate.mockResolvedValue(previewData);

    const request = new NextRequest('http://localhost:3000/api/templates/1/preview?sampleCount=3');
    const response = await GET_PREVIEW(request, { params: { id: '1' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(previewData);
  });

  it('should return 404 for non-existent template', async () => {
    const { getTemplateService } = require('@/lib/template-service');
    const mockService = getTemplateService();
    mockService.previewTemplate.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/templates/nonexistent/preview');
    const response = await GET_PREVIEW(request, { params: { id: 'nonexistent' } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Template not found');
  });
});

describe('/api/templates/validate', () => {
  it('should validate template and variables', async () => {
    const validationData = {
      template: 'Hello {{name}}!',
      variables: [
        {
          id: '1',
          name: 'name',
          type: 'string',
          required: false
        }
      ]
    };

    const validationResult = {
      isValid: true,
      errors: []
    };

    const { getTemplateService } = require('@/lib/template-service');
    const mockService = getTemplateService();
    mockService.validateTemplate.mockResolvedValue(validationResult);

    const request = new NextRequest('http://localhost:3000/api/templates/validate', {
      method: 'POST',
      body: JSON.stringify(validationData),
      headers: { 'Content-Type': 'application/json' }
    });

    const response = await POST_VALIDATE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(validationResult);
  });

  it('should return error for missing fields', async () => {
    const request = new NextRequest('http://localhost:3000/api/templates/validate', {
      method: 'POST',
      body: JSON.stringify({ template: 'Hello {{name}}!' }), // Missing variables
      headers: { 'Content-Type': 'application/json' }
    });

    const response = await POST_VALIDATE(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Missing required fields: template, variables');
  });
});

describe('/api/templates/parse', () => {
  it('should parse template and extract variables', async () => {
    const parseData = {
      template: 'Hello {{name}}!'
    };

    const parseResult = {
      variables: ['name'],
      isValid: true,
      errors: []
    };

    const { getTemplateService } = require('@/lib/template-service');
    const mockService = getTemplateService();
    mockService.parseTemplate.mockResolvedValue(parseResult);

    const request = new NextRequest('http://localhost:3000/api/templates/parse', {
      method: 'POST',
      body: JSON.stringify(parseData),
      headers: { 'Content-Type': 'application/json' }
    });

    const response = await POST_PARSE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(parseResult);
  });

  it('should return error for missing template', async () => {
    const request = new NextRequest('http://localhost:3000/api/templates/parse', {
      method: 'POST',
      body: JSON.stringify({}), // Missing template
      headers: { 'Content-Type': 'application/json' }
    });

    const response = await POST_PARSE(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Missing required field: template');
  });
});
