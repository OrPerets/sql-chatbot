// Enhanced TTS Service with OpenAI and fallback support
import { audioProcessor, AudioProcessingOptions } from './audio-processor';
import { ttsAnalytics } from './tts-analytics';
import { contextAwareVoice, VoiceIntelligenceOptions } from './context-aware-voice';
import { voiceAnalytics } from './voice-analytics';
import { voiceTextSanitizer, SanitizationConfig, VoiceTextSanitizer } from './voice-text-sanitizer';
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
  emotion?: 'happy' | 'sad' | 'excited' | 'calm' | 'neutral'; // Voice emotion parameters
  contentType?: 'sql' | 'explanation' | 'question' | 'feedback' | 'general'; // Content-type awareness
  audioProcessing?: AudioProcessingOptions; // Audio processing options
  contextAwareness?: boolean; // Enable context-aware voice intelligence
  voiceIntelligenceOptions?: VoiceIntelligenceOptions; // Voice intelligence options
  textSanitization?: SanitizationConfig | false; // Text sanitization options (false to disable)
  debug?: boolean; // Enable debug logging
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
}

// IndexedDB cache interface
interface AudioCacheEntry {
  id: string;
  audioData: ArrayBuffer;
  text: string;
  voice: string;
  speed: number;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

// Performance metrics interface
interface TTSPerformanceMetrics {
  responseTime: number;
  cacheHit: boolean;
  audioSize: number;
  errorType?: string;
  timestamp: number;
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
  private isGeneratingAudio = false; // New flag to prevent concurrent TTS generation

  // Progressive speech state
  private progressiveMode = false;
  private streamingText = '';
  private lastSpokenPosition = 0;
  private progressiveTimeout: NodeJS.Timeout | null = null;
  private currentOptions: TTSOptions | null = null;

  // Enhanced features
  private indexedDBCache: IDBDatabase | null = null;
  private performanceMetrics: TTSPerformanceMetrics[] = [];
  private circuitBreakerState = { failures: 0, lastFailure: 0, isOpen: false };
  private backgroundPregenQueue: string[] = [];
  private concurrentRequestLimit = 3;
  private activeRequests = 0;
  private requestQueue: Array<() => Promise<void>> = [];
  private cacheSizeLimit = 50; // Maximum number of cached audio files
  private maxCacheAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

  constructor() {
    if (typeof window !== 'undefined') {
      this.speechSynthesis = window.speechSynthesis;
      this.initializeIndexedDB();
      this.startBackgroundCacheWarming();
      this.startPerformanceMonitoring();
    }
  }

  // Initialize IndexedDB for persistent audio caching
  private async initializeIndexedDB(): Promise<void> {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      this.dlog('IndexedDB not available, using memory cache only');
      return;
    }

    try {
      const request = indexedDB.open('TTSAudioCache', 1);
      
      request.onerror = () => {
        this.dlog('Failed to open IndexedDB for TTS cache');
      };

      request.onsuccess = () => {
        this.indexedDBCache = request.result;
        this.dlog('IndexedDB cache initialized successfully');
        this.cleanupExpiredCache();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('audioCache')) {
          const store = db.createObjectStore('audioCache', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('accessCount', 'accessCount', { unique: false });
          store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
        }
      };
    } catch (error) {
      this.dlog('Error initializing IndexedDB:', error);
    }
  }

