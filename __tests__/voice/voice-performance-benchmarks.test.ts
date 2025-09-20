/**
 * Voice Performance Benchmarks
 * Comprehensive performance testing for voice functionality
 */

import { enhancedTTS } from '../../app/utils/enhanced-tts';
import { AudioProcessor } from '../../app/utils/audio-processor';
import { VoiceAnalytics } from '../../app/utils/voice-analytics';

// Mock Web APIs for performance testing
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
  destination: {},
  sampleRate: 44100
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

describe('Voice Performance Benchmarks', () => {
  let audioProcessor: AudioProcessor;
  let voiceAnalytics: VoiceAnalytics;

  beforeEach(() => {
    audioProcessor = new AudioProcessor();
    voiceAnalytics = new VoiceAnalytics();
  });

  describe('TTS Performance Benchmarks', () => {
    test('should meet TTS response time requirements', async () => {
      const testTexts = [
        'Short message',
        'This is a medium length message that tests the performance of the TTS system',
        'This is a very long message that contains multiple sentences and should test the performance limits of the TTS system. It includes various types of content and should provide a comprehensive test of the system capabilities.'
      ];

      const results = [];
      const maxResponseTime = 2000; // 2 seconds

      for (const text of testTexts) {
        const startTime = performance.now();
        
        const result = await enhancedTTS.speak(text, {
          voice: 'nova',
          optimizeForPerformance: true
        });
        
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        results.push({
          textLength: text.length,
          responseTime,
          audioSize: result.audioBlob.size,
          duration: result.duration
        });
        
        expect(responseTime).toBeLessThan(maxResponseTime);
      }

      // Track performance metrics
      await voiceAnalytics.trackPerformanceBenchmark({
        testType: 'TTS_RESPONSE_TIME',
        results,
        averageResponseTime: results.reduce((sum, r) => sum + r.responseTime, 0) / results.length
      });
    });

    test('should handle concurrent TTS requests efficiently', async () => {
      const concurrentRequests = 10;
      const testText = 'Concurrent request test message';
      
      const startTime = performance.now();
      
      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        enhancedTTS.speak(`${testText} ${i}`, { voice: 'nova' })
      );
      
      const results = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      expect(results).toHaveLength(concurrentRequests);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.audioBlob).toBeInstanceOf(Blob);
      });
      
      // Performance should scale reasonably with concurrent requests
      const averageTimePerRequest = totalTime / concurrentRequests;
      expect(averageTimePerRequest).toBeLessThan(3000); // 3 seconds per request max
      
      await voiceAnalytics.trackPerformanceBenchmark({
        testType: 'CONCURRENT_TTS_REQUESTS',
        results: {
          concurrentRequests,
          totalTime,
          averageTimePerRequest,
          successRate: 1.0
        }
      });
    });

    test('should optimize audio cache performance', async () => {
      const testText = 'Cache performance test message';
      const iterations = 50;
      
      // First pass - populate cache
      const firstPassStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await enhancedTTS.speak(testText, { voice: 'nova' });
      }
      const firstPassEnd = performance.now();
      const firstPassTime = firstPassEnd - firstPassStart;
      
      // Second pass - test cache hits
      const secondPassStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await enhancedTTS.speak(testText, { voice: 'nova' });
      }
      const secondPassEnd = performance.now();
      const secondPassTime = secondPassEnd - secondPassStart;
      
      // Cache should provide significant performance improvement
      const cacheImprovement = (firstPassTime - secondPassTime) / firstPassTime;
      expect(cacheImprovement).toBeGreaterThan(0.5); // At least 50% improvement
      
      await voiceAnalytics.trackPerformanceBenchmark({
        testType: 'CACHE_PERFORMANCE',
        results: {
          firstPassTime,
          secondPassTime,
          cacheImprovement,
          iterations
        }
      });
    });

    test('should handle large text efficiently', async () => {
      const largeText = 'A'.repeat(10000); // 10KB text
      const maxProcessingTime = 5000; // 5 seconds
      
      const startTime = performance.now();
      const result = await enhancedTTS.speak(largeText, {
        voice: 'nova',
        chunkSize: 1000,
        streaming: true
      });
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      expect(result).toBeDefined();
      expect(result.audioBlob).toBeInstanceOf(Blob);
      expect(processingTime).toBeLessThan(maxProcessingTime);
      
      // Should handle chunking efficiently
      expect(result.chunked).toBe(true);
      expect(result.totalChunks).toBeGreaterThan(1);
      
      await voiceAnalytics.trackPerformanceBenchmark({
        testType: 'LARGE_TEXT_PROCESSING',
        results: {
          textSize: largeText.length,
          processingTime,
          audioSize: result.audioBlob.size,
          totalChunks: result.totalChunks
        }
      });
    });
  });

  describe('Audio Processing Performance', () => {
    test('should process audio efficiently', async () => {
      const mockAudioBuffer = new ArrayBuffer(1024 * 100); // 100KB
      const audioBlob = new Blob([mockAudioBuffer], { type: 'audio/mp3' });
      
      const startTime = performance.now();
      const processedAudio = await audioProcessor.processAudio(audioBlob, {
        normalize: true,
        noiseReduction: true,
        compression: true
      });
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      expect(processedAudio).toBeDefined();
      expect(processedAudio.processedBlob).toBeInstanceOf(Blob);
      expect(processingTime).toBeLessThan(1000); // 1 second max
      
      // Compression should reduce size
      const compressionRatio = processedAudio.processedBlob.size / audioBlob.size;
      expect(compressionRatio).toBeLessThan(1);
      
      await voiceAnalytics.trackPerformanceBenchmark({
        testType: 'AUDIO_PROCESSING',
        results: {
          originalSize: audioBlob.size,
          processedSize: processedAudio.processedBlob.size,
          compressionRatio,
          processingTime
        }
      });
    });

    test('should handle batch audio processing', async () => {
      const batchSize = 10;
      const audioBlobs = Array.from({ length: batchSize }, (_, i) => {
        const buffer = new ArrayBuffer(1024 * 10); // 10KB each
        return new Blob([buffer], { type: 'audio/mp3' });
      });
      
      const startTime = performance.now();
      const processedBatch = await audioProcessor.processBatch(audioBlobs, {
        normalize: true,
        noiseReduction: true
      });
      const endTime = performance.now();
      const batchProcessingTime = endTime - startTime;
      
      expect(processedBatch).toHaveLength(batchSize);
      
      // Batch processing should be more efficient than individual processing
      const averageTimePerItem = batchProcessingTime / batchSize;
      expect(averageTimePerItem).toBeLessThan(200); // 200ms per item max
      
      await voiceAnalytics.trackPerformanceBenchmark({
        testType: 'BATCH_AUDIO_PROCESSING',
        results: {
          batchSize,
          totalTime: batchProcessingTime,
          averageTimePerItem
        }
      });
    });
  });

  describe('Memory Performance', () => {
    test('should manage memory efficiently', async () => {
      const initialMemory = await enhancedTTS.getMemoryUsage();
      
      // Generate multiple audio files to test memory management
      const audioFiles = [];
      for (let i = 0; i < 20; i++) {
        const audio = await enhancedTTS.speak(`Memory test ${i}`, { voice: 'nova' });
        audioFiles.push(audio);
      }
      
      const peakMemory = await enhancedTTS.getMemoryUsage();
      
      // Cleanup cache
      const cleanupResult = await enhancedTTS.cleanupCache();
      const finalMemory = await enhancedTTS.getMemoryUsage();
      
      expect(cleanupResult.cleanedItems).toBeGreaterThan(0);
      expect(finalMemory.cacheSize).toBeLessThan(peakMemory.cacheSize);
      
      await voiceAnalytics.trackPerformanceBenchmark({
        testType: 'MEMORY_MANAGEMENT',
        results: {
          initialMemory: initialMemory.cacheSize,
          peakMemory: peakMemory.cacheSize,
          finalMemory: finalMemory.cacheSize,
          cleanedItems: cleanupResult.cleanedItems
        }
      });
    });

    test('should handle memory pressure gracefully', async () => {
      // Simulate memory pressure
      const memoryPressureResult = await enhancedTTS.handleMemoryPressure({
        availableMemory: 50 * 1024 * 1024, // 50MB
        cacheSize: 100 * 1024 * 1024, // 100MB
        pressureLevel: 'high'
      });
      
      expect(memoryPressureResult).toBeDefined();
      expect(memoryPressureResult.actions).toBeDefined();
      expect(Array.isArray(memoryPressureResult.actions)).toBe(true);
      
      // Should reduce cache size under pressure
      expect(memoryPressureResult.reducedCacheSize).toBeLessThan(100 * 1024 * 1024);
      
      await voiceAnalytics.trackPerformanceBenchmark({
        testType: 'MEMORY_PRESSURE_HANDLING',
        results: {
          initialCacheSize: 100 * 1024 * 1024,
          reducedCacheSize: memoryPressureResult.reducedCacheSize,
          actionsTaken: memoryPressureResult.actions.length
        }
      });
    });
  });

  describe('Network Performance', () => {
    test('should handle network latency efficiently', async () => {
      const networkConditions = [
        { type: 'fast', latency: 50, bandwidth: 10000 },
        { type: 'medium', latency: 200, bandwidth: 1000 },
        { type: 'slow', latency: 1000, bandwidth: 100 }
      ];
      
      const results = [];
      
      for (const condition of networkConditions) {
        // Mock network conditions
        jest.spyOn(global, 'fetch').mockImplementation(() =>
          new Promise(resolve => {
            setTimeout(() => {
              resolve({
                ok: true,
                blob: () => Promise.resolve(new Blob(['audio data'], { type: 'audio/mp3' }))
              } as Response);
            }, condition.latency);
          })
        );
        
        const startTime = performance.now();
        const result = await enhancedTTS.speak('Network test message', {
          voice: 'nova',
          networkOptimization: true
        });
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        results.push({
          networkType: condition.type,
          latency: condition.latency,
          responseTime,
          optimized: result.networkOptimized
        });
      }
      
      // Response time should scale reasonably with network conditions
      const fastResult = results.find(r => r.networkType === 'fast');
      const slowResult = results.find(r => r.networkType === 'slow');
      
      expect(slowResult.responseTime).toBeGreaterThan(fastResult.responseTime);
      expect(slowResult.optimized).toBe(true);
      
      await voiceAnalytics.trackPerformanceBenchmark({
        testType: 'NETWORK_PERFORMANCE',
        results
      });
    });

    test('should handle network failures gracefully', async () => {
      // Mock network failure
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));
      
      const startTime = performance.now();
      
      try {
        await enhancedTTS.speak('Network failure test', { voice: 'nova' });
      } catch (error) {
        // Should fallback quickly
        const fallbackResult = await enhancedTTS.fallbackToBrowserTTS('Network failure test');
        const endTime = performance.now();
        const fallbackTime = endTime - startTime;
        
        expect(fallbackResult).toBeDefined();
        expect(fallbackTime).toBeLessThan(3000); // Fallback within 3 seconds
        
        await voiceAnalytics.trackPerformanceBenchmark({
          testType: 'NETWORK_FAILURE_RECOVERY',
          results: {
            fallbackTime,
            success: true
          }
        });
      }
    });
  });

  describe('Analytics Performance', () => {
    test('should track analytics efficiently', async () => {
      const analyticsEvents = 100;
      const startTime = performance.now();
      
      const promises = Array.from({ length: analyticsEvents }, (_, i) =>
        voiceAnalytics.trackTTSUsage({
          text: `Analytics test ${i}`,
          voice: 'nova',
          duration: 2.5,
          success: true
        })
      );
      
      await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      const averageTimePerEvent = totalTime / analyticsEvents;
      expect(averageTimePerEvent).toBeLessThan(10); // 10ms per event max
      
      await voiceAnalytics.trackPerformanceBenchmark({
        testType: 'ANALYTICS_PERFORMANCE',
        results: {
          totalEvents: analyticsEvents,
          totalTime,
          averageTimePerEvent
        }
      });
    });

    test('should handle analytics aggregation efficiently', async () => {
      const startTime = performance.now();
      
      const aggregatedMetrics = await voiceAnalytics.getAggregatedMetrics({
        timeRange: 'last24hours',
        includeBreakdown: true
      });
      
      const endTime = performance.now();
      const aggregationTime = endTime - startTime;
      
      expect(aggregatedMetrics).toBeDefined();
      expect(aggregationTime).toBeLessThan(1000); // 1 second max for aggregation
      
      await voiceAnalytics.trackPerformanceBenchmark({
        testType: 'ANALYTICS_AGGREGATION',
        results: {
          aggregationTime,
          metricsCount: Object.keys(aggregatedMetrics).length
        }
      });
    });
  });

  describe('End-to-End Performance', () => {
    test('should handle complete voice workflow efficiently', async () => {
      const testWorkflow = {
        userInput: 'Show me all users',
        sqlGeneration: 'SELECT * FROM users',
        explanation: 'This query retrieves all user records from the users table',
        audioGeneration: true,
        audioProcessing: true
      };
      
      const startTime = performance.now();
      
      // Complete workflow
      const processedInput = testWorkflow.userInput;
      const sqlAudio = await enhancedTTS.speak(testWorkflow.sqlGeneration, { voice: 'nova' });
      const explanationAudio = await enhancedTTS.speak(testWorkflow.explanation, { voice: 'nova' });
      
      const processedSQLAudio = await audioProcessor.processAudio(sqlAudio.audioBlob, {
        normalize: true
      });
      const processedExplanationAudio = await audioProcessor.processAudio(explanationAudio.audioBlob, {
        normalize: true
      });
      
      await voiceAnalytics.trackVoiceInteraction({
        userInput: processedInput,
        generatedSQL: testWorkflow.sqlGeneration,
        audioDuration: sqlAudio.duration + explanationAudio.duration,
        processingTime: performance.now() - startTime
      });
      
      const endTime = performance.now();
      const totalWorkflowTime = endTime - startTime;
      
      expect(totalWorkflowTime).toBeLessThan(5000); // 5 seconds for complete workflow
      
      await voiceAnalytics.trackPerformanceBenchmark({
        testType: 'END_TO_END_WORKFLOW',
        results: {
          totalTime: totalWorkflowTime,
          components: {
            sqlGeneration: sqlAudio.duration,
            explanation: explanationAudio.duration,
            processing: (processedSQLAudio.metadata.processingTime || 0) + 
                       (processedExplanationAudio.metadata.processingTime || 0)
          }
        }
      });
    });

    test('should maintain performance under load', async () => {
      const loadTestUsers = 50;
      const requestsPerUser = 5;
      
      const startTime = performance.now();
      
      const userPromises = Array.from({ length: loadTestUsers }, (_, userIndex) =>
        Promise.all(Array.from({ length: requestsPerUser }, (_, requestIndex) =>
          enhancedTTS.speak(`Load test user ${userIndex} request ${requestIndex}`, {
            voice: 'nova',
            optimizeForPerformance: true
          })
        ))
      );
      
      const results = await Promise.all(userPromises);
      const endTime = performance.now();
      const totalLoadTime = endTime - startTime;
      
      const totalRequests = loadTestUsers * requestsPerUser;
      const averageResponseTime = totalLoadTime / totalRequests;
      
      expect(averageResponseTime).toBeLessThan(2000); // 2 seconds average under load
      
      await voiceAnalytics.trackPerformanceBenchmark({
        testType: 'LOAD_TESTING',
        results: {
          totalUsers: loadTestUsers,
          requestsPerUser,
          totalRequests,
          totalTime: totalLoadTime,
          averageResponseTime,
          successRate: 1.0
        }
      });
    });
  });
});
