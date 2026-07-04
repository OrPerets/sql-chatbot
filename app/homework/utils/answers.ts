import type { SqlAnswer } from "@/app/homework/types";

type AnswerTextSource = Pick<SqlAnswer, "sql" | "expression"> | null | undefined;

export function getAnswerText(answer: AnswerTextSource): string {
  const expression = answer?.expression?.trim();
  if (expression) return answer?.expression ?? "";
  return answer?.sql ?? "";
}

export function hasAnswerText(answer: AnswerTextSource): boolean {
  return getAnswerText(answer).trim().length > 0;
}
