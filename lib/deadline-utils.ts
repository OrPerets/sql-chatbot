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

// Extension duration in milliseconds (2 days)
const EXTENSION_DURATION_MS = 2 * 24 * 60 * 60 * 1000;

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

function formatDate(date: Date): string {
  return date.toLocaleString('he-IL', {
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
  const now = nowInput ?? new Date();
  const availableFrom = resolveAvailabilityStart(homework);
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
  const effectiveAvailableUntil = getEffectiveDeadline(resolveAvailabilityEnd(homework), userEmail);
  const state = getAvailabilityState(homework, userEmail, nowInput);
  const isExtended = hasExtendedDeadline(userEmail);

  if (state === 'upcoming') {
    return `שיעור הבית ייפתח ב-${formatDate(availableFrom)}`;
  }

  if (state === 'closed') {
    return isExtended
      ? `חלון ההגשה המורחב נסגר ב-${formatDate(effectiveAvailableUntil)}`
      : `חלון ההגשה נסגר ב-${formatDate(effectiveAvailableUntil)}`;
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
  const effectiveAvailableUntil = getEffectiveDeadline(resolveAvailabilityEnd(homework), userEmail);
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
