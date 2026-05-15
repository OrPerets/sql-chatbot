export type LearnerTopic =
  | "selection_projection"
  | "filtering"
  | "sorting"
  | "joins"
  | "grouping_aggregation"
  | "subqueries"
  | "set_operations"
  | "null_handling"
  | "schema_comprehension"
  | "debugging"
  | "relational_algebra"
  | "exam_speed_fluency";

export type LearnerWeaknessKind =
  | "concept"
  | "speed"
  | "confidence"
  | "schema_reading"
  | "debugging";

export type LearnerTrend = "improving" | "stable" | "declining" | "unknown";

export type LearnerEvidenceStatus = "measured" | "insufficient_evidence";

export type TopicMasteryRecord = {
  topic: LearnerTopic;
  label: string;
  estimatedMastery: number;
  confidence: number;
  evidenceCount: number;
  lastEvidenceTime: Date | null;
  trend: LearnerTrend;
  strongestErrorTypes: string[];
  weaknessKinds: LearnerWeaknessKind[];
  status: LearnerEvidenceStatus;
  evidenceSummary: string[];
  freshnessScore?: number;
  freshnessLabel?: "fresh" | "aging" | "stale" | "unknown";
};

type TopicPatternConfig = {
  topic: LearnerTopic;
  label: string;
  patterns: RegExp[];
};

const TOPIC_CONFIG: TopicPatternConfig[] = [
  {
    topic: "selection_projection",
    label: "Selection and projection",
    patterns: [/\bselect\b/i, /\bfrom\b/i, /\bprojection\b/i, /\bcolumn\b/i],
  },
  {
    topic: "filtering",
    label: "Filtering",
    patterns: [/\bwhere\b/i, /\bfilter/i, /\bbetween\b/i, /\blike\b/i, /\bcondition\b/i],
  },
  {
    topic: "sorting",
    label: "Sorting",
    patterns: [/\border by\b/i, /\basc\b/i, /\bdesc\b/i, /\bsort/i],
  },
  {
    topic: "joins",
    label: "JOIN logic",
    patterns: [/\bjoin\b/i, /\bon\b/i, /\busing\b/i, /\bforeign key\b/i],
  },
  {
    topic: "grouping_aggregation",
    label: "Grouping and aggregation",
    patterns: [/\bgroup by\b/i, /\bhaving\b/i, /\bcount\b/i, /\bsum\b/i, /\bavg\b/i, /\bmin\b/i, /\bmax\b/i, /aggregate/i],
  },
  {
    topic: "subqueries",
    label: "Subqueries",
    patterns: [/\bsubquery\b/i, /nested query/i, /\bexists\b/i, /\bin\s*\(\s*select\b/i],
  },
  {
    topic: "set_operations",
    label: "Set operations",
    patterns: [/\bunion\b/i, /\bintersect\b/i, /\bexcept\b/i, /\bminus\b/i],
  },
  {
    topic: "null_handling",
    label: "NULL handling",
    patterns: [/\bnull\b/i, /\bis null\b/i, /\bis not null\b/i, /\bcoalesce\b/i, /\bifnull\b/i],
  },
  {
    topic: "schema_comprehension",
    label: "Schema comprehension",
    patterns: [/\bschema\b/i, /\btable\b/i, /\bcolumn\b/i, /\bfield\b/i, /\balias\b/i, /\bforeign key\b/i],
  },
  {
    topic: "debugging",
    label: "Debugging",
    patterns: [/\bdebug/i, /\berror\b/i, /\bsyntax\b/i, /\bparse\b/i, /\bincorrect\b/i, /\bwrong result\b/i],
  },
  {
    topic: "relational_algebra",
    label: "Relational algebra",
    patterns: [/\brelational algebra\b/i, /\bπ\b/i, /\bσ\b/i, /\b⨝\b/i, /\bprojection\b/i, /\bselection\b/i],
  },
  {
    topic: "exam_speed_fluency",
    label: "Exam-speed fluency",
    patterns: [/\bspeed\b/i, /\btime pressure\b/i, /\bfluency\b/i, /\bfast\b/i, /\bquickly\b/i],
  },
];

export const LEARNER_TOPIC_LABELS: Record<LearnerTopic, string> = Object.fromEntries(
  TOPIC_CONFIG.map((entry) => [entry.topic, entry.label])
) as Record<LearnerTopic, string>;

export const LEARNER_TOPICS = TOPIC_CONFIG.map((entry) => entry.topic);

export function getLearnerTopicLabel(topic: LearnerTopic): string {
  return LEARNER_TOPIC_LABELS[topic];
}

export function inferLearnerTopicsFromText(value: string | null | undefined): LearnerTopic[] {
  if (!value) {
    return [];
  }

  return TOPIC_CONFIG.filter((entry) =>
    entry.patterns.some((pattern) => pattern.test(value))
  ).map((entry) => entry.topic);
}

export function inferPrimaryLearnerTopic(
  value: string | null | undefined
): LearnerTopic | null {
  return inferLearnerTopicsFromText(value)[0] ?? null;
}
