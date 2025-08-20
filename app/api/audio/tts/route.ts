import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Global request deduplication to prevent multiple identical TTS calls
const activeRequests = new Map<string, Promise<NextResponse>>();

const ALLOWED_VOICES = new Set(['onyx','echo','fable','alloy','nova','shimmer']);

export async function POST(request: NextRequest) {
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
    } = body || {};

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const hasHebrew = /[\u0590-\u05FF]/.test(text);
    let voice = hasHebrew ? 'nova' : 'onyx';
    if (requestedVoice && ALLOWED_VOICES.has(requestedVoice)) {
      voice = requestedVoice;
    }

    // Dedup key
    const requestKey = `${voice}_${format}_${Math.round(speed * 100)}_${text}`;
    if (activeRequests.has(requestKey)) {
      return await activeRequests.get(requestKey)!;
    }

    const processingPromise = (async (): Promise<NextResponse> => {
      try {
        // Clean minimal text
        const processedText = text
          .replace(/```[\s\S]*?```/g, ' [code block] ')
          .replace(/\s+/g, ' ')
          .trim();

        // Call OpenAI speech API (server-side)
        const resp = await openai.audio.speech.create({
          model: 'gpt-4o-mini-tts',
          voice: voice as any,
          input: processedText,
          speed: Math.max(0.5, Math.min(1.5, Number(speed) || 1.0)),
          format: format as any,
        });

        const arrayBuf = await resp.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        if (!buffer || buffer.length === 0) {
          return NextResponse.json({ error: 'Empty audio from TTS' }, { status: 502 });
        }

        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': format === 'mp3' ? 'audio/mpeg' : 'application/octet-stream',
            'Content-Length': buffer.length.toString(),
            'Cache-Control': 'no-store',
          },
        });
      } catch (err) {
        return NextResponse.json({ error: 'Failed to generate speech' }, { status: 500 });
      } finally {
        activeRequests.delete(requestKey);
      }
    })();

    activeRequests.set(requestKey, processingPromise);
    return await processingPromise;
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate speech' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    voices: ['onyx','echo','fable','alloy','nova','shimmer'],
    models: ['gpt-4o-mini-tts'],
    formats: ['mp3','opus'],
  });
}