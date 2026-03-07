import {
  getAvailabilityMessage,
  getAvailabilityState,
  getHomeworkAvailabilityInfo,
  isHomeworkAccessible,
} from '@/lib/deadline-utils';

describe('deadline-utils availability windows', () => {
  const now = new Date('2026-03-06T10:00:00.000Z');

  it('treats homework as upcoming before availableFrom', () => {
    const homework = {
      availableFrom: '2026-03-07T00:00:00.000Z',
      availableUntil: '2026-03-10T00:00:00.000Z',
    };

    expect(getAvailabilityState(homework, null, now)).toBe('upcoming');
    expect(isHomeworkAccessible(homework, null, now)).toBe(false);
    expect(getAvailabilityMessage(homework, null, now)).toContain('ייפתח');
  });

  it('treats legacy dueAt-only homework as open before the deadline', () => {
    const homework = {
      dueAt: '2026-03-08T00:00:00.000Z',
      createdAt: '2026-03-01T00:00:00.000Z',
    };

    const info = getHomeworkAvailabilityInfo(homework, null, now);

    expect(info.availabilityState).toBe('open');
    expect(info.accessible).toBe(true);
    expect(info.effectiveAvailableUntil).toBe('2026-03-08T00:00:00.000Z');
  });

  it('treats homework as closed after availableUntil', () => {
    const homework = {
      availableFrom: '2026-03-01T00:00:00.000Z',
      availableUntil: '2026-03-05T00:00:00.000Z',
    };

    const info = getHomeworkAvailabilityInfo(homework, null, now);

    expect(info.availabilityState).toBe('closed');
    expect(info.accessible).toBe(false);
    expect(getAvailabilityMessage(homework, null, now)).toContain('נסגר');
  });

  it('applies deadline extensions to the end of the availability window', () => {
    const homework = {
      availableFrom: '2026-03-01T00:00:00.000Z',
      availableUntil: '2026-03-05T00:00:00.000Z',
    };

    expect(getAvailabilityState(homework, 'nakash.tal@gmail.com', now)).toBe('open');
    expect(getAvailabilityState(homework, 'student@example.com', now)).toBe('closed');
  });

  it('uses createdAt as the fallback opening date for legacy homework', () => {
    const homework = {
      dueAt: '2026-03-07T00:00:00.000Z',
      createdAt: '2026-03-06T09:00:00.000Z',
    };

    expect(getAvailabilityState(homework, null, now)).toBe('open');
  });
});
