import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const featureVoiceEnabled = process.env.FEATURE_VOICE === '1';
    if (!featureVoiceEnabled) {
      return NextResponse.json({ error: 'Voice feature disabled' }, { status: 404 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const { audioBuffer, context = 'general' } = await request.json();

    if (!audioBuffer || !Array.isArray(audioBuffer)) {
      return NextResponse.json({ error: 'Invalid audio buffer provided' }, { status: 400 });
    }

    try {
      // Convert audio buffer back to blob for Whisper API
      const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm' });
      
      // Create form data for Whisper API
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', 'auto'); // Auto-detect Hebrew/English
      formData.append('response_format', 'json');

      // Transcribe audio
      const transcription = await openai.audio.transcriptions.create({
        file: audioBlob as any,
        model: 'whisper-1',
        language: 'auto' as any,
        response_format: 'json'
      });

      const transcribedText = transcription.text?.toLowerCase() || '';
      
      // Analyze intent based on transcribed text and context
      const intent = await analyzeTranscriptionIntent(transcribedText, context);
      
      return NextResponse.json({
        intent: intent.intent,
        confidence: intent.confidence,
        transcription: transcribedText,
        context,
        analysis: intent.analysis
      });

    } catch (transcriptionError) {
      console.error('Transcription failed:', transcriptionError);
      
      // Fallback to basic audio analysis
      const basicAnalysis = analyzeAudioBasic(audioBuffer);
      
      return NextResponse.json({
        intent: basicAnalysis.intent,
        confidence: basicAnalysis.confidence,
        transcription: null,
        context,
        analysis: 'basic_audio_analysis',
        fallback: true
      });
    }

  } catch (error) {
    console.error('Voice intent analysis error:', error);
    return NextResponse.json({ 
      error: 'Failed to analyze voice intent',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Analyze transcribed text for intent
 */
async function analyzeTranscriptionIntent(text: string, context: string): Promise<{
  intent: string;
  confidence: number;
  analysis: string;
}> {
  // Define intent keywords and patterns
  const intentPatterns = {
    interaction_request: [
      'michael', 'מיכאל', 'help', 'עזרה', 'question', 'שאלה',
      'sql', 'query', 'database', 'בסיס נתונים', 'מסד נתונים',
      'explain', 'הסבר', 'show', 'תראה', 'how', 'איך'
    ],
    sql_assistance: [
      'select', 'insert', 'update', 'delete', 'join', 'where',
      'table', 'טבלה', 'column', 'עמודה', 'index', 'אינדקס',
      'create', 'drop', 'alter', 'grant', 'revoke'
    ],
    learning_request: [
      'learn', 'למד', 'teach', 'למד אותי', 'tutorial', 'הדרכה',
      'practice', 'תרגול', 'exercise', 'תרגיל', 'example', 'דוגמה'
    ],
    troubleshooting: [
      'error', 'שגיאה', 'problem', 'בעיה', 'fix', 'תקן',
      'wrong', 'לא נכון', 'broken', 'שבור', 'debug', 'באג'
    ]
  };

  let bestIntent = 'none';
  let maxConfidence = 0;
  let matchedKeywords: string[] = [];

  // Check each intent pattern
  for (const [intent, keywords] of Object.entries(intentPatterns)) {
    const matches = keywords.filter(keyword => text.includes(keyword));
    const confidence = Math.min(1.0, matches.length * 0.3 + (matches.length > 0 ? 0.4 : 0));
    
    if (confidence > maxConfidence) {
      maxConfidence = confidence;
      bestIntent = intent;
      matchedKeywords = matches;
    }
  }

  // Context-specific adjustments
  if (context === 'sql_learning' && bestIntent === 'none' && text.length > 5) {
    bestIntent = 'interaction_request';
    maxConfidence = Math.min(0.6, text.length * 0.02);
  }

  // Minimum confidence threshold
  if (maxConfidence < 0.3) {
    bestIntent = 'ambient_sound';
    maxConfidence = 0.1;
  }

  return {
    intent: bestIntent,
    confidence: maxConfidence,
    analysis: `Matched keywords: [${matchedKeywords.join(', ')}], Text length: ${text.length}`
  };
}

/**
 * Basic audio analysis fallback when transcription fails
 */
function analyzeAudioBasic(audioBuffer: number[]): {
  intent: string;
  confidence: number;
} {
  // Calculate basic audio properties
  const bufferLength = audioBuffer.length;
  const nonZeroSamples = audioBuffer.filter(sample => Math.abs(sample) > 0.01).length;
  const audioActivity = nonZeroSamples / bufferLength;
  
  // Simple heuristic: if there's enough audio activity, assume interaction intent
  if (audioActivity > 0.1 && bufferLength > 8000) { // ~0.5 seconds at 16kHz
    return {
      intent: 'interaction_request',
      confidence: Math.min(0.7, audioActivity * 2)
    };
  }
  
  return {
    intent: 'ambient_sound',
    confidence: 0.1
  };
}

export async function GET() {
  return NextResponse.json({
    service: 'Voice Intent Analysis',
    version: '1.0.0',
    supportedIntents: [
      'interaction_request',
      'sql_assistance', 
      'learning_request',
      'troubleshooting',
      'ambient_sound',
      'none'
    ],
    supportedLanguages: ['en', 'he', 'auto'],
    features: [
      'speech-to-text transcription',
      'intent classification',
      'confidence scoring',
      'context-aware analysis'
    ]
  });
}
