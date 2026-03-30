const RETRIEVAL_KEYWORDS = [
  "homework",
  "assignment",
  "instructions",
  "rubric",
  "deadline",
  "slides",
  "slide",
  "notes",
  "pdf",
  "syllabus",
  "policy",
  "faq",
  "week ",
  "schema",
  "table",
  "column",
  "home work",
  "hw",
  "שיעורי בית",
  "מטלה",
  "הנחיות",
  "רובריקה",
  "דדליין",
  "מועד הגשה",
  "מצגת",
  "שקופית",
  "סיכום",
  "סיכומים",
  "הערות",
  "שבוע",
  "סכמה",
  "טבלה",
  "עמודה",
  "קובץ",
  "מסמך",
];

export const SOURCE_OF_TRUTH_CORPUS = [
  {
    id: "official_course_material",
    label: "official course material",
    description: "Instructor-approved lecture PDFs, slides, and weekly notes.",
  },
  {
    id: "homework_instructions",
    label: "homework instructions",
    description: "Assignment briefs, allowed concepts, due dates, and rubric hints.",
  },
  {
    id: "worked_examples",
    label: "worked examples",
    description: "Curated solved examples and schema walkthroughs aligned to the course.",
  },
  {
    id: "faq_policy_notes",
    label: "FAQ and policy notes",
    description: "Course FAQ, grading policy, submission policy, and tutoring guardrails.",
  },
] as const;

export function shouldUseRetrieval(content: string): boolean {
  const normalized = String(content || "").toLowerCase();
  return RETRIEVAL_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function buildRetrievalInstructions(): string {
  const corpusText = SOURCE_OF_TRUTH_CORPUS.map(
    (item) => `- ${item.label}: ${item.description}`
  ).join("\n");

  return `[RETRIEVAL SOURCE OF TRUTH]
Use file_search when the user asks about course material, assignment requirements, week-specific scope, schema details from uploaded documents, or policy.
Treat the following corpus as the only source of truth for retrieved academic content:
${corpusText}

[RETRIEVAL CITATIONS]
Whenever file_search is used, ground the answer in the retrieved material and keep source citations visible in the final answer.`;
}

export function hasVisibleCitationSection(text: string): boolean {
  return /(^|\n)(sources|מקורות)\s*:/i.test(text);
}
