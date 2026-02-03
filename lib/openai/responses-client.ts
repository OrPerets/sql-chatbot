import { randomUUID } from "crypto";

import { openai } from "@/app/openai";
import { SqlTutorResponse, ToolCallOutput, ToolCallRequest } from "@/lib/openai/contracts";
import { getRuntimeAgentConfig } from "@/lib/openai/runtime-config";
import { executeToolCall } from "@/lib/openai/tools";

type UnknownRecord = Record<string, unknown>;

type CreateResponseInput = {
  input: unknown;
  previousResponseId?: string;
  metadata?: Record<string, string>;
  tools?: unknown[];
  model?: string;
  instructions?: string;
  extraInstructions?: string;
  toolChoice?: unknown;
  parallelToolCalls?: boolean | null;
  responseFormat?: unknown;
};

type ToolCallHandler = (toolCall: ToolCallRequest) => Promise<string>;

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
    const runtimeConfig = await getRuntimeAgentConfig();
    const model = params.model || runtimeConfig.model;
    const baseInstructions = params.instructions || runtimeConfig.instructions;
    const instructions = params.extraInstructions
      ? `${baseInstructions}\n\n${params.extraInstructions}`
      : baseInstructions;
    const tools = params.tools || runtimeConfig.tools;
    const toolChoice = normalizeToolChoice(params.toolChoice, tools);

    const response = await (openai as any).responses.create({
      model,
      instructions,
      tools,
      tool_choice: toolChoice,
      parallel_tool_calls: params.parallelToolCalls,
      response_format: params.responseFormat,
      input: params.input,
      previous_response_id: params.previousResponseId,
      metadata: {
        trace_id: traceId,
        ...(params.metadata || {}),
      },
    });

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
    const runtimeConfig = await getRuntimeAgentConfig();
    const model = params.model || runtimeConfig.model;
    const baseInstructions = params.instructions || runtimeConfig.instructions;
    const instructions = params.extraInstructions
      ? `${baseInstructions}\n\n${params.extraInstructions}`
      : baseInstructions;
    const tools = params.tools || runtimeConfig.tools;
    const toolChoice = normalizeToolChoice(params.toolChoice, tools);

    const stream = await (openai as any).responses.create({
      model,
      instructions,
      tools,
      tool_choice: toolChoice,
      parallel_tool_calls: params.parallelToolCalls,
      response_format: params.responseFormat,
      input: params.input,
      previous_response_id: params.previousResponseId,
      stream: true,
      metadata: {
        trace_id: traceId,
        ...(params.metadata || {}),
      },
    });

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

export function getSqlTutorResponseFormat() {
  return sqlTutorResponseFormat;
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
