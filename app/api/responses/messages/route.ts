import { openai } from "@/app/openai";
import { getAgentTools } from "@/app/agent-config";
import { ChatRequestDto, ChatResponseDto, SqlTutorResponse } from "@/lib/openai/contracts";
import { getOpenAIApiMode } from "@/lib/openai/api-mode";
import {
  createResponse,
  extractOutputText,
  extractSqlTutorResponse,
  getSqlTutorResponseFormat,
  streamResponse,
} from "@/lib/openai/responses-client";
import { executeToolCall } from "@/lib/openai/tools";
import { buildFileSearchTool, getOrCreateAppVectorStoreId } from "@/lib/openai/vector-store";

export const runtime = "nodejs";
export const maxDuration = 50;

type MessageRequestDto = ChatRequestDto & {
  stream?: boolean;
  homeworkRunner?: boolean;
  tutorMode?: boolean;
  thinkingMode?: boolean;
};

type ResponseCreateLike = {
  id?: string;
  output?: Array<any>;
};

type WeeklyPolicy = {
  extraInstructions: string;
  forcedInitialToolChoice?: {
    type: "function";
    name: "get_course_week_context";
  };
};

const tutorIntentKeywords = [
  "explain",
  "explanation",
  "why",
  "how",
  "teach",
  "tutor",
  "tutorial",
  "guide",
  "think",
  "thinking",
  "reason",
  "reasoning",
  "analyze",
  "analysis",
  "step by step",
  "help me understand",
  "what does",
  "optimize",
  "optimization",
  "mistake",
  "mistakes",
  "הסבר",
  "תסביר",
  "למד",
  "למד אותי",
  "איך",
  "מה זה",
  "למה",
  "חשיבה",
  "תחשוב",
  "לחשוב",
  "תהליך חשיבה",
  "טעויות",
  "טעות",
  "אופטימיזציה",
];

const tutorInstructions = `[TUTORING RESPONSE FORMAT]
You are a SQL tutor. Respond using the sql_tutor_response JSON schema only.
Fill each field with clear, student-friendly content.
- query: the SQL query
- explanation: step-by-step explanation
- commonMistakes: list of common mistakes
- optimization: performance/readability tips.`;

function base64ToBuffer(base64Data: string): { buffer: Buffer; mimeType: string } {
  const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Invalid base64 data URL format");
  }

  const mimeType = matches[1];
  const base64 = matches[2];
  const buffer = Buffer.from(base64, "base64");
  return { buffer, mimeType };
}

function buildWeeklyPolicy(homeworkRunner: boolean): WeeklyPolicy {
  if (homeworkRunner) {
    return {
      extraInstructions: `[HOMEWORK RUNNER - SQL CONTEXT]
הסטודנט עובד בממשק הרצת שיעורי בית. מותר להשתמש בכל פונקציות ורעיונות SQL הרלוונטיים: שאילתות מקוננות (subqueries), CONCAT, STRCMP (גם באותיות קטנות), ALL, ANY, TOP, LIMIT, JOINים מורכבים. אל תגביל את התשובות לפי שבוע לימוד — תן דוגמאות מלאות שהמנוע תומך בהן.`,
    };
  }

  return {
    extraInstructions: `[WEEK POLICY]
When SQL curriculum timing matters for an answer, call get_course_week_context first and use its tool output as the source of truth.
Never rely on guessed week numbers. Follow sqlRestrictions.allowedConcepts and sqlRestrictions.forbiddenConcepts from the tool output.

[CURRICULUM SQL SAFETY RULES]
- Never generate SQL that uses forbidden concepts for the current week.
- Explicitly avoid WITH (CTE) when it is forbidden.
- Explicitly avoid window functions (OVER, PARTITION BY, RANK, ROW_NUMBER) when forbidden.
- Explicitly avoid CASE-WHEN when forbidden.
- If a user asks for a forbidden concept, explain briefly in Hebrew that it is outside current course scope and provide an allowed alternative.
- Before returning SQL, run a final self-check that no forbidden keyword/concept appears in the answer.`,
    forcedInitialToolChoice: {
      type: "function",
      name: "get_course_week_context",
    },
  };
}

function hasTutorIntent(
  content: string,
  tutorMode?: boolean,
  metadata?: Record<string, string>
): boolean {
  if (tutorMode) {
    return true;
  }

  if (metadata?.tutor_mode === "true") {
    return true;
  }

  const normalized = content.toLowerCase();
  return tutorIntentKeywords.some((keyword) => normalized.includes(keyword));
}

function extractFunctionCalls(response: ResponseCreateLike) {
  const output = Array.isArray(response?.output) ? response.output : [];
  return output
    .filter((item) => item?.type === "function_call")
    .map((item) => ({
      callId: String(item.call_id || ""),
      name: String(item.name || ""),
      argumentsJson:
        typeof item.arguments === "string"
          ? item.arguments
          : JSON.stringify(item.arguments || {}),
    }))
    .filter((item) => item.callId && item.name);
}

