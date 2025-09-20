import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Global request deduplication to prevent multiple identical TTS calls
const activeRequests = new Map<string, Promise<NextResponse>>();

const ALLOWED_VOICES = new Set(['onyx','echo','fable','alloy','nova','shimmer']);

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const featureVoiceEnabled = process.env.FEATURE_VOICE === '1';
    if (!featureVoiceEnabled) {
      return NextResponse.json({ error: 'Voice feature disabled' }, { status: 404 });
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
        // Enhanced text processing with content-type awareness
        let processedText = text
          .replace(/```[\s\S]*?```/g, ' [code block] ')
          .replace(/\s+/g, ' ')
          .trim();

        // Apply content-type specific processing
        if (content_type === 'sql') {
          processedText = enhanceSQLPronunciation(processedText);
        } else if (content_type === 'explanation') {
          processedText = addNaturalPauses(processedText);
        }

        // Apply emotion-based text enhancement
        if (emotion !== 'neutral') {
          processedText = applyEmotionEnhancement(processedText, emotion);
        }

        // Call OpenAI speech API with enhanced parameters
        const resp = await openai.audio.speech.create({
          model: 'tts-1',
          voice: voice as any,
          input: processedText,
          speed: Math.max(0.5, Math.min(1.5, Number(speed) || 1.0)),
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

// Helper function to apply emotion enhancement
function applyEmotionEnhancement(text: string, emotion: string): string {
  switch (emotion) {
    case 'excited':
      return text.replace(/!/g, '! ').replace(/\./g, '. ');
    case 'calm':
      return text.replace(/\./g, '. ').replace(/!/g, '.');
    case 'happy':
      return text.replace(/\./g, '. ').replace(/!/g, '! ');
    case 'sad':
      return text.replace(/\./g, '... ').replace(/!/g, '.');
    default:
      return text;
  }
}

export async function GET() {
  return NextResponse.json({
    voices: ['onyx','echo','fable','alloy','nova','shimmer'],
    models: ['tts-1'],
    formats: ['mp3','opus'],
  });
}