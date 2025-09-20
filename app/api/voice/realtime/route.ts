import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const featureVoiceEnabled = process.env.FEATURE_VOICE === '1';
    if (!featureVoiceEnabled) {
      return NextResponse.json({ error: 'Voice feature disabled' }, { status: 404 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const { action, data } = await request.json();
    
    switch (action) {
      case 'connect':
        // Return connection configuration for client-side realtime service
        return NextResponse.json({ 
          success: true,
          config: {
            model: 'gpt-4o-realtime-preview-2024-10-01',
            voice: 'alloy',
            instructions: `You are Michael, an expert SQL tutor. 
              Provide clear, concise explanations about SQL concepts.
              Support both Hebrew and English languages.
              Keep responses conversational and educational.
              When explaining SQL queries, be practical and give examples.`
          }
        });
        
      case 'configure':
        // Update realtime configuration
        const { voice, instructions, model } = data || {};
        return NextResponse.json({ 
          success: true,
          config: {
            model: model || 'gpt-4o-realtime-preview-2024-10-01',
            voice: voice || 'alloy',
            instructions: instructions || 'You are Michael, an expert SQL tutor.'
          }
        });
        
      case 'health':
        // Health check for realtime service
        return NextResponse.json({ 
          success: true,
          status: 'healthy',
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
  return NextResponse.json({
    service: 'OpenAI Realtime Voice API',
    version: '1.0.0',
    status: 'available',
    features: [
      'real-time voice conversation',
      'speech-to-text transcription',
      'text-to-speech generation',
      'context-aware responses',
      'multilingual support (Hebrew/English)'
    ]
  });
}
