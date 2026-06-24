/**
 * Availability management utilities
 * Handles homework availability windows and user-specific end-time extensions.
 */

import type {
  HomeworkAvailabilityInfo,
  HomeworkAvailabilityState,
} from '@/app/homework/types';

type DateInput = string | Date | null | undefined;

export interface HomeworkAvailabilityInput {
  id?: string;
  title?: string;
  availableFrom?: DateInput;
  availableUntil?: DateInput;
  dueAt?: DateInput;
  createdAt?: DateInput;
}

// Users with extended deadlines (2 additional days)
const EXTENDED_DEADLINE_USERS = [
  'nakash.tal@gmail.com',
  'sagimor202@gmail.com',
] as const;

const HOMEWORK_ACCESS_ADMIN_EMAILS = [
  'orperets11@gmail.com',
  'roeizer@shenkar.ac.il',
  'talushka7@gmail.com',
] as const;

// Extension duration in milliseconds (2 days)
const EXTENSION_DURATION_MS = 2 * 24 * 60 * 60 * 1000;

const PERSONAL_ACCESS_OVERRIDES = [
  {
    email: 'bateldesta17@gmail.com',
    homeworkIds: ['69aabdaaafa3dcd3648446cb'],
    titleMatchers: [/^תרגיל בית 1$/, /^HW1\b/i],
    availableFrom: '2026-05-16T00:00:00.000+03:00',
    availableUntil: '2026-05-23T23:59:59.999+03:00',
  },
  {
    email: 'taltol2311@gmail.com',
    homeworkIds: ['693d8a930a7ebe39f7099c88', '693d8a930a7ebe39f7099c87'],
    titleMatchers: [/^תרגיל בית 3$/, /^תרגיל 3$/, /^HW3\b/i],
    availableFrom: '2026-06-24T00:00:00.000+03:00',
    availableUntil: '2026-06-25T00:05:00.000+03:00',
  },
  {
    email: 'elay83832@gmail.com',
    homeworkIds: ['693d8a930a7ebe39f7099c88', '693d8a930a7ebe39f7099c87'],
    titleMatchers: [/^תרגיל בית 3$/, /^תרגיל 3$/, /^HW3\b/i],
    availableFrom: '2026-06-24T00:00:00.000+03:00',
    availableUntil: '2026-06-25T00:05:00.000+03:00',
  },
] as const;

function toDate(value: DateInput, fallback?: Date): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return fallback ?? new Date();
}

function resolveAvailabilityStart(homework: HomeworkAvailabilityInput): Date {
  return toDate(
    homework.availableFrom,
    homework.createdAt ? toDate(homework.createdAt, new Date(0)) : new Date(0)
  );
}

function resolveAvailabilityEnd(homework: HomeworkAvailabilityInput): Date {
  return toDate(homework.availableUntil ?? homework.dueAt, new Date());
}

function findPersonalAccessOverride(
  homework: HomeworkAvailabilityInput,
  userEmail: string | null | undefined
) {
  if (!userEmail) return null;

  const normalizedEmail = userEmail.toLowerCase().trim();
  const homeworkId = homework.id?.trim();
  const homeworkTitle = homework.title?.trim() ?? '';

  return PERSONAL_ACCESS_OVERRIDES.find((override) => {
    if (override.email !== normalizedEmail) {
      return false;
    }

    if (homeworkId && (override.homeworkIds as readonly string[]).includes(homeworkId)) {
      return true;
    }

    return override.titleMatchers.some((matcher) => matcher.test(homeworkTitle));
  }) ?? null;
}

function getPersonalAccessWindow(
  homework: HomeworkAvailabilityInput,
  userEmail: string | null | undefined
) {
  const override = findPersonalAccessOverride(homework, userEmail);
  if (!override) return null;

  return {
    availableFrom: toDate(override.availableFrom),
    availableUntil: toDate(override.availableUntil),
  };
}

