export const OPENAI_API_MODE_DEFAULT = "responses" as const;

export const OPENAI_MODEL_REGISTRY = {
  tutorChat: "gpt-5.4-mini",
  adminEvaluation: "gpt-5.4",
  examGeneration: "gpt-5.4",
  aiAnalysis: "gpt-5.4",
  aiGrading: "gpt-5.4",
  conversationSummary: "gpt-5.4",
  voiceResponse: "gpt-5.4-mini",
  voiceTranscription: "gpt-4o-transcribe",
  voiceSynthesis: "gpt-4o-mini-tts",
  voiceRealtimeExperimental: "gpt-realtime-1.5",
} as const;

export type OpenAIModelRole = keyof typeof OPENAI_MODEL_REGISTRY;

export const RECOMMENDED_RUNTIME_MODEL = OPENAI_MODEL_REGISTRY.tutorChat;

export const APPROVED_RUNTIME_MODELS = [
  OPENAI_MODEL_REGISTRY.tutorChat,
  OPENAI_MODEL_REGISTRY.adminEvaluation,
] as const;

export type ApprovedRuntimeModel = (typeof APPROVED_RUNTIME_MODELS)[number];

export const RUNTIME_ROLLBACK_TARGETS = [
  ...APPROVED_RUNTIME_MODELS,
  "previous-stable",
] as const;

export type RuntimeRollbackTarget = (typeof RUNTIME_ROLLBACK_TARGETS)[number];

export function getModelForRole(role: OpenAIModelRole): string {
  return OPENAI_MODEL_REGISTRY[role];
}

export function getDefaultTutorModel(): string {
  return OPENAI_MODEL_REGISTRY.tutorChat;
}

export function getDefaultAdminModel(): string {
  return OPENAI_MODEL_REGISTRY.adminEvaluation;
}

export function isApprovedRuntimeModel(model: string): model is ApprovedRuntimeModel {
  return APPROVED_RUNTIME_MODELS.includes(model as ApprovedRuntimeModel);
}
