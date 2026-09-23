import { OPENAI_MODEL_REGISTRY } from "@/lib/openai/model-registry";

export type VoiceRuntimeMode = "chained" | "realtime_experimental";

export type VoiceRuntimeConfig = {
  mode: VoiceRuntimeMode;
  voice: string;
  instructions: string;
  chained: {
    transcriptionModel: string;
    responseModel: string;
    ttsModel: string;
  };
  realtimeExperimental: {
    model: string;
    clientSecretPath: string;
    gaWebrtcPath: string;
    requiresEphemeralCredentials: boolean;
  };
};

const DEFAULT_VOICE_RUNTIME_CONFIG: VoiceRuntimeConfig = {
  mode: "chained",
  voice: "alloy",
  instructions: `You are Michael, an expert SQL tutor.
Provide clear, concise explanations about SQL concepts.
Support both Hebrew and English languages.
Keep responses conversational and educational.
When explaining SQL queries, be practical and give examples.`,
  chained: {
    transcriptionModel: OPENAI_MODEL_REGISTRY.voiceTranscription,
    responseModel: OPENAI_MODEL_REGISTRY.voiceResponse,
    ttsModel: OPENAI_MODEL_REGISTRY.voiceSynthesis,
  },
  realtimeExperimental: {
    model: OPENAI_MODEL_REGISTRY.voiceRealtimeExperimental,
    clientSecretPath: "/api/voice/realtime",
    gaWebrtcPath: "/v1/realtime/calls",
    requiresEphemeralCredentials: true,
  },
};

export function getDefaultVoiceRuntimeConfig(): VoiceRuntimeConfig {
  return DEFAULT_VOICE_RUNTIME_CONFIG;
}

export function isVoiceFeatureEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_VOICE_ENABLED === "1" ||
    process.env.FEATURE_VOICE === "1" ||
    process.env.NODE_ENV === "development"
  );
}

export function getVoiceRuntimeConfig(): VoiceRuntimeConfig {
  const envMode = process.env.OPENAI_VOICE_MODE?.trim().toLowerCase();
  const mode: VoiceRuntimeMode =
    envMode === "realtime_experimental" ? "realtime_experimental" : DEFAULT_VOICE_RUNTIME_CONFIG.mode;

  return {
    mode,
    voice: process.env.OPENAI_VOICE_DEFAULT_VOICE?.trim() || DEFAULT_VOICE_RUNTIME_CONFIG.voice,
    instructions:
      process.env.OPENAI_VOICE_INSTRUCTIONS?.trim() || DEFAULT_VOICE_RUNTIME_CONFIG.instructions,
    chained: {
      transcriptionModel:
        process.env.OPENAI_VOICE_TRANSCRIPTION_MODEL?.trim() ||
        DEFAULT_VOICE_RUNTIME_CONFIG.chained.transcriptionModel,
      responseModel:
        process.env.OPENAI_VOICE_RESPONSE_MODEL?.trim() ||
        DEFAULT_VOICE_RUNTIME_CONFIG.chained.responseModel,
      ttsModel:
        process.env.OPENAI_VOICE_TTS_MODEL?.trim() ||
        DEFAULT_VOICE_RUNTIME_CONFIG.chained.ttsModel,
    },
    realtimeExperimental: {
      model:
        process.env.OPENAI_VOICE_REALTIME_MODEL?.trim() ||
        DEFAULT_VOICE_RUNTIME_CONFIG.realtimeExperimental.model,
      clientSecretPath: DEFAULT_VOICE_RUNTIME_CONFIG.realtimeExperimental.clientSecretPath,
      gaWebrtcPath: DEFAULT_VOICE_RUNTIME_CONFIG.realtimeExperimental.gaWebrtcPath,
      requiresEphemeralCredentials:
        DEFAULT_VOICE_RUNTIME_CONFIG.realtimeExperimental.requiresEphemeralCredentials,
    },
  };
}
