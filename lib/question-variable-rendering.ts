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
  papers: variable("papers", "number", { min: 8, max: 16 }),
  min_publications: variable("min_publications", "number", { min: 12, max: 18 }),
  year: variable("year", "number", { min: 2023, max: 2026 }),
  researcher_name: variable("researcher_name", "list", {
    options: ["Prof. Nadya Segev", "Prof. Michael Chen", "Prof. Dana Levi", "Prof. Amir Cohen"],
  }),
  include_field: variable("include_field", "list", { options: ["AI", "DB", "SQL", "ML"] }),
  exclude_field: variable("exclude_field", "list", { options: ["DB", "AI", "SQL", "ML"] }),
  excluded_field: variable("excluded_field", "list", { options: ["SQL", "DB", "AI", "ML"] }),
  country: variable("country", "list", { options: ["Israel", "Italy", "Portugal", "Spain"] }),
  target_country: variable("target_country", "list", { options: ["China", "Italy", "Spain"] }),
  benchmark_country: variable("benchmark_country", "list", { options: ["US", "UK", "Germany"] }),
  benchmark_university: variable("benchmark_university", "list", { options: ["Yale", "Stanford", "Oxford"] }),
};

const LEGACY_HW2_COUNTRY_VALUES = {
  country_1: { display: "איטליה", sql: "IT" },
  country_2: { display: "פורטוגל", sql: "PO" },
  country_3: { display: "ספרד", sql: "SP" },
} as const;

const DISPLAY_SQL_VALUES: Record<string, Record<string, { display: string; sql: string }>> = {
  country: {
    Israel: { display: "ישראל", sql: "Israel" },
    Italy: { display: "איטליה", sql: "Italy" },
    Portugal: { display: "פורטוגל", sql: "Portugal" },
    Spain: { display: "ספרד", sql: "Spain" },
  },
  target_country: {
    China: { display: "סין", sql: "China" },
    Italy: { display: "איטליה", sql: "Italy" },
    Spain: { display: "ספרד", sql: "Spain" },
  },
  benchmark_country: {
    US: { display: 'ארה"ב', sql: "US" },
    UK: { display: "בריטניה", sql: "UK" },
    Germany: { display: "גרמניה", sql: "Germany" },
  },
};

const HEBREW_PREFIX_VALUES = [
  "איטליה",
  "פורטוגל",
  "ספרד",
  "ישראל",
  "סין",
  'ארה"ב',
  "בריטניה",
  "גרמניה",
];

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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeHebrewPrefixes(text: string | undefined): string | undefined {
  if (typeof text !== "string") return text;
  const valuesPattern = HEBREW_PREFIX_VALUES.map(escapeRegExp).join("|");
  return text
    .replace(new RegExp(`([בוכלמש])-(?:${valuesPattern})`, "g"), (match, prefix) => {
      return `${prefix}${match.slice(2)}`;
    });
}

function hasLegacyHw2CountryVariable(name: string): name is keyof typeof LEGACY_HW2_COUNTRY_VALUES {
  return name in LEGACY_HW2_COUNTRY_VALUES;
}

function withLegacyHw2CountryValues(
  valuesByName: Map<string, unknown>,
  mode: "display" | "sql",
): Map<string, unknown> {
  const mergedValues = new Map(valuesByName);

  for (const [name, values] of Object.entries(LEGACY_HW2_COUNTRY_VALUES)) {
    mergedValues.set(name, values[mode]);
  }

  return mergedValues;
}

function coerceValueForDefinition(value: VariableValue, definition: VariableDefinition): VariableValue {
  const options = definition.constraints?.options;

  if (definition.type === "list" && Array.isArray(options) && options.length > 0 && !options.includes(String(value.value))) {
    return { ...value, value: options[0] };
  }

  if (definition.type === "number" && typeof value.value !== "number") {
    return { ...value, value: definition.constraints?.min ?? 1 };
  }

  return value;
}

function coerceGeneratedValues(values: VariableValue[], definitionsById: Map<string, VariableDefinition>): VariableValue[] {
  return values.map((value) => {
    const definition = definitionsById.get(value.variableId);
    return definition ? coerceValueForDefinition(value, definition) : value;
  });
}

function makeRenderedValues(valuesByName: Map<string, unknown>, mode: "display" | "sql"): Map<string, unknown> {
  const renderedValues = new Map(valuesByName);

  for (const [name, value] of valuesByName.entries()) {
    const valueText = String(value);
    const override = DISPLAY_SQL_VALUES[name]?.[valueText];
    if (override) {
      renderedValues.set(name, override[mode]);
    }
  }

  return renderedValues;
}

function makeFieldsDistinct(valuesByName: Map<string, unknown>): void {
  const includeField = valuesByName.get("include_field");
  const excludeField = valuesByName.get("exclude_field");
  if (!includeField || !excludeField || includeField !== excludeField) return;

  const fieldOptions = FALLBACK_VARIABLES.exclude_field.constraints?.options ?? ["DB"];
  const replacement = fieldOptions.find((option) => option !== includeField) ?? "DB";
  valuesByName.set("exclude_field", replacement);
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
  const hasLegacyHw2Countries = variableNames.some(hasLegacyHw2CountryVariable);
  const definitions = resolveDefinitions(question, options.templates ?? [])
    .filter((definition) => !hasLegacyHw2CountryVariable(definition.name));
  const definitionIds = new Set(definitions.map((definition) => definition.id));
  const scopedExistingValues = existingValues.filter((value) => definitionIds.has(value.variableId));
  const seedQuestionId = question.templateId ?? question.id;
  const generatedValues = scopedExistingValues.length > 0
    ? scopedExistingValues
    : TemplateSystem.generateVariableValues(definitions, `${options.homeworkSetId}-${seedQuestionId}-${options.studentId}`);
  const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]));
  const normalizedGeneratedValues = coerceGeneratedValues(generatedValues, definitionsById);
  const valuesByName = new Map<string, unknown>();

  for (const value of normalizedGeneratedValues) {
    const name = definitionsById.get(value.variableId)?.name ?? value.variableId;
    valuesByName.set(name, value.value);
  }

  makeFieldsDistinct(valuesByName);

  const displayValuesByName = hasLegacyHw2Countries
    ? withLegacyHw2CountryValues(makeRenderedValues(valuesByName, "display"), "display")
    : makeRenderedValues(valuesByName, "display");
  const sqlValuesByName = hasLegacyHw2Countries
    ? withLegacyHw2CountryValues(makeRenderedValues(valuesByName, "sql"), "sql")
    : makeRenderedValues(valuesByName, "sql");
  const returnedVariables = normalizedGeneratedValues.map((value) => {
    const name = definitionsById.get(value.variableId)?.name ?? value.variableId;
    return {
      ...value,
      value: valuesByName.get(name) ?? value.value,
    };
  });

  return {
    ...question,
    prompt: normalizeHebrewPrefixes(renderText(question.prompt, displayValuesByName)) ?? question.prompt,
    instructions: normalizeHebrewPrefixes(renderText(question.instructions, displayValuesByName)) ?? question.instructions,
    expectedOutputDescription: normalizeHebrewPrefixes(renderText(question.expectedOutputDescription, displayValuesByName)),
    starterSql: renderText(question.starterSql, sqlValuesByName),
    variables: returnedVariables,
  };
}
