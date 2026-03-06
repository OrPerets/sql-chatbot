type QuestionSchemaColumn = {
  column: string;
  type?: string;
};

export function buildExpectedOutputDescription(
  expectedOutputDescription?: string | null,
  expectedResultSchema?: QuestionSchemaColumn[] | null,
): string {
  const trimmed = expectedOutputDescription?.trim();
  if (trimmed) {
    return trimmed;
  }

  if (!expectedResultSchema || expectedResultSchema.length === 0) {
    return "";
  }

  const columns = expectedResultSchema
    .map((entry) => entry?.column?.trim())
    .filter(Boolean);

  if (columns.length === 0) {
    return "";
  }

  return `הפלט הצפוי צריך לכלול את העמודות: ${columns.join(", ")}.`;
}
