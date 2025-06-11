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
    
    // Clean text for browser TTS
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/```[\s\S]*?```/g, ' code block ')
      .replace(/😊|😀|😃|😄|😁|😆|😅|🤣|😂|🙂|🙃|😉|😇|🥰|😍|🤩|😘|😗|😚|😙|😋|😛|😜|🤪|😝|🤑|🤗|🤭|🤫|🤔|🤐|🤨|😐|😑|😶|😏|😒|🙄|😬|🤥|😌|😔|😪|🤤|😴|😷|🤒|🤕|🤢|🤮|🤧|🥵|🥶|🥴|😵|🤯|🤠|🥳|😎|🤓|🧐|🚀|⚡|💡|🎯|🎓|✨|👍|👎|👏|🔧|🛠️|📝|📊|💻|⭐|🎉|🔥|💪|🏆|📈|🎪/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Create utterance
    this.currentUtterance = new SpeechSynthesisUtterance(cleanText);
    this.currentUtterance.lang = language === 'he' ? 'he-IL' : 'en-US';
    this.currentUtterance.rate = (options.speed || 1.0) * 0.9;
    this.currentUtterance.pitch = options.pitch || 0.95;
    this.currentUtterance.volume = options.volume || 0.9;

    // Select browser voice
    const voices = this.speechSynthesis.getVoices();
    let selectedVoice = null;
    
    if (language === 'he') {
      selectedVoice = voices.find(voice => 
        voice.lang.includes('he') || voice.lang.includes('iw') ||
        voice.name.toLowerCase().includes('carmit') || 
        voice.name.toLowerCase().includes('hebrew')
      );
    } else {
      // Prefer male voices for university TA character
      selectedVoice = voices.find(voice => {
        const name = voice.name.toLowerCase();
        return name.includes('alex') || name.includes('daniel') || 
               name.includes('thomas') || name.includes('male');
      });
    }
    
    if (selectedVoice) {
      this.currentUtterance.voice = selectedVoice;
    }

    return new Promise((resolve, reject) => {
      if (!this.currentUtterance) {
        reject(new Error('No utterance created'));
        return;
      }

      this.currentUtterance.onend = () => resolve();
      this.currentUtterance.onerror = (event) => reject(new Error(`Speech error: ${event.error}`));
      
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
            audioUrl = await this.generateOpenAITTS(text, options);
            this.audioCache.set(cacheKey, audioUrl);
          }

          // Play audio
          this.currentAudio = new Audio(audioUrl);
          this.currentAudio.volume = options.volume || 0.9;
          this.currentAudio.playbackRate = options.speed || 1.0;
          
          await this.currentAudio.play();
          
          return new Promise((resolve, reject) => {
            if (!this.currentAudio) return reject(new Error('No audio'));
            
            this.currentAudio.onended = () => {
              options.onEnd?.();
              resolve();
            };
            this.currentAudio.onerror = (error) => {
              const err = new Error('Audio playback error');
              options.onError?.(err);
              reject(err);
            };
          });
          
        } catch (openaiError) {
          console.warn('OpenAI TTS failed, falling back to browser TTS:', openaiError);
        }
      }

      // Fallback to browser TTS
      await this.generateBrowserTTS(text, options);
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