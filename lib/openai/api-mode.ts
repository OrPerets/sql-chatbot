export type OpenAIApiMode = "assistants" | "responses";

const DEFAULT_OPENAI_API_MODE: OpenAIApiMode = "responses";

export function getOpenAIApiMode(): OpenAIApiMode {
  const mode = process.env.OPENAI_API_MODE?.trim().toLowerCase();
  if (mode === "assistants" || mode === "responses") {
    return mode;
  }
  return DEFAULT_OPENAI_API_MODE;
}

export function isResponsesMode(): boolean {
  return getOpenAIApiMode() === "responses";
}

export function isAssistantsMode(): boolean {
  return getOpenAIApiMode() === "assistants";
}
