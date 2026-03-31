import { createHash } from "crypto";

import { openai } from "@/app/openai";
import { getAgentToolsForContext } from "@/app/agent-config";
import { requireInstructorOrAdmin } from "@/lib/admin-auth";
import { getChatMessages } from "@/lib/chat";
import {
  ChatRequestDto,
  ChatResponseDto,
  ResponseCitation,
  ResponseTurnMetadata,
  TutorResponse,
  ToolCallUsage,
  TutorSubjectMode,
} from "@/lib/openai/contracts";
import {
  appendVisibleCitations,
  extractConnectorCalls,
  buildResponseTurnMetadata,
  extractResponseCitations,
  extractWebSearchMetrics,
} from "@/lib/openai/response-artifacts";
import {
  buildInstructorConnectorPromptRules,
  buildInstructorConnectorTools,
} from "@/lib/openai/instructor-connectors";
import { buildRetrievalInstructions, shouldUseRetrieval } from "@/lib/openai/retrieval";
import { getOpenAIApiMode } from "@/lib/openai/api-mode";
import { getOpenAIFeatureFlag } from "@/lib/openai/feature-flags";
import { getStudentPersonalizationBundle } from "@/lib/personalization";
import {
  createResponse,
  extractRelationalAlgebraTutorResponse,
  extractOutputText,
  extractSqlTutorResponse,
  getRelationalAlgebraTutorResponseFormat,
  getSqlTutorResponseFormat,
  streamResponse,
} from "@/lib/openai/responses-client";
import {
  MichaelToolContext,
  executeToolCall,
  getToolName,
  ToolExecutionContext,
} from "@/lib/openai/tools";
import { logToolUsageAuditEvent } from "@/lib/openai/tool-usage-logging";
import { buildFileSearchTool, getOrCreateAppVectorStoreId } from "@/lib/openai/vector-store";
import { chargeMainChatMessage, getCoinsConfig } from "@/lib/coins";
import { insufficientCoinsResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 50;

type MessageRequestDto = ChatRequestDto & {
  stream?: boolean;
  homeworkRunner?: boolean;
  tutorMode?: boolean;
  thinkingMode?: boolean;
  includeReasoningSummary?: boolean;
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

type ResolvedToolContext = {
  toolContext: MichaelToolContext;
  userRole: "student" | "instructor" | "admin";
  actorEmail?: string;
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

const personalizationIntentKeywords = [
  "where am i struggling",
  "what am i struggling with",
  "what should i study",
  "what should i practice",
  "what should i do next",
  "next step",
  "my weak areas",
  "weaknesses",
  "mistakes",
  "based on my mistakes",
  "איפה אני מתקשה",
  "במה אני מתקשה",
  "איפה קשה לי",
  "מה החולשות שלי",
  "מה כדאי לי לתרגל",
  "מה כדאי לי ללמוד",
  "מה כדאי לי לעשות עכשיו",
  "מה הצעד הבא",
  "טעויות",
  "לפי הטעויות שלי",
  "חולשות",
];

const tutorInstructions = `[TUTORING RESPONSE FORMAT]
You are a SQL tutor. Respond using the sql_tutor_response JSON schema only.
Fill each field with clear, student-friendly content.
- query: the SQL query
- explanation: step-by-step explanation
- commonMistakes: list of common mistakes
- optimization: performance/readability tips.`;

const relationalAlgebraTutorInstructions = `[RELATIONAL ALGEBRA TUTORING MODE]
You are teaching relational algebra for an introductory databases course.
Respond using the relational_algebra_tutor_response JSON schema only.

Rules:
- Prefer relational algebra notation and reasoning over raw SQL whenever possible.
- When the user writes SQL, explicitly map the SQL clauses into relational algebra operators.
- Use explain_relational_algebra_step when you need a reliable SQL-to-RA or RA-to-explanation decomposition.
- Keep the explanation in clear Hebrew, course-aligned, and step-by-step.
- Use only course-appropriate operators: σ, π, ⋈, ρ, ∪, ∩, −, ×, ÷ and γ when grouping is relevant.
- If the input uses ORDER BY, LIMIT, TOP, or another SQL-only feature, mention briefly that it is not part of classical relational algebra.`;

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

function buildWeeklyPolicy(toolContext: MichaelToolContext): WeeklyPolicy {
  if (toolContext === "homework_runner") {
    return {
      extraInstructions: `[HOMEWORK RUNNER - TUTORING MODE]
אתה פועל בתוך ממשק הרצת שיעורי בית. תפקידך להנחות את הסטודנט, לא לפתור במקומו.

הנחיות חובה:
- אל תספק תשובה ישירה או קוד SQL מוכן לשאלה. הנחה בלבד.
- תן רמזים, שאלות מנחות והכוונה שתעזורנה לסטודנט להגיע לפתרון בעצמו.
- שאל בחזרה (למשל: "איזו טבלה צריכה להיכלל?", "איזה תנאי WHERE מתאים?") במקום לתת את השאילתה.
- הסבר עקרונות וכללים רלוונטיים; אל תכתוב את השאילתה המלאה אלא אם הסטודנט כבר ניסה ונכשל וברור שצריך דוגמה אחת אחרונה.
- ענה בעברית. כאשר רלוונטי, הדגש מונחי SQL והסכמה.

[SQL CONTEXT]
מותר להתייחס לכל פונקציות SQL הרלוונטיות: subqueries, CONCAT, STRCMP, ALL, ANY, TOP, LIMIT, JOINים. אל תגביל לפי שבוע לימוד — תן רמזים מלאים שהמנוע תומך בהם.`,
    };
  }

  if (toolContext === "admin") {
    return {
      extraInstructions: `[ADMIN RESPONSES POLICY]
You are assisting an instructor or admin user.

Tool rules:
- Prefer internal course files, uploaded PDFs, and Michael's existing course tools for canonical course truth.
- Use web search only for current events, external references, official documentation, or freshness-sensitive questions.
- Do not use web search to decide grading outcomes, verify student correctness, or override internal course policy.
- If internal material already answers the question, stay grounded in that material instead of searching the web.
- When web sources are used, keep claims tied to cited sources and do not overstate certainty.`,
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

async function resolveToolContext(
  request: Request,
  body: MessageRequestDto
): Promise<ResolvedToolContext> {
  if (body.context === "admin") {
    const privilegedUser = await requireInstructorOrAdmin(request);
    return {
      toolContext: "admin",
      userRole: privilegedUser.role,
      actorEmail: privilegedUser.email,
    };
  }

  return {
    toolContext: body.homeworkRunner ? "homework_runner" : "main_chat",
    userRole: "student",
  };
}

function hasBuiltInTool(tools: unknown[], toolType: "web_search") {
  return tools.some(
    (tool) => Boolean(tool) && typeof tool === "object" && (tool as { type?: string }).type === toolType
  );
}

function isReasoningSummaryError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("reasoning") || message.includes("summary");
}

function isWebSearchUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("web_search") ||
    message.includes("web search") ||
    message.includes("rate limit") ||
    message.includes("429")
  );
}

function buildWebSearchFallbackInstructions(extraInstructions: string) {
  return `${extraInstructions}\n\n[WEB SEARCH FALLBACK]\nLive web search is unavailable for this turn. Answer without web search. If freshness matters, say briefly that live web search was unavailable.`;
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

function hasPersonalizationIntent(content: string): boolean {
  const normalized = content.toLowerCase();
  return personalizationIntentKeywords.some((keyword) => normalized.includes(keyword));
}

function resolveTutorSubjectMode(
  content: string,
  metadata?: Record<string, string>
): TutorSubjectMode {
  const explicitMode =
    typeof metadata?.subject_mode === "string" ? metadata.subject_mode.trim().toLowerCase() : "";
  const homeworkType =
    typeof metadata?.homework_type === "string" ? metadata.homework_type.trim().toLowerCase() : "";

  if (explicitMode === "relational_algebra" || homeworkType === "relational_algebra") {
    return "relational_algebra";
  }

  const normalized = content.toLowerCase();
  const relationalAlgebraSignals = [
    "relational algebra",
    "אלגברת יחסים",
    "selection",
    "projection",
    "rename",
    "cartesian product",
    "צירוף",
    "הקרנה",
    "בחירה",
    "מכפלה קרטזית",
    "division",
    "semijoin",
    "σ",
    "π",
    "ρ",
    "⋈",
    "γ",
    "∪",
    "∩",
    "÷",
  ];

  return relationalAlgebraSignals.some((keyword) => normalized.includes(keyword))
    ? "relational_algebra"
    : "sql";
}

function buildPersonalizationContextBlock(
  bundle: Awaited<ReturnType<typeof getStudentPersonalizationBundle>>
): string {
  const weaknesses = bundle.snapshot.weaknesses
    .slice(0, 5)
    .map((weakness) => `- ${weakness.label}: ${weakness.reasons[0] || "Recurring weak signal"}`)
    .join("\n");
  const strengths = bundle.snapshot.strengths
    .slice(0, 3)
    .map((strength) => `- ${strength.label}`)
    .join("\n");
  const repeatedMistakes = bundle.recentAttempts.repeatedMistakeThemes
    .slice(0, 5)
    .map((theme) => `- ${theme}`)
    .join("\n");

  return `[PRELOADED PERSONALIZATION DATA]
Use this stored student-personalization evidence directly in your answer. Do not say that no data is available unless the lists below are actually empty.

Current weak areas:
${weaknesses || "- No ranked weak areas were stored."}

Current strong areas:
${strengths || "- No ranked strong areas were stored."}

Repeated mistake themes:
${repeatedMistakes || "- No repeated mistake themes were stored."}

Quiz summary:
- Total attempts: ${bundle.snapshot.quizSummary.totalAttempts}
- Last score: ${bundle.snapshot.quizSummary.lastScore ?? "unknown"}
- Average score: ${bundle.snapshot.quizSummary.averageScore ?? "unknown"}

Risk summary:
- Risk level: ${bundle.snapshot.riskSummary.riskLevel}
- Reasons: ${bundle.snapshot.riskSummary.reasons.join(", ") || "none"}

Recommended next step:
- ${bundle.recommendation.primary.title}
- Rationale: ${bundle.recommendation.primary.rationale}

Answer in a direct, personalized way grounded in this evidence.`;
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

function hashStableIdentifier(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 32);
}

function buildSafetyIdentifier(userEmail: string | null): string | undefined {
  if (!userEmail) {
    return undefined;
  }
  return `student_${hashStableIdentifier(userEmail.trim().toLowerCase())}`;
}

function buildPromptCacheKey(params: {
  context?: MichaelToolContext;
  homeworkRunner: boolean;
  tutorIntent: boolean;
  subjectMode: TutorSubjectMode;
  retrievalNeeded: boolean;
  hasImage: boolean;
}): string {
  const contextLabel = params.context === "admin" ? "admin" : params.homeworkRunner ? "homework" : "main";
  return [
    "michael",
    contextLabel,
    params.tutorIntent ? `${params.subjectMode}_tutor` : "chat",
    params.retrievalNeeded ? "retrieval" : "direct",
    params.hasImage ? "image" : "text",
  ].join(":");
}

function buildReasoningConfig(
  includeReasoningSummary: boolean,
  reasoningEffort?: MessageRequestDto["reasoningEffort"]
) {
  if (includeReasoningSummary) {
    return reasoningEffort
      ? { effort: reasoningEffort, summary: "detailed" as const }
      : { summary: "detailed" as const };
  }

  if (!reasoningEffort) {
    return undefined;
  }

  return { effort: reasoningEffort };
}

async function buildFallbackInputFromChat(
  chatId: string,
  currentTurn: Array<{ role: string; content: Array<{ type: string; text?: string; file_id?: string }> }>
) {
  const storedMessages = await getChatMessages(chatId).catch(() => []);
  const history = storedMessages
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.text === "string" &&
        message.text.trim().length > 0
    )
    .slice(-12)
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: [{ type: "input_text" as const, text: message.text }],
    }));

  return [...history, ...currentTurn];
}