function formatDate(date: Date): string {
  return date.toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Check if a user has an extended deadline.
 */
export function hasExtendedDeadline(userEmail: string | null | undefined): boolean {
  if (!userEmail) return false;
  const normalizedEmail = userEmail.toLowerCase().trim();
  return (EXTENDED_DEADLINE_USERS as readonly string[]).includes(normalizedEmail);
}

export function isHomeworkAccessAdmin(userEmail: string | null | undefined): boolean {
  if (!userEmail) return false;
  const normalizedEmail = userEmail.toLowerCase().trim();
  return (HOMEWORK_ACCESS_ADMIN_EMAILS as readonly string[]).includes(normalizedEmail);
}

/**
 * Get the effective end of the availability window for a user.
 */
export function getEffectiveDeadline(
  standardDeadline: string | Date,
  userEmail: string | null | undefined
): Date {
  const standardDate = toDate(standardDeadline);

  if (hasExtendedDeadline(userEmail)) {
    return new Date(standardDate.getTime() + EXTENSION_DURATION_MS);
  }

  return standardDate;
}

export function getAvailabilityState(
  homework: HomeworkAvailabilityInput,
  userEmail: string | null | undefined,
  nowInput?: Date
): HomeworkAvailabilityState {
  if (isHomeworkAccessAdmin(userEmail)) {
    return 'open';
  }

  const now = nowInput ?? new Date();
  const availableFrom = resolveAvailabilityStart(homework);
  const personalAccessWindow = getPersonalAccessWindow(homework, userEmail);

  if (
    personalAccessWindow &&
    now >= personalAccessWindow.availableFrom &&
    now <= personalAccessWindow.availableUntil
  ) {
    return 'open';
  }

  const effectiveAvailableUntil = getEffectiveDeadline(resolveAvailabilityEnd(homework), userEmail);

  if (now < availableFrom) {
    return 'upcoming';
  }

  if (now > effectiveAvailableUntil) {
    return 'closed';
  }

  return 'open';
}

export function isHomeworkAccessible(
  homework: HomeworkAvailabilityInput,
  userEmail: string | null | undefined,
  nowInput?: Date
): boolean {
  return getAvailabilityState(homework, userEmail, nowInput) === 'open';
}

export function getAvailabilityMessage(
  homework: HomeworkAvailabilityInput,
  userEmail: string | null | undefined,
  nowInput?: Date
): string {
  const availableFrom = resolveAvailabilityStart(homework);
  const personalAccessWindow = getPersonalAccessWindow(homework, userEmail);
  const effectiveAvailableUntil = getEffectiveDeadline(resolveAvailabilityEnd(homework), userEmail);
  const state = getAvailabilityState(homework, userEmail, nowInput);
  const isExtended = hasExtendedDeadline(userEmail);
  const hasActivePersonalAccess =
    personalAccessWindow &&
    state === 'open' &&
    (nowInput ?? new Date()) >= personalAccessWindow.availableFrom &&
    (nowInput ?? new Date()) <= personalAccessWindow.availableUntil;

  if (state === 'upcoming') {
    return `שיעור הבית ייפתח ב-${formatDate(availableFrom)}`;
  }

  if (state === 'closed') {
    return isExtended
      ? `חלון ההגשה המורחב נסגר ב-${formatDate(effectiveAvailableUntil)}`
      : `חלון ההגשה נסגר ב-${formatDate(effectiveAvailableUntil)}`;
  }

  if (hasActivePersonalAccess) {
    return `זמין להגשה עד ${formatDate(personalAccessWindow.availableUntil)} (כולל פתיחה אישית)`;
  }

  return isExtended
    ? `זמין להגשה עד ${formatDate(effectiveAvailableUntil)} (כולל הארכה אישית)`
    : `זמין להגשה עד ${formatDate(effectiveAvailableUntil)}`;
}

export function getHomeworkAvailabilityInfo(
  homework: HomeworkAvailabilityInput,
  userEmail: string | null | undefined,
  nowInput?: Date
): HomeworkAvailabilityInfo {
  const personalAccessWindow = getPersonalAccessWindow(homework, userEmail);
  const standardEffectiveDeadline = getEffectiveDeadline(resolveAvailabilityEnd(homework), userEmail);
  const effectiveAvailableUntil = personalAccessWindow &&
    personalAccessWindow.availableUntil > standardEffectiveDeadline
    ? personalAccessWindow.availableUntil
    : standardEffectiveDeadline;
  const availabilityState = getAvailabilityState(homework, userEmail, nowInput);

  return {
    availabilityState,
    accessible: availabilityState === 'open',
    availabilityMessage: getAvailabilityMessage(homework, userEmail, nowInput),
    effectiveAvailableUntil: effectiveAvailableUntil.toISOString(),
  };
}

/**
 * Backward-compatible helper for UI surfaces still labeled around "deadline".
 */
export function getDeadlineMessage(
  dueAt: string | Date,
  userEmail: string | null | undefined
): string {
  return getAvailabilityMessage({ dueAt }, userEmail);
}
