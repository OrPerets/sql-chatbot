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
  
  // Enhanced humanization with natural conversation flow
  if (options.humanize && options.naturalPauses) {
    const isComplexResponse = text.length > 200;
    const isQuestion = text.includes('?');
    const isExclamation = text.includes('!');
    
    // Add a thoughtful pause at the beginning for complex responses
    if (isComplexResponse) {
      enhancedText = `<break time="200ms"/>${enhancedText}`;
    } else if (isQuestion) {
      // Slight pause before questions for natural flow
      enhancedText = `<break time="100ms"/>${enhancedText}`;
    }
    
    // Add natural breathing pauses at strategic points
    if (text.length > 150) {
      // Find natural breaking points (after complete thoughts)
      enhancedText = enhancedText
        .replace(/(\. )(?=[A-Z])/g, '$1<break time="400ms"/>')  // Longer pause between sentences
        .replace(/(, )(?=and |but |or |so |because )/gi, '$1<break time="200ms"/>');  // Natural clause pauses
    }
  }
  
  // Natural pauses between punctuation marks for better rhythm
  if (options.addPauses) {
    enhancedText = enhancedText
      .replace(/([.!?])\s+/g, '$1<break time="350ms"/> ')  // Increased from 150ms for natural sentence breaks
      .replace(/([,;:])\s+/g, '$1<break time="200ms"/> ')  // Increased from 50ms for natural flow
      .replace(/(—|–)\s*/g, '<break time="250ms"/>$1<break time="250ms"/> ')  // Em/en dash pauses
      .replace(/\.\.\./g, '<break time="400ms"/>');  // Ellipsis for thinking pause
  }
  
  // Subtle emphasis only for very important terms
  if (options.emphasizeImportant) {
    enhancedText = enhancedText
      .replace(/\b(error|warning|important|note|remember)\b/gi, '<emphasis level="moderate">$1</emphasis>')
      .replace(/\b(SELECT|FROM|WHERE|JOIN|INSERT|UPDATE|DELETE)\b/g, '<emphasis level="reduced">$1</emphasis>');  // Gentle emphasis on SQL keywords
  }
  
  // Dynamic pacing based on content complexity
  if (options.adjustPacing) {
    const hasComplexTerms = /\b(normalization|optimization|algorithm|implementation|database|query)\b/i.test(text);
    const hasCode = /\b(SELECT|FROM|WHERE|CREATE|TABLE)\b/i.test(text);
    
    if (hasComplexTerms || hasCode) {
      // Slow down slightly for technical content
      enhancedText = `<prosody rate="0.92">${enhancedText}</prosody>`;
    } else if (options.characterStyle === 'university_ta') {
      // Natural teaching pace - slightly slower than normal
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
      speed = 0.95,    // Increased from 0.9 for better conversational pace
      format = 'mp3',
      enhance_prosody = true,
      character_style = 'university_ta',
      humanize = true,           // Keep but enhanced
      natural_pauses = true,     // Keep with better implementation
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
          // For progressive mode, avoid adding breaks that might cause early cutoff
          const isProgressiveMode = processedText.includes('...') || processedText.length < 100;
          
          processedText = enhanceTextWithSSML(processedText, {
            addPauses: !isProgressiveMode,  // Only add pauses for complete messages
            emphasizeImportant: true, // Re-enabled with subtle emphasis
            adjustPacing: true,     // Re-enabled with dynamic pacing
            humanize: humanize && !isProgressiveMode,  // Humanize only complete messages
            naturalPauses: natural_pauses && processedText.length > 50 && !isProgressiveMode,
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
          speed: Math.max(0.75, Math.min(1.1, speed)), // Adjusted range for more natural speech (0.75-1.1 instead of 0.8-1.2)
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