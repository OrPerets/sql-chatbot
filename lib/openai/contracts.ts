export type ChatRole = "user" | "assistant" | "system";

export type ChatInputItem =
  | {
      type: "input_text";
      text: string;
    }
  | {
      type: "input_image";
      file_id?: string;
      image_url?: string;
      detail?: "low" | "high" | "auto";
    }
  | {
      type: "input_file";
      file_id: string;
    };

export type ChatInputMessage = {
  role: ChatRole;
  content: ChatInputItem[];
};

export type ChatRequestDto = {
  sessionId?: string;
  chatId?: string;
  previousResponseId?: string;
  content?: string;
  imageData?: string;
  fileIds?: string[];
  userEmail?: string;
  metadata?: Record<string, string>;
  context?: "main_chat" | "homework_runner" | "admin" | "voice";
  reasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh";
  taskClass?: TaskClass;
  skillId?: string;
};

export type TaskClass =
  | "live_tutoring"
  | "grading"
  | "long_summary"
  | "nightly_analytics"
  | "content_audit";

export type SkillDefinition = {
  id: string;
  displayName: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  safetyConstraints: string[];
  telemetryTags: string[];
};

export type TutorSubjectMode = "sql" | "relational_algebra";

export type ResponseCitation = {
  type: "file_citation" | "url_citation";
  fileId?: string;
  filename?: string;
  url?: string;
  title?: string;
  index?: number;
  startIndex?: number;
  endIndex?: number;
  query?: string;
  snippet?: string | null;
  score?: number | null;
};

export type ResponseTokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
};

export type ToolCallUsage = {
  name: string;
  callId?: string;
  argumentsJson?: string;
  status: "completed" | "failed";
  outputPreview?: string;
  error?: string;
};

export type ConnectorUsage = {
  label: string;
  toolNames: string[];
  callCount: number;
};

export type ResponseTurnMetadata = {
  requestId?: string | null;
  actorId?: string | null;
  route?: string | null;
  taskClass?: TaskClass | null;
  skillId?: string | null;
  canonicalStateStrategy: "previous_response_id";
  sessionId?: string | null;
  responseId?: string | null;
  previousResponseId?: string | null;
  model?: string | null;
  latencyMs?: number | null;
  tokenUsage?: ResponseTokenUsage | null;
  toolCalls?: ToolCallUsage[];
  failureReason?: string | null;
  store?: boolean;
  truncation?: "auto" | "disabled" | string | null;
  promptCacheKey?: string | null;
  safetyIdentifier?: string | null;
  retrievalUsed?: boolean;
  fileSearchQueries?: string[];
  webSearchQueries?: string[];
  webSearchCallCount?: number;
  webSearchSourceCount?: number;
  connectorUsage?: ConnectorUsage[];
  connectorCallCount?: number;
  toolUsed?: string[];
  fallbackTriggered?: boolean;
  costEstimateUsd?: number | null;
};

export type ToolCallRequest = {
  callId: string;
  name: string;
  argumentsJson: string;
};

export type ToolCallOutput = {
  type: "function_call_output";
  call_id: string;
  output: string;
};

export type ChatResponseDto = {
  sessionId: string | null;
  responseId: string;
  outputText: string;
  tutorResponse?: TutorResponse | null;
  citations?: ResponseCitation[];
  metadata?: ResponseTurnMetadata | null;
};

export type SqlTutorResponse = {
  query: string;
  explanation: string;
  commonMistakes: string[];
  optimization: string;
};

export type RelationalAlgebraTutorStep = {
  title: string;
  operator: string;
  symbol: string;
  expression: string;
  explanation: string;
  sqlEquivalent?: string;
};

export type RelationalAlgebraTutorExample = {
  concept: string;
  sqlExample: string;
  relationalAlgebraExample: string;
  note: string;
};

export type RelationalAlgebraTutorResponse = {
  summary: string;
  relationalAlgebraExpression: string;
  steps: RelationalAlgebraTutorStep[];
  commonMistakes: string[];
  examples: RelationalAlgebraTutorExample[];
  scopeNote: string;
};

export type TutorResponse = SqlTutorResponse | RelationalAlgebraTutorResponse;

export type ResponseStreamEvent =
  | { type: "response.created"; responseId: string }
  | { type: "response.output_text.delta"; delta: string }
  | { type: "response.reasoning_summary_text.delta"; delta: string }
  | { type: "response.reasoning_summary_text.done"; text: string }
  | { type: "response.tool_call.started"; name: string }
  | { type: "response.tool_call.completed"; name: string }
  | {
      type: "response.completed";
      responseId: string;
      outputText: string;
      tutorResponse?: TutorResponse | null;
      citations?: ResponseCitation[];
      metadata?: ResponseTurnMetadata | null;
    }
  | { type: "response.tutor.mode"; enabled: boolean; subjectMode?: TutorSubjectMode }
  | { type: "response.error"; message: string };
