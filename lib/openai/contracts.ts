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
  previousResponseId?: string;
  content?: string;
  imageData?: string;
  userEmail?: string;
  metadata?: Record<string, string>;
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
    }
  | { type: "response.tutor.mode"; enabled: boolean }
  | { type: "response.error"; message: string };
