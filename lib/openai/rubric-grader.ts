export type RubricDimension = {
  id: string;
  label: string;
  weight: number;
  criteria: string;
  examples?: string[];
};

export type RubricScore = {
  dimensionId: string;
  label: string;
  weight: number;
  score: number;
  rationale: string;
};

export type RubricGraderInput = {
  rubric: RubricDimension[];
  studentResponse: string;
  assignmentContext?: string;
};

export type RubricGraderResult = {
  success: true;
  totalScore: number;
  confidence: number;
  reviewRequired: boolean;
  reviewReason?: string;
  scores: RubricScore[];
  correctionGuidance: string[];
};

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function collectDimensionKeywords(dimension: RubricDimension): string[] {
  const sources = [dimension.label, dimension.criteria, ...(dimension.examples || [])]
    .map((part) => normalizeText(part))
    .filter(Boolean);
  return Array.from(
    new Set(
      sources
        .flatMap((source) => source.split(/[^\p{L}\p{N}_]+/u))
        .filter((token) => token.length >= 4)
    )
  );
}

function boundedScore(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function gradeWithRubric(input: RubricGraderInput): RubricGraderResult {
  const normalizedResponse = normalizeText(input.studentResponse || "");
  const responseTokens = new Set(
    normalizedResponse
      .split(/[^\p{L}\p{N}_]+/u)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2)
  );

  const totalWeight = input.rubric.reduce((sum, dimension) => sum + Math.max(0, dimension.weight), 0) || 1;

  const scores = input.rubric.map((dimension) => {
    const keywords = collectDimensionKeywords(dimension);
    const matched = keywords.filter((keyword) => responseTokens.has(keyword));
    const coverage = keywords.length ? matched.length / keywords.length : normalizedResponse.length ? 0.5 : 0;
    const score = boundedScore(coverage);

    return {
      dimensionId: dimension.id,
      label: dimension.label,
      weight: dimension.weight,
      score,
      rationale:
        matched.length > 0
          ? `Evidence matched: ${matched.slice(0, 5).join(", ")}.`
          : "No clear evidence for this criterion in the current response.",
    } satisfies RubricScore;
  });

  const totalScore = scores.reduce(
    (sum, score) => sum + score.score * (Math.max(0, score.weight) / totalWeight),
    0
  );
  const confidenceSignals = scores.map((score) => score.score);
  const confidence = Math.round(
    (confidenceSignals.reduce((sum, signal) => sum + signal, 0) / Math.max(1, confidenceSignals.length)) * 100
  );
  const reviewRequired = confidence < 55;

  const correctionGuidance = scores
    .filter((score) => score.score < 0.7)
    .map((score) => `Improve ${score.label}: directly address rubric criteria with concrete SQL evidence.`);

  return {
    success: true,
    totalScore: Number(totalScore.toFixed(3)),
    confidence,
    reviewRequired,
    reviewReason: reviewRequired ? "Low confidence rubric match; manual review required." : undefined,
    scores,
    correctionGuidance,
  };
}
