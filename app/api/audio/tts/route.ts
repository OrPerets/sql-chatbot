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
      voice = 'onyx',  // Default to the warm, confident male voice for Michael
      speed = 1.1,     // Optimized speed for natural conversation flow
      format = 'mp3',
      enhance_prosody = false, // Disabled by default for lower latency
      character_style = 'university_ta',
      humanize = true,
      natural_pauses = false,     // Disabled for lower latency
      emotional_intonation = false, // Disabled for lower latency
      low_latency = false  // New parameter for low-latency mode
    } = body;

    if (!text) {
      return NextResponse.json(
        { error: 'No text provided' },
        { status: 400 }
      );
    }

    // Create request fingerprint for deduplication
    const requestKey = `${text}_${voice}_${speed}_${format}_${low_latency ? 'fast' : 'normal'}_${character_style}_${humanize}`;
    
    // Check if identical request is already processing
    if (activeRequests.has(requestKey)) {
      console.log('🔄 Duplicate TTS request detected - returning existing promise');
      return await activeRequests.get(requestKey)!;
    }

    // Create and store the processing promise
    const processingPromise = (async (): Promise<NextResponse> => {
      try {
        const startTime = performance.now();
        
        // Detect language
        const hasHebrew = /[\u0590-\u05FF]/.test(text);
    
        // Optimized text cleaning for low-latency mode
        let processedText = text;
        
        if (!low_latency) {
          // Only apply complex processing in normal mode
          processedText = text
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/```[\s\S]*?```/g, ' [code block] ')
            .replace(/😊|😀|😃|😄|😁|😆|😅|🤣|😂|🙂|🙃|😉|😇|🥰|😍|🤩|😘|😗|😚|😙|😋|😛|😜|🤪|😝|🤑|🤗|🤭|🤫|🤔|🤐|🤨|😐|😑|😶|😏|😒|🙄|😬|🤥|😌|😔|😪|🤤|😴|😷|🤒|🤕|🤢|🤮|🤧|🥵|🥶|🥴|😵|🤯|🤠|🥳|😎|🤓|🧐|🚀|⚡|💡|🎯|🎓|✨|👍|👎|👏|🔧|🛠️|📝|📊|💻|⭐|🎉|🔥|💪|🏆|📈|🎪/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        } else {
          // Fast mode: minimal processing
          processedText = text
            .replace(/\s+/g, ' ')
            .trim();
        }

        // Simplified character-specific processing for low latency
        if (character_style === 'university_ta' && humanize && !low_latency) {
          if (hasHebrew) {
            processedText = processedText.replace(/\bSQL\b/g, 'אס קיו אל');
          } else {
            processedText = processedText.replace(/\bSQL\b/g, 'S-Q-L');
          }
        }

        // Apply minimal SSML only if not in low-latency mode
        if (enhance_prosody && !low_latency) {
          processedText = enhanceTextWithSSML(processedText, {
            addPauses: false,        // Disabled for speed
            emphasizeImportant: false,
            adjustPacing: false,
            humanize: false,
            naturalPauses: false,
            emotionalIntonation: false,
            characterStyle: character_style
          });
        }

        // Enhanced voice selection with optimization for human-like speech
        let selectedVoice = voice;
        if (hasHebrew) {
          selectedVoice = 'nova';
          console.log('🇮🇱 Hebrew detected - using nova voice for best Hebrew pronunciation');
        } else if (!hasHebrew && character_style === 'university_ta') {
          // Optimized for Michael's character
          if (low_latency) {
            selectedVoice = 'onyx'; // Always use onyx in low-latency mode
            console.log('⚡ Low-latency mode - using onyx voice for optimal speed and warmth');
          } else if (humanize) {
            selectedVoice = ['onyx', 'echo', 'fable'].includes(voice) ? voice : 'onyx';
            console.log('🎓 English TA mode with humanization - using warm voice:', selectedVoice);
          } else {
            selectedVoice = ['echo', 'onyx'].includes(voice) ? voice : 'echo';
            console.log('🎓 English TA mode - using professional voice:', selectedVoice);
          }
        }

        // Optimized speed settings for natural human-like speech
        let finalSpeed = speed;
        if (low_latency) {
          // Slightly faster for low-latency mode but still natural
          finalSpeed = Math.min(speed * 1.05, 1.15);
          console.log('⚡ Low-latency mode - speed:', finalSpeed);
        } else if (humanize) {
          // Perfect speed for human-like conversation
          finalSpeed = Math.max(speed * 0.95, 1.0);
          console.log('🎭 Humanized mode - speed:', finalSpeed);
        }

        // **BROWSER-COMPATIBLE AUDIO SETTINGS**
        // Always use MP3 for maximum browser compatibility
        const responseFormat = 'mp3';  // MP3 is universally supported in browsers

        console.log(`🎵 Generating TTS with OpenAI:`, {
          voice: selectedVoice,
          speed: finalSpeed,
          format: responseFormat,
          mode: low_latency ? 'low-latency' : 'standard',
          text_length: processedText.length
        });

        // **HIGH-QUALITY TTS GENERATION**
        const mp3Response = await openai.audio.speech.create({
          model: 'tts-1-hd',  // Use HD model for better clarity and reduced artifacts
          voice: selectedVoice as any,
          input: processedText,
          speed: finalSpeed,
          response_format: responseFormat as any,
        });

        const audioBuffer = Buffer.from(await mp3Response.arrayBuffer());
        const audioBase64 = audioBuffer.toString('base64');
        const audioUrl = `data:audio/${responseFormat};base64,${audioBase64}`;

        const endTime = performance.now();
        const processingTime = Math.round(endTime - startTime);
        
        console.log(`✅ TTS generated successfully in ${processingTime}ms`, {
          voice: selectedVoice,
          speed: finalSpeed,
          format: responseFormat,
          size: `${Math.round(audioBuffer.length / 1024)}KB`,
          quality: 'HD'
        });

        // **OPTIMIZED RESPONSE WITH QUALITY HEADERS**
        const response = NextResponse.json({
          success: true,
          audioUrl,
          metadata: {
            voice: selectedVoice,
            speed: finalSpeed,
            format: responseFormat,
            size: audioBuffer.length,
            processingTime,
            textLength: processedText.length,
            mode: low_latency ? 'low-latency' : 'standard',
            quality: 'HD'
          }
        });

        // Add headers for better audio caching and quality
        response.headers.set('Cache-Control', 'public, max-age=3600');
        response.headers.set('Content-Type', 'application/json');
        
        return response;
      } finally {
        // Clean up the active request
        activeRequests.delete(requestKey);
      }
    })();

    // Store the promise
    activeRequests.set(requestKey, processingPromise);
    return await processingPromise;

  } catch (error) {
    console.error('TTS API error:', error);
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