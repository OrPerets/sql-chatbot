import { randomUUID } from "crypto";

import { openai } from "@/app/openai";
import {
  RelationalAlgebraTutorResponse,
  SqlTutorResponse,
  ToolCallOutput,
  ToolCallRequest,
} from "@/lib/openai/contracts";
import { getRuntimeAgentConfig } from "@/lib/openai/runtime-config";
import { executeToolCall } from "@/lib/openai/tools";

type UnknownRecord = Record<string, unknown>;

type CreateResponseInput = {
  input: unknown;
  fallbackInput?: unknown;
  previousResponseId?: string;
  conversation?: string;
  metadata?: Record<string, string>;
  tools?: unknown[];
  model?: string;
  instructions?: string;
  extraInstructions?: string;
  toolChoice?: unknown;
  parallelToolCalls?: boolean | null;
  responseFormat?: unknown;
  reasoning?: unknown;
  include?: string[];
  store?: boolean;
  truncation?: "auto" | "disabled" | string;
  promptCacheKey?: string;
  promptCacheRetention?: "24h";
  safetyIdentifier?: string;
  background?: boolean;
};

type ToolCallHandler = (toolCall: ToolCallRequest) => Promise<string>;

function normalizeTextFormat(format: unknown): unknown {
  if (!format || typeof format !== "object") {
    return format;
  }

  const candidate = format as Record<string, any>;
  if (candidate.type === "json_schema" && candidate.json_schema) {
    const schemaSpec = candidate.json_schema as Record<string, any>;
    return {
      type: "json_schema",
      name: schemaSpec.name,
      schema: schemaSpec.schema,
      strict: schemaSpec.strict,
    };
  }

  return format;
}

function normalizeToolChoice(toolChoice: unknown, tools: unknown[]): unknown {
  if (!toolChoice || typeof toolChoice !== "object") {
    return toolChoice;
  }

  const candidate = toolChoice as { type?: string; name?: string };
  if (candidate.type !== "function" || !candidate.name) {
    return toolChoice;
  }

  const hasFunctionTool = tools.some((tool) => {
    if (!tool || typeof tool !== "object") {
      return false;
    }
    const item = tool as { type?: string; name?: string };
    return item.type === "function" && item.name === candidate.name;
  });

  return hasFunctionTool ? toolChoice : undefined;
}

function createTraceId(): string {
  return `rsp_${randomUUID()}`;
}

function isRecoverablePreviousResponseError(error: any): boolean {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("previous_response_id") &&
    (message.includes("invalid") ||
      message.includes("missing") ||
      message.includes("not found") ||
      message.includes("does not exist") ||
      message.includes("expired") ||
      message.includes("cannot"))
  );
}

async function buildPayload(params: CreateResponseInput, traceId: string, stream: boolean) {
  const runtimeConfig = await getRuntimeAgentConfig();
  const model = params.model || runtimeConfig.model;
  const baseInstructions = params.instructions || runtimeConfig.instructions;
  const instructions = params.extraInstructions
    ? `${baseInstructions}\n\n${params.extraInstructions}`
    : baseInstructions;
  const tools = params.tools || runtimeConfig.tools;
  const toolChoice = normalizeToolChoice(params.toolChoice, tools);

  const payload: Record<string, unknown> = {
    model,
    instructions,
    tools,
    tool_choice: toolChoice,
    parallel_tool_calls: params.parallelToolCalls,
    input: params.input,
    previous_response_id: params.previousResponseId,
    conversation: params.conversation,
    stream,
    include: params.include,
    store: params.store,
    truncation: params.truncation,
    prompt_cache_key: params.promptCacheKey,
    prompt_cache_retention: params.promptCacheRetention,
    safety_identifier: params.safetyIdentifier,
    background: params.background,
    metadata: {
      trace_id: traceId,
      ...(params.metadata || {}),
    },
  };

  if (typeof params.responseFormat !== "undefined") {
    payload.text = { format: normalizeTextFormat(params.responseFormat) };
  }
  if (typeof params.reasoning !== "undefined") {
    payload.reasoning = params.reasoning;
  }

  if (!params.previousResponseId) {
    delete payload.previous_response_id;
  }
  if (!params.conversation) {
    delete payload.conversation;
  }
  if (!params.include?.length) {
    delete payload.include;
  }
  if (typeof params.store === "undefined") {
    delete payload.store;
  }
  if (!params.truncation) {
    delete payload.truncation;
  }
  if (!params.promptCacheKey) {
    delete payload.prompt_cache_key;
  }
  if (!params.promptCacheRetention) {
    delete payload.prompt_cache_retention;
  }
  if (!params.safetyIdentifier) {
    delete payload.safety_identifier;
  }
  if (typeof params.background === "undefined") {
    delete payload.background;
  }
  if (!stream) {
    delete payload.stream;
  }

  return { payload, model };
}

