import type { Question, QuestionTemplate, VariableDefinition, VariableValue } from "@/app/homework/types";
import { TemplateSystem } from "./template-system";

const PLACEHOLDER_PATTERN = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

const FALLBACK_VARIABLES: Record<string, VariableDefinition> = {
  start_year: variable("start_year", "number", { min: 1980, max: 1992 }),
  end_year: variable("end_year", "number", { min: 1993, max: 2000 }),
  min_salary: variable("min_salary", "number", { min: 5000, max: 8000, step: 500 }),
  max_salary: variable("max_salary", "number", { min: 9000, max: 15000, step: 500 }),
  max_age: variable("max_age", "number", { min: 25, max: 45 }),
  eur_amount: variable("eur_amount", "number", { min: 1500, max: 3000, step: 100 }),
  exchange_rate: variable("exchange_rate", "number", { min: 3.5, max: 4.3, step: 0.1 }),
  increase_percent: variable("increase_percent", "number", { min: 5, max: 20 }),
  city_length: variable("city_length", "number", { min: 4, max: 10 }),
  include_letter: variable("include_letter", "list", { options: ["a", "e", "i", "o", "r", "n", "l"] }),
  exclude_letter: variable("exclude_letter", "list", { options: ["a", "e", "i", "o", "r", "n", "l"] }),
  name_letter: variable("name_letter", "list", { options: ["a", "e", "i", "o", "r", "n", "l"] }),
  last_name_letter: variable("last_name_letter", "list", { options: ["a", "e", "i", "o", "r", "n", "l"] }),
  excluded_department_letter: variable("excluded_department_letter", "list", { options: ["a", "e", "i", "o", "r", "n", "l"] }),
  street_letter: variable("street_letter", "list", { options: ["a", "e", "i", "o", "r", "n", "l"] }),
};

function variable(name: string, type: VariableDefinition["type"], constraints?: VariableDefinition["constraints"]): VariableDefinition {
  return {
    id: name,
    name,
    type,
    constraints,
    required: true,
  };
}

export function extractQuestionVariableNames(question: Pick<Question, "prompt" | "instructions" | "starterSql" | "expectedOutputDescription">): string[] {
  const names: string[] = [];
  const source = [
    question.prompt,
    question.instructions,
    question.starterSql,
    question.expectedOutputDescription,
  ].filter(Boolean).join("\n");

  for (const match of source.matchAll(PLACEHOLDER_PATTERN)) {
    const name = match[1];
    if (name && !names.includes(name)) {
      names.push(name);
    }
  }

  return names;
}

function renderText(text: string | undefined, valuesByName: Map<string, unknown>): string | undefined {
  if (typeof text !== "string") return text;
  return text.replace(PLACEHOLDER_PATTERN, (match, name: string) => {
    if (!valuesByName.has(name)) return match;
    return String(valuesByName.get(name));
  });
}

function findTemplateDefinitions(question: Question, templates: QuestionTemplate[]): VariableDefinition[] {
  if (question.templateId) {
    return templates.find((template) => template.id === question.templateId)?.variables ?? [];
  }

  const questionNames = extractQuestionVariableNames(question);
  if (questionNames.length === 0) return [];

  const exactMatch = templates.find((template) => {
    const templateNames = template.variables.map((definition) => definition.name);
    return questionNames.length === templateNames.length && questionNames.every((name) => templateNames.includes(name));
  });

  if (exactMatch) return exactMatch.variables;

  return templates.find((template) => {
    const templateNames = template.variables.map((definition) => definition.name);
    return questionNames.every((name) => templateNames.includes(name));
  })?.variables ?? [];
}

function resolveDefinitions(question: Question, templates: QuestionTemplate[]): VariableDefinition[] {
  const questionNames = extractQuestionVariableNames(question);
  const templateDefinitions = findTemplateDefinitions(question, templates);

  return questionNames.map((name) => {
    const fallback = FALLBACK_VARIABLES[name];
    if (fallback) return fallback;
    const templateDefinition = templateDefinitions.find((definition) => definition.name === name);
    if (templateDefinition) return templateDefinition;
    return variable(name, "string", { minLength: 3, maxLength: 8 });
  });
}

export function renderQuestionVariables(
  question: Question,
  options: {
    homeworkSetId: string;
    studentId: string;
    templates?: QuestionTemplate[];
  },
): Question {
  const variableNames = extractQuestionVariableNames(question);
  if (variableNames.length === 0) return question;

  const existingValues = Array.isArray(question.variables) ? question.variables as VariableValue[] : [];
  const definitions = resolveDefinitions(question, options.templates ?? []);
  const generatedValues = existingValues.length > 0
    ? existingValues
    : TemplateSystem.generateVariableValues(definitions, `${options.homeworkSetId}-${question.id}-${options.studentId}`);
  const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]));
  const valuesByName = new Map<string, unknown>();

  for (const value of generatedValues) {
    const name = definitionsById.get(value.variableId)?.name ?? value.variableId;
    valuesByName.set(name, value.value);
  }

  return {
    ...question,
    prompt: renderText(question.prompt, valuesByName) ?? question.prompt,
    instructions: renderText(question.instructions, valuesByName) ?? question.instructions,
    expectedOutputDescription: renderText(question.expectedOutputDescription, valuesByName),
    starterSql: renderText(question.starterSql, valuesByName),
    variables: generatedValues,
  };
}
