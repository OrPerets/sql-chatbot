import {
  getLearnerTopicLabel,
  type LearnerTopic,
} from "@/lib/learner-model";

export const SQL_MISCONCEPTION_DEFINITIONS = {
  wrong_join_predicate: {
    label: "Wrong join predicate",
    studentLabel: "The JOIN matches the wrong columns",
    studentExplanation:
      "Your JOIN connects the tables, but it connects the wrong fields so the rows do not line up correctly.",
    topics: ["joins"] as LearnerTopic[],
    keywords: [
      "wrong on",
      "wrong join predicate",
      "join predicate",
      "wrong join condition",
      "incorrect join",
      "join mismatch",
    ],
  },
  missing_join_condition: {
    label: "Missing join condition",
    studentLabel: "The JOIN is missing the relationship between the tables",
    studentExplanation:
      "You joined the tables without a valid matching condition, so SQL cannot know which rows belong together.",
    topics: ["joins"] as LearnerTopic[],
    keywords: [
      "missing join",
      "missing on",
      "missing join condition",
      "cartesian",
      "cross join by mistake",
    ],
  },
  grouping_before_filtering: {
    label: "Grouping before filtering",
    studentLabel: "The query mixes up WHERE and HAVING",
    studentExplanation:
      "The filter is happening in the wrong stage. Row-level filters belong in WHERE, while group-level filters belong in HAVING.",
    topics: ["grouping_aggregation", "filtering"] as LearnerTopic[],
    keywords: [
      "where and having",
      "group by and where",
      "grouping/filter order",
      "having instead of where",
      "where instead of having",
    ],
  },
  aggregate_without_grouping: {
    label: "Aggregate without grouping",
    studentLabel: "The aggregate query is missing the right GROUP BY structure",
    studentExplanation:
      "The query uses an aggregate correctly in spirit, but the non-aggregated columns are not grouped the way SQL requires.",
    topics: ["grouping_aggregation"] as LearnerTopic[],
    keywords: [
      "aggregate without grouping",
      "group by",
      "must appear in the group by",
      "aggregate/group mismatch",
      "non-aggregated column",
    ],
  },
  alias_confusion: {
    label: "Alias confusion",
    studentLabel: "The aliases are pointing to the wrong table or column",
    studentExplanation:
      "The query introduces aliases, but later references them inconsistently, so SQL loses track of which table or column you mean.",
    topics: ["schema_comprehension", "joins"] as LearnerTopic[],
    keywords: ["alias", "ambiguous", "unknown alias", "wrong alias"],
  },
  null_misunderstanding: {
    label: "NULL misunderstanding",
    studentLabel: "The query treats NULL like a normal value",
    studentExplanation:
      "NULL needs special handling in SQL. Regular equality checks often fail when the real issue is a missing value check.",
    topics: ["null_handling", "filtering"] as LearnerTopic[],
    keywords: ["null", "is null", "is not null", "= null", "missing value"],
  },
  output_column_mismatch: {
    label: "Output column mismatch",
    studentLabel: "The result shape does not match what the question asked for",
    studentExplanation:
      "The query may be close, but it is returning the wrong columns, missing required fields, or keeping extra output that changes the answer.",
    topics: ["selection_projection", "debugging"] as LearnerTopic[],
    keywords: [
      "wrong result",
      "wrong column",
      "output-column mismatch",
      "incorrect output",
      "expected column",
      "selected the wrong columns",
    ],
  },
  schema_navigation_failure: {
    label: "Schema navigation failure",
    studentLabel: "The query is pulling from the wrong table or column",
    studentExplanation:
      "The main issue is reading the schema. The query is reaching for a table, column, or relationship that does not exist in this dataset.",
    topics: ["schema_comprehension"] as LearnerTopic[],
    keywords: [
      "table does not exist",
      "column does not exist",
      "unknown column",
      "unknown table",
      "relation does not exist",
      "schema navigation",
      "wrong table",
      "wrong column",
    ],
  },
} as const;

export type SqlMisconceptionCategory = keyof typeof SQL_MISCONCEPTION_DEFINITIONS;

export type SqlMisconceptionMatch = {
  category: SqlMisconceptionCategory;
  label: string;
  studentLabel: string;
  studentExplanation: string;
  topics: LearnerTopic[];
  confidence: number;
  reasons: string[];
};

const SQL_MISCONCEPTION_IDS = Object.keys(
  SQL_MISCONCEPTION_DEFINITIONS
) as SqlMisconceptionCategory[];

