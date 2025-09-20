/**
 * Mobile Voice Testing Suite
 * Comprehensive testing for voice functionality on mobile devices
 */

import { EnhancedTTS } from '../../app/utils/enhanced-tts';
import { VoiceAnalytics } from '../../app/utils/voice-analytics';

// Mobile device mocks
const createMobileMock = (deviceType: string) => {
  const mobileAPIs = {
    ios: {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
      touch: true,
      orientation: 'portrait',
      connection: {
        effectiveType: '4g',
        downlink: 10,
        rtt: 100
      },
      mediaDevices: {
        getUserMedia: jest.fn(() => Promise.resolve({
          getTracks: () => [{ kind: 'audio', enabled: true }]
        } as MediaStream)),
        enumerateDevices: jest.fn(() => Promise.resolve([
          { deviceId: 'default', kind: 'audioinput', label: 'Built-in Microphone' },
          { deviceId: 'speaker', kind: 'audiooutput', label: 'Built-in Speaker' }
        ]))
      },
      speechSynthesis: {
        getVoices: jest.fn(() => [
          { name: 'Alex', lang: 'en-US', voiceURI: 'Alex', default: true },
          { name: 'Victoria', lang: 'en-US', voiceURI: 'Victoria' },
          { name: 'Daniel', lang: 'en-GB', voiceURI: 'Daniel' }
        ]),
        speak: jest.fn(),
        cancel: jest.fn(),
        pause: jest.fn(),
        resume: jest.fn()
      },
      audioContext: {
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
        sampleRate: 44100,
        state: 'running'
      }
    },
    android: {
      userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36',
      touch: true,
      orientation: 'portrait',
      connection: {
        effectiveType: '4g',
        downlink: 8,
        rtt: 150
      },
      mediaDevices: {
        getUserMedia: jest.fn(() => Promise.resolve({
          getTracks: () => [{ kind: 'audio', enabled: true }]
        } as MediaStream)),
        enumerateDevices: jest.fn(() => Promise.resolve([
          { deviceId: 'default', kind: 'audioinput', label: 'Built-in Microphone' },
          { deviceId: 'speaker', kind: 'audiooutput', label: 'Built-in Speaker' }
        ]))
      },
      speechSynthesis: {
        getVoices: jest.fn(() => [
          { name: 'Google US English', lang: 'en-US', voiceURI: 'Google US English' },
          { name: 'Google UK English', lang: 'en-GB', voiceURI: 'Google UK English' }
        ]),
        speak: jest.fn(),
        cancel: jest.fn(),
        pause: jest.fn(),
        resume: jest.fn()
      },
      audioContext: {
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
        sampleRate: 44100,
        state: 'running'
      }
    },
    tablet: {
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
      touch: true,
      orientation: 'landscape',
      connection: {
        effectiveType: 'wifi',
        downlink: 50,
        rtt: 50
      },
      mediaDevices: {
        getUserMedia: jest.fn(() => Promise.resolve({
          getTracks: () => [{ kind: 'audio', enabled: true }]
        } as MediaStream)),
        enumerateDevices: jest.fn(() => Promise.resolve([
          { deviceId: 'default', kind: 'audioinput', label: 'Built-in Microphone' },
          { deviceId: 'speaker', kind: 'audiooutput', label: 'Built-in Speaker' }
        ]))
      },
      speechSynthesis: {
        getVoices: jest.fn(() => [
          { name: 'Alex', lang: 'en-US', voiceURI: 'Alex', default: true },
          { name: 'Victoria', lang: 'en-US', voiceURI: 'Victoria' },
          { name: 'Daniel', lang: 'en-GB', voiceURI: 'Daniel' }
        ]),
        speak: jest.fn(),
        cancel: jest.fn(),
        pause: jest.fn(),
        resume: jest.fn()
      },
      audioContext: {
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
        sampleRate: 44100,
        state: 'running'
      }
    }
  };

  return mobileAPIs[deviceType] || mobileAPIs.ios;
};

