/**
 * Voice Feature Integration Tests
 * Comprehensive testing for voice functionality across the application
 */

import { EnhancedTTS } from '../../app/utils/enhanced-tts';
import { AudioProcessor } from '../../app/utils/audio-processor';
import { VoiceAnalytics } from '../../app/utils/voice-analytics';
import { ContextAwareVoice } from '../../app/utils/context-aware-voice';

// Mock Web APIs
global.AudioContext = jest.fn(() => ({
  createOscillator: jest.fn(() => ({
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    frequency: { value: 440 }
  })),
  createGain: jest.fn(() => ({
    connect: jest.fn(),
    gain: { value: 1 }
  })),
  destination: {}
}));

global.MediaRecorder = jest.fn(() => ({
  start: jest.fn(),
  stop: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  state: 'inactive'
}));

global.navigator.mediaDevices = {
  getUserMedia: jest.fn(() => Promise.resolve({} as MediaStream)),
  enumerateDevices: jest.fn(() => Promise.resolve([]))
};

// Mock IndexedDB
const mockDB = {
  transaction: jest.fn(() => ({
    objectStore: jest.fn(() => ({
      get: jest.fn(() => Promise.resolve({ result: null })),
      put: jest.fn(() => Promise.resolve()),
      delete: jest.fn(() => Promise.resolve()),
      count: jest.fn(() => Promise.resolve({ result: 0 }))
    }))
  }))
};

global.indexedDB = {
  open: jest.fn(() => ({
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    result: mockDB
  }))
} as any;