function normalizeText(value: string | null | undefined) {
  return (value ?? "").toLowerCase();
}

function pushReason(
  reasons: Map<SqlMisconceptionCategory, string[]>,
  category: SqlMisconceptionCategory,
  reason: string
) {
  const existing = reasons.get(category) ?? [];
  if (!existing.includes(reason)) {
    existing.push(reason);
    reasons.set(category, existing);
  }
}

function detectFromKeywords(
  lowerText: string,
  reasons: Map<SqlMisconceptionCategory, string[]>
) {
  SQL_MISCONCEPTION_IDS.forEach((category) => {
    const definition = SQL_MISCONCEPTION_DEFINITIONS[category];
    definition.keywords.forEach((keyword) => {
      if (lowerText.includes(keyword)) {
        pushReason(reasons, category, `Detected signal: "${keyword}"`);
      }
    });
  });
}

function detectFromSql(sql: string, prompt: string, reasons: Map<SqlMisconceptionCategory, string[]>) {
  const lowerSql = normalizeText(sql);
  const lowerPrompt = normalizeText(prompt);

  if (lowerSql.includes(" join ") && !lowerSql.includes(" on ")) {
    pushReason(reasons, "missing_join_condition", "The SQL uses JOIN without an ON clause.");
  }

  if (
    (lowerSql.includes(" count(") ||
      lowerSql.includes(" sum(") ||
      lowerSql.includes(" avg(") ||
      lowerSql.includes(" min(") ||
      lowerSql.includes(" max(")) &&
    !lowerSql.includes(" group by ") &&
    lowerPrompt.includes("each ")
  ) {
    pushReason(
      reasons,
      "aggregate_without_grouping",
      "The SQL aggregates rows but does not include a matching GROUP BY clause."
    );
  }

  if (lowerSql.includes("= null") || lowerSql.includes("!= null")) {
    pushReason(
      reasons,
      "null_misunderstanding",
      "The SQL compares NULL with a regular equality operator."
    );
  }

  if (
    lowerPrompt.includes("return only") &&
    lowerSql.includes("select *")
  ) {
    pushReason(
      reasons,
      "output_column_mismatch",
      "The question asks for a specific output shape, but the SQL selects every column."
    );
  }
}

function buildConfidence(reasons: string[]) {
  if (reasons.length >= 3) return 0.92;
  if (reasons.length === 2) return 0.82;
  return 0.68;
}

export function getSqlMisconceptionDefinition(category: SqlMisconceptionCategory) {
  return SQL_MISCONCEPTION_DEFINITIONS[category];
}

export function normalizeSqlMisconceptionCategory(
  value: string | null | undefined
): SqlMisconceptionCategory | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if ((SQL_MISCONCEPTION_IDS as string[]).includes(trimmed)) {
    return trimmed as SqlMisconceptionCategory;
  }

  const byLabel = SQL_MISCONCEPTION_IDS.find((category) => {
    const definition = SQL_MISCONCEPTION_DEFINITIONS[category];
    return (
      definition.label.toLowerCase() === trimmed ||
      definition.studentLabel.toLowerCase() === trimmed
    );
  });

  return byLabel ?? null;
}

export function inferSqlMisconceptions(input: {
  text?: string | null;
  sql?: string | null;
  prompt?: string | null;
}): SqlMisconceptionMatch[] {
  const lowerText = normalizeText(input.text);
  const prompt = input.prompt ?? "";
  const sql = input.sql ?? "";
  const reasons = new Map<SqlMisconceptionCategory, string[]>();

  detectFromKeywords(lowerText, reasons);
  detectFromSql(sql, prompt, reasons);

  return Array.from(reasons.entries())
    .map(([category, matchReasons]) => {
      const definition = SQL_MISCONCEPTION_DEFINITIONS[category];
      return {
        category,
        label: definition.label,
        studentLabel: definition.studentLabel,
        studentExplanation: definition.studentExplanation,
        topics: definition.topics,
        confidence: buildConfidence(matchReasons),
        reasons: matchReasons,
      };
    })
    .sort((left, right) => right.confidence - left.confidence);
}

export function summarizeMisconceptionForStudent(match: SqlMisconceptionMatch | null | undefined) {
  if (!match) {
    return null;
  }

  const topicLabel =
    match.topics.length > 0 ? getLearnerTopicLabel(match.topics[0]) : "SQL";

  return `${match.studentLabel}. This is mainly a ${topicLabel} issue.`;
}
