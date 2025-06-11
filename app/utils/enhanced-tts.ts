// Enhanced TTS Service with OpenAI and fallback support
export interface TTSOptions {
  voice?: string;
  speed?: number;
  pitch?: number;
  volume?: number;
  useOpenAI?: boolean;
  characterStyle?: 'university_ta' | 'professional' | 'casual' | 'technical';
  enhanceProsody?: boolean;
  backgroundAmbiance?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
}

export interface TTSVoice {
  id: string;
  name: string;
  description: string;
  type: 'openai' | 'browser';
  language: string[];
  gender: 'male' | 'female' | 'neutral';
  quality: 'standard' | 'high' | 'premium';
}

// Define available voices
export const AVAILABLE_VOICES: TTSVoice[] = [
  // OpenAI Premium Voices
  {
    id: 'nova',
    name: 'Nova',
    description: 'Warm, friendly female voice - great for explanations',
    type: 'openai',
    language: ['en', 'he'],
    gender: 'female',
    quality: 'premium'
  },
  {
    id: 'shimmer',
    name: 'Shimmer',
    description: 'Clear, professional female voice - excellent for tutorials',
    type: 'openai',
    language: ['en', 'he'],
    gender: 'female',
    quality: 'premium'
  },
  {
    id: 'echo',
    name: 'Echo',
    description: 'Deep, authoritative male voice - perfect for Michael',
    type: 'openai',
    language: ['en', 'he'],
    gender: 'male',
    quality: 'premium'
  },
  {
    id: 'onyx',
    name: 'Onyx',
    description: 'Deep, confident male voice - professional and clear',
    type: 'openai',
    language: ['en', 'he'],
    gender: 'male',
    quality: 'premium'
  },
  {
    id: 'alloy',
    name: 'Alloy',
    description: 'Neutral, balanced voice - good for technical content',
    type: 'openai',
    language: ['en', 'he'],
    gender: 'neutral',
    quality: 'premium'
  },
  {
    id: 'fable',
    name: 'Fable',
    description: 'Warm, engaging voice - great for storytelling',
    type: 'openai',
    language: ['en', 'he'],
    gender: 'neutral',
    quality: 'premium'
  }
];

