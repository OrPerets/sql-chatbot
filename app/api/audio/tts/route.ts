import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Voice configurations for different contexts
const VOICE_PROFILES = {
  'nova': {
    openai_voice: 'nova',
    description: 'Warm, friendly female voice - great for explanations',
    language_support: ['en', 'he']
  },
  'shimmer': {
    openai_voice: 'shimmer',
    description: 'Clear, professional female voice - excellent for tutorials',
    language_support: ['en', 'he']
  },
  'alloy': {
    openai_voice: 'alloy',
    description: 'Neutral, balanced voice - good for technical content',
    language_support: ['en', 'he']
  },
  'echo': {
    openai_voice: 'echo',
    description: 'Deep, authoritative male voice - perfect for Michael',
    language_support: ['en', 'he']
  },
  'fable': {
    openai_voice: 'fable',
    description: 'Warm, engaging voice - great for storytelling',
    language_support: ['en', 'he']
  },
  'onyx': {
    openai_voice: 'onyx',
    description: 'Deep, confident male voice - professional and clear',
    language_support: ['en', 'he']
  }
};

// Add SSML processing for enhanced prosody
function enhanceTextWithSSML(text: string, options: {
  addPauses?: boolean;
  emphasizeImportant?: boolean;
  adjustPacing?: boolean;
} = {}) {
  let enhancedText = text;
  
  if (options.addPauses) {
    // Add natural pauses after punctuation
    enhancedText = enhancedText
      .replace(/([.!?])\s+/g, '$1 <break time="0.5s"/> ')
      .replace(/([,;:])\s+/g, '$1 <break time="0.3s"/> ');
  }
  
  if (options.emphasizeImportant) {
    // Emphasize SQL keywords and important terms
    enhancedText = enhancedText
      .replace(/\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|TABLE|DATABASE|JOIN|GROUP BY|ORDER BY)\b/gi, '<emphasis level="moderate">$1</emphasis>')
      .replace(/\b(error|warning|important|note|tip)\b/gi, '<emphasis level="strong">$1</emphasis>');
  }
  
  if (options.adjustPacing) {
    // Slow down complex technical explanations
    const hasComplexTerms = /\b(relationship|foreign key|primary key|normalization|optimization|index)\b/i.test(text);
    if (hasComplexTerms) {
      enhancedText = `<prosody rate="0.9">${enhancedText}</prosody>`;
    }
  }
  
  return enhancedText;
}

export async function POST(request: NextRequest) {
  try {
    console.log('OpenAI TTS API called');
    
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not found in environment variables');
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }
    
    const body = await request.json();
    const { 
      text, 
      voice = 'nova', 
      speed = 1.0, 
      format = 'mp3',
      enhance_prosody = true,
      character_style = 'university_ta'
    } = body;

    if (!text) {
      return NextResponse.json(
        { error: 'No text provided' },
        { status: 400 }
      );
    }

    // Detect language
    const hasHebrew = /[\u0590-\u05FF]/.test(text);
    
    // Clean and enhance text for better speech
    let processedText = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/```[\s\S]*?```/g, ' [code block] ')
      .replace(/😊|😀|😃|😄|😁|😆|😅|🤣|😂|🙂|🙃|😉|😇|🥰|😍|🤩|😘|😗|😚|😙|😋|😛|😜|🤪|😝|🤑|🤗|🤭|🤫|🤔|🤐|🤨|😐|😑|😶|😏|😒|🙄|😬|🤥|😌|😔|😪|🤤|😴|😷|🤒|🤕|🤢|🤮|🤧|🥵|🥶|🥴|😵|🤯|🤠|🥳|😎|🤓|🧐|🚀|⚡|💡|🎯|🎓|✨|👍|👎|👏|🔧|🛠️|📝|📊|💻|⭐|🎉|🔥|💪|🏆|📈|🎪/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Apply character-specific enhancements
    if (character_style === 'university_ta') {
      // Make it sound more like a friendly TA (removed "Alright" prefix for direct speech)
      processedText = processedText
        .replace(/\b(let me|let's)\b/gi, 'let\'s')
        .replace(/\b(you see|you can see)\b/gi, 'you\'ll notice')
        .replace(/\b(this is|this shows)\b/gi, 'here we have');
    }

    // Apply SSML enhancements if requested
    if (enhance_prosody) {
      processedText = enhanceTextWithSSML(processedText, {
        addPauses: true,
        emphasizeImportant: true,
        adjustPacing: hasHebrew // Slower for Hebrew
      });
    }

    // Select appropriate voice based on language and preference
    let selectedVoice = voice;
    if (hasHebrew && ['nova', 'shimmer'].includes(voice)) {
      // Keep nova/shimmer for Hebrew as they handle it well
      selectedVoice = voice;
    } else if (!hasHebrew && character_style === 'university_ta') {
      // For English Michael, prefer male voices
      selectedVoice = ['echo', 'onyx'].includes(voice) ? voice : 'echo';
    }

    console.log(`Generating TTS with voice: ${selectedVoice} for text: ${processedText.substring(0, 100)}...`);

    // Generate speech using OpenAI TTS
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1-hd', // Use the high-quality model
      voice: selectedVoice as any,
      input: processedText,
      speed: Math.max(0.25, Math.min(4.0, speed)), // Clamp speed between 0.25 and 4.0
      response_format: format as any,
    });

    // Convert the response to a buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());

    // Return audio with appropriate headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': format === 'mp3' ? 'audio/mpeg' : 'audio/wav',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });

  } catch (error) {
    console.error('TTS generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate speech' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Return available voice profiles
  return NextResponse.json({
    voices: VOICE_PROFILES,
    models: ['tts-1', 'tts-1-hd'],
    formats: ['mp3', 'opus', 'aac', 'flac'],
    character_styles: ['university_ta', 'professional', 'casual', 'technical']
  });
} 