function toFunctionCallOutputs(calls: Array<{ callId: string }>, results: string[]) {
  return calls.map((call, index) => ({
    type: "function_call_output" as const,
    call_id: call.callId,
    output: results[index] || JSON.stringify({ error: "Tool did not return output" }),
  }));
}

function buildEventStreamResponse(
  handler: (writer: WritableStreamDefaultWriter<Uint8Array>, encoder: TextEncoder) => Promise<void>
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const writer = new WritableStream<Uint8Array>({
        write(chunk) {
          controller.enqueue(chunk);
        },
        close() {
          controller.close();
        },
        abort(error) {
          controller.error(error);
        },
      }).getWriter();

      try {
        await handler(writer, encoder);
        await writer.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown stream error";
        await writer.write(
          encoder.encode(`${JSON.stringify({ type: "response.error", message })}\n`)
        );
        await writer.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function POST(request: Request) {
  const mode = getOpenAIApiMode();

  try {
    const body = (await request.json()) as MessageRequestDto;
    const { sessionId, content, imageData } = body ?? {};

    if (!content && !imageData) {
      return Response.json(
        { mode, error: "Either content or imageData is required." },
        { status: 400 }
      );
    }

    const inputItems: Array<{ type: "input_text" | "input_image"; text?: string; file_id?: string }> = [];
    const weeklyPolicy = buildWeeklyPolicy(Boolean(body.homeworkRunner));
    const textInput = content || "";
    const tutorIntent = hasTutorIntent(textInput, body.tutorMode, body.metadata);
    const responseFormat = tutorIntent ? getSqlTutorResponseFormat() : undefined;
    const reasoningModeEnabled = body.thinkingMode !== false || tutorIntent;
    const reasoningLanguageInstructions = reasoningModeEnabled
      ? "\n\n[REASONING SUMMARY LANGUAGE]\nWhen generating reasoning summaries, always write them in natural Hebrew (עברית) only. Keep each summary concise, student-friendly, and focused on what helps the user. Do not mention tools, function calls, APIs, or internal system actions. If a draft appears in English, rewrite it to Hebrew before returning it."
      : "";
    const extraInstructions = tutorIntent
      ? `${weeklyPolicy.extraInstructions}\n\n${tutorInstructions}${reasoningLanguageInstructions}`
      : `${weeklyPolicy.extraInstructions}${reasoningLanguageInstructions}`;

    if (textInput) {
      inputItems.push({ type: "input_text", text: textInput });
    }

    if (imageData) {
      const { buffer, mimeType } = base64ToBuffer(imageData);
      const extension = mimeType.split("/")[1] || "png";
      const fileName = `responses_upload_${Date.now()}.${extension}`;
      const file = await openai.files.create({
        file: new File([new Uint8Array(buffer)], fileName, { type: mimeType }),
        purpose: "assistants",
      });
      inputItems.push({ type: "input_image", file_id: file.id });
    }

    const initialInput = [
      {
        role: "user",
        content: inputItems.length
          ? inputItems
          : [{ type: "input_text", text: "Please help me with SQL and databases." }],
      },
    ];
    const vectorStoreId = await getOrCreateAppVectorStoreId().catch(() => null);
    const tools = vectorStoreId
      ? [...getAgentTools(), buildFileSearchTool(vectorStoreId)]
      : undefined;
    const maxIterations = 8;

    const useStream = body.stream !== false;

    if (useStream) {
      return buildEventStreamResponse(async (writer, encoder) => {
        let iterationInput: any = initialInput;
        let previousResponseId = body.previousResponseId;
        let finalOutputText = "";
        let finalResponseId = "";
        let includeReasoningSummary = reasoningModeEnabled;

        if (tutorIntent) {
          await writer.write(
            encoder.encode(`${JSON.stringify({ type: "response.tutor.mode", enabled: true })}\n`)
          );
        }

        for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
          let stream: any;
          try {
            stream = await streamResponse({
              input: iterationInput,
              previousResponseId,
              tools,
              toolChoice: iteration === 1 ? weeklyPolicy.forcedInitialToolChoice : undefined,
              extraInstructions,
              responseFormat,
              reasoning: includeReasoningSummary ? { summary: "detailed" } : undefined,
              metadata: {
                ...(body.metadata || {}),
                session_id: sessionId || "",
                route: "/api/responses/messages",
                tool_loop_iteration: String(iteration),
              },
            });
          } catch (error) {
            const message = error instanceof Error ? error.message.toLowerCase() : "";
            const canRetryWithoutReasoning =
              includeReasoningSummary &&
              (message.includes("reasoning") || message.includes("summary"));
            if (!canRetryWithoutReasoning) {
              throw error;
            }
            includeReasoningSummary = false;
            stream = await streamResponse({
              input: iterationInput,
              previousResponseId,
              tools,
              toolChoice: iteration === 1 ? weeklyPolicy.forcedInitialToolChoice : undefined,
              extraInstructions,
              responseFormat,
              metadata: {
                ...(body.metadata || {}),
                session_id: sessionId || "",
                route: "/api/responses/messages",
                tool_loop_iteration: String(iteration),
              },
            });
          }

          let iterationResponseId = "";
          let iterationOutputText = "";
          let iterationTutorResponse: SqlTutorResponse | null = null;
          const calls: Array<{ callId: string; name: string; argumentsJson: string }> = [];

          for await (const event of stream as any) {
            if (event?.type === "response.created") {
              iterationResponseId = String(event.response?.id || "");
              if (iterationResponseId) {
                await writer.write(
                  encoder.encode(
                    `${JSON.stringify({
                      type: "response.created",
                      responseId: iterationResponseId,
                    })}\n`
                  )
                );
              }
            } else if (event?.type === "response.output_text.delta" && typeof event.delta === "string") {
              iterationOutputText += event.delta;
              await writer.write(
                encoder.encode(
                  `${JSON.stringify({ type: "response.output_text.delta", delta: event.delta })}\n`
                )
              );
            } else if (
              event?.type === "response.reasoning_summary_text.delta" &&
              typeof event.delta === "string"
            ) {
              await writer.write(
                encoder.encode(
                  `${JSON.stringify({
                    type: "response.reasoning_summary_text.delta",
                    delta: event.delta,
                  })}\n`
                )
              );
            } else if (
              event?.type === "response.reasoning_summary_text.done" &&
              typeof event.text === "string"
            ) {
              await writer.write(
                encoder.encode(
                  `${JSON.stringify({
                    type: "response.reasoning_summary_text.done",
                    text: event.text,
                  })}\n`
                )
              );
            } else if (event?.type === "response.output_text.done" && typeof event.text === "string") {
              iterationOutputText = event.text;
            } else if (event?.type === "response.output_item.done" && event?.item?.type === "function_call") {
              const toolCall = {
                callId: String(event.item.call_id || ""),
                name: String(event.item.name || ""),
                argumentsJson:
                  typeof event.item.arguments === "string"
                    ? event.item.arguments
                    : JSON.stringify(event.item.arguments || {}),
              };
              calls.push(toolCall);
              await writer.write(
                encoder.encode(
                  `${JSON.stringify({ type: "response.tool_call.started", name: toolCall.name })}\n`
                )
              );
            } else if (event?.type === "response.completed") {
              iterationResponseId = String(event.response?.id || iterationResponseId || "");
              iterationOutputText = extractOutputText(event.response);
              if (tutorIntent) {
                iterationTutorResponse = extractSqlTutorResponse(event.response);
              }
            }
          }

          if (!calls.length) {
            finalResponseId = iterationResponseId;
            finalOutputText = iterationOutputText;
            await writer.write(
              encoder.encode(
                `${JSON.stringify({
                  type: "response.completed",
                  responseId: finalResponseId,
                  outputText: finalOutputText,
                  tutorResponse: iterationTutorResponse,
                })}\n`
              )
            );
            return;
          }

          const toolResults = await Promise.all(calls.map((call) => executeToolCall(call)));
          for (const call of calls) {
            await writer.write(
              encoder.encode(
                `${JSON.stringify({ type: "response.tool_call.completed", name: call.name })}\n`
              )
            );
          }
          iterationInput = toFunctionCallOutputs(calls, toolResults);
          previousResponseId = iterationResponseId;
        }

        await writer.write(
          encoder.encode(
            `${JSON.stringify({
              type: "response.completed",
              responseId: finalResponseId,
              outputText: finalOutputText,
            })}\n`
          )
        );
      });
    }

    let loopInput: any = initialInput;
    let previousResponseId = body.previousResponseId;
    let response: any = null;

    for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
      response = await createResponse({
        input: loopInput,
        previousResponseId,
        tools,
        toolChoice: iteration === 1 ? weeklyPolicy.forcedInitialToolChoice : undefined,
        extraInstructions,
        responseFormat,
        metadata: {
          ...(body.metadata || {}),
          session_id: sessionId || "",
          route: "/api/responses/messages",
          tool_loop_iteration: String(iteration),
        },
      });

      const calls = extractFunctionCalls(response);
      if (!calls.length) {
        const payload: ChatResponseDto = {
          sessionId: sessionId || null,
          responseId: response?.id || "",
          outputText: extractOutputText(response),
          tutorResponse: tutorIntent ? extractSqlTutorResponse(response) : null,
        };
        return Response.json({ mode, ...payload });
      }

      const toolResults = await Promise.all(calls.map((call) => executeToolCall(call)));
      loopInput = toFunctionCallOutputs(calls, toolResults);
      previousResponseId = response?.id;
    }

    const payload: ChatResponseDto = {
      sessionId: sessionId || null,
      responseId: response?.id || "",
      outputText: extractOutputText(response),
      tutorResponse: tutorIntent ? extractSqlTutorResponse(response) : null,
    };
    return Response.json({ mode, ...payload });
  } catch (error: any) {
    return Response.json(
      {
        mode,
        error: error?.message || "Failed to send message.",
      },
      { status: 500 }
    );
  }
}