class EnhancedTTSService {
  private audioCache = new Map<string, string>();
  private currentAudio: HTMLAudioElement | null = null;
  private speechSynthesis: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.speechSynthesis = window.speechSynthesis;
    }
  }

  // Get cache key for audio
  private getCacheKey(text: string, options: TTSOptions): string {
    return `${text}-${JSON.stringify(options)}`;
  }

  // Detect text language
  private detectLanguage(text: string): 'en' | 'he' {
    const hasHebrew = /[\u0590-\u05FF]/.test(text);
    return hasHebrew ? 'he' : 'en';
  }

  // Select best voice based on language and preferences
  private selectVoice(language: 'en' | 'he', options: TTSOptions): string {
    const { voice, characterStyle } = options;
    
    // If specific voice requested and available, use it
    if (voice && AVAILABLE_VOICES.some(v => v.id === voice && v.language.includes(language))) {
      return voice;
    }

    // Auto-select based on character style and language
    if (language === 'he') {
      return 'nova'; // Nova handles Hebrew well
    }

    // For English, choose based on character style
    switch (characterStyle) {
      case 'university_ta':
        return 'echo'; // Friendly male TA voice
      case 'professional':
        return 'onyx'; // Professional male voice
      case 'casual':
        return 'shimmer'; // Warm female voice
      case 'technical':
        return 'alloy'; // Neutral voice
      default:
        return 'echo';
    }
  }

  // Generate speech using OpenAI TTS
  private async generateOpenAITTS(text: string, options: TTSOptions): Promise<string> {
    const language = this.detectLanguage(text);
    const selectedVoice = this.selectVoice(language, options);
    
    const response = await fetch('/api/audio/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voice: selectedVoice,
        speed: options.speed || 1.0,
        format: 'mp3',
        enhance_prosody: options.enhanceProsody !== false,
        character_style: options.characterStyle || 'university_ta'
      }),
    });

    if (!response.ok) {
      throw new Error(`TTS API error: ${response.status}`);
    }

    // Convert response to blob URL
    const audioBlob = await response.blob();
    return URL.createObjectURL(audioBlob);
  }

  // Fallback to browser speech synthesis
  private async generateBrowserTTS(text: string, options: TTSOptions): Promise<void> {
    if (!this.speechSynthesis) {
      throw new Error('Speech synthesis not supported');
    }

    const language = this.detectLanguage(text);
    
    // Clean text for natural, teacher-like speech with comprehension focus
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
      .replace(/```[\s\S]*?```/g, '. Here is some code... ') // Natural pause before code explanation
      .replace(/`([^`]+)`/g, '$1') // Remove inline code backticks
      .replace(/[😊😀😃😄😁😆😅🤣😂🙂🙃😉😇🥰😍🤩😘😗😚😙😋😛😜🤪😝🤑🤗🤭🤫🤔🤐🤨😐😑😶😏😒🙄😬🤥😌😔😪🤤😴😷🤒🤕🤢🤮🤧🥵🥶🥴😵🤯🤠🥳😎🤓🧐🚀⚡💡🎯🎓✨👍👎👏🔧🛠️📝📊💻⭐🎉🔥💪🏆📈🎪]/g, '') // Remove emojis
      // Natural sentence flow and pauses for teaching
      .replace(/\n\n+/g, '... ') // Double newlines become thoughtful pauses
      .replace(/\n+/g, '. ') // Single newlines become sentence breaks
      .replace(/([.!?])\s*([A-Z])/g, '$1... $2') // Add thoughtful pause after sentences
      .replace(/([.!?])\s*$/g, '$1...') // Add pause at end of final sentences
      .replace(/:\s*/g, ': ') // Pause after colons for explanation
      .replace(/;\s*/g, '; ') // Pause after semicolons
      .replace(/,\s*and\s+/g, ', and ') // Natural "and" conjunction pauses
      .replace(/,\s*but\s+/g, ', but ') // Natural "but" conjunction pauses
      .replace(/,\s*or\s+/g, ', or ') // Natural "or" conjunction pauses
      .replace(/,\s*so\s+/g, ', so ') // Natural "so" conjunction pauses
      // Clean up excessive punctuation
      .replace(/[.]{3,}/g, '...') // Normalize ellipses
      .replace(/[.]{2}/g, '...') // Convert double dots to ellipses
      .replace(/[?]{2,}/g, '?') // Single question marks
      .replace(/[!]{2,}/g, '!') // Single exclamation marks
      // Ensure proper spacing for natural speech rhythm
      .replace(/\s*[.]\s*/g, '. ') // Proper period spacing
      .replace(/\s*[,]\s*/g, ', ') // Proper comma spacing
      .replace(/\s*[?]\s*/g, '? ') // Proper question spacing
      .replace(/\s*[!]\s*/g, '! ') // Proper exclamation spacing
      .replace(/\s*[...]\s*/g, '... ') // Proper ellipses spacing
      .replace(/\s+/g, ' ') // Clean up multiple spaces
      .trim();

    // ENHANCED voice selection for natural human-like speech
    const voices = this.speechSynthesis.getVoices();
    let selectedVoice = null;
    
    if (language === 'he') {
      // Prioritize high-quality Hebrew voices
      selectedVoice = voices.find(voice => 
        (voice.lang.includes('he') || voice.lang.includes('iw')) &&
        (voice.name.toLowerCase().includes('carmit') || 
         voice.name.toLowerCase().includes('hebrew') ||
         voice.localService === true) // Prefer local/system voices for better quality
      ) || voices.find(voice => voice.lang.includes('he') || voice.lang.includes('iw'));
    } else {
      // Prioritize natural English male voices for university TA character
      selectedVoice = voices.find(voice => {
        const name = voice.name.toLowerCase();
        const isEnglish = voice.lang.startsWith('en');
        const isLocal = voice.localService === true;
        const isMale = name.includes('male') || name.includes('alex') || 
                      name.includes('daniel') || name.includes('thomas') ||
                      name.includes('arthur') || name.includes('gordon');
        return isEnglish && (isLocal || isMale);
      });
      
      // Fallback to any good English voice
      if (!selectedVoice) {
        selectedVoice = voices.find(voice => 
          voice.lang.startsWith('en') && voice.localService === true
        ) || voices.find(voice => voice.lang.startsWith('en'));
      }
    }
    
    // Final fallback to first available voice
    if (!selectedVoice) {
      selectedVoice = voices.find(voice => voice.lang.startsWith(language === 'he' ? 'he' : 'en')) || voices[0];
    }

    // Create utterance
    this.currentUtterance = new SpeechSynthesisUtterance(cleanText);
    this.currentUtterance.lang = language === 'he' ? 'he-IL' : 'en-US';
    this.currentUtterance.rate = Math.min((options.speed || 1.0) * 0.95, 1.5); // Even slower, more deliberate teaching pace
    this.currentUtterance.pitch = options.pitch || 0.85; // Lower pitch for warm, authoritative teacher voice
    this.currentUtterance.volume = options.volume || 0.75; // Softer volume for comfortable listening

    if (selectedVoice) {
      this.currentUtterance.voice = selectedVoice;
    }

    return new Promise((resolve, reject) => {
      if (!this.currentUtterance) {
        reject(new Error('No utterance created'));
        return;
      }

      this.currentUtterance.onstart = () => {
        // Call onStart only if it wasn't already called (for fallback scenarios)
        if (options.onStart) {
          options.onStart();
        }
        console.log('Browser speech synthesis started');
      };

      this.currentUtterance.onend = () => {
        options.onEnd?.();
        resolve();
      };
      
      this.currentUtterance.onerror = (event) => {
        const err = new Error(`Speech error: ${event.error}`);
        options.onError?.(err);
        reject(err);
      };
      
      // Start speech immediately
      this.speechSynthesis!.speak(this.currentUtterance);
    });
  }

  // Main speak method
  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    if (!text.trim()) return;

    // Call onStart callback IMMEDIATELY for instant visual feedback
    options.onStart?.();

    const cacheKey = this.getCacheKey(text, options);
    
    try {
      // Stop any current speech
      this.stop();

      // Try OpenAI TTS first if enabled and available
      if (options.useOpenAI !== false) {
        try {
          let audioUrl = this.audioCache.get(cacheKey);
          
          if (!audioUrl) {
            console.log('Generating new OpenAI TTS audio...');
            audioUrl = await this.generateOpenAITTS(text, options);
            this.audioCache.set(cacheKey, audioUrl);
          } else {
            console.log('Using cached OpenAI TTS audio');
          }

          // Play audio immediately when ready
          this.currentAudio = new Audio(audioUrl);
          this.currentAudio.volume = options.volume || 0.8;
          this.currentAudio.playbackRate = options.speed || 1.0;
          
          await this.currentAudio.play();
          
          return new Promise((resolve, reject) => {
            if (!this.currentAudio) return reject(new Error('No audio'));
            
            this.currentAudio.onended = () => {
              options.onEnd?.();
              resolve();
            };
            this.currentAudio.onerror = (error) => {
              console.error('Audio playback error:', error);
              const err = new Error('Audio playback error');
              options.onError?.(err);
              reject(err);
            };
          });
          
        } catch (openaiError) {
          console.warn('OpenAI TTS failed, falling back to browser TTS:', openaiError);
          // Fall through to browser TTS
        }
      }

      // Use browser TTS as fallback (onStart already called above)
      await this.generateBrowserTTS(text, { ...options, onStart: undefined }); // Don't call onStart again
      options.onEnd?.();
      
    } catch (error) {
      console.error('All TTS methods failed:', error);
      const err = error instanceof Error ? error : new Error('TTS failed');
      options.onError?.(err);
      throw err;
    }
  }

  // Stop current speech
  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }

    if (this.speechSynthesis && this.speechSynthesis.speaking) {
      this.speechSynthesis.cancel();
    }
    
    this.currentUtterance = null;
  }

  // Check if currently speaking
  isSpeaking(): boolean {
    return !!(
      (this.currentAudio && !this.currentAudio.paused) ||
      (this.speechSynthesis && this.speechSynthesis.speaking)
    );
  }

  // Get available voices
  getVoices(): TTSVoice[] {
    return AVAILABLE_VOICES;
  }

  // Clear audio cache
  clearCache(): void {
    // Revoke blob URLs to free memory
    this.audioCache.forEach(url => URL.revokeObjectURL(url));
    this.audioCache.clear();
  }

  // Add background ambiance (optional enhancement)
  async addBackgroundAmbiance(type: 'classroom' | 'library' | 'office' = 'classroom'): Promise<void> {
    // This could be enhanced to add subtle background sounds
    // For now, we'll just adjust the voice parameters slightly
    console.log(`Adding ${type} ambiance effect`);
  }
}

// Export singleton instance
export const enhancedTTS = new EnhancedTTSService();

// Utility function for easy usage
export async function speakWithMichael(
  text: string, 
  options: TTSOptions = {}
): Promise<void> {
  const defaultOptions: TTSOptions = {
    useOpenAI: true,
    characterStyle: 'university_ta',
    enhanceProsody: true,
    speed: 1.0,
    volume: 0.9,
    ...options
  };
  
  return enhancedTTS.speak(text, defaultOptions);
} 