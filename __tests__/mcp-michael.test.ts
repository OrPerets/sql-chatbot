/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

// Mock fetch globally
global.fetch = jest.fn();

// Mock content module
jest.mock('@/lib/content', () => ({
  getCurrentWeekContextNormalized: jest.fn(),
  getWeekContextByNumberNormalized: jest.fn(),
  getWeeklyContent: jest.fn(),
}));

// Mock sql-curriculum module
jest.mock('@/lib/sql-curriculum', () => ({
  SQL_CURRICULUM_MAP: {
    1: { week: 1, concepts: [], forbiddenConcepts: [] },
    13: { week: 13, concepts: [], forbiddenConcepts: [] },
  },
  getAllowedConceptsForWeek: jest.fn().mockReturnValue([]),
  getForbiddenConceptsForWeek: jest.fn().mockReturnValue([]),
}));

describe('MCP Michael System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Date Calculation Logic', () => {
    test('should calculate correct week number based on semester start', () => {
      const calculateCurrentWeek = (startDate: string): number => {
        const start = new Date(startDate);
        const now = new Date();
        const weekNumber = Math.ceil((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
        return Math.max(1, Math.min(14, weekNumber));
      };

      // Test with a known start date (8 weeks ago)
      const eightWeeksAgo = new Date();
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - (8 * 7));
      const startDate = eightWeeksAgo.toISOString().split('T')[0];

      const currentWeek = calculateCurrentWeek(startDate);
      expect(currentWeek).toBeGreaterThanOrEqual(1);
      expect(currentWeek).toBeLessThanOrEqual(14);
    });

    test('should calculate correct date ranges for weeks', () => {
      const calculateDateRange = (week: number, startDate: string): string => {
        const start = new Date(startDate);
        const weekStart = new Date(start.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
        
        return `${weekStart.toLocaleDateString('he-IL')} - ${weekEnd.toLocaleDateString('he-IL')}`;
      };

      const startDate = '2024-01-01';
      const week1Range = calculateDateRange(1, startDate);
      const week2Range = calculateDateRange(2, startDate);

      // Check for the actual format used by toLocaleDateString('he-IL') which uses dots
      expect(week1Range).toContain('1.1.2024');
      expect(week2Range).toContain('8.1.2024');
      expect(week1Range).toContain('7.1.2024');
      expect(week2Range).toContain('14.1.2024');
    });
  });

  describe('API Route Validation', () => {
    test('should validate week number range', () => {
      const validateWeek = (week: number): boolean => {
        return week >= 1 && week <= 14;
      };

      expect(validateWeek(1)).toBe(true);
      expect(validateWeek(14)).toBe(true);
      expect(validateWeek(0)).toBe(false);
      expect(validateWeek(15)).toBe(false);
      expect(validateWeek(-1)).toBe(false);
    });

    test('should validate required fields for weekly content', () => {
      const validateWeeklyContent = (data: any): { valid: boolean; errors: string[] } => {
        const errors: string[] = [];
        
        if (!data.week || data.week < 1 || data.week > 14) {
          errors.push('Week must be between 1 and 14');
        }
        
        if (typeof data.content !== 'string') {
          errors.push('Content must be a string');
        }
        
        return {
          valid: errors.length === 0,
          errors
        };
      };

      // Valid data
      const validData = { week: 5, content: 'SQL joins and relationships' };
      expect(validateWeeklyContent(validData).valid).toBe(true);

      // Invalid week
      const invalidWeek = { week: 15, content: 'Some content' };
      expect(validateWeeklyContent(invalidWeek).valid).toBe(false);
      expect(validateWeeklyContent(invalidWeek).errors).toContain('Week must be between 1 and 14');

      // Missing content
      const missingContent = { week: 5 };
      expect(validateWeeklyContent(missingContent).valid).toBe(false);
      expect(validateWeeklyContent(missingContent).errors).toContain('Content must be a string');
    });
  });

  describe('Weekly Content Structure', () => {
    test('should create proper weekly content structure', () => {
      const createWeeklyContent = (week: number, content: string, dateRange: string) => {
        return {
          week,
          content,
          dateRange,
          updatedAt: new Date().toISOString(),
          updatedBy: 'admin'
        };
      };

      const weekData = createWeeklyContent(3, 'GROUP BY and HAVING clauses', '2024-01-15 - 2024-01-21');
      
      expect(weekData).toHaveProperty('week', 3);
      expect(weekData).toHaveProperty('content', 'GROUP BY and HAVING clauses');
      expect(weekData).toHaveProperty('dateRange', '2024-01-15 - 2024-01-21');
      expect(weekData).toHaveProperty('updatedAt');
      expect(weekData).toHaveProperty('updatedBy', 'admin');
    });
  });

  describe('Context Injection Format', () => {
    test('should format weekly context correctly', () => {
      const formatWeeklyContext = (week: number, content: string): string => {
        if (!content || !content.trim()) return '';
        return `\n\n[הקשר שבועי נוכחי - שבוע ${week}: ${content}]`;
      };

      const context = formatWeeklyContext(5, 'SQL joins and relationships');
      expect(context).toBe('\n\n[הקשר שבועי נוכחי - שבוע 5: SQL joins and relationships]');

      const emptyContext = formatWeeklyContext(3, '');
      expect(emptyContext).toBe('');

      const whitespaceContext = formatWeeklyContext(7, '   ');
      expect(whitespaceContext).toBe('');
    });
  });

  describe('Course Context Function Endpoint', () => {
    test('get_course_week_context returns stringified JSON payload', async () => {
      // Reset modules to ensure fresh imports with mocks
      jest.resetModules();
      
      const { getCurrentWeekContextNormalized } = await import('@/lib/content');
      (getCurrentWeekContextNormalized as jest.Mock).mockResolvedValue({
        weekNumber: 5,
        content: 'SQL joins and relationships',
        dateRange: '2024-01-29 - 2024-02-04',
        updatedAt: '2024-01-27T10:00:00.000Z',
        updatedBy: 'admin',
      });

      const { getAllowedConceptsForWeek, getForbiddenConceptsForWeek } = await import('@/lib/sql-curriculum');
      (getAllowedConceptsForWeek as jest.Mock).mockReturnValue([]);
      (getForbiddenConceptsForWeek as jest.Mock).mockReturnValue([]);

      const { POST } = await import('../app/api/assistants/functions/course-context/route');
      const req = new (NextRequest as any)('http://localhost:3000/api/assistants/functions/course-context', {
        method: 'POST',
        body: JSON.stringify({ functionName: 'get_course_week_context', parameters: {} })
      })
      const res = await POST(req)
      const text = await (res as any).text()
      const data = JSON.parse(text)
      expect(data).toHaveProperty('weekNumber', 5)
      expect(data).toHaveProperty('content')
      expect(typeof data.fetchedAt === 'string').toBe(true)
    })

    test('list_course_week_summaries returns summaries object', async () => {
      // Reset modules to ensure fresh imports with mocks
      jest.resetModules();
      
      const { getWeeklyContent } = await import('@/lib/content');
      (getWeeklyContent as jest.Mock).mockResolvedValue([
        { week: 1, content: 'Intro', updatedAt: '2024-01-01T00:00:00.000Z', updatedBy: 'admin' },
        { week: 2, content: '', updatedAt: '2024-01-02T00:00:00.000Z', updatedBy: 'admin' },
      ]);

      const { POST } = await import('../app/api/assistants/functions/course-context/route');
      const req = new (NextRequest as any)('http://localhost:3000/api/assistants/functions/course-context', {
        method: 'POST',
        body: JSON.stringify({ functionName: 'list_course_week_summaries', parameters: {} })
      })
      const res = await POST(req)
      const text = await (res as any).text()
      const data = JSON.parse(text)
      expect(Array.isArray(data.weeks)).toBe(true)
      expect(data.weeks[0]).toHaveProperty('weekNumber')
    })

    test('out-of-range week gracefully clamps', async () => {
      // Reset modules to ensure fresh imports with mocks
      jest.resetModules();
      
      const { getWeekContextByNumberNormalized } = await import('@/lib/content');
      (getWeekContextByNumberNormalized as jest.Mock).mockResolvedValue({ 
        weekNumber: 14, 
        content: 'Week 14 content', 
        dateRange: '2024-04-01 - 2024-04-07',
        updatedAt: '2024-01-01T00:00:00.000Z',
        updatedBy: 'admin',
      });

      const { getAllowedConceptsForWeek, getForbiddenConceptsForWeek } = await import('@/lib/sql-curriculum');
      (getAllowedConceptsForWeek as jest.Mock).mockReturnValue([]);
      (getForbiddenConceptsForWeek as jest.Mock).mockReturnValue([]);

      const { POST } = await import('../app/api/assistants/functions/course-context/route');
      const req = new (NextRequest as any)('http://localhost:3000/api/assistants/functions/course-context', {
        method: 'POST',
        body: JSON.stringify({ functionName: 'get_course_week_context', parameters: { week: 999 } })
      })
      const res = await POST(req)
      const text = await (res as any).text()
      const data = JSON.parse(text)
      expect(data.weekNumber).toBeGreaterThanOrEqual(1)
      expect(data.weekNumber).toBeLessThanOrEqual(14)
    })

    test('auto week after semester end falls back to last curriculum week', async () => {
      jest.resetModules();

      const { getCurrentWeekContextNormalized, getWeekContextByNumberNormalized } = await import('@/lib/content');
      (getCurrentWeekContextNormalized as jest.Mock).mockResolvedValue({
        weekNumber: 14,
        content: null,
        dateRange: null,
        updatedAt: null,
        updatedBy: null,
      });
      (getWeekContextByNumberNormalized as jest.Mock).mockResolvedValue({
        weekNumber: 13,
        content: 'Final week context',
        dateRange: '2024-04-01 - 2024-04-07',
        updatedAt: '2024-04-01T00:00:00.000Z',
        updatedBy: 'admin',
      });

      const { POST } = await import('../app/api/assistants/functions/course-context/route');
      const req = new (NextRequest as any)('http://localhost:3000/api/assistants/functions/course-context', {
        method: 'POST',
        body: JSON.stringify({ functionName: 'get_course_week_context', parameters: {} })
      })
      const res = await POST(req)
      const text = await (res as any).text()
      const data = JSON.parse(text)
      expect(data.weekNumber).toBe(13)
      expect(data.content).toBe('Final week context')
      expect(getWeekContextByNumberNormalized).toHaveBeenCalledWith(13)
    })
  })

  describe('Semester Configuration', () => {
    test('should handle semester start date validation', () => {
      const validateSemesterStart = (dateString: string): boolean => {
        if (!dateString) return false;
        
        const date = new Date(dateString);
        const now = new Date();
        
        // Semester start should be valid date and not too far back
        const isValidDate = !isNaN(date.getTime());
        const notTooOld = date > new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000)); // Not more than a year ago
        const notTooFarFuture = date < new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // Not more than a month in future
        
        return isValidDate && notTooOld && notTooFarFuture;
      };

      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const twoYearsAgo = new Date(Date.now() - (2 * 365 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
      const twoMonthsFromNow = new Date(Date.now() + (60 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

      expect(validateSemesterStart(yesterday)).toBe(true);
      expect(validateSemesterStart(today)).toBe(true); // Today is acceptable
      expect(validateSemesterStart(twoMonthsFromNow)).toBe(false); // Too far in future
      expect(validateSemesterStart(twoYearsAgo)).toBe(false); // Too old
      expect(validateSemesterStart('')).toBe(false); // Empty string
      expect(validateSemesterStart('invalid-date')).toBe(false); // Invalid date
    });
  });

  describe('Error Handling', () => {
    test('should handle API errors gracefully', () => {
      const handleApiError = (error: any): { success: boolean; message: string } => {
        if (error.message?.includes('fetch')) {
          return { success: false, message: 'Network error occurred' };
        }
        if (error.message?.includes('Validation')) {
          return { success: false, message: 'Validation error occurred' };
        }
        return { success: false, message: 'Unknown error occurred' };
      };

      const networkError = new Error('Failed to fetch');
      expect(handleApiError(networkError).message).toBe('Network error occurred');

      const validationError = new Error('Validation failed');
      expect(handleApiError(validationError).message).toBe('Validation error occurred');

      const unknownError = new Error('Something went wrong');
      expect(handleApiError(unknownError).message).toBe('Unknown error occurred');
    });
  });
});
