import {
  getAvailabilityMessage,
  getAvailabilityState,
  getHomeworkAvailabilityInfo,
  isHomeworkAccessAdmin,
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

  it('lets homework admins open assignments outside the student availability window', () => {
    const homework = {
      availableFrom: '2026-03-07T00:00:00.000Z',
      availableUntil: '2026-03-10T00:00:00.000Z',
    };

    expect(isHomeworkAccessAdmin('orperets11@gmail.com')).toBe(true);
    expect(isHomeworkAccessAdmin('roeizer@shenkar.ac.il')).toBe(true);
    expect(getAvailabilityState(homework, 'orperets11@gmail.com', now)).toBe('open');
    expect(isHomeworkAccessible(homework, 'roeizer@shenkar.ac.il', now)).toBe(true);
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

  it('opens HW1 for the approved student during the personal access window', () => {
    const homework = {
      id: '69aabdaaafa3dcd3648446cb',
      title: 'תרגיל בית 1',
      availableFrom: '2026-01-01T00:00:00.000Z',
      availableUntil: '2026-01-08T00:00:00.000Z',
    };
    const duringOverride = new Date('2026-05-16T10:00:00.000Z');

    const info = getHomeworkAvailabilityInfo(homework, 'bateldesta17@gmail.com', duringOverride);

    expect(info.availabilityState).toBe('open');
    expect(info.accessible).toBe(true);
    expect(info.effectiveAvailableUntil).toBe('2026-05-23T20:59:59.999Z');
    expect(info.availabilityMessage).toContain('פתיחה אישית');
    expect(getAvailabilityState(homework, 'student@example.com', duringOverride)).toBe('closed');
  });

  it('uses a strict DB override as the effective personal availability window', () => {
    const homework = {
      id: 'set-1',
      title: 'Global Open Homework',
      availableFrom: '2026-03-01T00:00:00.000Z',
      availableUntil: '2026-03-20T00:00:00.000Z',
    };
    const overrideWindow = {
      availableFrom: '2026-03-08T00:00:00.000Z',
      availableUntil: '2026-03-09T00:00:00.000Z',
      strict: true,
      source: 'db' as const,
    };

    expect(getAvailabilityState(homework, 'student@example.com', now, overrideWindow)).toBe('upcoming');
    expect(isHomeworkAccessible(homework, 'student@example.com', now, overrideWindow)).toBe(false);
    expect(getAvailabilityState(homework, 'student@example.com', new Date('2026-03-10T00:00:00.000Z'), overrideWindow))
      .toBe('closed');
    expect(getHomeworkAvailabilityInfo(homework, 'student@example.com', now, overrideWindow).effectiveAvailableUntil)
      .toBe('2026-03-09T00:00:00.000Z');
    expect(getAvailabilityState(homework, 'control@example.com', now)).toBe('open');
  });

  it('closes the personal HW1 access window after one week', () => {
    const homework = {
      id: '69aabdaaafa3dcd3648446cb',
      title: 'תרגיל בית 1',
      availableFrom: '2026-01-01T00:00:00.000Z',
      availableUntil: '2026-01-08T00:00:00.000Z',
    };
    const afterOverride = new Date('2026-05-24T00:00:00.000Z');

    expect(getAvailabilityState(homework, 'bateldesta17@gmail.com', afterOverride)).toBe('closed');
  });

  it('uses createdAt as the fallback opening date for legacy homework', () => {
    const homework = {
      dueAt: '2026-03-07T00:00:00.000Z',
      createdAt: '2026-03-06T09:00:00.000Z',
    };

    expect(getAvailabilityState(homework, null, now)).toBe('open');
  });
});
