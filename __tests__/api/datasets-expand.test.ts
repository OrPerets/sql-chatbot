/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST as expandDataset } from '@/app/api/datasets/[id]/expand/route';
import { GET as getGenerationStatus } from '@/app/api/datasets/[id]/generation-status/route';
import { POST as rollbackDataset } from '@/app/api/datasets/[id]/rollback/route';
import { GET as validateDataset } from '@/app/api/datasets/[id]/validate/route';

// Mock the data generation service
jest.mock('@/lib/data-generation', () => ({
  startDataGeneration: jest.fn(),
  getDataGenerationService: jest.fn(),
  rollbackDataGeneration: jest.fn(),
  validateGeneratedData: jest.fn(),
}));

describe('/api/datasets/[id]/expand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should start data generation with valid config', async () => {
    const { startDataGeneration } = require('@/lib/data-generation');
    startDataGeneration.mockResolvedValue('generation-id-123');

    const request = new NextRequest('http://localhost:3000/api/datasets/test-id/expand', {
      method: 'POST',
      body: JSON.stringify({
        targetRows: 5000,
        preserveExisting: true,
        dataTypes: {
          names: true,
          emails: true,
          dates: true,
          numbers: true,
          text: true,
        },
        patterns: {
          realistic: true,
          relationships: true,
          constraints: true,
        },
      }),
    });

    const response = await expandDataset(request, { params: { id: 'test-id' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.generationId).toBe('generation-id-123');
    expect(data.message).toBe('Data generation started successfully');
    expect(startDataGeneration).toHaveBeenCalledWith('test-id', expect.objectContaining({
      targetRows: 5000,
      preserveExisting: true,
    }));
  });

  it('should use default values when config is not provided', async () => {
    const { startDataGeneration } = require('@/lib/data-generation');
    startDataGeneration.mockResolvedValue('generation-id-123');

    const request = new NextRequest('http://localhost:3000/api/datasets/test-id/expand', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await expandDataset(request, { params: { id: 'test-id' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(startDataGeneration).toHaveBeenCalledWith('test-id', expect.objectContaining({
      targetRows: 5000,
      preserveExisting: true,
      dataTypes: {
        names: true,
        emails: true,
        dates: true,
        numbers: true,
        text: true,
      },
      patterns: {
        realistic: true,
        relationships: true,
        constraints: true,
      },
    }));
  });

  it('should reject invalid target rows', async () => {
    const request = new NextRequest('http://localhost:3000/api/datasets/test-id/expand', {
      method: 'POST',
      body: JSON.stringify({
        targetRows: 50, // Too low
      }),
    });

    const response = await expandDataset(request, { params: { id: 'test-id' } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Target rows must be between 100 and 50000');
  });

  it('should handle service errors', async () => {
    const { startDataGeneration } = require('@/lib/data-generation');
    startDataGeneration.mockRejectedValue(new Error('Database connection failed'));

    const request = new NextRequest('http://localhost:3000/api/datasets/test-id/expand', {
      method: 'POST',
      body: JSON.stringify({
        targetRows: 5000,
      }),
    });

    const response = await expandDataset(request, { params: { id: 'test-id' } });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Database connection failed');
  });
});

describe('/api/datasets/[id]/generation-status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return generation statuses for a dataset', async () => {
    const mockService = {
      generationStatus: new Map([
        ['gen-1', {
          id: 'gen-1',
          datasetId: 'test-id',
          status: 'completed',
          progress: 100,
          message: 'Generation completed',
          startedAt: '2024-01-01T00:00:00Z',
          completedAt: '2024-01-01T00:05:00Z',
          generatedRows: 5000,
        }],
      ]),
    };

    const { getDataGenerationService } = require('@/lib/data-generation');
    getDataGenerationService.mockResolvedValue(mockService);

    const request = new NextRequest('http://localhost:3000/api/datasets/test-id/generation-status');
    const response = await getGenerationStatus(request, { params: { id: 'test-id' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.datasetId).toBe('test-id');
    expect(data.statuses).toHaveLength(1);
    expect(data.statuses[0].status).toBe('completed');
  });

  it('should return empty array when no generations exist', async () => {
    const mockService = {
      generationStatus: new Map(),
    };

    const { getDataGenerationService } = require('@/lib/data-generation');
    getDataGenerationService.mockResolvedValue(mockService);

    const request = new NextRequest('http://localhost:3000/api/datasets/test-id/generation-status');
    const response = await getGenerationStatus(request, { params: { id: 'test-id' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.statuses).toHaveLength(0);
  });
});

describe('/api/datasets/[id]/rollback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should rollback dataset successfully', async () => {
    const { rollbackDataGeneration } = require('@/lib/data-generation');
    rollbackDataGeneration.mockResolvedValue(true);

    const request = new NextRequest('http://localhost:3000/api/datasets/test-id/rollback', {
      method: 'POST',
    });

    const response = await rollbackDataset(request, { params: { id: 'test-id' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Dataset rolled back successfully');
    expect(data.datasetId).toBe('test-id');
    expect(rollbackDataGeneration).toHaveBeenCalledWith('test-id');
  });

  it('should return 404 when no data to rollback', async () => {
    const { rollbackDataGeneration } = require('@/lib/data-generation');
    rollbackDataGeneration.mockResolvedValue(false);

    const request = new NextRequest('http://localhost:3000/api/datasets/test-id/rollback', {
      method: 'POST',
    });

    const response = await rollbackDataset(request, { params: { id: 'test-id' } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('No generated data found to rollback');
  });

  it('should handle service errors', async () => {
    const { rollbackDataGeneration } = require('@/lib/data-generation');
    rollbackDataGeneration.mockRejectedValue(new Error('Rollback failed'));

    const request = new NextRequest('http://localhost:3000/api/datasets/test-id/rollback', {
      method: 'POST',
    });

    const response = await rollbackDataset(request, { params: { id: 'test-id' } });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Rollback failed');
  });
});

describe('/api/datasets/[id]/validate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return validation results', async () => {
    const { validateGeneratedData } = require('@/lib/data-generation');
    validateGeneratedData.mockResolvedValue({
      valid: true,
      issues: [],
    });

    const request = new NextRequest('http://localhost:3000/api/datasets/test-id/validate');
    const response = await validateDataset(request, { params: { id: 'test-id' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.datasetId).toBe('test-id');
    expect(data.valid).toBe(true);
    expect(data.issues).toHaveLength(0);
    expect(data.timestamp).toBeDefined();
    expect(validateGeneratedData).toHaveBeenCalledWith('test-id');
  });

  it('should return validation issues when data is invalid', async () => {
    const { validateGeneratedData } = require('@/lib/data-generation');
    validateGeneratedData.mockResolvedValue({
      valid: false,
      issues: ['Table users has inconsistent column count', 'Table orders is empty'],
    });

    const request = new NextRequest('http://localhost:3000/api/datasets/test-id/validate');
    const response = await validateDataset(request, { params: { id: 'test-id' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.valid).toBe(false);
    expect(data.issues).toHaveLength(2);
    expect(data.issues).toContain('Table users has inconsistent column count');
    expect(data.issues).toContain('Table orders is empty');
  });

  it('should handle service errors', async () => {
    const { validateGeneratedData } = require('@/lib/data-generation');
    validateGeneratedData.mockRejectedValue(new Error('Validation failed'));

    const request = new NextRequest('http://localhost:3000/api/datasets/test-id/validate');
    const response = await validateDataset(request, { params: { id: 'test-id' } });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Validation failed');
  });
});
