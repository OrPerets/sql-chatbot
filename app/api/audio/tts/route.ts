import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createHash } from 'node:crypto';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Global request deduplication to prevent multiple identical TTS calls
const activeRequests = new Map<string, Promise<NextResponse>>();

const ALLOWED_VOICES = new Set(['onyx','echo','fable','alloy','nova','shimmer']);
const ALLOWED_FORMATS = new Set(['mp3', 'wav', 'opus', 'aac', 'flac', 'pcm']);
const DEFAULT_TTS_MODEL = process.env.OPENAI_TTS_MODEL?.trim() || 'gpt-4o-mini-tts';
const MAX_INPUT_CHARS = Number(process.env.OPENAI_TTS_MAX_INPUT_CHARS || 3800);

function hashForDedup(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

function normalizeSpeechText(text: string, contentType: string): string {
  let processedText = text
    .replace(/```[\s\S]*?```/g, ' [code block] ')
    .replace(/\s+/g, ' ')
    .trim();

  if (contentType === 'sql') {
    processedText = enhanceSQLPronunciation(processedText);
  } else if (contentType === 'explanation') {
    processedText = addNaturalPauses(processedText);
  }

  if (processedText.length > MAX_INPUT_CHARS) {
    processedText = `${processedText.slice(0, MAX_INPUT_CHARS).trim()}...`;
  }

  return processedText;
}

function buildVoiceInstructions(emotion: string, characterStyle: string, enhanceProsody: boolean): string {
  const pacing = enhanceProsody
    ? 'Use natural pacing with short pauses at sentence boundaries.'
    : 'Use steady pacing without dramatic pauses.';
  return [
    'You are Michael, a clear and friendly SQL teaching assistant.',
    `Character style: ${characterStyle}.`,
    `Emotional tone: ${emotion}.`,
    pacing,
    'Pronounce technical terms clearly, especially SQL keywords.',
  ].join(' ');
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const featureVoiceEnabled = process.env.FEATURE_VOICE === '1';
    if (!featureVoiceEnabled) {
      return NextResponse.json({ 
        enabled: false,
        message: 'Voice feature is disabled'
      }, { status: 503 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const body = await request.json();
    const {
      text,
      voice: requestedVoice,
      speed = 1.0,
      format = 'mp3',
      emotion = 'neutral',
      content_type = 'general',
      enhance_prosody = true,
      character_style = 'university_ta'
    } = body || {};

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    if (!ALLOWED_FORMATS.has(format)) {
      return NextResponse.json({ error: 'Unsupported audio format' }, { status: 400 });
    }

    const hasHebrew = /[\u0590-\u05FF]/.test(text);
    let voice = hasHebrew ? 'nova' : 'onyx';
    if (requestedVoice && ALLOWED_VOICES.has(requestedVoice)) {
      voice = requestedVoice;
    }

    const normalizedSpeed = Math.max(0.5, Math.min(1.5, Number(speed) || 1.0));
    const speechText = normalizeSpeechText(text, content_type);
    const instructions = buildVoiceInstructions(emotion, character_style, enhance_prosody);

    // Enhanced dedup key with bounded memory footprint
    const requestKey = hashForDedup([
      voice,
      format,
      String(Math.round(normalizedSpeed * 100)),
      emotion,
      content_type,
      character_style,
      speechText,
    ]);
    if (activeRequests.has(requestKey)) {
      return await activeRequests.get(requestKey)!;
    }

    const processingPromise = (async (): Promise<NextResponse> => {
      try {
        let resp;
        try {
          resp = await openai.audio.speech.create({
            model: DEFAULT_TTS_MODEL,
            voice: voice as any,
            input: speechText,
            speed: normalizedSpeed,
            response_format: format as any,
            instructions,
          });
        } catch (primaryError) {
          // Fallback for environments still pinned to legacy TTS model behavior
          resp = await openai.audio.speech.create({
            model: 'tts-1',
            voice: voice as any,
            input: speechText,
            speed: normalizedSpeed,
            response_format: format as any,
          });
          console.warn('Falling back to tts-1 for speech synthesis:', primaryError);
        }

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
            'X-TTS-Content-Type': content_type,
            'X-TTS-Model': DEFAULT_TTS_MODEL,
          },
        });
      } catch (err) {
        console.error('TTS API Error:', err);
        return NextResponse.json({ 
          error: 'Failed to generate speech',
          details: err instanceof Error ? err.message : 'Unknown error'
        }, { status: 500 });
      } finally {
        activeRequests.delete(requestKey);
      }
    })();

    activeRequests.set(requestKey, processingPromise);
    return await processingPromise;
  } catch (error) {
    console.error('TTS Route Error:', error);
    return NextResponse.json({ 
      error: 'Failed to generate speech',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper function to enhance SQL pronunciation
function enhanceSQLPronunciation(text: string): string {
  return text
    .replace(/\bSELECT\b/gi, 'SELECT')
    .replace(/\bFROM\b/gi, 'FROM')
    .replace(/\bWHERE\b/gi, 'WHERE')
    .replace(/\bJOIN\b/gi, 'JOIN')
    .replace(/\bORDER BY\b/gi, 'ORDER BY')
    .replace(/\bGROUP BY\b/gi, 'GROUP BY')
    .replace(/\bHAVING\b/gi, 'HAVING')
    .replace(/\bUNION\b/gi, 'UNION')
    .replace(/\bINNER\b/gi, 'INNER')
    .replace(/\bLEFT\b/gi, 'LEFT')
    .replace(/\bRIGHT\b/gi, 'RIGHT')
    .replace(/\bOUTER\b/gi, 'OUTER');
}

// Helper function to add natural pauses for explanations
function addNaturalPauses(text: string): string {
  return text
    .replace(/\./g, '. ') // Add pause after periods
    .replace(/:/g, ': ') // Add pause after colons
    .replace(/;/g, '; ') // Add pause after semicolons
    .replace(/,/g, ', '); // Add pause after commas
}

export async function GET() {
  return NextResponse.json({
    voices: ['onyx','echo','fable','alloy','nova','shimmer'],
    models: [DEFAULT_TTS_MODEL, 'tts-1'],
    formats: ['mp3', 'wav', 'opus', 'aac', 'flac', 'pcm'],
  });
}
