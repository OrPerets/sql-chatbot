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
  // New options for reducing latency
  preload?: boolean; // Start generating audio immediately when text is available
  lowLatency?: boolean; // Use faster settings for quicker response
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

  // New properties for latency optimization
  private preloadRequests = new Map<string, Promise<string>>();
  private latencyLogger = {
    startTime: 0,
    apiTime: 0,
    playbackTime: 0,
    totalTime: 0
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.speechSynthesis = window.speechSynthesis;
      // **WARM-UP: Initialize audio system immediately**
      this.warmUpAudioSystem();
    }
  }

  // **NEW: WARM-UP AUDIO SYSTEM FOR INSTANT RESPONSE**
  private async warmUpAudioSystem(): Promise<void> {
    try {
      console.log('🔥 WARM-UP: Initializing audio system for instant response...');
      
      // 1. Test audio playback capability immediately
      setTimeout(() => {
        this.testAudioPlayback().then(success => {
          if (success) {
            console.log('✅ WARM-UP: Audio system ready for instant speech');
          }
        });
      }, 100);

      // 2. Pre-warm TTS with a very short, silent phrase
      setTimeout(() => {
        this.prewarmTTS();
      }, 500);

    } catch (error) {
      console.warn('⚠️ WARM-UP: Audio warm-up failed, will retry on first use:', error);
    }
  }

  // **NEW: PRE-WARM TTS API FOR FASTER FIRST RESPONSE**
  private async prewarmTTS(): Promise<void> {
    try {
      console.log('🚀 PREWARM: Warming up TTS API for instant response...');
      
      // Generate a very short, quiet test phrase to warm up the TTS API
      const warmupText = '.'; // Minimal text
      const warmupOptions: TTSOptions = {
        voice: 'onyx',
        speed: 1.1,
        volume: 0.01, // Almost silent
        lowLatency: true,
        useOpenAI: true
      };

      // Create the request but don't wait for it to complete
      // This warms up the API connection and caching
      this.generateOpenAITTS(warmupText, warmupOptions)
        .then(() => {
          console.log('✅ PREWARM: TTS API warmed up successfully');
        })
        .catch((error) => {
          console.log('ℹ️ PREWARM: TTS warmup completed (expected for minimal text)');
        });

    } catch (error) {
      console.log('ℹ️ PREWARM: TTS warmup skipped, will rely on first-use initialization');
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

  // Enhanced voice selection with better defaults for human-like speech
  private selectVoice(language: 'en' | 'he', options: TTSOptions): string {
    const { voice, characterStyle, humanize, lowLatency } = options;
    
    // For Hebrew text, always use Nova (best Hebrew pronunciation)
    if (language === 'he') {
      console.log('🇮🇱 Hebrew text detected - using nova voice for optimal pronunciation');
      return 'nova';
    }

    // If specific voice requested and available for English, use it
    if (voice && AVAILABLE_VOICES.some(v => v.id === voice && v.language.includes(language))) {
      return voice;
    }

    // Optimized voice selection for human-like speech
    switch (characterStyle) {
      case 'university_ta':
        // For low latency mode, prefer onyx (warmest and clearest)
        if (lowLatency) return 'onyx';
        // For humanized TA, prefer Onyx (warmer) over Echo (more authoritative)
        return humanize !== false ? 'onyx' : 'echo';
      case 'professional':
        return 'echo'; // Professional but still human-like
      case 'casual':
        return 'fable'; // Most expressive and relatable
      case 'technical':
        return 'alloy'; // Clear and balanced
      default:
        return 'onyx'; // Default to warmest male voice - perfect for Michael
    }
  }

  // **ULTRA-LOW LATENCY SPEECH TRIGGER**
  // Optimized for immediate speech response with minimal delay
  private shouldStartSpeech(text: string, options: TTSOptions): boolean {
    const trimmedText = text.trim();
    
    // Ultra-aggressive thresholds for immediate response
    if (options.lowLatency) {
      // Start speaking after just 8-12 characters in low-latency mode
      return trimmedText.length >= 8;
    }
    
    if (options.preload) {
      // Start speaking after 12-15 characters in preload mode
      return trimmedText.length >= 12;
    }
    
    // **REDUCED THRESHOLD FOR IMMEDIATE SPEECH**
    // Previous: 20-30 characters, New: 15-20 characters
    return trimmedText.length >= 15;
  }

  // Optimized OpenAI TTS generation with latency tracking
  private async generateOpenAITTS(text: string, options: TTSOptions): Promise<string> {
    const startTime = performance.now();
    this.latencyLogger.startTime = startTime;
    
    const language = this.detectLanguage(text);
    const selectedVoice = this.selectVoice(language, options);
    
    // Create optimized request key for caching
    const requestKey = `${text}_${selectedVoice}_${options.speed || 1.1}_${options.lowLatency ? 'fast' : 'normal'}`;
    
    // Check cache first for instant response
    if (this.audioCache.has(requestKey)) {
      console.log('🚀 INSTANT: Using cached audio for immediate playback');
      this.latencyLogger.apiTime = 0;
      this.latencyLogger.totalTime = performance.now() - startTime;
      return this.audioCache.get(requestKey)!;
    }
    
    // Check if same request is already pending
    if (this.pendingRequests.has(requestKey)) {
      console.log('🔄 FAST: Reusing pending TTS request');
      return await this.pendingRequests.get(requestKey)!;
    }
    
    console.log(`🎤 OPTIMIZED TTS: voice=${selectedVoice}, language=${language}, lowLatency=${options.lowLatency}`);
    
    // Create the promise and store it
    const requestPromise = (async (): Promise<string> => {
      try {
        const apiStartTime = performance.now();
        
        const response = await fetch('/api/audio/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            voice: selectedVoice,
            // Optimized settings for human-like speech with onyx voice
            speed: options.lowLatency ? 1.2 : (options.speed || 1.1), // Slightly faster for natural flow
            format: 'mp3',
            enhance_prosody: !options.lowLatency, // Skip complex processing in low latency mode
            character_style: options.characterStyle || 'university_ta',
            humanize: options.humanize !== false,
            natural_pauses: false, // Disable to reduce processing time
            emotional_intonation: false, // Disable complex features for lower latency
            low_latency: options.lowLatency || false
          }),
        });

        this.latencyLogger.apiTime = performance.now() - apiStartTime;

        if (!response.ok) {
          throw new Error(`TTS API error: ${response.status}`);
        }

        // **FIXED: Handle JSON response with embedded audio URL**
        const jsonResponse = await response.json();
        if (!jsonResponse.success || !jsonResponse.audioUrl) {
          throw new Error('Invalid TTS API response format');
        }
        
        const audioUrl = jsonResponse.audioUrl;
        
        // Cache the result for future use
        this.audioCache.set(requestKey, audioUrl);
        
        this.latencyLogger.totalTime = performance.now() - startTime;
        console.log(`⚡ OPTIMIZED TTS generated in ${this.latencyLogger.apiTime.toFixed(0)}ms API + ${(this.latencyLogger.totalTime - this.latencyLogger.apiTime).toFixed(0)}ms processing. Quality: ${jsonResponse.metadata?.quality || 'HD'}`);
        
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

  // Enhanced speak method with latency optimization
  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    const speakStartTime = performance.now();
    
    console.log('🎤 ENHANCED TTS speak called:', {
      textLength: text?.length || 0,
      progressiveMode: options.progressiveMode,
      lowLatency: options.lowLatency,
      preload: options.preload,
      isCurrentlySpeaking: this.isCurrentlySpeaking,
      preview: text?.substring(0, 100) + '...'
    });

    if (!text || text.trim().length === 0) {
      console.log('❌ No text provided to Enhanced TTS');
      return;
    }

    // Set optimized defaults for Michael's voice
    const optimizedOptions: TTSOptions = {
      voice: 'onyx', // Warm, confident male voice
      speed: 1.1, // Slightly faster for natural conversation flow
      volume: 0.9,
      useOpenAI: true,
      characterStyle: 'university_ta',
      enhanceProsody: false, // Disable for faster processing
      humanize: true,
      naturalPauses: false, // Disable for lower latency
      emotionalIntonation: false, // Disable for faster response
      lowLatency: true, // Enable low latency mode
      ...options // Override with provided options
    };

    // Handle progressive mode
    if (optimizedOptions.progressiveMode) {
      return this.handleProgressiveSpeech(text, optimizedOptions);
    }

    // Handle preload mode (start generation immediately)
    if (optimizedOptions.preload) {
      return this.handlePreloadSpeech(text, optimizedOptions);
    }

    // Standard mode with latency optimization
    return this.handleStandardSpeech(text, optimizedOptions);
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

    // **IMMEDIATE SPEECH TRIGGER - Use our new optimized threshold**
    if (!this.isCurrentlySpeaking && this.shouldStartSpeech(text, options)) {
      console.log('🎤 PROGRESSIVE TTS: Starting immediate speech with optimized threshold');
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
    }, 500); // Wait 500ms for more content
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

  // New method for preload speech (parallel audio generation)
  private async handlePreloadSpeech(text: string, options: TTSOptions): Promise<void> {
    console.log('🚀 PRELOAD: Starting parallel audio generation');
    
    // Ensure progressive state is reset
    this.resetProgressiveState();

    // Stop any current speech immediately
    if (this.isCurrentlySpeaking) {
      this.stop();
    }

    try {
      this.isCurrentlySpeaking = true;
      options.onStart?.();
      
      // Start audio generation immediately (parallel processing)
      if (options.useOpenAI !== false) {
        console.log('⚡ PRELOAD: Generating OpenAI TTS in parallel');
        const audioUrl = await this.generateOpenAITTS(text, options);
        
        // Play immediately when ready
        await this.playAudioUrl(audioUrl, options);
      } else {
        console.log('🎯 PRELOAD: Using browser TTS fallback');
        await this.generateBrowserTTS(text, options);
      }
      
    } catch (error) {
      console.error('❌ PRELOAD TTS: Speech failed:', error);
      options.onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.isCurrentlySpeaking = false;
      options.onEnd?.();
      
      // Log performance metrics
      const totalTime = performance.now() - this.latencyLogger.startTime;
      console.log(`📊 PRELOAD Performance: Total=${totalTime.toFixed(0)}ms, API=${this.latencyLogger.apiTime.toFixed(0)}ms, Playback=${(totalTime - this.latencyLogger.apiTime).toFixed(0)}ms`);
    }
  }

  // Optimized standard speech handling
  private async handleStandardSpeech(text: string, options: TTSOptions): Promise<void> {
    // Ensure progressive state is reset
    this.resetProgressiveState();

    // Quick check - if already speaking, stop immediately (no delays)
    if (this.isCurrentlySpeaking) {
      console.log('🔄 OPTIMIZED: Interrupting current speech for immediate response');
      this.stop();
    }

    try {
      this.isCurrentlySpeaking = true;
      options.onStart?.();
      
      if (options.useOpenAI !== false) {
        console.log('⚡ OPTIMIZED: Using low-latency OpenAI TTS');
        const audioUrl = await this.generateOpenAITTS(text, options);
        await this.playAudioUrl(audioUrl, options);
      } else {
        console.log('🎯 OPTIMIZED: Using browser TTS fallback');
        await this.generateBrowserTTS(text, options);
      }
      
    } catch (error) {
      console.error('❌ OPTIMIZED TTS: Speech failed:', error);
      options.onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.isCurrentlySpeaking = false;
      options.onEnd?.();
    }
  }

  // Enhanced audio playback with latency tracking and error handling
  private async playAudioUrl(audioUrl: string, options: TTSOptions): Promise<void> {
    const playbackStartTime = performance.now();
    
    return new Promise((resolve, reject) => {
      // **ENHANCED ERROR HANDLING FOR AUDIO COMPATIBILITY**
      this.currentAudio = new Audio();
      this.currentAudio.volume = options.volume || 0.9;
      
      // Preload the audio for faster playback
      this.currentAudio.preload = 'auto';
      
             // **COMPREHENSIVE ERROR HANDLING**
       this.currentAudio.onerror = (error) => {
         console.error('❌ AUDIO ERROR: Failed to load audio:', error);
         console.log('🔧 AUDIO DEBUG: Audio URL format:', audioUrl.substring(0, 50) + '...');
         console.log('🔧 AUDIO DEBUG: URL length:', audioUrl.length);
         console.log('🔧 AUDIO DEBUG: Is data URL:', audioUrl.startsWith('data:'));
         console.log('🔧 AUDIO DEBUG: MIME type:', audioUrl.match(/data:([^;]+)/)?.[1] || 'unknown');
        
                 // Try fallback to browser TTS if audio fails to load
         console.log('🔄 FALLBACK: Attempting browser TTS as backup');
         
         // Get the text from progressive state or try to extract from error context
         let fallbackText = this.streamingText || '';
         if (!fallbackText && options.progressiveMode) {
           // Try to get text from the current chunk being processed
           fallbackText = 'Sorry, there was an audio issue. Let me try again with a different voice.';
         }
         
         this.generateBrowserTTS(fallbackText, options)
           .then(() => resolve())
           .catch((fallbackError) => {
             console.error('❌ FALLBACK FAILED: Both OpenAI and browser TTS failed:', fallbackError);
             // Just resolve to avoid blocking the UI
             console.log('⚠️ GRACEFUL FALLBACK: Continuing without audio');
             resolve();
           });
      };
      
      this.currentAudio.onloadeddata = () => {
        console.log('🎵 AUDIO SUCCESS: Audio preloaded and ready for immediate playback');
      };
      
      this.currentAudio.onended = () => {
        const playbackTime = performance.now() - playbackStartTime;
        console.log(`🎵 OPTIMIZED: Audio playback completed in ${playbackTime.toFixed(0)}ms`);
        this.currentAudio = null;
        resolve();
      };
      
      // **SAFE AUDIO LOADING WITH ERROR RECOVERY**
      try {
        // Set the source after all event handlers are in place
        this.currentAudio.src = audioUrl;
        
        // Attempt to play with error handling
        const playPromise = this.currentAudio.play();
        if (playPromise !== undefined) {
                     playPromise.catch((playError) => {
             console.error('❌ PLAY ERROR: Audio play failed:', playError);
             // Try browser TTS fallback with graceful handling
             let fallbackText = this.streamingText || '';
             if (!fallbackText) {
               fallbackText = 'Audio playback issue detected.';
             }
             
             this.generateBrowserTTS(fallbackText, options)
               .then(() => resolve())
               .catch(() => {
                 console.log('⚠️ GRACEFUL FALLBACK: Continuing without audio playback');
                 resolve();
               });
           });
        }
      } catch (sourceError) {
        console.error('❌ SOURCE ERROR: Failed to set audio source:', sourceError);
        reject(sourceError);
      }
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

  // **NEW: PUBLIC METHOD TO TRIGGER WARM-UP ON USER INTERACTION**
  async warmUpForUser(): Promise<void> {
    console.log('🎯 USER WARM-UP: Preparing audio system for immediate use...');
    await this.testAudioPlayback();
    await this.prewarmTTS();
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

// Utility function for easy usage with Michael's optimized settings
export async function speakWithMichael(
  text: string, 
  options: TTSOptions = {}
): Promise<void> {
  const defaultOptions: TTSOptions = {
    voice: 'onyx', // Warm, confident male voice - perfect for Michael
    speed: 1.1, // Optimized for natural conversation flow
    volume: 0.9,
    useOpenAI: true,
    characterStyle: 'university_ta',
    enhanceProsody: false, // Disabled for faster processing
    humanize: true, // Keep for warmth
    naturalPauses: false, // Disabled for lower latency
    emotionalIntonation: false, // Disabled for faster response
    lowLatency: true, // Enable low-latency mode by default
    preload: false, // Can be enabled for specific use cases
    ...options
  };
  
  return enhancedTTS.speak(text, defaultOptions);
} 