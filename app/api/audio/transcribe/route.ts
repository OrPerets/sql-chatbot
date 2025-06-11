import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    console.log('Transcription API called');
    
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

    // Convert File to form data for OpenAI API
    const openaiFormData = new FormData();
    openaiFormData.append('file', audioFile);
    openaiFormData.append('model', 'whisper-1');
    openaiFormData.append('language', 'he'); // Hebrew language preference

    console.log('Calling OpenAI Whisper API...');
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'he', // Hebrew support
      response_format: 'json',
    });

    console.log('Transcription successful:', transcription.text);
    return NextResponse.json({
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