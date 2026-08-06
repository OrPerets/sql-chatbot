export const SQL_COIN_CHALLENGE_TOPICS = [
  { value: "subqueries", label: "תתי שאילתות" },
  { value: "joins", label: "צירופים" },
  { value: "relational_algebra", label: "אלגברת יחסים" },
  { value: "aggregation", label: "קיבוץ ואגרגציה" },
  { value: "filtering_sorting", label: "סינון ומיון" },
] as const;

export const SQL_COIN_CHALLENGE_DIFFICULTIES = [
  { value: "easy", label: "קל" },
  { value: "medium", label: "בינוני" },
  { value: "hard", label: "קשה" },
] as const;

export type SqlCoinChallengeTopic = (typeof SQL_COIN_CHALLENGE_TOPICS)[number]["value"];
export type SqlCoinChallengeDifficulty = (typeof SQL_COIN_CHALLENGE_DIFFICULTIES)[number]["value"];

export function normalizeSqlCoinChallengeTopic(value: unknown): SqlCoinChallengeTopic | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  const option = SQL_COIN_CHALLENGE_TOPICS.find((topic) => topic.value === normalized);
  return option?.value ?? null;
}

export function normalizeSqlCoinChallengeDifficulty(value: unknown): SqlCoinChallengeDifficulty | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  const option = SQL_COIN_CHALLENGE_DIFFICULTIES.find((difficulty) => difficulty.value === normalized);
  return option?.value ?? null;
}

export function getSqlCoinChallengeTopicLabel(topic: SqlCoinChallengeTopic): string {
  return SQL_COIN_CHALLENGE_TOPICS.find((option) => option.value === topic)?.label ?? topic;
}

export function getSqlCoinChallengeDifficultyLabel(difficulty: SqlCoinChallengeDifficulty): string {
  return SQL_COIN_CHALLENGE_DIFFICULTIES.find((option) => option.value === difficulty)?.label ?? difficulty;
}
