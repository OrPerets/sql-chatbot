/**
 * Deadline management utilities
 * Handles standard deadlines and user-specific deadline extensions
 */

// Users with extended deadlines (2 additional days)
const EXTENDED_DEADLINE_USERS = [
  'nakash.tal@gmail.com',
  'sagimor202@gmail.com',
] as const;

// Extension duration in milliseconds (2 days)
const EXTENSION_DURATION_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Check if a user has an extended deadline
 */
export function hasExtendedDeadline(userEmail: string | null | undefined): boolean {
  if (!userEmail) return false;
  const normalizedEmail = userEmail.toLowerCase().trim();
  return (EXTENDED_DEADLINE_USERS as readonly string[]).includes(normalizedEmail);
}

/**
 * Get the effective deadline for a user
 * Returns the extended deadline if the user qualifies, otherwise returns the standard deadline
 */
export function getEffectiveDeadline(
  standardDeadline: string | Date,
  userEmail: string | null | undefined
): Date {
  const standardDate = typeof standardDeadline === 'string' 
    ? new Date(standardDeadline) 
    : standardDeadline;

  if (hasExtendedDeadline(userEmail)) {
    return new Date(standardDate.getTime() + EXTENSION_DURATION_MS);
  }

  return standardDate;
}

/**
 * Check if a homework is still accessible for a user
 * Returns true if the current time is before the effective deadline
 */
export function isHomeworkAccessible(
  dueAt: string | Date,
  userEmail: string | null | undefined
): boolean {
  const effectiveDeadline = getEffectiveDeadline(dueAt, userEmail);
  const now = new Date();
  return now < effectiveDeadline;
}

/**
 * Get the deadline message for display
 */
export function getDeadlineMessage(
  dueAt: string | Date,
  userEmail: string | null | undefined
): string {
  const effectiveDeadline = getEffectiveDeadline(dueAt, userEmail);
  const isExtended = hasExtendedDeadline(userEmail);
  
  const dateStr = effectiveDeadline.toLocaleString('he-IL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isExtended) {
    return `תאריך הגשה מורחב: ${dateStr}`;
  }
  
  return `תאריך הגשה: ${dateStr}`;
}