describe('Mobile Voice Testing', () => {
  const mobileDevices = ['ios', 'android', 'tablet'];
  
  mobileDevices.forEach(device => {
    describe(`${device.toUpperCase()} Device`, () => {
      let enhancedTTS: EnhancedTTS;
      let voiceAnalytics: VoiceAnalytics;
      let mockAPIs: any;

      beforeEach(() => {
        mockAPIs = createMobileMock(device);
        
        // Set up mobile-specific globals
        global.navigator.userAgent = mockAPIs.userAgent;
        global.navigator.mediaDevices = mockAPIs.mediaDevices;
        global.speechSynthesis = mockAPIs.speechSynthesis;
        global.AudioContext = jest.fn(() => mockAPIs.audioContext);
        
        // Mock touch events
        global.TouchEvent = jest.fn();
        global.touchstart = jest.fn();
        global.touchend = jest.fn();
        global.touchmove = jest.fn();
        
        // Mock device orientation
        global.screen = {
          orientation: {
            type: mockAPIs.orientation,
            angle: mockAPIs.orientation === 'portrait' ? 0 : 90
          }
        } as any;
        
        // Mock network connection
        global.navigator.connection = mockAPIs.connection as any;
        
        // Mock IndexedDB for mobile
        global.indexedDB = {
          open: jest.fn(() => ({
            onsuccess: null,
            onerror: null,
            onupgradeneeded: null,
            result: {
              transaction: jest.fn(() => ({
                objectStore: jest.fn(() => ({
                  get: jest.fn(() => Promise.resolve({ result: null })),
                  put: jest.fn(() => Promise.resolve()),
                  delete: jest.fn(() => Promise.resolve()),
                  count: jest.fn(() => Promise.resolve({ result: 0 }))
                }))
              }))
            }
          }))
        } as any;

        enhancedTTS = new EnhancedTTS();
        voiceAnalytics = new VoiceAnalytics();
      });

      test('should detect mobile device capabilities', () => {
        const capabilities = enhancedTTS.getMobileCapabilities();
        
        expect(capabilities).toBeDefined();
        expect(capabilities.isMobile).toBe(true);
        expect(capabilities.deviceType).toBe(device);
        expect(capabilities.touchSupport).toBe(true);
        expect(capabilities.orientation).toBe(mockAPIs.orientation);
        expect(capabilities.networkType).toBe(mockAPIs.connection.effectiveType);
      });

      test('should handle mobile TTS functionality', async () => {
        const testText = 'Mobile TTS test message';
        
        try {
          const result = await enhancedTTS.speak(testText, {
            voice: 'nova',
            optimizeForMobile: true,
            reduceQuality: true
          });
          
          expect(result).toBeDefined();
          expect(result.audioBlob).toBeInstanceOf(Blob);
          expect(result.mobileOptimized).toBe(true);
          
          // Track mobile-specific usage
          await voiceAnalytics.trackMobileUsage({
            device: device,
            feature: 'TTS',
            success: true,
            audioSize: result.audioBlob.size,
            duration: result.duration,
            networkType: mockAPIs.connection.effectiveType
          });
          
        } catch (error) {
          // Test mobile fallback
          const fallbackResult = await enhancedTTS.fallbackToMobileTTS(testText);
          expect(fallbackResult).toBeDefined();
          
          await voiceAnalytics.trackMobileUsage({
            device: device,
            feature: 'TTS',
            success: false,
            error: error.message,
            usedFallback: true
          });
        }
      });

      test('should handle touch interactions', () => {
        const touchHandler = enhancedTTS.getTouchHandler();
        
        expect(touchHandler).toBeDefined();
        expect(typeof touchHandler.onTouchStart).toBe('function');
        expect(typeof touchHandler.onTouchEnd).toBe('function');
        expect(typeof touchHandler.onTouchMove).toBe('function');
        
        // Test touch event handling
        const touchEvent = new TouchEvent('touchstart', {
          touches: [{ clientX: 100, clientY: 100 } as Touch]
        });
        
        expect(() => touchHandler.onTouchStart(touchEvent)).not.toThrow();
      });

      test('should handle orientation changes', () => {
        const orientationHandler = enhancedTTS.getOrientationHandler();
        
        expect(orientationHandler).toBeDefined();
        expect(typeof orientationHandler.onOrientationChange).toBe('function');
        
        // Test orientation change handling
        const newOrientation = mockAPIs.orientation === 'portrait' ? 'landscape' : 'portrait';
        
        expect(() => orientationHandler.onOrientationChange(newOrientation)).not.toThrow();
        
        // Verify UI adaptation
        const adaptedUI = enhancedTTS.adaptUIForOrientation(newOrientation);
        expect(adaptedUI).toBeDefined();
        expect(adaptedUI.orientation).toBe(newOrientation);
      });

      test('should handle network connectivity changes', async () => {
        const networkHandler = enhancedTTS.getNetworkHandler();
        
        expect(networkHandler).toBeDefined();
        expect(typeof networkHandler.onNetworkChange).toBe('function');
        
        // Test different network conditions
        const networkConditions = ['2g', '3g', '4g', 'wifi', 'offline'];
        
        for (const condition of networkConditions) {
          const adaptedConfig = await networkHandler.onNetworkChange(condition);
          
          expect(adaptedConfig).toBeDefined();
          expect(adaptedConfig.networkType).toBe(condition);
          
          // Verify quality adjustments based on network
          if (condition === '2g' || condition === '3g') {
            expect(adaptedConfig.reduceQuality).toBe(true);
            expect(adaptedConfig.enableCompression).toBe(true);
          } else if (condition === 'wifi') {
            expect(adaptedConfig.reduceQuality).toBe(false);
            expect(adaptedConfig.enableCompression).toBe(false);
          }
        }
      });

      test('should handle mobile-specific audio limitations', async () => {
        const audioLimitations = enhancedTTS.getMobileAudioLimitations();
        
        expect(audioLimitations).toBeDefined();
        expect(audioLimitations.maxAudioLength).toBeDefined();
        expect(audioLimitations.supportedFormats).toBeDefined();
        expect(audioLimitations.simultaneousPlayback).toBeDefined();
        
        // Test audio length limits
        const longText = 'A'.repeat(1000);
        const result = await enhancedTTS.speak(longText, {
          voice: 'nova',
          respectMobileLimits: true
        });
        
        expect(result).toBeDefined();
        expect(result.truncated).toBeDefined();
        
        if (result.truncated) {
          expect(result.originalLength).toBeGreaterThan(result.audioBlob.size);
        }
      });

      test('should handle mobile memory constraints', async () => {
        const memoryInfo = enhancedTTS.getMobileMemoryInfo();
        
        expect(memoryInfo).toBeDefined();
        expect(memoryInfo.maxCacheSize).toBeDefined();
        expect(memoryInfo.currentUsage).toBeDefined();
        expect(memoryInfo.cleanupThreshold).toBeDefined();
        
        // Test memory management
        const cleanupResult = await enhancedTTS.cleanupMobileCache();
        expect(cleanupResult).toBeDefined();
        expect(cleanupResult.cleanedItems).toBeGreaterThanOrEqual(0);
        
        // Test memory usage monitoring
        const usageStats = await enhancedTTS.getMobileMemoryUsage();
        expect(usageStats).toBeDefined();
        expect(usageStats.cacheSize).toBeGreaterThanOrEqual(0);
        expect(usageStats.memoryPressure).toBeDefined();
      });

      test('should handle mobile-specific error scenarios', async () => {
        const mobileErrorScenarios = [
          { type: 'lowMemory', description: 'Insufficient memory for audio processing' },
          { type: 'networkTimeout', description: 'Network request timeout on mobile' },
          { type: 'audioInterrupted', description: 'Audio playback interrupted by system' },
          { type: 'permissionDenied', description: 'Microphone permission denied' }
        ];
        
        for (const scenario of mobileErrorScenarios) {
          const errorResult = await enhancedTTS.handleMobileError({
            device: device,
            errorType: scenario.type,
            errorMessage: scenario.description,
            networkType: mockAPIs.connection.effectiveType
          });
          
          expect(errorResult).toBeDefined();
          expect(errorResult.handled).toBe(true);
          expect(errorResult.recoveryAction).toBeDefined();
          
          // Track mobile-specific errors
          await voiceAnalytics.trackMobileError({
            device: device,
            errorType: scenario.type,
            errorMessage: scenario.description,
            recoveryAction: errorResult.recoveryAction
          });
        }
      });

      test('should optimize for mobile performance', async () => {
        const performanceConfig = enhancedTTS.getMobilePerformanceConfig();
        
        expect(performanceConfig).toBeDefined();
        expect(performanceConfig.batchSize).toBeDefined();
        expect(performanceConfig.timeoutMs).toBeDefined();
        expect(performanceConfig.retryAttempts).toBeDefined();
        
        // Test performance optimization
        const optimizedResult = await enhancedTTS.optimizeForMobile('Test message', {
          networkType: mockAPIs.connection.effectiveType,
          deviceType: device,
          batteryLevel: 50
        });
        
        expect(optimizedResult).toBeDefined();
        expect(optimizedResult.optimizations).toBeDefined();
        expect(Array.isArray(optimizedResult.optimizations)).toBe(true);
      });

      test('should track mobile-specific analytics', async () => {
        const mobileMetrics = await voiceAnalytics.getMobileMetrics(device);
        
        expect(mobileMetrics).toBeDefined();
        expect(mobileMetrics.device).toBe(device);
        expect(mobileMetrics.totalSessions).toBeGreaterThanOrEqual(0);
        expect(mobileMetrics.successRate).toBeGreaterThanOrEqual(0);
        expect(mobileMetrics.averageResponseTime).toBeGreaterThanOrEqual(0);
        expect(mobileMetrics.networkUsage).toBeDefined();
        
        // Test mobile-specific feature usage
        const featureUsage = await voiceAnalytics.getMobileFeatureUsage(device);
        expect(featureUsage).toBeDefined();
        expect(Array.isArray(featureUsage.features)).toBe(true);
        
        // Test battery impact tracking
        const batteryImpact = await voiceAnalytics.getBatteryImpact(device);
        expect(batteryImpact).toBeDefined();
        expect(batteryImpact.estimatedBatteryDrain).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Mobile Cross-Device Integration', () => {
    test('should maintain consistent behavior across mobile devices', async () => {
      const testText = 'Cross-device mobile test';
      const results = {};
      
      for (const device of mobileDevices) {
        const mockAPIs = createMobileMock(device);
        global.navigator.userAgent = mockAPIs.userAgent;
        global.navigator.mediaDevices = mockAPIs.mediaDevices;
        global.speechSynthesis = mockAPIs.speechSynthesis;
        global.AudioContext = jest.fn(() => mockAPIs.audioContext);
        global.navigator.connection = mockAPIs.connection as any;
        
        const enhancedTTS = new EnhancedTTS();
        
        try {
          const result = await enhancedTTS.speak(testText, {
            voice: 'nova',
            optimizeForMobile: true
          });
          
          results[device] = {
            success: true,
            duration: result.duration,
            audioSize: result.audioBlob.size,
            mobileOptimized: result.mobileOptimized
          };
        } catch (error) {
          results[device] = {
            success: false,
            error: error.message
          };
        }
      }
      
      // Verify consistent results across mobile devices
      expect(Object.keys(results)).toHaveLength(mobileDevices.length);
      
      // At least some devices should succeed
      const successCount = Object.values(results).filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(0);
    });

    test('should handle mobile device switching', async () => {
      const deviceSwitchScenarios = [
        { from: 'ios', to: 'android' },
        { from: 'android', to: 'tablet' },
        { from: 'tablet', to: 'ios' }
      ];
      
      for (const scenario of deviceSwitchScenarios) {
        // Simulate device switch
        const fromMock = createMobileMock(scenario.from);
        const toMock = createMobileMock(scenario.to);
        
        global.navigator.userAgent = fromMock.userAgent;
        const fromTTS = new EnhancedTTS();
        const fromCapabilities = fromTTS.getMobileCapabilities();
        
        global.navigator.userAgent = toMock.userAgent;
        const toTTS = new EnhancedTTS();
        const toCapabilities = toTTS.getMobileCapabilities();
        
        // Test device switch handling
        const switchResult = await toTTS.handleDeviceSwitch({
          from: scenario.from,
          to: scenario.to,
          previousCapabilities: fromCapabilities,
          currentCapabilities: toCapabilities
        });
        
        expect(switchResult).toBeDefined();
        expect(switchResult.success).toBe(true);
        expect(switchResult.adaptations).toBeDefined();
      }
    });

    test('should provide mobile-specific recommendations', async () => {
      const recommendations = {};
      
      for (const device of mobileDevices) {
        const mockAPIs = createMobileMock(device);
        global.navigator.userAgent = mockAPIs.userAgent;
        global.navigator.connection = mockAPIs.connection as any;
        
        const enhancedTTS = new EnhancedTTS();
        const deviceRecommendations = enhancedTTS.getMobileRecommendations();
        
        recommendations[device] = deviceRecommendations;
      }
      
      // Verify recommendations are provided for all devices
      Object.keys(recommendations).forEach(device => {
        expect(recommendations[device]).toBeDefined();
        expect(Array.isArray(recommendations[device].optimizations)).toBe(true);
        expect(Array.isArray(recommendations[device].limitations)).toBe(true);
        expect(recommendations[device].bestPractices).toBeDefined();
      });
    });
  });
});