function logAdapterEvent(level: "info" | "error", event: string, payload: UnknownRecord): void {
  const logPayload = {
    source: "responses-client",
    level,
    event,
    ...payload,
  };

  if (level === "error") {
    console.error(JSON.stringify(logPayload));
    return;
  }

  console.log(JSON.stringify(logPayload));
}

export async function createResponse(params: CreateResponseInput) {
  const traceId = createTraceId();
  const start = Date.now();

  try {
    const { payload, model } = await buildPayload(params, traceId, false);
    let response: any;

    try {
      response = await (openai as any).responses.create(payload);
    } catch (error: any) {
      if (!params.fallbackInput || !isRecoverablePreviousResponseError(error)) {
        throw error;
      }

      logAdapterEvent("info", "create_response.previous_response_fallback", {
        traceId,
        previousResponseId: params.previousResponseId || null,
      });

      response = await (openai as any).responses.create({
        ...payload,
        input: params.fallbackInput,
        previous_response_id: undefined,
      });
    }

    logAdapterEvent("info", "create_response.success", {
      traceId,
      responseId: response?.id || null,
      model,
      durationMs: Date.now() - start,
    });

    return response;
  } catch (error: any) {
    logAdapterEvent("error", "create_response.error", {
      traceId,
      durationMs: Date.now() - start,
      message: error?.message || "Unknown error",
    });
    throw error;
  }
}

export async function streamResponse(params: CreateResponseInput) {
  const traceId = createTraceId();
  const start = Date.now();

  try {
    const { payload, model } = await buildPayload(params, traceId, true);
    let stream: any;

    try {
      stream = await (openai as any).responses.create(payload);
    } catch (error: any) {
      if (!params.fallbackInput || !isRecoverablePreviousResponseError(error)) {
        throw error;
      }

      logAdapterEvent("info", "stream_response.previous_response_fallback", {
        traceId,
        previousResponseId: params.previousResponseId || null,
      });

      stream = await (openai as any).responses.create({
        ...payload,
        input: params.fallbackInput,
        previous_response_id: undefined,
      });
    }

    logAdapterEvent("info", "stream_response.started", {
      traceId,
      model,
      durationMs: Date.now() - start,
    });

    return stream;
  } catch (error: any) {
    logAdapterEvent("error", "stream_response.error", {
      traceId,
      durationMs: Date.now() - start,
      message: error?.message || "Unknown error",
    });
    throw error;
  }
}

export function extractOutputText(response: any): string {
  if (!response) {
    return "";
  }

  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  const chunks: string[] = [];
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (item?.type !== "message" || !Array.isArray(item?.content)) {
      continue;
    }

    for (const contentItem of item.content) {
      if (typeof contentItem?.text === "string") {
        chunks.push(contentItem.text);
      } else if (typeof contentItem?.text?.value === "string") {
        chunks.push(contentItem.text.value);
      }
    }
  }

  return chunks.join("");
}

const sqlTutorResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "sql_tutor_response",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: {
          type: "string",
          description: "A runnable SQL query that answers the student's request.",
        },
        explanation: {
          type: "string",
          description: "A clear, student-friendly explanation of how the query works.",
        },
        commonMistakes: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Common mistakes students might make with this query.",
        },
        optimization: {
          type: "string",
          description: "Suggestions for performance or readability improvements.",
        },
      },
      required: ["query", "explanation", "commonMistakes", "optimization"],
    },
    strict: true,
  },
} as const;

const relationalAlgebraTutorResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "relational_algebra_tutor_response",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: {
          type: "string",
          description: "Short overview of the relational algebra approach.",
        },
        relationalAlgebraExpression: {
          type: "string",
          description: "The relational algebra expression using course-appropriate notation.",
        },
        steps: {
          type: "array",
          description: "Ordered relational algebra explanation steps.",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              operator: { type: "string" },
              symbol: { type: "string" },
              expression: { type: "string" },
              explanation: { type: "string" },
              sqlEquivalent: { type: ["string", "null"] },
            },
            required: [
              "title",
              "operator",
              "symbol",
              "expression",
              "explanation",
              "sqlEquivalent",
            ],
          },
        },
        commonMistakes: {
          type: "array",
          items: {
            type: "string",
          },
        },
        examples: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              concept: { type: "string" },
              sqlExample: { type: "string" },
              relationalAlgebraExample: { type: "string" },
              note: { type: "string" },
            },
            required: ["concept", "sqlExample", "relationalAlgebraExample", "note"],
          },
        },
        scopeNote: {
          type: "string",
          description: "Clarifies scope limitations and non-classical SQL features when relevant.",
        },
      },
      required: [
        "summary",
        "relationalAlgebraExpression",
        "steps",
        "commonMistakes",
        "examples",
        "scopeNote",
      ],
    },
    strict: true,
  },
} as const;

