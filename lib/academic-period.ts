import { DEFAULT_ADMIN_EMAILS } from "./admin-emails";

export interface AcademicPeriod {
  year: number;
  semester: number;
}

export const DEFAULT_ACADEMIC_PERIOD: AcademicPeriod = {
  year: 2026,
  semester: 2,
};

export const ACADEMIC_SEMESTER_OPTIONS = [
  { value: 1, label: "A" },
  { value: 2, label: "B" },
  { value: 3, label: "C" },
] as const;

export function getAcademicSemesterLabel(semester: number): string {
  return ACADEMIC_SEMESTER_OPTIONS.find((option) => option.value === semester)?.label ?? String(semester);
}

export function formatAcademicPeriodLabel(period: AcademicPeriod): string {
  return `${period.year}/${getAcademicSemesterLabel(period.semester)}`;
}

const PRIVILEGED_ROLES = ["admin", "instructor", "teacher", "builder"];

function parseNumericValue(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parseAcademicPeriodFromSearchParams(searchParams: URLSearchParams): AcademicPeriod | null {
  const year = parseNumericValue(searchParams.get("year"));
  const semester = parseNumericValue(searchParams.get("semester"));

  if (!year || !semester) {
    return null;
  }

  return { year, semester };
}

export function isNonEmptyAcademicValue(value: unknown): boolean {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined;
}

export function normalizeAcademicPeriodInput(input: {
  year?: unknown;
  semester?: unknown;
}): AcademicPeriod | null {
  const year = typeof input.year === "number" ? input.year : Number.parseInt(String(input.year ?? ""), 10);
  const semester =
    typeof input.semester === "number" ? input.semester : Number.parseInt(String(input.semester ?? ""), 10);

  if (!Number.isFinite(year) || !Number.isFinite(semester) || year <= 0 || semester <= 0) {
    return null;
  }

  return {
    year: Math.trunc(year),
    semester: Math.trunc(semester),
  };
}

export function isPrivilegedUserRecord(user: {
  email?: string | null;
  role?: string | null;
}): boolean {
  const email = String(user.email || "").trim().toLowerCase();
  const role = String(user.role || "").trim().toLowerCase();
  return DEFAULT_ADMIN_EMAILS.map((adminEmail) => adminEmail.toLowerCase()).includes(email)
    || PRIVILEGED_ROLES.includes(role);
}

export function buildAcademicPeriodUserQuery(period?: AcademicPeriod | null) {
  if (!period) {
    return {};
  }

  const adminEmails = DEFAULT_ADMIN_EMAILS.map((email) => email.toLowerCase());

  return {
    $or: [
      { email: { $in: adminEmails } },
      { role: { $in: PRIVILEGED_ROLES } },
      {
        $and: [
          { email: { $nin: adminEmails } },
          { role: { $nin: PRIVILEGED_ROLES } },
          { year: period.year },
          { semester: period.semester },
        ],
      },
    ],
  };
}

export function buildAcademicPeriodSearchParams(period: AcademicPeriod): string {
  const params = new URLSearchParams({
    year: String(period.year),
    semester: String(period.semester),
  });
  return params.toString();
}
