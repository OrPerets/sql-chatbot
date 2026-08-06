import {
  getDefaultVoiceRuntimeConfig,
  getVoiceRuntimeConfig,
  isVoiceFeatureEnabled,
} from "@/lib/openai/voice-config";

describe("voice-config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OPENAI_VOICE_MODE;
    delete process.env.OPENAI_VOICE_RESPONSE_MODEL;
    delete process.env.OPENAI_VOICE_TRANSCRIPTION_MODEL;
    delete process.env.OPENAI_VOICE_TTS_MODEL;
    delete process.env.NEXT_PUBLIC_VOICE_ENABLED;
    delete process.env.FEATURE_VOICE;
    delete process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("defaults to chained production voice mode", () => {
    const config = getDefaultVoiceRuntimeConfig();
    expect(config.mode).toBe("chained");
    expect(config.chained.responseModel).toBe("gpt-5.4-mini");
    expect(config.chained.transcriptionModel).toBe("gpt-4o-transcribe");
    expect(config.chained.ttsModel).toBe("gpt-4o-mini-tts");
  });

  it("supports realtime experimental mode through env config", () => {
    process.env.OPENAI_VOICE_MODE = "realtime_experimental";

    const config = getVoiceRuntimeConfig();
    expect(config.mode).toBe("realtime_experimental");
    expect(config.realtimeExperimental.model).toBe("gpt-realtime-1.5");
    expect(config.realtimeExperimental.requiresEphemeralCredentials).toBe(true);
  });

  it("enables voice when development mode is active", () => {
    process.env.NODE_ENV = "development";

    expect(isVoiceFeatureEnabled()).toBe(true);
  });

  it("enables voice when either public or server feature flags are set", () => {
    process.env.NEXT_PUBLIC_VOICE_ENABLED = "1";
    expect(isVoiceFeatureEnabled()).toBe(true);

    delete process.env.NEXT_PUBLIC_VOICE_ENABLED;
    process.env.FEATURE_VOICE = "1";
    expect(isVoiceFeatureEnabled()).toBe(true);
  });

  it("disables voice when no enabling flags are set", () => {
    expect(isVoiceFeatureEnabled()).toBe(false);
  });
});
