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
  userEmail?: string;
  metadata?: Record<string, string>;
};

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

export type ResponseTurnMetadata = {
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
  tutorResponse?: SqlTutorResponse | null;
  citations?: ResponseCitation[];
  metadata?: ResponseTurnMetadata | null;
};

export type SqlTutorResponse = {
  query: string;
  explanation: string;
  commonMistakes: string[];
  optimization: string;
};

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
      tutorResponse?: SqlTutorResponse | null;
      citations?: ResponseCitation[];
      metadata?: ResponseTurnMetadata | null;
    }
  | { type: "response.tutor.mode"; enabled: boolean }
  | { type: "response.error"; message: string };
