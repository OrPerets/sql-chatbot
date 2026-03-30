import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getVoiceRuntimeConfig, isVoiceFeatureEnabled } from '@/lib/openai/voice-config';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const voiceConfig = getVoiceRuntimeConfig();
    console.log('Transcription API called');
    // Feature flag guard
    const featureVoiceEnabled = isVoiceFeatureEnabled();
    if (!featureVoiceEnabled) {
      return NextResponse.json({ error: 'Voice feature disabled' }, { status: 404 });
    }
    
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not found in environment variables');
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }
    
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    console.log('Audio file received:', audioFile?.name, audioFile?.size);

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    console.log('Calling OpenAI transcription API...');
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: voiceConfig.chained.transcriptionModel,
      language: 'he', // Hebrew support
      response_format: 'json',
    });

    console.log('Transcription successful:', transcription.text);
    return NextResponse.json({
      text: transcription.text,
      transcription: transcription.text,
    });

  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: 'Failed to transcribe audio' },
      { status: 500 }
    );
  }
} 
