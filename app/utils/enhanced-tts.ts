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
  humanize?: boolean; // New option for more human-like speech
  naturalPauses?: boolean; // Add natural thinking pauses
  emotionalIntonation?: boolean; // Add emotional context to speech
  progressiveMode?: boolean; // New option for progressive speech
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
  personality: string; // New field for personality traits
}

// Define available voices with enhanced personality descriptions
export const AVAILABLE_VOICES: TTSVoice[] = [
  // OpenAI Premium Voices - Reordered for better male voices first
  {
    id: 'onyx',
    name: 'Onyx',
    description: 'Warm, friendly male voice - perfect for a university TA',
    type: 'openai',
    language: ['en', 'he'],
    gender: 'male',
    quality: 'premium',
    personality: 'friendly, clear, engaging, patient, slightly upbeat'
  },
  {
    id: 'echo',
    name: 'Echo',
    description: 'Natural, conversational male voice - great for explanations',
    type: 'openai',
    language: ['en', 'he'],
    gender: 'male',
    quality: 'premium',
    personality: 'natural, approachable, mentor-like, warm'
  },
  {
    id: 'fable',
    name: 'Fable',
    description: 'Expressive, storytelling voice - engaging and relatable',
    type: 'openai',
    language: ['en', 'he'],
    gender: 'neutral',
    quality: 'premium',
    personality: 'expressive, engaging, storytelling, relatable'
  },
  {
    id: 'alloy',
    name: 'Alloy',
    description: 'Balanced, natural voice - good for technical content',
    type: 'openai',
    language: ['en', 'he'],
    gender: 'neutral',
    quality: 'premium',
    personality: 'balanced, clear, technical, reliable'
  },
  {
    id: 'nova',
    name: 'Nova',
    description: 'Warm, friendly female voice - great for explanations',
    type: 'openai',
    language: ['en', 'he'],
    gender: 'female',
    quality: 'premium',
    personality: 'warm, friendly, clear, helpful'
  },
  {
    id: 'shimmer',
    name: 'Shimmer',
    description: 'Clear, professional female voice - excellent for tutorials',
    type: 'openai',
    language: ['en', 'he'],
    gender: 'female',
    quality: 'premium',
    personality: 'professional, clear, articulate, confident'
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

  // Progressive speech state
  private progressiveMode = false;
  private streamingText = '';
  private lastSpokenPosition = 0;
  private progressiveTimeout: NodeJS.Timeout | null = null;
  private currentOptions: TTSOptions | null = null;

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
    const { voice, characterStyle, humanize } = options;
    
    // For Hebrew text, always use Nova (best Hebrew pronunciation)
    if (language === 'he') {
      console.log('🇮🇱 Hebrew text detected - forcing nova voice for optimal pronunciation');
      return 'nova';
    }

    // If specific voice requested and available for English, use it
    if (voice && AVAILABLE_VOICES.some(v => v.id === voice && v.language.includes(language))) {
      return voice;
    }

    // For English, choose based on character style with enhanced human voice selection
    switch (characterStyle) {
      case 'university_ta':
        // For humanized TA, prefer Onyx (warmer) over Echo (more authoritative)
        return humanize !== false ? 'onyx' : 'echo';
      case 'professional':
        return 'echo'; // Professional but still human-like
      case 'casual':
        return 'fable'; // Most expressive and relatable
      case 'technical':
        return 'alloy'; // Clear and balanced
      default:
        return 'onyx'; // Default to warmest male voice
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

  // Enhanced speak method with progressive support
  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    console.log('🎤 Enhanced TTS speak called:', {
      textLength: text?.length || 0,
      progressiveMode: options.progressiveMode,
      isCurrentlySpeaking: this.isCurrentlySpeaking,
      preview: text?.substring(0, 100) + '...'
    });

    if (!text || text.trim().length === 0) {
      console.log('❌ No text provided to Enhanced TTS');
      return;
    }

    // Handle progressive mode
    if (options.progressiveMode) {
      return this.handleProgressiveSpeech(text, options);
    }

    // Standard mode - existing implementation
    return this.handleStandardSpeech(text, options);
  }

  // New method for progressive speech handling
  private async handleProgressiveSpeech(text: string, options: TTSOptions): Promise<void> {
    console.log('🔄 PROGRESSIVE TTS: Handling progressive speech', {
      newTextLength: text.length,
      currentStreamingLength: this.streamingText.length,
      lastSpokenPosition: this.lastSpokenPosition,
      isCurrentlySpeaking: this.isCurrentlySpeaking
    });

    // Store the streaming text and options
    this.streamingText = text;
    this.currentOptions = options;
    this.progressiveMode = true;

    // If we're not currently speaking and have enough text, start speaking
    if (!this.isCurrentlySpeaking && text.length > 50) {
      console.log('🎤 PROGRESSIVE TTS: Starting initial speech');
      await this.speakProgressiveChunk(text, options);
    }
    // If we're already speaking, the current speech will check for more content when it ends
  }

  // New method to speak progressive chunks
  private async speakProgressiveChunk(text: string, options: TTSOptions): Promise<void> {
    if (this.isCurrentlySpeaking) {
      console.log('🚫 PROGRESSIVE TTS: Already speaking, skipping chunk');
      return;
    }

    // Calculate what to speak (either all text if first time, or new content)
    let textToSpeak = text;
    
    // For subsequent chunks, only speak the new content
    if (this.lastSpokenPosition > 0 && text.length > this.lastSpokenPosition) {
      textToSpeak = text.substring(this.lastSpokenPosition);
      console.log('🔄 PROGRESSIVE TTS: Speaking new chunk:', {
        from: this.lastSpokenPosition,
        to: text.length,
        chunkLength: textToSpeak.length,
        preview: textToSpeak.substring(0, 50) + '...'
      });
    }

    if (!textToSpeak.trim()) {
      console.log('❌ PROGRESSIVE TTS: No new content to speak');
      return;
    }

    try {
      this.isCurrentlySpeaking = true;
      options.onStart?.();

      // Generate and play audio for this chunk
      const audioUrl = await this.generateOpenAITTS(textToSpeak, options);
      await this.playAudioUrl(audioUrl, {
        ...options,
        onEnd: () => {
          console.log('🎤 PROGRESSIVE TTS: Chunk completed');
          this.isCurrentlySpeaking = false;
          this.lastSpokenPosition = text.length;
          
          // Check if there's more content to speak
          this.checkForMoreContent();
          
          // Only call onEnd if we're completely done
          if (!this.progressiveMode || this.streamingText === text) {
            options.onEnd?.();
          }
        },
        onError: (error) => {
          console.error('❌ PROGRESSIVE TTS: Chunk error:', error);
          this.isCurrentlySpeaking = false;
          this.resetProgressiveState();
          options.onError?.(error);
        }
      });

    } catch (error) {
      console.error('❌ PROGRESSIVE TTS: Error in progressive chunk:', error);
      this.isCurrentlySpeaking = false;
      this.resetProgressiveState();
      options.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  // Check if there's more content to speak
  private checkForMoreContent(): void {
    if (!this.progressiveMode || !this.currentOptions) {
      return;
    }

    // Clear any existing timeout
    if (this.progressiveTimeout) {
      clearTimeout(this.progressiveTimeout);
    }

    // Wait a bit and check if more content has arrived
    this.progressiveTimeout = setTimeout(() => {
      if (this.streamingText.length > this.lastSpokenPosition) {
        console.log('🔄 PROGRESSIVE TTS: More content available, continuing speech');
        this.speakProgressiveChunk(this.streamingText, this.currentOptions!);
      } else {
        console.log('✅ PROGRESSIVE TTS: No more content, speech complete');
        this.resetProgressiveState();
        this.currentOptions?.onEnd?.();
      }
    }, 100); // Wait just 100ms for more content
  }

  // Reset progressive state
  private resetProgressiveState(): void {
    this.progressiveMode = false;
    this.streamingText = '';
    this.lastSpokenPosition = 0;
    this.currentOptions = null;
    
    if (this.progressiveTimeout) {
      clearTimeout(this.progressiveTimeout);
      this.progressiveTimeout = null;
    }
  }

  // Standard speech handling (existing implementation)
  private async handleStandardSpeech(text: string, options: TTSOptions): Promise<void> {
    // ... existing speak implementation ...
    // Ensure progressive state is reset
    this.resetProgressiveState();

    // Apply global speech lock
    if (this.globalSpeechLock) {
      console.log('🔒 Enhanced TTS: Global speech lock active, rejecting new request');
      throw new Error('Speech lock active - another speech operation in progress');
    }

    // Check if already speaking
    if (this.isCurrentlySpeaking) {
      console.log('🔄 Enhanced TTS: Already speaking, stopping current speech');
      this.stop();
      // Wait briefly for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Set global speech lock
    this.globalSpeechLock = true;
    
    // Set timeout to automatically release lock (safety mechanism)
    this.globalTimeout = setTimeout(() => {
      console.log('⏰ Enhanced TTS: Auto-releasing speech lock after timeout');
      this.globalSpeechLock = false;
    }, 30000); // 30 second timeout

    try {
      this.isCurrentlySpeaking = true;
      options.onStart?.();
      
      if (options.useOpenAI !== false) {
        console.log('🎯 Enhanced TTS: Using OpenAI TTS for high-quality speech');
        const audioUrl = await this.generateOpenAITTS(text, options);
        await this.playAudioUrl(audioUrl, options);
      } else {
        console.log('🎯 Enhanced TTS: Using browser TTS fallback');
        await this.generateBrowserTTS(text, options);
      }
      
    } catch (error) {
      console.error('❌ Enhanced TTS: Speech failed:', error);
      options.onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.isCurrentlySpeaking = false;
      this.globalSpeechLock = false;
      if (this.globalTimeout) {
        clearTimeout(this.globalTimeout);
        this.globalTimeout = null;
      }
      options.onEnd?.();
    }
  }

  // Helper method to play audio URL
  private async playAudioUrl(audioUrl: string, options: TTSOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      this.currentAudio = new Audio(audioUrl);
      this.currentAudio.volume = options.volume || 0.9;

      this.currentAudio.onended = () => {
        const endTime = performance.now();
        console.log(
          `🎵 Enhanced TTS: Audio playback completed in ${Math.round(endTime - startTime)}ms`
        );
        this.currentAudio = null;
        resolve();
      };

      this.currentAudio.onerror = (error) => {
        console.error('❌ Enhanced TTS: Audio playback error:', error);
        this.currentAudio = null;
        reject(new Error('Audio playback failed'));
      };

      this.currentAudio.play().catch(reject);
    });
  }

  // Stop current speech
  stop(): void {
    console.log('🛑 Enhanced TTS: Stop requested');
    
    // Reset progressive state
    this.resetProgressiveState();
    
    // Stop current audio
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }

    // Stop browser TTS
    if (this.speechSynthesis && this.currentUtterance) {
      this.speechSynthesis.cancel();
      this.currentUtterance = null;
    }

    // Release locks
    this.isCurrentlySpeaking = false;
    this.releaseLock('stop() called');
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
    voice: 'onyx',
    useOpenAI: true,
    characterStyle: 'university_ta',
    enhanceProsody: true,
    speed: 1.0,
    volume: 0.9,
    ...options
  };
  
  return enhancedTTS.speak(text, defaultOptions);
} 