export function getSqlTutorResponseFormat() {
  return sqlTutorResponseFormat;
}

export function getRelationalAlgebraTutorResponseFormat() {
  return relationalAlgebraTutorResponseFormat;
}

function isSqlTutorResponse(value: unknown): value is SqlTutorResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as SqlTutorResponse;
  return (
    typeof candidate.query === "string" &&
    typeof candidate.explanation === "string" &&
    typeof candidate.optimization === "string" &&
    Array.isArray(candidate.commonMistakes) &&
    candidate.commonMistakes.every((item) => typeof item === "string")
  );
}

function isRelationalAlgebraTutorResponse(
  value: unknown
): value is RelationalAlgebraTutorResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as RelationalAlgebraTutorResponse;
  return (
    typeof candidate.summary === "string" &&
    typeof candidate.relationalAlgebraExpression === "string" &&
    typeof candidate.scopeNote === "string" &&
    Array.isArray(candidate.commonMistakes) &&
    candidate.commonMistakes.every((item) => typeof item === "string") &&
    Array.isArray(candidate.steps) &&
    candidate.steps.every(
      (step) =>
        step &&
        typeof step === "object" &&
        typeof step.title === "string" &&
        typeof step.operator === "string" &&
        typeof step.symbol === "string" &&
        typeof step.expression === "string" &&
        typeof step.explanation === "string" &&
        (typeof step.sqlEquivalent === "undefined" || typeof step.sqlEquivalent === "string")
    ) &&
    Array.isArray(candidate.examples) &&
    candidate.examples.every(
      (example) =>
        example &&
        typeof example === "object" &&
        typeof example.concept === "string" &&
        typeof example.sqlExample === "string" &&
        typeof example.relationalAlgebraExample === "string" &&
        typeof example.note === "string"
    )
  );
}

export function extractSqlTutorResponse(response: any): SqlTutorResponse | null {
  const outputText = extractOutputText(response);
  if (!outputText) {
    return null;
  }

  try {
    const parsed = JSON.parse(outputText) as unknown;
    return isSqlTutorResponse(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function extractRelationalAlgebraTutorResponse(
  response: any
): RelationalAlgebraTutorResponse | null {
  const outputText = extractOutputText(response);
  if (!outputText) {
    return null;
  }

  try {
    const parsed = JSON.parse(outputText) as unknown;
    return isRelationalAlgebraTutorResponse(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extractFunctionCalls(response: any): ToolCallRequest[] {
  const output = Array.isArray(response?.output) ? response.output : [];
  return output
    .filter((item) => item?.type === "function_call")
    .map((item) => ({
      callId: String(item.call_id || ""),
      name: String(item.name || ""),
      argumentsJson: typeof item.arguments === "string" ? item.arguments : JSON.stringify(item.arguments || {}),
    }))
    .filter((item) => item.callId && item.name);
}

function toToolOutputs(calls: ToolCallRequest[], results: string[]): ToolCallOutput[] {
  return calls.map((call, index) => ({
    type: "function_call_output",
    call_id: call.callId,
    output: results[index] || JSON.stringify({ error: "Tool did not return output" }),
  }));
}

export async function runToolLoop(
  params: CreateResponseInput & {
    maxIterations?: number;
    toolHandler?: ToolCallHandler;
  }
) {
  const maxIterations = params.maxIterations || 8;
  const toolHandler = params.toolHandler || executeToolCall;
  let previousResponseId = params.previousResponseId;
  let nextInput = params.input;
  let response: any = null;

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    response = await createResponse({
      input: nextInput,
      previousResponseId,
      metadata: {
        tool_loop_iteration: String(iteration),
        ...(params.metadata || {}),
      },
      tools: params.tools,
    });

    const functionCalls = extractFunctionCalls(response);
    if (!functionCalls.length) {
      return response;
    }

    const outputs = await Promise.all(functionCalls.map((call) => toolHandler(call)));
    const toolOutputs = toToolOutputs(functionCalls, outputs);

    previousResponseId = response.id;
    nextInput = toolOutputs;
  }

  return response;
}
