import type {
  Question,
  QuestionParameterDefinition,
  QuestionParameterMode,
  QuestionParameterSourceField,
  VariableConstraints,
  VariableType,
  VariableValue,
} from "@/app/homework/types";
import type { QuestionDraft } from "@/app/homework/builder/components/wizard/types";

const PARAMETER_PATTERN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

type ParameterizedQuestionShape = Pick<
  Question,
  | "id"
  | "prompt"
  | "instructions"
  | "starterSql"
  | "expectedOutputDescription"
  | "expectedResultSchema"
  | "gradingRubric"
  | "datasetId"
  | "maxAttempts"
  | "points"
  | "evaluationMode"
  | "templateId"
  | "parameterMode"
  | "parameters"
>;

export interface ParameterTokenUsage {
  name: string;
  sourceFields: QuestionParameterSourceField[];
}

export interface InlineQuestionPreview {
  question: Question;
  variables: VariableValue[];
}

function buildMatches(input: string): string[] {
  if (!input) return [];
  return Array.from(input.matchAll(PARAMETER_PATTERN)).map((match) => match[1]!.trim());
}

export function collectQuestionParameterTokens(fields: {
  prompt?: string;
  instructions?: string;
  starterSql?: string;
}): ParameterTokenUsage[] {
  const usageByName = new Map<string, Set<QuestionParameterSourceField>>();

  const register = (field: QuestionParameterSourceField, value?: string) => {
    for (const name of buildMatches(value ?? "")) {
      const current = usageByName.get(name) ?? new Set<QuestionParameterSourceField>();
      current.add(field);
      usageByName.set(name, current);
    }
  };

  register("prompt", fields.prompt);
  register("instructions", fields.instructions);
  register("starterSql", fields.starterSql);

  return Array.from(usageByName.entries()).map(([name, sourceFields]) => ({
    name,
    sourceFields: Array.from(sourceFields),
  }));
}

function defaultConstraintsForType(type: VariableType): VariableConstraints {
  switch (type) {
    case "number":
      return { min: 1, max: 100, step: 1 };
    case "string":
      return { minLength: 1, maxLength: 12 };
    case "date":
      return { minDate: "2024-01-01", maxDate: "2026-12-31", format: "YYYY-MM-DD" };
    case "list":
      return { options: ["option_1", "option_2", "option_3"] };
    case "range":
      return { start: 1, end: 10 };
    case "table_name":
      return { tableNames: ["employees", "departments", "orders"] };
    case "column_name":
      return { columnNames: ["id", "name", "created_at"] };
    case "sql_value":
      return { dataTypes: ["VARCHAR", "INTEGER", "DATE"] };
    default:
      return {};
  }
}

function createParameterDefinition(
  name: string,
  sourceFields: QuestionParameterSourceField[],
): QuestionParameterDefinition {
  return {
    id: `param-${name}`,
    name,
    sourceFields,
    type: "number",
    description: "",
    constraints: defaultConstraintsForType("number"),
    defaultValue: undefined,
    required: true,
  };
}

export function syncQuestionParameters<T extends QuestionDraft | Question>(
  question: T,
  options?: { forceParameterized?: boolean },
): T {
  const tokens = collectQuestionParameterTokens({
    prompt: question.prompt,
    instructions: question.instructions,
    starterSql: question.starterSql,
  });

  const existing = new Map((question.parameters ?? []).map((parameter) => [parameter.name, parameter]));
  const parameters = tokens.map(({ name, sourceFields }) => {
    const current = existing.get(name);
    if (!current) {
      return createParameterDefinition(name, sourceFields);
    }

    return {
      ...current,
      sourceFields,
      constraints: current.constraints ?? defaultConstraintsForType(current.type),
    };
  });

  const parameterMode: QuestionParameterMode =
    options?.forceParameterized || tokens.length > 0 || question.parameterMode === "parameterized"
      ? "parameterized"
      : "static";

  return {
    ...question,
    parameterMode,
    parameters,
  };
}

function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }

  let current = Math.abs(hash);
  return () => {
    current = (current * 9301 + 49297) % 233280;
    return current / 233280;
  };
}

function randomString(length: number, random: () => number): string {
  const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += characters[Math.floor(random() * characters.length)]!;
  }
  return value;
}

function generateValue(parameter: QuestionParameterDefinition, random: () => number) {
  const constraints = parameter.constraints ?? {};

  if (parameter.defaultValue !== undefined && parameter.defaultValue !== "") {
    return parameter.defaultValue;
  }

  switch (parameter.type) {
    case "number": {
      const min = constraints.min ?? 1;
      const max = constraints.max ?? 100;
      const step = constraints.step ?? 1;
      const steps = Math.max(0, Math.floor((max - min) / step));
      return min + Math.floor(random() * (steps + 1)) * step;
    }
    case "string": {
      const minLength = constraints.minLength ?? 1;
      const maxLength = constraints.maxLength ?? Math.max(8, minLength);
      const length = minLength + Math.floor(random() * (maxLength - minLength + 1));
      return randomString(length, random);
    }
    case "date": {
      const minDate = new Date(constraints.minDate ?? "2024-01-01");
      const maxDate = new Date(constraints.maxDate ?? "2026-12-31");
      const value = minDate.getTime() + random() * (maxDate.getTime() - minDate.getTime());
      return new Date(value).toISOString().slice(0, 10);
    }
    case "list": {
      const options = constraints.options ?? [];
      return options[Math.floor(random() * options.length)] ?? "option";
    }
    case "range": {
      const start = constraints.start ?? 1;
      const end = constraints.end ?? 10;
      return start + Math.floor(random() * (end - start + 1));
    }
    case "table_name": {
      const tableNames = constraints.tableNames ?? [];
      return tableNames[Math.floor(random() * tableNames.length)] ?? "table_name";
    }
    case "column_name": {
      const columnNames = constraints.columnNames ?? [];
      return columnNames[Math.floor(random() * columnNames.length)] ?? "column_name";
    }
    case "sql_value": {
      const types = constraints.dataTypes ?? [];
      const dataType = types[Math.floor(random() * types.length)] ?? "VARCHAR";
      if (dataType === "INTEGER") return Math.floor(random() * 1000);
      if (dataType === "DATE") return `'${new Date(2025, 0, 1 + Math.floor(random() * 28)).toISOString().slice(0, 10)}'`;
      return `'${randomString(6, random)}'`;
    }
    default:
      return "";
  }
}