  // Get audio from IndexedDB cache
  private async getFromIndexedDBCache(cacheKey: string): Promise<ArrayBuffer | null> {
    if (!this.indexedDBCache) return null;

    return new Promise((resolve) => {
      const transaction = this.indexedDBCache!.transaction(['audioCache'], 'readonly');
      const store = transaction.objectStore('audioCache');
      const request = store.get(cacheKey);

      request.onsuccess = () => {
        const result = request.result as AudioCacheEntry;
        if (result && Date.now() - result.timestamp < this.maxCacheAge) {
          // Update access statistics
          result.accessCount++;
          result.lastAccessed = Date.now();
          
          // Update in background
          this.updateCacheEntryStats(cacheKey, result);
          resolve(result.audioData);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
    });
  }

  // Store audio in IndexedDB cache
  private async storeInIndexedDBCache(cacheKey: string, audioData: ArrayBuffer, text: string, voice: string, speed: number): Promise<void> {
    if (!this.indexedDBCache) return;

    const entry: AudioCacheEntry = {
      id: cacheKey,
      audioData,
      text,
      voice,
      speed,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now()
    };

    return new Promise((resolve) => {
      const transaction = this.indexedDBCache!.transaction(['audioCache'], 'readwrite');
      const store = transaction.objectStore('audioCache');
      const request = store.put(entry);

      request.onsuccess = () => {
        this.dlog(`Audio cached in IndexedDB: ${audioData.byteLength} bytes`);
        this.enforceCacheSizeLimit();
        resolve();
      };

      request.onerror = () => {
        this.dlog('Failed to store audio in IndexedDB cache');
        resolve();
      };
    });
  }

  // Update cache entry statistics
  private async updateCacheEntryStats(cacheKey: string, entry: AudioCacheEntry): Promise<void> {
    if (!this.indexedDBCache) return;

    const transaction = this.indexedDBCache.transaction(['audioCache'], 'readwrite');
    const store = transaction.objectStore('audioCache');
    store.put(entry);
  }

  // Enforce cache size limit using LRU eviction
  private async enforceCacheSizeLimit(): Promise<void> {
    if (!this.indexedDBCache) return;

    return new Promise((resolve) => {
      const transaction = this.indexedDBCache!.transaction(['audioCache'], 'readwrite');
      const store = transaction.objectStore('audioCache');
      const countRequest = store.count();

      countRequest.onsuccess = () => {
        const count = countRequest.result;
        if (count > this.cacheSizeLimit) {
          // Get all entries sorted by last accessed time (oldest first)
          const index = store.index('lastAccessed');
          const getAllRequest = index.getAll();

          getAllRequest.onsuccess = () => {
            const entries = getAllRequest.result as AudioCacheEntry[];
            const sortedEntries = entries.sort((a, b) => a.lastAccessed - b.lastAccessed);
            const entriesToDelete = sortedEntries.slice(0, count - this.cacheSizeLimit);

            // Delete oldest entries
            entriesToDelete.forEach(entry => {
              store.delete(entry.id);
            });

            this.dlog(`Evicted ${entriesToDelete.length} old cache entries`);
          };
        }
        resolve();
      };
    });
  }

  // Clean up expired cache entries
  private async cleanupExpiredCache(): Promise<void> {
    if (!this.indexedDBCache) return;

    const transaction = this.indexedDBCache.transaction(['audioCache'], 'readwrite');
    const store = transaction.objectStore('audioCache');
    const index = store.index('timestamp');
    const getAllRequest = index.getAll();

    getAllRequest.onsuccess = () => {
      const entries = getAllRequest.result as AudioCacheEntry[];
      const now = Date.now();
      
      entries.forEach(entry => {
        if (now - entry.timestamp > this.maxCacheAge) {
          store.delete(entry.id);
        }
      });
    };
  }

  // Background cache warming for common phrases
  private startBackgroundCacheWarming(): void {
    const commonPhrases = [
      "Hello! How can I help you today?",
      "Let me explain that SQL query for you.",
      "That's a great question!",
      "Here's how you can improve your query:",
      "I'll help you understand this concept.",
      "Let's break this down step by step.",
      "You're doing great!",
      "Is there anything else you'd like to know?",
      "I'm here to help you learn SQL.",
      "That's correct! Well done.",
      "SELECT * FROM users",
      "WHERE clause filters records",
      "JOIN combines tables",
      "ORDER BY sorts results",
      "GROUP BY aggregates data"
    ];

    // Warm cache in background after a delay
    setTimeout(() => {
      this.warmCacheWithPhrases(commonPhrases);
    }, 5000);
  }

  private async warmCacheWithPhrases(phrases: string[]): Promise<void> {
    this.dlog('Starting background cache warming...');
    
    for (const phrase of phrases) {
      try {
        const cacheKey = this.getCacheKey(phrase, { voice: 'onyx', speed: 1.0 });
        
        // Check if already cached
        const existing = await this.getFromIndexedDBCache(cacheKey);
        if (existing) continue;

        // Generate and cache
        const audioUrl = await this.generateOpenAITTS(phrase, { voice: 'onyx', speed: 1.0 });
        
        // Convert blob URL to ArrayBuffer for storage
        const response = await fetch(audioUrl);
        const audioData = await response.arrayBuffer();
        
        await this.storeInIndexedDBCache(cacheKey, audioData, phrase, 'onyx', 1.0);
        
        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        this.dlog('Failed to warm cache for phrase:', phrase, error);
      }
    }
    
    this.dlog('Background cache warming completed');
  }

  // Performance monitoring
  private startPerformanceMonitoring(): void {
    // Clean up old metrics every hour
    setInterval(() => {
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      this.performanceMetrics = this.performanceMetrics.filter(m => m.timestamp > oneHourAgo);
    }, 60 * 60 * 1000);
  }

  // Record performance metrics
  private recordMetrics(metrics: TTSPerformanceMetrics): void {
    this.performanceMetrics.push(metrics);
    
    // Log performance summary every 10 requests
    if (this.performanceMetrics.length % 10 === 0) {
      this.logPerformanceSummary();
    }
  }

  // Log performance summary
  private logPerformanceSummary(): void {
    const recent = this.performanceMetrics.slice(-10);
    const avgResponseTime = recent.reduce((sum, m) => sum + m.responseTime, 0) / recent.length;
    const cacheHitRate = recent.filter(m => m.cacheHit).length / recent.length * 100;
    const avgAudioSize = recent.reduce((sum, m) => sum + m.audioSize, 0) / recent.length;

    this.dlog('TTS Performance Summary:', {
      avgResponseTime: `${avgResponseTime.toFixed(2)}ms`,
      cacheHitRate: `${cacheHitRate.toFixed(1)}%`,
      avgAudioSize: `${(avgAudioSize / 1024).toFixed(1)}KB`,
      totalRequests: this.performanceMetrics.length
    });
  }

  private isDebug(): boolean {
    return typeof window !== 'undefined' && (process.env.NEXT_PUBLIC_DEBUG_VOICE === '1');
  }

  private dlog(...args: any[]): void {
    if (this.isDebug()) {
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  }

  // Test audio playback with user gesture
  async testAudioPlayback(): Promise<boolean> {
    try {
      this.dlog('🎵 Testing audio playback capability...');
      
      // Create a silent audio element to test autoplay
      const testAudio = new Audio();
      testAudio.src = 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ4AAAA='; // Silent 1 second WAV
      testAudio.volume = 0.01; // Almost silent
      
      const playPromise = testAudio.play();
      if (playPromise !== undefined) {
        await playPromise;
        this.dlog('✅ Audio playback test successful!');
        this.audioUnlocked = true;
        return true;
      }
      
      return false;
    } catch (error) {
      if (this.isDebug()) console.warn('⚠️ Audio playback test failed:', error);
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

  // Circuit breaker pattern for API calls
  private async executeWithCircuitBreaker<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    // Check if circuit is open
    if (this.circuitBreakerState.isOpen) {
      const timeSinceLastFailure = Date.now() - this.circuitBreakerState.lastFailure;
      if (timeSinceLastFailure < 30000) { // 30 second timeout
        throw new Error(`Circuit breaker open for ${operationName}. Try again later.`);
      } else {
        // Half-open state - try again
        this.circuitBreakerState.isOpen = false;
        this.dlog(`Circuit breaker half-open for ${operationName}, attempting reset`);
      }
    }

    try {
      const result = await operation();
      // Success - reset failure count
      this.circuitBreakerState.failures = 0;
      return result;
    } catch (error) {
      this.circuitBreakerState.failures++;
      this.circuitBreakerState.lastFailure = Date.now();
      
      // Open circuit after 3 failures
      if (this.circuitBreakerState.failures >= 3) {
        this.circuitBreakerState.isOpen = true;
        this.dlog(`Circuit breaker opened for ${operationName} after ${this.circuitBreakerState.failures} failures`);
      }
      
      throw error;
    }
  }

  // Exponential backoff retry mechanism
  private async retryWithBackoff<T>(
    operation: () => Promise<T>, 
    maxRetries: number = 3, 
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          break;
        }
        
        const delay = baseDelay * Math.pow(2, attempt);
        this.dlog(`Retry attempt ${attempt + 1}/${maxRetries} failed, waiting ${delay}ms:`, error);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  // Generate speech using OpenAI TTS with enhanced error handling and caching
  private async generateOpenAITTS(text: string, options: TTSOptions): Promise<string> {
    const startTime = Date.now();
    
    // Client-side feature flag guard
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_VOICE_ENABLED !== '1') {
      throw new Error('Voice feature disabled');
    }
    
    const language = this.detectLanguage(text);
    const selectedVoice = this.selectVoice(language, options);
    
    // Create request key for client-side deduplication
    const requestKey = `${text}_${selectedVoice}_${options.speed || 1.0}_${options.enhanceProsody !== false}_${options.characterStyle || 'university_ta'}`;
    
    // Try IndexedDB cache first
    const cacheKey = this.getCacheKey(text, { ...options, voice: selectedVoice });
    const cachedAudio = await this.getFromIndexedDBCache(cacheKey);
    if (cachedAudio) {
      this.dlog('🗄️ EnhancedTTS: IndexedDB cache hit for audio');
      const audioUrl = URL.createObjectURL(new Blob([cachedAudio], { type: 'audio/mpeg' }));
      this.audioCache.set(cacheKey, audioUrl);
      
      // Record metrics
      this.recordMetrics({
        responseTime: Date.now() - startTime,
        cacheHit: true,
        audioSize: cachedAudio.byteLength,
        timestamp: Date.now()
      });
      
      return audioUrl;
    }
    
    // Try memory cache
    if (this.audioCache.has(cacheKey)) {
      this.dlog('🗄️ EnhancedTTS: Memory cache hit for audio');
      this.recordMetrics({
        responseTime: Date.now() - startTime,
        cacheHit: true,
        audioSize: 0, // Unknown size from memory cache
        timestamp: Date.now()
      });
      return this.audioCache.get(cacheKey)!;
    }

    // Check if same request is already pending
    if (this.pendingRequests.has(requestKey)) {
      this.dlog('🔄 Client-side: Duplicate TTS request detected - reusing pending promise');
      return await this.pendingRequests.get(requestKey)!;
    }
    
    this.dlog(`🎤 Generating OpenAI TTS: voice=${selectedVoice}, language=${language}`);
    
    // Create the promise and store it
    const requestPromise = (async (): Promise<string> => {
      try {
        // Wait for available request slot
        await this.waitForRequestSlot();
        
        const result = await this.executeWithCircuitBreaker(async () => {
          return await this.retryWithBackoff(async () => {
            const base = process.env.NEXT_PUBLIC_SERVER_BASE || '';
            const primaryUrl = `${base}/api/audio/tts`;
            this.dlog('🔈 TTS fetch →', primaryUrl);
            
            let response = await fetch(primaryUrl, {
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
                character_style: options.characterStyle || 'university_ta',
                emotion: options.emotion || 'neutral',
                content_type: options.contentType || 'general'
              }),
            });
            
            // Fallback to local route if server base failed
            if (!response.ok) {
              this.dlog('⚠️ TTS primary failed status:', response.status);
              try {
                const localUrl = `/api/audio/tts`;
                this.dlog('🔁 Trying local TTS →', localUrl);
                response = await fetch(localUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    text,
                    voice: selectedVoice,
                    speed: options.speed || 1.0,
                    format: 'mp3',
                    enhance_prosody: options.enhanceProsody !== false,
                    character_style: options.characterStyle || 'university_ta',
                    emotion: options.emotion || 'neutral',
                    content_type: options.contentType || 'general'
                  }),
                });
              } catch {}
            }

            if (!response.ok) {
              throw new Error(`TTS API error: ${response.status}`);
            }

            return response;
          }, 3, 1000); // 3 retries, 1s base delay
        }, 'OpenAI TTS API');

        // Convert response to blob URL
        const audioBlob = await result.blob();
        if (!audioBlob || audioBlob.size === 0) {
          throw new Error('Empty audio received from TTS endpoint');
        }
        
        const audioUrl = URL.createObjectURL(audioBlob);
        this.dlog(`✅ OpenAI TTS audio generated: ${audioBlob.size} bytes`);
        
        // Cache in both memory and IndexedDB
        this.audioCache.set(cacheKey, audioUrl);
        
        // Process audio if options are provided
        let processedAudioArrayBuffer = await audioBlob.arrayBuffer();
        if (options.audioProcessing && audioProcessor.isAudioProcessingSupported()) {
          try {
            const { processedAudio, metrics } = await audioProcessor.processAudio(
              processedAudioArrayBuffer, 
              options.audioProcessing
            );
            processedAudioArrayBuffer = processedAudio;
            
            this.dlog('Audio processing completed:', {
              originalSize: audioBlob.size,
              processedSize: processedAudioArrayBuffer.byteLength,
              quality: metrics.quality,
              bitrate: metrics.bitrate
            });
          } catch (error) {
            this.dlog('Audio processing failed, using original audio:', error);
          }
        }

        // Store in IndexedDB in background
        this.storeInIndexedDBCache(cacheKey, processedAudioArrayBuffer, text, selectedVoice, options.speed || 1.0).catch(err => {
          this.dlog('Failed to store in IndexedDB cache:', err);
        });
        
        // Record metrics
        this.recordMetrics({
          responseTime: Date.now() - startTime,
          cacheHit: false,
          audioSize: audioBlob.size,
          voice: selectedVoice,
          emotion: options.emotion || 'neutral',
          contentType: options.contentType || 'general',
          timestamp: Date.now()
        });

        // Record analytics
        ttsAnalytics.recordRequest({
          responseTime: Date.now() - startTime,
          cacheHit: false,
          audioSize: audioBlob.size,
          voice: selectedVoice,
          emotion: options.emotion || 'neutral',
          contentType: options.contentType || 'general'
        });
        
        return audioUrl;
      } catch (error) {
        // Record error metrics
        this.recordMetrics({
          responseTime: Date.now() - startTime,
          cacheHit: false,
          audioSize: 0,
          voice: selectedVoice,
          emotion: options.emotion || 'neutral',
          contentType: options.contentType || 'general',
          errorType: error instanceof Error ? error.message : 'unknown',
          timestamp: Date.now()
        });

        // Record error analytics
        ttsAnalytics.recordError(error instanceof Error ? error : new Error(String(error)), {
          voice: selectedVoice,
          textLength: text.length,
          userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server'
        });
        
        throw error;
      } finally {
        // Clean up pending request and release request slot
        this.pendingRequests.delete(requestKey);
        this.releaseRequestSlot();
      }
    })();
    
    // Store the promise
    this.pendingRequests.set(requestKey, requestPromise);
    return await requestPromise;
  }

  // Request slot management for concurrent request limiting
  private async waitForRequestSlot(): Promise<void> {
    if (this.activeRequests < this.concurrentRequestLimit) {
      this.activeRequests++;
      return;
    }

    // Wait in queue
    return new Promise((resolve) => {
      this.requestQueue.push(resolve);
    });
  }

  private releaseRequestSlot(): void {
    this.activeRequests--;
    
    if (this.requestQueue.length > 0) {
      const next = this.requestQueue.shift();
      this.activeRequests++;
      next?.();
    }
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

  // Enhanced speak method with progressive support and context awareness
  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    this.dlog('🎤 Enhanced TTS speak called:', {
      textLength: text?.length || 0,
      progressiveMode: options.progressiveMode,
      contextAwareness: options.contextAwareness,
      isCurrentlySpeaking: this.isCurrentlySpeaking,
      preview: text?.substring(0, 100) + '...'
    });

    if (!text || text.trim().length === 0) {
      this.dlog('❌ No text provided to Enhanced TTS');
      return;
    }

    // Try to unlock audio up front (best-effort)
    if (!this.audioUnlocked) {
      try { await this.testAudioPlayback(); } catch {}
    }

    // Apply context-aware voice intelligence if enabled
    let processedText = text;
    let enhancedOptions = { ...options };
    
    if (options.contextAwareness !== false) {
      const contextResult = contextAwareVoice.processTextForVoice(text, 
        contextAwareVoice.analyzeContext(text), 
        options.voiceIntelligenceOptions
      );
      
      processedText = contextResult.processedText;
      enhancedOptions = {
        ...options,
        speed: contextResult.voiceParameters.speed,
        pitch: contextResult.voiceParameters.pitch,
        emotion: contextResult.voiceParameters.emotion as any,
        contentType: contextResult.voiceParameters.emotion as any
      };
      
      this.dlog('🧠 Context-aware processing applied:', {
        originalLength: text.length,
        processedLength: processedText.length,
        voiceParameters: contextResult.voiceParameters
      });
    }

    // Sanitize text to remove technical formatting and unwanted content
    if (options.textSanitization !== false) {
      // Use conservative sanitization by default to avoid removing too much content
      const defaultSanitizationConfig = {
        removeSSMLTags: true,
        removeHTMLTags: true,
        removeMarkdownFormatting: false, // Keep markdown for now
        removeTechnicalFormatting: true,
        removeTimestamps: true,
        removeDebugInfo: true,
        removeCodeBlocks: false, // Keep code blocks for now
        removeUrls: false, // Keep URLs for now
        removeEmails: false, // Keep emails for now
        removeSpecialCharacters: false,
        normalizeWhitespace: true,
        preserveNumbers: true,
        preservePunctuation: true,
        maxLength: 5000
      };
      
      const sanitizationConfig = options.textSanitization ? 
        { ...defaultSanitizationConfig, ...options.textSanitization } : 
        defaultSanitizationConfig;
      
      const sanitizer = new VoiceTextSanitizer(sanitizationConfig);
      const sanitizationResult = sanitizer.sanitizeText(processedText);
      
      // Safety check: if sanitized text is empty or too short, use original text
      if (sanitizationResult.sanitizedText.trim().length === 0 || 
          sanitizationResult.sanitizedText.trim().length < 10) {
        this.dlog('⚠️ Sanitized text too short, using original text');
        processedText = text; // Use original text as fallback
      } else {
        processedText = sanitizationResult.sanitizedText;
      }
      
      this.dlog('🧹 Text sanitization applied:', {
        originalLength: text.length,
        processedLength: processedText.length,
        sanitizedLength: sanitizationResult.sanitizedText.length,
        removedElements: sanitizationResult.removedElements.length,
        reductionPercentage: sanitizationResult.statistics.reductionPercentage.toFixed(2) + '%',
        usingFallback: processedText === text
      });
    } else {
      this.dlog('🚫 Text sanitization disabled');
    }

    // Record analytics
    voiceAnalytics.recordTTSRequest(
      enhancedOptions.voice || 'onyx',
      processedText.length,
      enhancedOptions.contentType || 'general',
      Date.now(),
      true
    );

    // Handle progressive mode
    if (enhancedOptions.progressiveMode) {
      return this.handleProgressiveSpeech(processedText, enhancedOptions);
    }

    // Standard mode - existing implementation
    return this.handleStandardSpeech(processedText, enhancedOptions);
  }

  // New method for progressive speech handling
  private async handleProgressiveSpeech(text: string, options: TTSOptions): Promise<void> {
    this.dlog('🔄 PROGRESSIVE TTS: Handling progressive speech', {
      newTextLength: text.length,
      currentStreamingLength: this.streamingText.length,
      lastSpokenPosition: this.lastSpokenPosition,
      isCurrentlySpeaking: this.isCurrentlySpeaking
    });

    // Store the streaming text and options
    this.streamingText = text;
    this.currentOptions = options;
    this.progressiveMode = true;

    // Debounce rapid updates to prevent echo
    if (this.progressiveTimeout) {
      clearTimeout(this.progressiveTimeout);
    }

    // Wait a bit to accumulate more text before speaking
    this.progressiveTimeout = setTimeout(async () => {
      // If we're not currently speaking and have enough new text, start speaking
      if (!this.isCurrentlySpeaking && text.length > this.lastSpokenPosition + 30) {
        this.dlog('🎤 PROGRESSIVE TTS: Starting/continuing speech');
        await this.speakProgressiveChunk();
      }
    }, 300); // Wait 300ms to accumulate text
  }

  // New method to speak progressive chunks
  private async speakProgressiveChunk(): Promise<void> {
    if (this.isCurrentlySpeaking || !this.currentOptions || this.isGeneratingAudio) {
      this.dlog('🚫 PROGRESSIVE TTS: Already speaking/generating or no options, skipping chunk', {
        isCurrentlySpeaking: this.isCurrentlySpeaking,
        isGeneratingAudio: this.isGeneratingAudio,
        hasOptions: !!this.currentOptions
      });
      return;
    }

    // Calculate what to speak
    let textToSpeak = '';
    const fullText = this.streamingText;
    
    if (this.lastSpokenPosition === 0) {
      // First chunk - speak everything we have so far
      textToSpeak = fullText;
    } else if (fullText.length > this.lastSpokenPosition) {
      // Subsequent chunks - only speak new content
      textToSpeak = fullText.substring(this.lastSpokenPosition);
    }

    // Ensure we have meaningful content to speak (not just a few characters)
    if (!textToSpeak.trim() || textToSpeak.trim().length < 10) {
      this.dlog('❌ PROGRESSIVE TTS: Not enough new content to speak');
      // Check again later
      this.scheduleNextProgressiveCheck();
      return;
    }

    this.dlog('🔄 PROGRESSIVE TTS: Speaking chunk:', {
      from: this.lastSpokenPosition,
      to: fullText.length,
      chunkLength: textToSpeak.length,
      preview: textToSpeak.substring(0, 50) + '...'
    });

    try {
      this.isCurrentlySpeaking = true;
      this.isGeneratingAudio = true;

      // Generate and play audio for this chunk
      let audioUrl: string | null = null;
      try {
        audioUrl = await this.generateOpenAITTS(textToSpeak, this.currentOptions);
      } catch (genErr) {
        if (this.isDebug()) console.warn('⚠️ PROGRESSIVE TTS: OpenAI TTS generation failed, falling back to browser TTS:', genErr);
        await this.generateBrowserTTS(textToSpeak, this.currentOptions);
        // Simulate completion pathway
        this.isCurrentlySpeaking = false;
        this.isGeneratingAudio = false;
        this.lastSpokenPosition = fullText.length;
        this.currentOptions.onEnd?.();
        this.resetProgressiveState();
        return;
      }
      
      // Update position BEFORE playing to prevent duplicate processing
      const spokenUpTo = fullText.length;
      
      // Mark generation as complete but still speaking
      this.isGeneratingAudio = false;
      
      await this.playAudioUrl(audioUrl!, {
        ...this.currentOptions,
        onEnd: () => {
          this.dlog('🎤 PROGRESSIVE TTS: Chunk completed, updating position');
          this.isCurrentlySpeaking = false;
          this.lastSpokenPosition = spokenUpTo;
          
          // Check if there's more content to speak
          if (this.progressiveMode && this.streamingText.length > spokenUpTo) {
            this.dlog('🔄 PROGRESSIVE TTS: More content available, scheduling next chunk');
            this.scheduleNextProgressiveCheck();
          } else if (!this.progressiveMode || this.streamingText === fullText) {
            this.dlog('✅ PROGRESSIVE TTS: All content spoken or progressive mode ended');
            this.currentOptions.onEnd?.();
            this.resetProgressiveState();
          }
        },
        onError: async (error) => {
          if (this.isDebug()) console.error('❌ PROGRESSIVE TTS: Chunk play error, attempting browser TTS fallback:', error);
          this.isCurrentlySpeaking = false;
          this.isGeneratingAudio = false;
          try { await this.generateBrowserTTS(textToSpeak, this.currentOptions!); } catch {}
          this.resetProgressiveState();
          this.currentOptions?.onError?.(error instanceof Error ? error : new Error(String(error)));
        }
      });

    } catch (error) {
      if (this.isDebug()) console.error('❌ PROGRESSIVE TTS: Error in progressive chunk:', error);
      this.isCurrentlySpeaking = false;
      this.isGeneratingAudio = false;
      this.resetProgressiveState();
      this.currentOptions?.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  // Helper to schedule next progressive check
  private scheduleNextProgressiveCheck(): void {
    if (this.progressiveTimeout) {
      clearTimeout(this.progressiveTimeout);
    }
    
    this.progressiveTimeout = setTimeout(() => {
      if (this.progressiveMode && !this.isCurrentlySpeaking) {
        this.speakProgressiveChunk();
      }
    }, 500);
  }

  // Reset progressive state
  private resetProgressiveState(): void {
    this.progressiveMode = false;
    this.streamingText = '';
    this.lastSpokenPosition = 0;
    this.currentOptions = null;
    this.isGeneratingAudio = false;
    
    if (this.progressiveTimeout) {
      clearTimeout(this.progressiveTimeout);
      this.progressiveTimeout = null;
    }
  }

  // Standard speech handling (existing implementation)
  private async handleStandardSpeech(text: string, options: TTSOptions): Promise<void> {
    // Ensure progressive state is reset
    // Ensure progressive state is reset
    this.resetProgressiveState();

    // Apply global speech lock
    if (this.globalSpeechLock) {
      this.dlog('🔒 Enhanced TTS: Global speech lock active, rejecting new request');
      throw new Error('Speech lock active - another speech operation in progress');
    }

    // Check if already speaking
    if (this.isCurrentlySpeaking) {
      this.dlog('🔄 Enhanced TTS: Already speaking, stopping current speech');
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
      
      if (options.useOpenAI !== false) {
        this.dlog('🎯 Enhanced TTS: Using OpenAI TTS for high-quality speech');
        try {
          const audioUrl = await this.generateOpenAITTS(text, options);
          await this.playAudioUrl(audioUrl, options);
        } catch (e) {
          if (this.isDebug()) console.warn('⚠️ OpenAI TTS failed, falling back to browser TTS', e);
          await this.generateBrowserTTS(text, options);
        }
      } else {
        this.dlog('🎯 Enhanced TTS: Using browser TTS fallback');
        await this.generateBrowserTTS(text, options);
      }
      
    } catch (error) {
      if (this.isDebug()) console.error('❌ Enhanced TTS: Speech failed:', error);
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
      this.currentAudio = new Audio(audioUrl);
      this.currentAudio.volume = options.volume || 0.9;
      
      // Add slight delay before starting to ensure audio is loaded
      this.currentAudio.preload = 'auto';
      
      // Track audio loading state
      let audioLoaded = false;
      let playbackStarted = false;
      
      this.currentAudio.onloadedmetadata = () => {
        this.dlog('🎵 Enhanced TTS: Audio metadata loaded, duration:', this.currentAudio?.duration);
        audioLoaded = true;
      };
      
      const fireStart = (() => {
        let fired = false;
        return () => {
          if (!fired) {
            fired = true;
            try { options.onStart?.(); } catch {}
          }
        };
      })();

      this.currentAudio.oncanplaythrough = () => {
        this.dlog('🎵 Enhanced TTS: Audio can play through without interruption');
        if (!playbackStarted) {
          playbackStarted = true;
          // Start playback with a slight delay to ensure smooth start
          setTimeout(() => {
            const p = this.currentAudio?.play();
            if (p && typeof (p as any).then === 'function') {
              (p as Promise<void>).then(() => {
                fireStart();
              }).catch((err: any) => {
                if (this.isDebug()) console.error('❌ Enhanced TTS: Play failed:', err);
                reject(err);
              });
            } else {
              fireStart();
            }
          }, 50);
        }
      };

      this.currentAudio.onplay = () => {
        fireStart();
      };
      
      this.currentAudio.onended = () => {
        this.dlog('🎵 Enhanced TTS: Audio playback completed naturally');
        // Add a small delay before cleanup to ensure the last bit of audio is heard
        setTimeout(() => {
          this.currentAudio = null;
          resolve();
        }, 100);
      };
      
      // Handle potential interruptions
      this.currentAudio.onpause = () => {
        if (!this.currentAudio?.ended) {
          if (this.isDebug()) console.warn('⚠️ Enhanced TTS: Audio was paused unexpectedly');
        }
      };
      
      // Load the audio
      this.currentAudio.load();
    });
  }

  // Stop current speech
  stop(): void {
    this.dlog('🛑 Enhanced TTS: Stop requested');
    
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
    this.dlog(`🔓 EnhancedTTS: Releasing global lock - ${reason}`);
    
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
    this.dlog('⚡ EnhancedTTS: FORCE UNLOCK called');
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

  // Dynamic bitrate adjustment based on content
  private getOptimalBitrate(text: string, contentType?: string): number {
    return audioProcessor.getOptimalBitrate(text.length, contentType);
  }

  // Get performance metrics for monitoring
  getPerformanceMetrics(): { summary: any; recent: TTSPerformanceMetrics[] } {
    const recent = this.performanceMetrics.slice(-20);
    const summary = {
      totalRequests: this.performanceMetrics.length,
      avgResponseTime: recent.length > 0 ? recent.reduce((sum, m) => sum + m.responseTime, 0) / recent.length : 0,
      cacheHitRate: recent.length > 0 ? recent.filter(m => m.cacheHit).length / recent.length * 100 : 0,
      avgAudioSize: recent.length > 0 ? recent.reduce((sum, m) => sum + m.audioSize, 0) / recent.length : 0,
      errorRate: recent.length > 0 ? recent.filter(m => m.errorType).length / recent.length * 100 : 0,
      circuitBreakerOpen: this.circuitBreakerState.isOpen,
      activeRequests: this.activeRequests,
      pendingRequests: this.requestQueue.length
    };
    
    return { summary, recent };
  }

  // Clear audio cache with IndexedDB cleanup
  async clearCache(): Promise<void> {
    // Revoke blob URLs to free memory
    this.audioCache.forEach(url => URL.revokeObjectURL(url));
    this.audioCache.clear();
    
    // Clear IndexedDB cache
    if (this.indexedDBCache) {
      const transaction = this.indexedDBCache.transaction(['audioCache'], 'readwrite');
      const store = transaction.objectStore('audioCache');
      await new Promise<void>((resolve) => {
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => resolve();
        clearRequest.onerror = () => resolve();
      });
    }
    
    this.dlog('Audio cache cleared (memory and IndexedDB)');
  }

  // Health check for the TTS service
  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details: any }> {
    const metrics = this.getPerformanceMetrics();
    const { summary } = metrics;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const details: any = {};
    
    // Check response time
    if (summary.avgResponseTime > 3000) {
      status = 'degraded';
      details.slowResponse = true;
    }
    
    // Check error rate
    if (summary.errorRate > 10) {
      status = 'unhealthy';
      details.highErrorRate = true;
    }
    
    // Check cache hit rate
    if (summary.cacheHitRate < 30) {
      details.lowCacheHitRate = true;
      if (status === 'healthy') status = 'degraded';
    }
    
    // Check circuit breaker
    if (this.circuitBreakerState.isOpen) {
      status = 'unhealthy';
      details.circuitBreakerOpen = true;
    }
    
    // Check IndexedDB availability
    details.indexedDBAvailable = !!this.indexedDBCache;
    details.activeRequests = summary.activeRequests;
    details.pendingRequests = summary.pendingRequests;
    
    return { status, details };
  }

  // Streaming audio for large text blocks
  async generateStreamingAudio(
    text: string, 
    options: TTSOptions = {},
    onChunkReady: (audioUrl: string, chunkIndex: number) => void
  ): Promise<void> {
    const maxChunkSize = 500; // Characters per chunk
    const chunks = this.splitTextIntoChunks(text, maxChunkSize);
    
    this.dlog(`Generating streaming audio for ${chunks.length} chunks`);
    
    for (let i = 0; i < chunks.length; i++) {
      try {
        const chunkText = chunks[i];
        const audioUrl = await this.generateOpenAITTS(chunkText, options);
        onChunkReady(audioUrl, i);
        
        // Small delay between chunks to prevent overwhelming
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        this.dlog(`Failed to generate chunk ${i}:`, error);
        // Continue with next chunk
      }
    }
  }

  // Split text into optimal chunks for streaming
  private splitTextIntoChunks(text: string, maxChunkSize: number): string[] {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks: string[] = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence;
      }
    }
    
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  // Pre-generate audio for frequently used phrases
  async pregenerateCommonPhrases(): Promise<void> {
    const commonPhrases = [
      "Yes, that's correct!",
      "Let me help you with that.",
      "Good question!",
      "Here's the answer:",
      "Try this approach:",
      "Well done!",
      "Keep practicing!",
      "You're improving!",
      "Let's try another example.",
      "Great job!"
    ];

    this.dlog('Pre-generating common phrases...');
    
    for (const phrase of commonPhrases) {
      try {
        const cacheKey = this.getCacheKey(phrase, { voice: 'onyx', speed: 1.0 });
        
        // Skip if already cached
        const existing = await this.getFromIndexedDBCache(cacheKey);
        if (existing) continue;

        // Generate and cache in background
        setTimeout(async () => {
          try {
            await this.generateOpenAITTS(phrase, { voice: 'onyx', speed: 1.0 });
          } catch (error) {
            this.dlog(`Failed to pre-generate phrase: "${phrase}"`, error);
          }
        }, Math.random() * 5000); // Stagger requests
        
      } catch (error) {
        this.dlog(`Failed to pre-generate phrase: "${phrase}"`, error);
      }
    }
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
    speed: 0.95,  // Increased from 0.9 for better conversational pace
    volume: 0.9,
    humanize: true,  // Enable human-like speech by default
    naturalPauses: true,  // Enable natural pauses by default
    contextAwareness: true,  // Enable context-aware voice intelligence by default
    voiceIntelligenceOptions: {
      enableSQLPronunciation: true,
      enableTechnicalTerms: true,
      enableSmartPausing: true,
      enableEmphasisDetection: true,
      enableContextAdaptation: true,
      pauseDuration: 800,
      emphasisIntensity: 0.3
    },
    ...options
  };
  
  return enhancedTTS.speak(text, defaultOptions);
} 