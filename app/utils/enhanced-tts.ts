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
  private audioUnlocked = false;
  private isCurrentlySpeaking = false;
  private globalSpeechLock = false;
  private globalTimeout: NodeJS.Timeout | null = null;
  private pendingRequests = new Map<string, Promise<string>>();

  constructor() {
    if (typeof window !== 'undefined') {
      this.speechSynthesis = window.speechSynthesis;
    }
  }

  // Test audio playback with user gesture
  async testAudioPlayback(): Promise<boolean> {
    try {
      console.log('🎵 Testing audio playback capability...');
      
      // Create a silent audio element to test autoplay
      const testAudio = new Audio();
      testAudio.src = 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ4AAAA='; // Silent 1 second WAV
      testAudio.volume = 0.01; // Almost silent
      
      const playPromise = testAudio.play();
      if (playPromise !== undefined) {
        await playPromise;
        console.log('✅ Audio playback test successful!');
        this.audioUnlocked = true;
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('⚠️ Audio playback test failed:', error);
      this.audioUnlocked = false;
      return false;
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
    
    // For Hebrew text, always use Nova (best Hebrew pronunciation)
    if (language === 'he') {
      console.log('🇮🇱 Hebrew text detected - forcing nova voice for optimal pronunciation');
      return 'nova';
    }

    // If specific voice requested and available for English, use it
    if (voice && AVAILABLE_VOICES.some(v => v.id === voice && v.language.includes(language))) {
      return voice;
    }

    // For English, choose based on character style
    switch (characterStyle) {
      case 'university_ta':
        return 'echo'; // Deep male TA voice for Michael
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
    
    // Create request key for client-side deduplication
    const requestKey = `${text}_${selectedVoice}_${options.speed || 1.0}_${options.enhanceProsody !== false}_${options.characterStyle || 'university_ta'}`;
    
    // Check if same request is already pending
    if (this.pendingRequests.has(requestKey)) {
      console.log('🔄 Client-side: Duplicate TTS request detected - reusing pending promise');
      return await this.pendingRequests.get(requestKey)!;
    }
    
    console.log(`🎤 Generating OpenAI TTS: voice=${selectedVoice}, language=${language}`);
    
    // Create the promise and store it
    const requestPromise = (async (): Promise<string> => {
      try {
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
        const audioUrl = URL.createObjectURL(audioBlob);
        console.log(`✅ OpenAI TTS audio generated: ${audioBlob.size} bytes`);
        return audioUrl;
      } finally {
        // Clean up pending request
        this.pendingRequests.delete(requestKey);
      }
    })();
    
    // Store the promise
    this.pendingRequests.set(requestKey, requestPromise);
    return await requestPromise;
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

    const callId = Math.random().toString(36).substring(2, 8);
    console.log(`🗣️ [${callId}] EnhancedTTS.speak() called with: "${text.substring(0, 50)}..."`);
    
    // GLOBAL LOCK - Only one speech at a time EVER
    if (this.globalSpeechLock || this.isCurrentlySpeaking) {
      console.log(`🚫 [${callId}] GLOBAL SPEECH LOCK: Rejecting speech request - already speaking`, {
        globalSpeechLock: this.globalSpeechLock,
        isCurrentlySpeaking: this.isCurrentlySpeaking,
        currentAudio: !!this.currentAudio,
        audioPlaying: this.currentAudio ? !this.currentAudio.paused : false
      });
      return;
    }
    
    // Set global lock immediately
    this.globalSpeechLock = true;
    this.isCurrentlySpeaking = true;
    console.log(`🔒 [${callId}] Global lock acquired`);
    
    // Safety timeout - force unlock after 30 seconds
    this.globalTimeout = setTimeout(() => {
      console.log(`⏰ [${callId}] SAFETY TIMEOUT: Force unlocking TTS after 30 seconds`);
      this.releaseLock('safety timeout');
      this.stop();
    }, 30000);
    
    const cacheKey = this.getCacheKey(text, options);
    
    try {
      // Call onStart callback
      options.onStart?.();

      // Try OpenAI TTS first if enabled and available
      if (options.useOpenAI !== false) {
        try {
          let audioUrl = this.audioCache.get(cacheKey);
          
          if (!audioUrl) {
            audioUrl = await this.generateOpenAITTS(text, options);
            this.audioCache.set(cacheKey, audioUrl);
          }

          // Play audio with proper error handling
          console.log(`🔊 [${callId}] Creating new Audio element with URL:`, audioUrl.substring(0, 50) + '...');
          this.currentAudio = new Audio(audioUrl);
          this.currentAudio.volume = options.volume || 0.9;
          this.currentAudio.playbackRate = options.speed || 1.0;
          console.log(`🎛️ [${callId}] Audio element configured:`, {
            volume: this.currentAudio.volume,
            playbackRate: this.currentAudio.playbackRate,
            src: this.currentAudio.src.substring(0, 50) + '...'
          });
          
          // Set up event handlers before playing
          return new Promise(async (resolve, reject) => {
            if (!this.currentAudio) return reject(new Error('No audio'));
            
            this.currentAudio.onended = () => {
              console.log(`🤐 [${callId}] OpenAI TTS audio ended`);
              this.releaseLock('audio ended');
              options.onEnd?.();
              resolve();
            };
            
            this.currentAudio.onerror = (error) => {
              console.error(`❌ [${callId}] OpenAI TTS audio error:`, error);
              this.releaseLock('audio error');
              const err = new Error('Audio playback error');
              options.onError?.(err);
              reject(err);
            };
            
            this.currentAudio.oncanplaythrough = () => {
              console.log('✅ OpenAI TTS audio ready to play');
            };
            
            this.currentAudio.onloadstart = () => {
              console.log('🔄 OpenAI TTS audio loading...');
            };
            
            this.currentAudio.onplay = () => {
              console.log(`▶️ [${callId}] OpenAI TTS audio started playing`);
            };
            
            try {
              console.log(`🎵 [${callId}] Starting OpenAI TTS audio playback...`);
              const playPromise = this.currentAudio.play();
              
              if (playPromise !== undefined) {
                await playPromise;
                console.log(`✅ [${callId}] OpenAI TTS audio playback started successfully`);
              }
            } catch (playError) {
              console.error(`❌ [${callId}] OpenAI TTS playback failed:`, playError);
              this.releaseLock('playback error');
              // If autoplay fails, throw error to fallback to browser TTS
              throw new Error(`Audio autoplay blocked: ${playError.message}`);
            }
          });
          
        } catch (openaiError) {
          console.warn('OpenAI TTS failed, falling back to browser TTS:', openaiError);
          // Re-throw autoplay errors
          if (openaiError.message && openaiError.message.includes('autoplay')) {
            throw openaiError;
          }
        }
      }

      // Fallback to browser TTS
      console.log('🔄 Using browser TTS fallback');
      await this.generateBrowserTTS(text, options);
      this.releaseLock('browser TTS completed');
      options.onEnd?.();
      
    } catch (error) {
      console.error('All TTS methods failed:', error);
      this.releaseLock('TTS error');
      const err = error instanceof Error ? error : new Error('TTS failed');
      options.onError?.(err);
      throw err;
    }
  }

  // Stop current speech
  stop(): void {
    console.log('🛑 EnhancedTTS.stop() called');
    this.releaseLock('stop() called');
    
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

  // Force unlock the global speech lock
  private releaseLock(reason: string): void {
    console.log(`🔓 EnhancedTTS: Releasing global lock - ${reason}`);
    
    // Clear safety timeout
    if (this.globalTimeout) {
      clearTimeout(this.globalTimeout);
      this.globalTimeout = null;
    }
    
    // Reset global flags
    this.isCurrentlySpeaking = false;
    this.globalSpeechLock = false;
  }

  // Public method to force unlock if stuck
  forceUnlock(): void {
    console.log('⚡ EnhancedTTS: FORCE UNLOCK called');
    this.releaseLock('manual force unlock');
    this.stop();
  }

  // Check if currently speaking
  isSpeaking(): boolean {
    const audioSpeaking = !!(this.currentAudio && !this.currentAudio.paused);
    const synthSpeaking = !!(this.speechSynthesis && this.speechSynthesis.speaking);
    const globallyLocked = this.globalSpeechLock || this.isCurrentlySpeaking;
    
    return audioSpeaking || synthSpeaking || globallyLocked;
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