export async function POST(request: Request) {
  const mode = getOpenAIApiMode();

  try {
    const body = (await request.json()) as MessageRequestDto;
    const { sessionId, chatId, content, imageData } = body ?? {};
    const resolvedContext = await resolveToolContext(request, body);
    const userEmail = typeof body?.userEmail === "string" ? body.userEmail.trim() : "";
    const resolvedStudentId =
      typeof body?.metadata?.student_id === "string" && body.metadata.student_id.trim().length > 0
        ? body.metadata.student_id.trim()
        : userEmail || undefined;
    const uploadedFileIds = Array.isArray(body.fileIds)
      ? body.fileIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];

    if (!content && !imageData && uploadedFileIds.length === 0) {
      return Response.json(
        { mode, error: "Either content, imageData, or fileIds is required." },
        { status: 400 }
      );
    }

    const coinsConfig = await getCoinsConfig();
    if (coinsConfig.modules.mainChat && resolvedContext.toolContext !== "admin") {
      if (!userEmail) {
        return Response.json(
          { mode, error: "userEmail required when coins are ON" },
          { status: 400 }
        );
      }

      const billingResult = await chargeMainChatMessage(userEmail, {
        sessionId,
        hasImage: Boolean(imageData),
      });
      if (billingResult.ok === false) {
        return insufficientCoinsResponse(billingResult.balance, billingResult.required);
      }
    }

    const inputItems: Array<{
      type: "input_text" | "input_image" | "input_file";
      text?: string;
      file_id?: string;
    }> = [];
    const weeklyPolicy = buildWeeklyPolicy(resolvedContext.toolContext);
    const textInput = content || "";
    const tutorSubjectMode = resolveTutorSubjectMode(textInput, body.metadata);
    const tutorIntent =
      tutorSubjectMode === "relational_algebra" || hasTutorIntent(textInput, body.tutorMode, body.metadata);
    const personalizationIntent =
      resolvedContext.toolContext === "main_chat" &&
      getOpenAIFeatureFlag("FEATURE_PERSONALIZATION_TOOLS") &&
      hasPersonalizationIntent(textInput);
    const retrievalNeeded = shouldUseRetrieval(textInput);
    const responseFormat = tutorIntent
      ? tutorSubjectMode === "relational_algebra"
        ? getRelationalAlgebraTutorResponseFormat()
        : getSqlTutorResponseFormat()
      : undefined;
    const initialIncludeReasoningSummary =
      body.includeReasoningSummary ?? body.thinkingMode !== false;
    const reasoningModeEnabled = initialIncludeReasoningSummary;
    const safetyIdentifier = buildSafetyIdentifier(
      resolvedContext.actorEmail || userEmail || null
    );
    const promptCacheKey = buildPromptCacheKey({
      context: resolvedContext.toolContext,
      homeworkRunner: resolvedContext.toolContext === "homework_runner",
      tutorIntent,
      subjectMode: tutorSubjectMode,
      retrievalNeeded,
      hasImage: Boolean(imageData),
    });
    const reasoningLanguageInstructions = reasoningModeEnabled
      ? "\n\n[REASONING SUMMARY LANGUAGE]\nWhen generating reasoning summaries, always write them in natural Hebrew (עברית) only. Keep each summary concise, student-friendly, and focused on what helps the user. Do not mention tools, function calls, APIs, or internal system actions. If a draft appears in English, rewrite it to Hebrew before returning it."
      : "";
    const retrievalInstructions = retrievalNeeded ? `\n\n${buildRetrievalInstructions()}` : "";
    const personalizationInstructions =
      resolvedContext.toolContext !== "homework_runner" &&
      getOpenAIFeatureFlag("FEATURE_PERSONALIZATION_TOOLS")
      ? `\n\n[PERSONALIZATION TOOL RULES]
Use student-personalization tools deliberately, not on every turn.
- Prefer \`recommend_next_learning_step\`, \`get_student_progress_snapshot\`, \`get_recent_submission_attempts\`, and \`get_deadline_and_schedule_context\` when the student asks what to do next, when repeated failed attempts are visible, or near the start of a tutoring thread when a quick calibration would materially improve the guidance.
- Do not call personalization tools repeatedly in the same thread unless the recommendation is stale because the student attempted something new.
- Prefer the newer personalization tools over \`get_student_learning_profile\` and \`generate_next_practice_step\` when both could answer the same need.
- Keep responses grounded in the returned evidence. Do not invent weakness history or deadlines that the tools did not return.`
      : "";
    const personalizationContext =
      personalizationIntent &&
      resolvedStudentId
        ? await getStudentPersonalizationBundle({
            studentId: resolvedStudentId,
            homeworkSetId: body.metadata?.homework_set_id || undefined,
            questionId: body.metadata?.question_id || undefined,
          })
            .then((bundle) => `\n\n${buildPersonalizationContextBlock(bundle)}`)
            .catch(() => "")
        : "";
    const extraInstructions = tutorIntent
      ? `${weeklyPolicy.extraInstructions}${retrievalInstructions}${personalizationInstructions}${personalizationContext}\n\n${
          tutorSubjectMode === "relational_algebra"
            ? relationalAlgebraTutorInstructions
            : tutorInstructions
        }${reasoningLanguageInstructions}`
      : `${weeklyPolicy.extraInstructions}${retrievalInstructions}${personalizationInstructions}${personalizationContext}${reasoningLanguageInstructions}`;

    if (textInput) {
      inputItems.push({ type: "input_text", text: textInput });
    }

    for (const fileId of uploadedFileIds) {
      inputItems.push({ type: "input_file", file_id: fileId });
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
    const fallbackInput = chatId
      ? await buildFallbackInputFromChat(chatId, initialInput)
      : undefined;
    const baseTools = getAgentToolsForContext(resolvedContext.toolContext);
    const connectorTools =
      resolvedContext.toolContext === "admin" &&
      (resolvedContext.userRole === "admin" || resolvedContext.userRole === "instructor")
        ? await buildInstructorConnectorTools()
        : [];
    const connectorPromptRules =
      connectorTools.length > 0 ? await buildInstructorConnectorPromptRules() : "";
    const vectorStoreId = await getOrCreateAppVectorStoreId().catch(() => null);
    const tools = [
      ...baseTools,
      ...connectorTools,
      ...(vectorStoreId ? [buildFileSearchTool(vectorStoreId)] : []),
    ];
    const maxIterations = 8;
    const toolExecutionContext: ToolExecutionContext = {
      toolContext: resolvedContext.toolContext,
      userRole: resolvedContext.userRole,
      userId: resolvedContext.actorEmail || userEmail || undefined,
      userEmail: resolvedContext.actorEmail || userEmail || undefined,
      sessionId: sessionId || undefined,
      chatId: chatId || undefined,
      homeworkSetId: body.metadata?.homework_set_id || undefined,
      questionId: body.metadata?.question_id || undefined,
      studentId: resolvedStudentId,
    };

    const useStream = body.stream !== false;
    const requestStartedAt = Date.now();
    const toolUsage: ToolCallUsage[] = [];
    const combinedExtraInstructions = connectorPromptRules
      ? `${extraInstructions}\n\n${connectorPromptRules}`
      : extraInstructions;
    const sharedResponseConfig = {
      extraInstructions: combinedExtraInstructions,
      responseFormat,
      include: vectorStoreId ? ["file_search_call.results"] : undefined,
      store: true,
      truncation: "auto" as const,
      promptCacheKey,
      promptCacheRetention: "24h" as const,
      safetyIdentifier,
      fallbackInput,
    };

    if (useStream) {
      return buildEventStreamResponse(async (writer, encoder) => {
        let iterationInput: any = initialInput;
        let previousResponseId = body.previousResponseId;
        let finalOutputText = "";
        let finalResponseId = "";
        let activeTools = tools;
        let activeExtraInstructions = combinedExtraInstructions;
        let includeReasoningSummary = reasoningModeEnabled;
        let finalCitations: ResponseCitation[] = [];
        let finalMetadata: ResponseTurnMetadata | null = null;

        if (tutorIntent) {
          await writer.write(
            encoder.encode(
              `${JSON.stringify({
                type: "response.tutor.mode",
                enabled: true,
                subjectMode: tutorSubjectMode,
              })}\n`
            )
          );
        }

        for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
          const iterationPreviousResponseId = previousResponseId || null;
          let stream: any;
          try {
            stream = await streamResponse({
              input: iterationInput,
              previousResponseId,
              ...sharedResponseConfig,
              tools: activeTools,
              extraInstructions: activeExtraInstructions,
              toolChoice: iteration === 1 ? weeklyPolicy.forcedInitialToolChoice : undefined,
              reasoning: buildReasoningConfig(includeReasoningSummary, body.reasoningEffort),
              metadata: {
                ...(body.metadata || {}),
                session_id: sessionId || "",
                chat_id: chatId || "",
                route: "/api/responses/messages",
                tool_loop_iteration: String(iteration),
              },
            });
          } catch (error) {
            if (includeReasoningSummary && isReasoningSummaryError(error)) {
              includeReasoningSummary = false;
              stream = await streamResponse({
                input: iterationInput,
                previousResponseId,
                ...sharedResponseConfig,
                tools: activeTools,
                extraInstructions: activeExtraInstructions,
                toolChoice: iteration === 1 ? weeklyPolicy.forcedInitialToolChoice : undefined,
                reasoning: buildReasoningConfig(false, body.reasoningEffort),
                metadata: {
                  ...(body.metadata || {}),
                  session_id: sessionId || "",
                  chat_id: chatId || "",
                  route: "/api/responses/messages",
                  tool_loop_iteration: String(iteration),
                },
              });
            } else if (
              resolvedContext.toolContext === "admin" &&
              hasBuiltInTool(activeTools, "web_search") &&
              isWebSearchUnavailableError(error)
            ) {
              activeTools = activeTools.filter((tool) => getToolName(tool as any) !== "web_search");
              activeExtraInstructions = buildWebSearchFallbackInstructions(extraInstructions);
              await logToolUsageAuditEvent({
                route: "/api/responses/messages",
                toolContext: resolvedContext.toolContext,
                userRole: resolvedContext.userRole,
                userEmail: resolvedContext.actorEmail || userEmail || null,
                toolName: "web_search",
                latencyMs: Date.now() - requestStartedAt,
                status: "fallback",
                details: {
                  reason: error instanceof Error ? error.message : "web_search unavailable",
                },
              });
              stream = await streamResponse({
                input: iterationInput,
                previousResponseId,
                ...sharedResponseConfig,
                tools: activeTools,
                extraInstructions: activeExtraInstructions,
                toolChoice: iteration === 1 ? weeklyPolicy.forcedInitialToolChoice : undefined,
                reasoning: buildReasoningConfig(includeReasoningSummary, body.reasoningEffort),
                metadata: {
                  ...(body.metadata || {}),
                  session_id: sessionId || "",
                  chat_id: chatId || "",
                  route: "/api/responses/messages",
                  tool_loop_iteration: String(iteration),
                  web_search_fallback: "true",
                },
              });
            } else {
              throw error;
            }
          }

          let iterationResponseId = "";
          let iterationOutputText = "";
          let iterationTutorResponse: TutorResponse | null = null;
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
              reasoningModeEnabled &&
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
              reasoningModeEnabled &&
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
            } else if (
              event?.type === "response.output_item.done" &&
              event?.item?.type === "function_call"
            ) {
              const toolCall = {
                callId: String(event.item.call_id || ""),
                name: String(event.item.name || ""),
                argumentsJson:
                  typeof event.item.arguments === "string"
                    ? event.item.arguments
                    : JSON.stringify(event.item.arguments || {}),
              };
              calls.push(toolCall);
              toolUsage.push({
                name: toolCall.name,
                callId: toolCall.callId,
                argumentsJson: toolCall.argumentsJson,
                status: "completed",
              });
              if (reasoningModeEnabled) {
                await writer.write(
                  encoder.encode(
                    `${JSON.stringify({
                      type: "response.tool_call.started",
                      name: toolCall.name,
                    })}\n`
                  )
                );
              }
            } else if (event?.type === "response.completed") {
              iterationResponseId = String(event.response?.id || iterationResponseId || "");
              const responseCitations = extractResponseCitations(event.response);
              iterationOutputText = appendVisibleCitations(
                extractOutputText(event.response),
                responseCitations
              );
              finalCitations = responseCitations;
              if (tutorIntent) {
                iterationTutorResponse =
                  tutorSubjectMode === "relational_algebra"
                    ? extractRelationalAlgebraTutorResponse(event.response)
                    : extractSqlTutorResponse(event.response);
              }
              finalMetadata = buildResponseTurnMetadata({
                response: event.response,
                sessionId: sessionId || null,
                previousResponseId: iterationPreviousResponseId,
                latencyMs: Date.now() - requestStartedAt,
                toolCalls: toolUsage,
                promptCacheKey,
                safetyIdentifier,
                store: true,
                truncation: "auto",
              });
              const webSearchMetrics = extractWebSearchMetrics(event.response);
              if (webSearchMetrics.callCount > 0) {
                await logToolUsageAuditEvent({
                  route: "/api/responses/messages",
                  toolContext: resolvedContext.toolContext,
                  userRole: resolvedContext.userRole,
                  userEmail: resolvedContext.actorEmail || userEmail || null,
                  responseId: iterationResponseId,
                  toolName: "web_search",
                  queries: webSearchMetrics.queries,
                  sourceCount: webSearchMetrics.sourceCount,
                  latencyMs: Date.now() - requestStartedAt,
                  status: "completed",
                });
              }
              for (const connectorCall of extractConnectorCalls(event.response)) {
                await logToolUsageAuditEvent({
                  route: "/api/responses/messages",
                  toolContext: resolvedContext.toolContext,
                  userRole: resolvedContext.userRole,
                  userEmail: resolvedContext.actorEmail || userEmail || null,
                  responseId: iterationResponseId,
                  toolName: connectorCall.toolName,
                  latencyMs: Date.now() - requestStartedAt,
                  status: "completed",
                  details: {
                    sourceLabel: connectorCall.label,
                    sourceType: "connector_or_mcp",
                  },
                });
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
                  citations: finalCitations,
                  metadata: finalMetadata,
                })}\n`
              )
            );
            return;
          }

          const toolUsageStartIndex = toolUsage.length - calls.length;
          const toolResults = await Promise.all(
            calls.map(async (call, index) => {
              const result = await executeToolCall(call, toolExecutionContext);
              const preview = result.slice(0, 240);
              toolUsage[toolUsageStartIndex + index] = {
                ...toolUsage[toolUsageStartIndex + index],
                outputPreview: preview,
              };
              return result;
            })
          );
          for (const [index, call] of calls.entries()) {
            if (reasoningModeEnabled) {
              await writer.write(
                encoder.encode(
                  `${JSON.stringify({ type: "response.tool_call.completed", name: call.name })}\n`
                )
              );
            }
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
              citations: finalCitations,
              metadata: finalMetadata,
            })}\n`
          )
        );
      });
    }

    let loopInput: any = initialInput;
    let previousResponseId = body.previousResponseId;
    let response: any = null;
    let activeTools = tools;
    let activeExtraInstructions = combinedExtraInstructions;
    let includeReasoningSummary = reasoningModeEnabled;
    let lastPreviousResponseId: string | null = previousResponseId || null;

    for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
      lastPreviousResponseId = previousResponseId || null;
      try {
        response = await createResponse({
          input: loopInput,
          previousResponseId,
          ...sharedResponseConfig,
          tools: activeTools,
          extraInstructions: activeExtraInstructions,
          toolChoice: iteration === 1 ? weeklyPolicy.forcedInitialToolChoice : undefined,
          reasoning: buildReasoningConfig(includeReasoningSummary, body.reasoningEffort),
          metadata: {
            ...(body.metadata || {}),
            session_id: sessionId || "",
            chat_id: chatId || "",
            route: "/api/responses/messages",
            tool_loop_iteration: String(iteration),
          },
        });
      } catch (error) {
        if (includeReasoningSummary && isReasoningSummaryError(error)) {
          includeReasoningSummary = false;
          response = await createResponse({
            input: loopInput,
            previousResponseId,
            ...sharedResponseConfig,
            tools: activeTools,
            extraInstructions: activeExtraInstructions,
            toolChoice: iteration === 1 ? weeklyPolicy.forcedInitialToolChoice : undefined,
            reasoning: buildReasoningConfig(false, body.reasoningEffort),
            metadata: {
              ...(body.metadata || {}),
              session_id: sessionId || "",
              chat_id: chatId || "",
              route: "/api/responses/messages",
              tool_loop_iteration: String(iteration),
            },
          });
        } else if (
          resolvedContext.toolContext === "admin" &&
          hasBuiltInTool(activeTools, "web_search") &&
          isWebSearchUnavailableError(error)
        ) {
          activeTools = activeTools.filter((tool) => getToolName(tool as any) !== "web_search");
          activeExtraInstructions = buildWebSearchFallbackInstructions(extraInstructions);
          await logToolUsageAuditEvent({
            route: "/api/responses/messages",
            toolContext: resolvedContext.toolContext,
            userRole: resolvedContext.userRole,
            userEmail: resolvedContext.actorEmail || userEmail || null,
            toolName: "web_search",
            latencyMs: Date.now() - requestStartedAt,
            status: "fallback",
            details: {
              reason: error instanceof Error ? error.message : "web_search unavailable",
            },
          });
          response = await createResponse({
            input: loopInput,
            previousResponseId,
            ...sharedResponseConfig,
            tools: activeTools,
            extraInstructions: activeExtraInstructions,
            toolChoice: iteration === 1 ? weeklyPolicy.forcedInitialToolChoice : undefined,
            reasoning: buildReasoningConfig(includeReasoningSummary, body.reasoningEffort),
            metadata: {
              ...(body.metadata || {}),
              session_id: sessionId || "",
              chat_id: chatId || "",
              route: "/api/responses/messages",
              tool_loop_iteration: String(iteration),
              web_search_fallback: "true",
            },
          });
        } else {
          throw error;
        }
      }

      const calls = extractFunctionCalls(response);
      if (!calls.length) {
        const citations = extractResponseCitations(response);
        const outputText = appendVisibleCitations(extractOutputText(response), citations);
        const metadata = buildResponseTurnMetadata({
          response,
          sessionId: sessionId || null,
          previousResponseId: lastPreviousResponseId,
          latencyMs: Date.now() - requestStartedAt,
          toolCalls: toolUsage,
          promptCacheKey,
          safetyIdentifier,
          store: true,
          truncation: "auto",
        });
        const payload: ChatResponseDto = {
          sessionId: sessionId || null,
          responseId: response?.id || "",
          outputText,
          tutorResponse:
            tutorIntent
              ? tutorSubjectMode === "relational_algebra"
                ? extractRelationalAlgebraTutorResponse(response)
                : extractSqlTutorResponse(response)
              : null,
          citations,
          metadata,
        };
        const webSearchMetrics = extractWebSearchMetrics(response);
        if (webSearchMetrics.callCount > 0) {
          await logToolUsageAuditEvent({
            route: "/api/responses/messages",
            toolContext: resolvedContext.toolContext,
            userRole: resolvedContext.userRole,
            userEmail: resolvedContext.actorEmail || userEmail || null,
            responseId: response?.id || null,
            toolName: "web_search",
            queries: webSearchMetrics.queries,
            sourceCount: webSearchMetrics.sourceCount,
            latencyMs: Date.now() - requestStartedAt,
            status: "completed",
          });
        }
        for (const connectorCall of extractConnectorCalls(response)) {
          await logToolUsageAuditEvent({
            route: "/api/responses/messages",
            toolContext: resolvedContext.toolContext,
            userRole: resolvedContext.userRole,
            userEmail: resolvedContext.actorEmail || userEmail || null,
            responseId: response?.id || null,
            toolName: connectorCall.toolName,
            latencyMs: Date.now() - requestStartedAt,
            status: "completed",
            details: {
              sourceLabel: connectorCall.label,
              sourceType: "connector_or_mcp",
            },
          });
        }
        return Response.json({ mode, ...payload });
      }

      calls.forEach((call) =>
        toolUsage.push({
          name: call.name,
          callId: call.callId,
          argumentsJson: call.argumentsJson,
          status: "completed",
        })
      );
      const toolResults = await Promise.all(
        calls.map(async (call, index) => {
          const result = await executeToolCall(call, toolExecutionContext);
          const toolUsageIndex = toolUsage.length - calls.length + index;
          toolUsage[toolUsageIndex] = {
            ...toolUsage[toolUsageIndex],
            outputPreview: result.slice(0, 240),
          };
          return result;
        })
      );
      loopInput = toFunctionCallOutputs(calls, toolResults);
      previousResponseId = response?.id;
    }

    const citations = extractResponseCitations(response);
    const outputText = appendVisibleCitations(extractOutputText(response), citations);
    const metadata = buildResponseTurnMetadata({
      response,
      sessionId: sessionId || null,
      previousResponseId: lastPreviousResponseId,
      latencyMs: Date.now() - requestStartedAt,
      toolCalls: toolUsage,
      promptCacheKey,
      safetyIdentifier,
      store: true,
      truncation: "auto",
    });
    const payload: ChatResponseDto = {
      sessionId: sessionId || null,
      responseId: response?.id || "",
      outputText,
      tutorResponse:
        tutorIntent
          ? tutorSubjectMode === "relational_algebra"
            ? extractRelationalAlgebraTutorResponse(response)
            : extractSqlTutorResponse(response)
          : null,
      citations,
      metadata,
    };
    const webSearchMetrics = extractWebSearchMetrics(response);
    if (webSearchMetrics.callCount > 0) {
      await logToolUsageAuditEvent({
        route: "/api/responses/messages",
        toolContext: resolvedContext.toolContext,
        userRole: resolvedContext.userRole,
        userEmail: resolvedContext.actorEmail || userEmail || null,
        responseId: response?.id || null,
        toolName: "web_search",
        queries: webSearchMetrics.queries,
        sourceCount: webSearchMetrics.sourceCount,
        latencyMs: Date.now() - requestStartedAt,
        status: "completed",
      });
    }
    for (const connectorCall of extractConnectorCalls(response)) {
      await logToolUsageAuditEvent({
        route: "/api/responses/messages",
        toolContext: resolvedContext.toolContext,
        userRole: resolvedContext.userRole,
        userEmail: resolvedContext.actorEmail || userEmail || null,
        responseId: response?.id || null,
        toolName: connectorCall.toolName,
        latencyMs: Date.now() - requestStartedAt,
        status: "completed",
        details: {
          sourceLabel: connectorCall.label,
          sourceType: "connector_or_mcp",
        },
      });
    }
    return Response.json({ mode, ...payload });
  } catch (error: any) {
    return Response.json(
      {
        mode,
        error: error?.message || "Failed to send message.",
      },
      { status: typeof error?.status === "number" ? error.status : 500 }
    );
  }
}
