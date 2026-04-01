import type { SkillDefinition } from "@/lib/openai/contracts";

export const skillDefinitionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "displayName",
    "description",
    "inputSchema",
    "outputSchema",
    "safetyConstraints",
    "telemetryTags",
  ],
  properties: {
    id: { type: "string" },
    displayName: { type: "string" },
    description: { type: "string" },
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    safetyConstraints: { type: "array", items: { type: "string" } },
    telemetryTags: { type: "array", items: { type: "string" } },
  },
} as const;

export const sprintSkillDefinitions: SkillDefinition[] = [
  {
    id: "sql-debugger",
    displayName: "SQL Debugger",
    description: "Diagnoses SQL query mistakes and provides guided hints before full fixes.",
    inputSchema: {
      type: "object",
      required: ["studentSql", "objective", "schemaContext"],
    },
    outputSchema: {
      type: "object",
      required: ["diagnosis", "hints", "fullFix"],
    },
    safetyConstraints: ["hint_first", "no_direct_answer_until_threshold"],
    telemetryTags: ["skill", "sql-debugger", "student"],
  },
];
