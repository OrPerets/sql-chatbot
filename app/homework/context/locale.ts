export type SupportedHomeworkLocale = "he" | "en";

export function resolveHomeworkLocale(candidate?: string | null): SupportedHomeworkLocale {
  if (!candidate) return "he";
  if (candidate.toLowerCase().startsWith("en")) return "en";
  return "he";
}
