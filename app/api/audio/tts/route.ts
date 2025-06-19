import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Global request deduplication to prevent multiple identical TTS calls
const activeRequests = new Map<string, Promise<NextResponse>>();

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

// Add SSML processing for enhanced prosody and human-like speech
function enhanceTextWithSSML(text: string, options: {
  addPauses?: boolean;
  emphasizeImportant?: boolean;
  adjustPacing?: boolean;
  humanize?: boolean;
  naturalPauses?: boolean;
  emotionalIntonation?: boolean;
  characterStyle?: string;
} = {}) {
  let enhancedText = text;
  
  // Minimal humanization - reduce initial pause
  if (options.humanize && options.naturalPauses) {
    const isComplexResponse = text.length > 200;
    if (isComplexResponse) {
      enhancedText = `<break time="50ms"/>${enhancedText}`;
    }
  }
  
  // Minimal pauses - reduce break times significantly
  if (options.addPauses) {
    enhancedText = enhancedText
      .replace(/([.!?])\s+/g, '$1<break time="150ms"/> ')
      .replace(/([,;:])\s+/g, '$1<break time="50ms"/> ');
  }
  
  // Minimal emphasis - only for very important terms
  if (options.emphasizeImportant) {
    enhancedText = enhancedText
      .replace(/\b(error|warning|important)\b/gi, '<emphasis level="moderate">$1</emphasis>');
  }
  
  // Simple pacing - just slow down if too complex
  if (options.adjustPacing) {
    const hasVeryComplexTerms = /\b(normalization|optimization|algorithm|implementation)\b/i.test(text);
    if (hasVeryComplexTerms) {
      enhancedText = `<prosody rate="0.95">${enhancedText}</prosody>`;
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
      voice = 'onyx',  // Keep the warmer male voice
      speed = 1.0,     // Back to normal speed for clarity
      format = 'mp3',
      enhance_prosody = true,
      character_style = 'university_ta',
      humanize = true,           // Keep but simplified
      natural_pauses = true,     // Keep but minimal
      emotional_intonation = false // Disable to avoid complexity
    } = body;

    if (!text) {
      return NextResponse.json(
        { error: 'No text provided' },
        { status: 400 }
      );
    }

    // Create request fingerprint for deduplication
    const requestKey = `${text}_${voice}_${speed}_${format}_${enhance_prosody}_${character_style}_${humanize}_${natural_pauses}_${emotional_intonation}`;
    
    // Check if identical request is already processing
    if (activeRequests.has(requestKey)) {
      console.log('🔄 Duplicate TTS request detected - returning existing promise');
      return await activeRequests.get(requestKey)!;
    }

    // Create and store the processing promise
    const processingPromise = (async (): Promise<NextResponse> => {
      try {
        // Detect language
        const hasHebrew = /[\u0590-\u05FF]/.test(text);
    
        // Simplified text cleaning - remove problematic enhancements
        let processedText = text
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1')
          .replace(/```[\s\S]*?```/g, ' [code block] ')
          .replace(/😊|😀|😃|😄|😁|😆|😅|🤣|😂|🙂|🙃|😉|😇|🥰|😍|🤩|😘|😗|😚|😙|😋|😛|😜|🤪|😝|🤑|🤗|🤭|🤫|🤔|🤐|🤨|😐|😑|😶|😏|😒|🙄|😬|🤥|😌|😔|😪|🤤|😴|😷|🤒|🤕|🤢|🤮|🤧|🥵|🥶|🥴|😵|🤯|🤠|🥳|😎|🤓|🧐|🚀|⚡|💡|🎯|🎓|✨|👍|👎|👏|🔧|🛠️|📝|📊|💻|⭐|🎉|🔥|💪|🏆|📈|🎪/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        // Minimal character-specific processing - no random additions
        if (character_style === 'university_ta' && humanize) {
          if (hasHebrew) {
            // Simple Hebrew enhancements - no prefixes
            processedText = processedText
              .replace(/\bSQL\b/g, 'אס קיו אל'); // Hebrew pronunciation
          } else {
            // Simple English enhancements - no random openings
            processedText = processedText
              .replace(/\bSQL\b/g, 'S-Q-L'); // Spell out for clarity
          }
        }

        // Apply minimal SSML for basic clarity improvements
        if (enhance_prosody) {
          processedText = enhanceTextWithSSML(processedText, {
            addPauses: true,        // Only basic pauses
            emphasizeImportant: false, // Disable to avoid issues
            adjustPacing: false,    // Disable complex pacing
            humanize: false,        // Disable complex humanization
            naturalPauses: natural_pauses && processedText.length > 100,
            emotionalIntonation: false, // Already disabled above
            characterStyle: character_style
          });
        }

        // Enhanced voice selection with humanization preferences
        let selectedVoice = voice;
        if (hasHebrew) {
          // For Hebrew text, use voices that handle Hebrew well
          selectedVoice = 'nova';
          console.log('🇮🇱 Hebrew detected - using nova voice for best Hebrew pronunciation');
        } else if (!hasHebrew && character_style === 'university_ta') {
          // For English Michael, prefer warmer male voices when humanized
          if (humanize) {
            selectedVoice = ['onyx', 'echo', 'fable'].includes(voice) ? voice : 'onyx';
            console.log('🎓 English TA mode with humanization - using warm male voice:', selectedVoice);
          } else {
            selectedVoice = ['echo', 'onyx'].includes(voice) ? voice : 'echo';
            console.log('🎓 English TA mode - using professional male voice:', selectedVoice);
          }
        }

        console.log(`Generating humanized TTS with voice: ${selectedVoice} for text: ${processedText.substring(0, 100)}...`);

        // Generate speech using OpenAI TTS with optimized parameters for clear speech
        const mp3 = await openai.audio.speech.create({
          model: 'tts-1-hd', // Always use the high-quality model for best results
          voice: selectedVoice as any,
          input: processedText,
          speed: Math.max(0.8, Math.min(1.2, speed)), // More reasonable speed range for clarity
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
      } finally {
        // Clean up the request tracking
        activeRequests.delete(requestKey);
      }
    })();

    // Store the promise and return it
    activeRequests.set(requestKey, processingPromise);
    return await processingPromise;

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