function substituteTemplate(input: string | undefined, variables: VariableValue[], parameters: QuestionParameterDefinition[]) {
  if (!input) return input ?? "";
  let output = input;
  for (const variable of variables) {
    const parameter = parameters.find((entry) => entry.id === variable.variableId);
    if (!parameter) continue;
    output = output.replace(new RegExp(`\\{\\{\\s*${parameter.name}\\s*\\}\\}`, "g"), String(variable.value));
  }
  return output;
}

export function instantiateInlineQuestion(
  question: ParameterizedQuestionShape,
  options: {
    homeworkSetId: string;
    studentId: string;
    sampleIndex?: number;
  },
): InlineQuestionPreview {
  const parameters = question.parameters ?? [];
  const normalizedMode: QuestionParameterMode =
    question.parameterMode ?? (parameters.length > 0 ? "parameterized" : "static");

  if (normalizedMode !== "parameterized" || parameters.length === 0) {
    return {
      question: {
        ...question,
        id: question.id,
        variables: [],
        parameterMode: normalizedMode,
      },
      variables: [],
    };
  }

  const seed = `${options.homeworkSetId}-${question.id}-${options.studentId}-${options.sampleIndex ?? 0}`;
  const random = seededRandom(seed);
  const variables = parameters.map((parameter) => ({
    variableId: parameter.id,
    value: generateValue(parameter, random),
    generatedAt: seed,
  }));

  return {
    question: {
      ...question,
      id: question.id,
      prompt: substituteTemplate(question.prompt, variables, parameters),
      instructions: substituteTemplate(question.instructions, variables, parameters),
      starterSql: substituteTemplate(question.starterSql, variables, parameters),
      expectedOutputDescription: substituteTemplate(question.expectedOutputDescription, variables, parameters),
      variables,
      parameterMode: normalizedMode,
      isTemplate: false,
    },
    variables,
  };
}

export function buildInlineQuestionPreviews(
  question: ParameterizedQuestionShape,
  options: {
    homeworkSetId: string;
    studentId: string;
    sampleCount?: number;
  },
): InlineQuestionPreview[] {
  const sampleCount = options.sampleCount ?? 3;
  return Array.from({ length: sampleCount }, (_, sampleIndex) =>
    instantiateInlineQuestion(question, {
      homeworkSetId: options.homeworkSetId,
      studentId: options.studentId,
      sampleIndex,
    }),
  );
}

export function validateQuestionParameters(question: Pick<QuestionDraft, "parameterMode" | "parameters" | "prompt" | "instructions" | "starterSql">): string[] {
  const errors: string[] = [];
  const parameterMode = question.parameterMode ?? ((question.parameters?.length ?? 0) > 0 ? "parameterized" : "static");

  if (parameterMode !== "parameterized") {
    return errors;
  }

  const tokens = collectQuestionParameterTokens({
    prompt: question.prompt,
    instructions: question.instructions,
    starterSql: question.starterSql,
  });
  const parameters = question.parameters ?? [];

  if (tokens.length === 0) {
    errors.push("יש להוסיף לפחות פרמטר אחד באמצעות {{token}}.");
  }

  for (const token of tokens) {
    const parameter = parameters.find((entry) => entry.name === token.name);
    if (!parameter) {
      errors.push(`הפרמטר ${token.name} מזוהה בטקסט אך לא הוגדר.`);
      continue;
    }

    const constraints = parameter.constraints ?? {};
    if (parameter.type === "number" && constraints.min !== undefined && constraints.max !== undefined && constraints.min > constraints.max) {
      errors.push(`הטווח של ${parameter.name} אינו תקין.`);
    }
    if (parameter.type === "number" && constraints.step !== undefined && constraints.step <= 0) {
      errors.push(`לפרמטר ${parameter.name} חייב להיות צעד חיובי.`);
    }
    if (parameter.type === "string" && constraints.minLength !== undefined && constraints.maxLength !== undefined && constraints.minLength > constraints.maxLength) {
      errors.push(`אורך הטקסט של ${parameter.name} אינו תקין.`);
    }
    if (parameter.type === "list" && (!constraints.options || constraints.options.filter(Boolean).length === 0)) {
      errors.push(`יש להגדיר אפשרויות עבור ${parameter.name}.`);
    }
    if (parameter.type === "range" && constraints.start !== undefined && constraints.end !== undefined && constraints.start > constraints.end) {
      errors.push(`טווח הערכים של ${parameter.name} אינו תקין.`);
    }
    if (parameter.type === "date" && constraints.minDate && constraints.maxDate && constraints.minDate > constraints.maxDate) {
      errors.push(`טווח התאריכים של ${parameter.name} אינו תקין.`);
    }
  }

  return errors;
}
