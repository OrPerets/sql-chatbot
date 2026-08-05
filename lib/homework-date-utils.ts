const HOMEWORK_TIME_ZONE = "Asia/Jerusalem";
const OFFSETLESS_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/;

function getTimeZoneOffsetMinutes(date: Date): number {
  const timeZoneName = new Intl.DateTimeFormat("en-US", {
    timeZone: HOMEWORK_TIME_ZONE,
    timeZoneName: "longOffset",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = timeZoneName?.match(/^GMT([+-])(\d{2}):(\d{2})$/);

  if (!match) {
    throw new Error(`Could not resolve ${HOMEWORK_TIME_ZONE} offset`);
  }

  const sign = match[1] === "+" ? 1 : -1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/**
 * The homework builder emits values from an HTML datetime-local input. Those
 * values intentionally have no offset, so interpret them in the course's
 * timezone before persisting them. Values that already contain an offset are
 * left unchanged.
 */
export function normalizeHomeworkDateTime(value: string | undefined): string | undefined {
  if (!value) return value;

  const trimmed = value.trim();
  if (!OFFSETLESS_DATE_TIME_PATTERN.test(trimmed)) {
    return value;
  }

  const wallClockAsUtc = new Date(`${trimmed}Z`);
  if (Number.isNaN(wallClockAsUtc.getTime())) {
    return value;
  }

  let offsetMinutes = getTimeZoneOffsetMinutes(wallClockAsUtc);
  let instant = new Date(wallClockAsUtc.getTime() - offsetMinutes * 60_000);

  // Re-evaluate once at the resulting instant so dates near a DST boundary
  // use the offset that applies to the actual Jerusalem instant.
  const resolvedOffsetMinutes = getTimeZoneOffsetMinutes(instant);
  if (resolvedOffsetMinutes !== offsetMinutes) {
    offsetMinutes = resolvedOffsetMinutes;
    instant = new Date(wallClockAsUtc.getTime() - offsetMinutes * 60_000);
  }

  return instant.toISOString();
}