describe('Voice Integration Tests', () => {
  let enhancedTTS: EnhancedTTS;
  let audioProcessor: AudioProcessor;
  let voiceAnalytics: VoiceAnalytics;
  let contextAwareVoice: ContextAwareVoice;

  beforeEach(() => {
    enhancedTTS = new EnhancedTTS();
    audioProcessor = new AudioProcessor();
    voiceAnalytics = new VoiceAnalytics();
    contextAwareVoice = new ContextAwareVoice();
  });

  describe('TTS Service Integration', () => {
    test('should handle complete TTS workflow', async () => {
      const testText = 'Hello, this is a test message';
      
      // Test text preprocessing
      const processedText = contextAwareVoice.preprocessText(testText);
      expect(processedText).toBeDefined();
      
      // Test TTS generation
      const audioData = await enhancedTTS.speak(processedText, {
        voice: 'nova',
        speed: 1.0,
        emotion: 'friendly'
      });
      
      expect(audioData).toBeDefined();
      expect(audioData.audioBlob).toBeInstanceOf(Blob);
      expect(audioData.duration).toBeGreaterThan(0);
      
      // Test analytics tracking
      const analytics = await voiceAnalytics.trackTTSUsage({
        text: testText,
        voice: 'nova',
        duration: audioData.duration,
        success: true
      });
      
      expect(analytics).toBeDefined();
    });

    test('should handle TTS error scenarios', async () => {
      // Mock API failure
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('API Error'));
      
      const testText = 'Test error handling';
      
      try {
        await enhancedTTS.speak(testText, { voice: 'nova' });
      } catch (error) {
        expect(error).toBeDefined();
        
        // Test error analytics
        const errorAnalytics = await voiceAnalytics.trackError({
          type: 'TTS_API_ERROR',
          message: 'API Error',
          context: { text: testText, voice: 'nova' }
        });
        
        expect(errorAnalytics).toBeDefined();
      }
    });

    test('should handle cache operations', async () => {
      const testText = 'Cache test message';
      const cacheKey = enhancedTTS.generateCacheKey(testText, { voice: 'nova' });
      
      // Test cache miss
      const cachedAudio = await enhancedTTS.getFromCache(cacheKey);
      expect(cachedAudio).toBeNull();
      
      // Generate and cache audio
      const audioData = await enhancedTTS.speak(testText, { voice: 'nova' });
      await enhancedTTS.cacheAudio(cacheKey, audioData);
      
      // Test cache hit
      const retrievedAudio = await enhancedTTS.getFromCache(cacheKey);
      expect(retrievedAudio).toBeDefined();
    });
  });

  describe('Audio Processing Integration', () => {
    test('should process audio data correctly', async () => {
      // Create mock audio data
      const mockAudioBuffer = new ArrayBuffer(1024);
      const audioBlob = new Blob([mockAudioBuffer], { type: 'audio/mp3' });
      
      // Test audio processing
      const processedAudio = await audioProcessor.processAudio(audioBlob, {
        normalize: true,
        noiseReduction: true,
        compression: true
      });
      
      expect(processedAudio).toBeDefined();
      expect(processedAudio.processedBlob).toBeInstanceOf(Blob);
      expect(processedAudio.metadata).toBeDefined();
      expect(processedAudio.metadata.originalSize).toBe(mockAudioBuffer.byteLength);
    });

    test('should handle audio quality assessment', async () => {
      const mockAudioBuffer = new ArrayBuffer(1024);
      const audioBlob = new Blob([mockAudioBuffer], { type: 'audio/mp3' });
      
      const qualityMetrics = await audioProcessor.assessQuality(audioBlob);
      
      expect(qualityMetrics).toBeDefined();
      expect(qualityMetrics.clarity).toBeGreaterThanOrEqual(0);
      expect(qualityMetrics.clarity).toBeLessThanOrEqual(1);
      expect(qualityMetrics.noiseLevel).toBeGreaterThanOrEqual(0);
      expect(qualityMetrics.noiseLevel).toBeLessThanOrEqual(1);
    });
  });

  describe('Voice Analytics Integration', () => {
    test('should track comprehensive voice metrics', async () => {
      const testSession = {
        sessionId: 'test-session-123',
        userId: 'test-user',
        startTime: Date.now(),
        features: ['TTS', 'VoiceCommands', 'Conversation']
      };
      
      // Start session
      await voiceAnalytics.startSession(testSession);
      
      // Track TTS usage
      await voiceAnalytics.trackTTSUsage({
        text: 'Test message',
        voice: 'nova',
        duration: 2.5,
        success: true
      });
      
      // Track voice commands
      await voiceAnalytics.trackVoiceCommand({
        command: 'SELECT * FROM users',
        recognized: true,
        executionTime: 1.2
      });
      
      // Track conversation turn
      await voiceAnalytics.trackConversationTurn({
        userInput: 'Hello',
        assistantResponse: 'Hi there!',
        responseTime: 1.5
      });
      
      // End session and get analytics
      const sessionAnalytics = await voiceAnalytics.endSession(testSession.sessionId);
      
      expect(sessionAnalytics).toBeDefined();
      expect(sessionAnalytics.totalTTSUsage).toBe(1);
      expect(sessionAnalytics.totalVoiceCommands).toBe(1);
      expect(sessionAnalytics.totalConversationTurns).toBe(1);
      expect(sessionAnalytics.averageResponseTime).toBeGreaterThan(0);
    });

    test('should handle error tracking and alerting', async () => {
      const errorEvent = {
        type: 'VOICE_ACTIVATION_FAILED',
        message: 'Voice activation timeout',
        context: { userId: 'test-user', sessionId: 'test-session' },
        severity: 'high'
      };
      
      const errorReport = await voiceAnalytics.trackError(errorEvent);
      
      expect(errorReport).toBeDefined();
      expect(errorReport.errorId).toBeDefined();
      expect(errorReport.timestamp).toBeDefined();
      expect(errorReport.severity).toBe('high');
      
      // Test error aggregation
      const errorStats = await voiceAnalytics.getErrorStatistics();
      expect(errorStats).toBeDefined();
      expect(errorStats.totalErrors).toBeGreaterThan(0);
    });
  });

  describe('Context-Aware Voice Integration', () => {
    test('should handle SQL query pronunciation', async () => {
      const sqlQuery = 'SELECT * FROM users WHERE age > 25 ORDER BY name ASC';
      
      const processedQuery = await contextAwareVoice.processSQLQuery(sqlQuery);
      
      expect(processedQuery).toBeDefined();
      expect(processedQuery.pronunciation).toContain('SELECT');
      expect(processedQuery.pronunciation).toContain('FROM');
      expect(processedQuery.pronunciation).toContain('WHERE');
      expect(processedQuery.emphasis).toBeDefined();
      expect(processedQuery.pauses).toBeDefined();
    });

    test('should handle technical term pronunciation', async () => {
      const technicalText = 'The database uses PostgreSQL with JSONB columns';
      
      const processedText = await contextAwareVoice.preprocessText(technicalText);
      
      expect(processedText).toBeDefined();
      expect(processedText).toContain('PostgreSQL');
      expect(processedText).toContain('JSONB');
    });

    test('should adapt voice parameters based on content', async () => {
      const queryText = 'SELECT * FROM users';
      const explanationText = 'This query retrieves all user records from the users table';
      
      const queryParams = await contextAwareVoice.getVoiceParameters(queryText);
      const explanationParams = await contextAwareVoice.getVoiceParameters(explanationText);
      
      expect(queryParams).toBeDefined();
      expect(explanationParams).toBeDefined();
      
      // SQL queries should have different parameters than explanations
      expect(queryParams.speed).not.toBe(explanationParams.speed);
      expect(queryParams.emotion).not.toBe(explanationParams.emotion);
    });
  });

  describe('Cross-Component Integration', () => {
    test('should handle complete voice interaction flow', async () => {
      const interactionFlow = {
        userInput: 'Show me all users',
        expectedSQL: 'SELECT * FROM users',
        explanation: 'This query will display all user records'
      };
      
      // 1. Process user input with context awareness
      const processedInput = await contextAwareVoice.preprocessText(interactionFlow.userInput);
      
      // 2. Generate SQL (mock)
      const generatedSQL = interactionFlow.expectedSQL;
      
      // 3. Process SQL for pronunciation
      const sqlPronunciation = await contextAwareVoice.processSQLQuery(generatedSQL);
      
      // 4. Generate TTS for explanation
      const explanationAudio = await enhancedTTS.speak(
        interactionFlow.explanation,
        await contextAwareVoice.getVoiceParameters(interactionFlow.explanation)
      );
      
      // 5. Process audio
      const processedAudio = await audioProcessor.processAudio(
        explanationAudio.audioBlob,
        { normalize: true, noiseReduction: true }
      );
      
      // 6. Track analytics
      await voiceAnalytics.trackVoiceInteraction({
        userInput: interactionFlow.userInput,
        generatedSQL: generatedSQL,
        audioDuration: explanationAudio.duration,
        processingTime: Date.now() - Date.now()
      });
      
      expect(processedInput).toBeDefined();
      expect(sqlPronunciation).toBeDefined();
      expect(explanationAudio).toBeDefined();
      expect(processedAudio).toBeDefined();
    });

    test('should handle voice mode switching', async () => {
      const voiceModes = ['avatar', 'circle', 'minimal'];
      
      for (const mode of voiceModes) {
        // Test mode activation
        await voiceAnalytics.trackVoiceModeChange({
          from: 'previous',
          to: mode,
          userId: 'test-user'
        });
        
        // Test mode-specific functionality
        const modeConfig = enhancedTTS.getModeConfiguration(mode);
        expect(modeConfig).toBeDefined();
      }
    });
  });

  describe('Performance Integration', () => {
    test('should handle concurrent voice operations', async () => {
      const concurrentOperations = Array.from({ length: 5 }, (_, i) => 
        enhancedTTS.speak(`Test message ${i}`, { voice: 'nova' })
      );
      
      const results = await Promise.all(concurrentOperations);
      
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result.audioBlob).toBeInstanceOf(Blob);
      });
    });

    test('should handle memory management', async () => {
      // Generate multiple audio files
      const audioFiles = [];
      for (let i = 0; i < 10; i++) {
        const audio = await enhancedTTS.speak(`Memory test ${i}`, { voice: 'nova' });
        audioFiles.push(audio);
      }
      
      // Test cache cleanup
      const cleanupResult = await enhancedTTS.cleanupCache();
      expect(cleanupResult).toBeDefined();
      expect(cleanupResult.cleanedItems).toBeGreaterThanOrEqual(0);
      
      // Test memory usage
      const memoryUsage = await enhancedTTS.getMemoryUsage();
      expect(memoryUsage).toBeDefined();
      expect(memoryUsage.cacheSize).toBeGreaterThanOrEqual(0);
      expect(memoryUsage.memoryLimit).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery Integration', () => {
    test('should handle network failures gracefully', async () => {
      // Mock network failure
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));
      
      const testText = 'Network failure test';
      
      try {
        await enhancedTTS.speak(testText, { voice: 'nova' });
      } catch (error) {
        // Test fallback to browser TTS
        const fallbackResult = await enhancedTTS.fallbackToBrowserTTS(testText);
        expect(fallbackResult).toBeDefined();
        
        // Test error recovery
        const recoveryResult = await enhancedTTS.retryWithBackoff(testText, { voice: 'nova' });
        expect(recoveryResult).toBeDefined();
      }
    });

    test('should handle audio context failures', async () => {
      // Mock AudioContext failure
      global.AudioContext = jest.fn(() => {
        throw new Error('AudioContext not supported');
      });
      
      const testText = 'AudioContext failure test';
      
      try {
        const audioData = await enhancedTTS.speak(testText, { voice: 'nova' });
        expect(audioData).toBeDefined();
      } catch (error) {
        // Should gracefully handle the error
        expect(error).toBeDefined();
        
        // Test error tracking
        const errorReport = await voiceAnalytics.trackError({
          type: 'AUDIO_CONTEXT_ERROR',
          message: error.message,
          context: { text: testText }
        });
        
        expect(errorReport).toBeDefined();
      }
    });
  });
});
