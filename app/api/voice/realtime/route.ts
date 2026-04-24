import { NextRequest, NextResponse } from 'next/server';
import { getVoiceRuntimeConfig, isVoiceFeatureEnabled } from '@/lib/openai/voice-config';

export async function POST(request: NextRequest) {
  try {
    const featureVoiceEnabled = isVoiceFeatureEnabled();
    if (!featureVoiceEnabled) {
      return NextResponse.json({ error: 'Voice feature disabled' }, { status: 404 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const { action, data } = await request.json();
    const voiceConfig = getVoiceRuntimeConfig();
    
    switch (action) {
      case 'connect':
        return NextResponse.json({ 
          success: true,
          mode: voiceConfig.mode,
          config: voiceConfig,
          productionReady: voiceConfig.mode === 'chained'
        });
        
      case 'configure':
        const { voice, instructions, mode } = data || {};
        return NextResponse.json({ 
          success: true,
          config: {
            ...voiceConfig,
            mode: mode === 'realtime_experimental' ? 'realtime_experimental' : voiceConfig.mode,
            voice: voice || voiceConfig.voice,
            instructions: instructions || voiceConfig.instructions
          }
        });
        
      case 'health':
        return NextResponse.json({ 
          success: true,
          status: 'healthy',
          mode: voiceConfig.mode,
          timestamp: new Date().toISOString()
        });
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Realtime API error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

export async function GET() {
  const voiceConfig = getVoiceRuntimeConfig();
  return NextResponse.json({
    service: 'Michael Voice Runtime',
    version: '1.0.0',
    status: 'available',
    mode: voiceConfig.mode,
    config: voiceConfig,
    features: [
      'chained voice orchestration',
      'realtime experimental contract',
      'speech-to-text transcription',
      'text-to-speech generation',
      'context-aware responses',
      'multilingual support (Hebrew/English)'
    ]
  });
}
