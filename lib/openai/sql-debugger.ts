export type SqlErrorCategory =
  | "syntax"
  | "wrong_join_keys"
  | "grouping_aggregation_misuse"
  | "null_handling_mistake"
  | "unknown";

export type SqlDebuggerInput = {
  studentSql: string;
  objective: string;
  schemaContext: string;
  attemptCount?: number;
};

export type SqlDebuggerOutput = {
  diagnosis: string;
  hints: string[];
  fullFix: string | null;
  errorTaxonomy: SqlErrorCategory[];
  revealAnswerEligible: boolean;
};

const taxonomyMatchers: Array<{ category: SqlErrorCategory; test: (sql: string) => boolean }> = [
  {
    category: "syntax",
    test: (sql) => /\b(SELEC|FORM|WERE|GROPU|ORDRE)\b/i.test(sql) || /\bSELECT\b[\s\S]*\bFROM\b/i.test(sql) === false,
  },
  {
    category: "wrong_join_keys",
    test: (sql) => /\bJOIN\b[\s\S]*\bON\b[\s\S]*(?:\w+\.id\s*=\s*\w+\.id|\w+\.name\s*=\s*\w+\.id)/i.test(sql),
  },
  {
    category: "grouping_aggregation_misuse",
    test: (sql) => /\bGROUP\s+BY\b/i.test(sql) && /\bCOUNT\(|\bSUM\(|\bAVG\(/i.test(sql) === false,
  },
  {
    category: "null_handling_mistake",
    test: (sql) => /(?:=|<>|!=)\s*NULL\b/i.test(sql),
  },
];

export function detectSqlErrorTaxonomy(studentSql: string): SqlErrorCategory[] {
  const sql = String(studentSql || "");
  const matches = taxonomyMatchers.filter((entry) => entry.test(sql)).map((entry) => entry.category);
  return matches.length ? matches : ["unknown"];
}

export function isRevealAnswerEligible(attemptCount?: number, threshold = 3): boolean {
  const attempts = Number.isFinite(attemptCount) ? Number(attemptCount) : 0;
  return attempts >= threshold;
}

export function buildSqlDebuggerPolicySnippet(attemptCount?: number, revealThreshold = 3): string {
  const reveal = isRevealAnswerEligible(attemptCount, revealThreshold);
  return `[SQL DEBUGGER SKILL POLICY]\nYou are operating as the sql-debugger skill.\n1) Start with diagnosis + actionable hints.\n2) Do NOT provide a full fixed query until reveal threshold is reached.\n3) Reveal threshold: ${revealThreshold} attempts.\n4) Current attempt count: ${attemptCount ?? 0}.\n5) revealAnswerEligible: ${reveal ? "true" : "false"}.\nWhen revealAnswerEligible is false, set fullFix to null and ask for one more attempt.`;
}

export function buildSqlDebuggerMvpOutput(input: SqlDebuggerInput): SqlDebuggerOutput {
  const taxonomy = detectSqlErrorTaxonomy(input.studentSql);
  const revealAnswerEligible = isRevealAnswerEligible(input.attemptCount);
  const hints: string[] = [];

  if (taxonomy.includes("syntax")) {
    hints.push("בדוק שכתבת SELECT ... FROM ... ושמות המילים השמורות תקינים.");
  }
  if (taxonomy.includes("wrong_join_keys")) {
    hints.push("ב־JOIN ודא שאתה מחבר בין מפתח זר למפתח ראשי המתאים בטבלאות הנכונות.");
  }
  if (taxonomy.includes("grouping_aggregation_misuse")) {
    hints.push("כשיש GROUP BY, עמודות שאינן אגרגטיביות חייבות להופיע בקבוצת הקיבוץ.");
  }
  if (taxonomy.includes("null_handling_mistake")) {
    hints.push("ב־NULL משתמשים ב־IS NULL או IS NOT NULL ולא ב־= NULL.");
  }
  if (!hints.length) {
    hints.push("השאילתה קרובה. נסה להשוות כל חלק לדרישת השאלה: FROM, JOIN, WHERE, GROUP BY.");
  }

  return {
    diagnosis: `Detected categories: ${taxonomy.join(", ")}`,
    hints,
    fullFix: revealAnswerEligible ? "Provide complete fixed SQL only after final student attempt." : null,
    errorTaxonomy: taxonomy,
    revealAnswerEligible,
  };
}
