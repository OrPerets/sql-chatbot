import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getVoiceRuntimeConfig, isVoiceFeatureEnabled } from '@/lib/openai/voice-config';
import type { SpeechIntent } from '@/app/utils/avatar-speech-controller';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Global request deduplication to prevent multiple identical TTS calls
const activeRequests = new Map<string, Promise<NextResponse>>();

const ALLOWED_VOICES = new Set(['onyx','echo','fable','alloy','nova','shimmer']);

type TTSFailureCode =
  | 'VOICE_DISABLED'
  | 'INVALID_REQUEST'
  | 'OPENAI_API_KEY_MISSING'
  | 'TTS_GENERATION_FAILED';

type TTSFailureResponse = {
  ok: false;
  enabled: boolean;
  code: TTSFailureCode;
  message: string;
  retryable: boolean;
  details?: string;
};

const createFailureResponse = (
  status: number,
  payload: TTSFailureResponse
) => NextResponse.json(payload, { status });

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const voiceConfig = getVoiceRuntimeConfig();
    const featureVoiceEnabled = isVoiceFeatureEnabled();
    if (!featureVoiceEnabled) {
      return createFailureResponse(200, {
        ok: false,
        enabled: false,
        code: 'VOICE_DISABLED',
        message: 'Voice feature is disabled',
        retryable: false,
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return createFailureResponse(500, {
        ok: false,
        enabled: true,
        code: 'OPENAI_API_KEY_MISSING',
        message: 'OpenAI API key not configured',
        retryable: false,
      });
    }

    const body = await request.json();
    const {
      text,
      voice: requestedVoice,
      speed = 1.0,
      format = 'mp3',
      emotion = 'neutral',
      content_type = 'general',
      speech_intent,
      enhance_prosody: _enhance_prosody = true,
      character_style: _character_style = 'university_ta'
    } = body || {};

    const normalizedIntent = normalizeSpeechIntent(speech_intent);

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return createFailureResponse(400, {
        ok: false,
        enabled: true,
        code: 'INVALID_REQUEST',
        message: 'No text provided',
        retryable: false,
      });
    }

    const hasHebrew = /[\u0590-\u05FF]/.test(text);
    let voice = hasHebrew ? 'nova' : 'onyx';
    if (requestedVoice && ALLOWED_VOICES.has(requestedVoice)) {
      voice = requestedVoice;
    }

    // Enhanced dedup key with new parameters
    const requestKey = `${voice}_${format}_${Math.round(speed * 100)}_${emotion}_${content_type}_${text}`;
    if (activeRequests.has(requestKey)) {
      return await activeRequests.get(requestKey)!;
    }

    const processingPromise = (async (): Promise<NextResponse> => {
      try {
        const prosody = mapIntentToProsody(normalizedIntent, content_type);
        let processedText = preprocessSpeechText(text, normalizedIntent, content_type, emotion);

        // Call OpenAI speech API with enhanced parameters
        const resp = await openai.audio.speech.create({
          model: voiceConfig.chained.ttsModel,
          voice: voice as any,
          input: processedText,
          speed: Math.max(0.5, Math.min(1.5, Number(speed) || prosody.speed)),
          response_format: format as any,
        });

        const arrayBuf = await resp.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        if (!buffer || buffer.length === 0) {
          return NextResponse.json({ error: 'Empty audio from TTS' }, { status: 502 });
        }

        // Calculate processing time for analytics
        const processingTime = Date.now() - startTime;

        return new NextResponse(new Uint8Array(buffer), {
          status: 200,
          headers: {
            'Content-Type': format === 'mp3' ? 'audio/mpeg' : 'application/octet-stream',
            'Content-Length': buffer.length.toString(),
            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            'X-TTS-Processing-Time': processingTime.toString(),
            'X-TTS-Voice': voice,
            'X-TTS-Emotion': emotion,
            'X-TTS-Content-Type': content_type
          },
        });
      } catch (err) {
        console.error('TTS API Error:', err);
        return createFailureResponse(500, {
          ok: false,
          enabled: true,
          code: 'TTS_GENERATION_FAILED',
          message: 'Failed to generate speech',
          retryable: true,
          details: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
        activeRequests.delete(requestKey);
      }
    })();

    activeRequests.set(requestKey, processingPromise);
    return await processingPromise;
  } catch (error) {
    console.error('TTS Route Error:', error);
    return createFailureResponse(500, {
      ok: false,
      enabled: true,
      code: 'TTS_GENERATION_FAILED',
      message: 'Failed to generate speech',
      retryable: true,
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function enhanceSQLPronunciation(text: string): string {
  return text
    .replace(/\bCOUNT\s*\(\s*\*\s*\)/gi, 'count all rows')
    .replace(/\bAVG\b/gi, 'average')
    .replace(/\bSUM\b/gi, 'sum')
    .replace(/\bMIN\b/gi, 'minimum')
    .replace(/\bMAX\b/gi, 'maximum')
    .replace(/\bSELECT\b/gi, 'select')
    .replace(/\bFROM\b/gi, 'from')
    .replace(/\bWHERE\b/gi, 'where')
    .replace(/\bJOIN\b/gi, 'join')
    .replace(/\bORDER BY\b/gi, 'order by')
    .replace(/\bGROUP BY\b/gi, 'group by')
    .replace(/\bHAVING\b/gi, 'having')
    .replace(/!=/g, ' not equal to ')
    .replace(/>=/g, ' greater than or equal to ')
    .replace(/<=/g, ' less than or equal to ')
    .replace(/<>/g, ' not equal to ');
}

function addNaturalPauses(text: string): string {
  return text
    .replace(/([:;])\s*/g, '$1 ')
    .replace(/([.?!])\s*/g, '$1  ')
    .replace(/,\s*/g, ', ');
}

function applyEmotionEnhancement(text: string, emotion: string): string {
  switch (emotion) {
    case 'excited':
      return text.replace(/!/g, '! ').replace(/\./g, '. ');
    case 'calm':
      return text.replace(/!/g, '. ').replace(/\?/g, '? ');
    case 'happy':
      return text.replace(/\./g, '. ').replace(/!/g, '! ');
    case 'sad':
      return text.replace(/\./g, '... ').replace(/!/g, '.');
    default:
      return text;
  }
}

function normalizeSpeechIntent(intent: unknown): SpeechIntent | null {
  if (!intent || typeof intent !== 'object') {
    return null;
  }

  const candidate = intent as Partial<SpeechIntent>;
  if (!candidate.intent || typeof candidate.intent !== 'string') {
    return null;
  }

  return {
    intent: candidate.intent,
    emotion: candidate.emotion,
    urgency: candidate.urgency,
    source: candidate.source,
    confidence: candidate.confidence,
  };
}

function mapIntentToProsody(intent: SpeechIntent | null, contentType: string) {
  if (contentType === 'sql') {
    return { speed: 0.94 };
  }

  switch (intent?.intent) {
    case 'greeting':
      return { speed: 1.04 };
    case 'summary':
      return { speed: 1.02 };
    case 'error':
      return { speed: 0.9 };
    case 'uncertainty':
      return { speed: 0.92 };
    case 'explain':
      return { speed: 0.96 };
    default:
      return { speed: 0.98 };
  }
}

function preprocessSpeechText(
  text: string,
  intent: SpeechIntent | null,
  contentType: string,
  emotion: string
): string {
  let processedText = text
    .replace(/```[\s\S]*?```/g, ' code example. ')
    .replace(/\s+/g, ' ')
    .trim();

  if (contentType === 'sql') {
    processedText = enhanceSQLPronunciation(processedText);
  }

  processedText = addNaturalPauses(processedText);

  if ((intent?.intent === 'uncertainty' || (intent?.confidence ?? 1) < 0.55) && !/^\s*(Let me think|תן לי לחשוב)/i.test(processedText)) {
    processedText = `${/[\u0590-\u05FF]/.test(processedText) ? 'תן לי לחשוב רגע. ' : 'Let me think for a second. '}${processedText}`;
  }

  if (intent?.intent === 'summary' && !/^\s*(In short|To sum up|בקיצור|לסיכום)/i.test(processedText)) {
    processedText = `${/[\u0590-\u05FF]/.test(processedText) ? 'לסיכום, ' : 'In short, '}${processedText}`;
  }

  if (emotion !== 'neutral') {
    processedText = applyEmotionEnhancement(processedText, emotion);
  }

  return processedText.replace(/\s+/g, ' ').trim();
}

export async function GET() {
  const voiceConfig = getVoiceRuntimeConfig();
  return NextResponse.json({
    voices: ['onyx','echo','fable','alloy','nova','shimmer'],
    models: [voiceConfig.chained.ttsModel],
    formats: ['mp3','opus'],
  });
}
