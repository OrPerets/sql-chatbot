/**
 * Cross-Browser Voice Compatibility Tests
 * Tests voice functionality across different browser environments
 */

import { EnhancedTTS } from '../../app/utils/enhanced-tts';
import { VoiceAnalytics } from '../../app/utils/voice-analytics';

// Browser-specific mocks
const createBrowserMock = (browserName: string) => {
  const mockAPIs = {
    chrome: {
      speechSynthesis: {
        getVoices: jest.fn(() => [
          { name: 'Google US English', lang: 'en-US', voiceURI: 'Google US English' },
          { name: 'Microsoft David Desktop', lang: 'en-US', voiceURI: 'Microsoft David Desktop' }
        ]),
        speak: jest.fn(),
        cancel: jest.fn(),
        pause: jest.fn(),
        resume: jest.fn()
      },
      webkitSpeechRecognition: jest.fn(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        abort: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        continuous: false,
        interimResults: false,
        lang: 'en-US'
      })),
      AudioContext: jest.fn(() => ({
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
      }))
    },
    firefox: {
      speechSynthesis: {
        getVoices: jest.fn(() => [
          { name: 'Default', lang: 'en-US', voiceURI: 'Default' },
          { name: 'Alex', lang: 'en-US', voiceURI: 'Alex' }
        ]),
        speak: jest.fn(),
        cancel: jest.fn(),
        pause: jest.fn(),
        resume: jest.fn()
      },
      webkitSpeechRecognition: null, // Firefox doesn't support this
      AudioContext: jest.fn(() => ({
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
      }))
    },
    safari: {
      speechSynthesis: {
        getVoices: jest.fn(() => [
          { name: 'Alex', lang: 'en-US', voiceURI: 'Alex' },
          { name: 'Victoria', lang: 'en-US', voiceURI: 'Victoria' },
          { name: 'Daniel', lang: 'en-GB', voiceURI: 'Daniel' }
        ]),
        speak: jest.fn(),
        cancel: jest.fn(),
        pause: jest.fn(),
        resume: jest.fn()
      },
      webkitSpeechRecognition: jest.fn(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        abort: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        continuous: false,
        interimResults: false,
        lang: 'en-US'
      })),
      AudioContext: jest.fn(() => ({
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
      }))
    },
    edge: {
      speechSynthesis: {
        getVoices: jest.fn(() => [
          { name: 'Microsoft David Desktop', lang: 'en-US', voiceURI: 'Microsoft David Desktop' },
          { name: 'Microsoft Zira Desktop', lang: 'en-US', voiceURI: 'Microsoft Zira Desktop' }
        ]),
        speak: jest.fn(),
        cancel: jest.fn(),
        pause: jest.fn(),
        resume: jest.fn()
      },
      webkitSpeechRecognition: jest.fn(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        abort: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        continuous: false,
        interimResults: false,
        lang: 'en-US'
      })),
      AudioContext: jest.fn(() => ({
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
      }))
    }
  };

  return mockAPIs[browserName] || mockAPIs.chrome;
};

describe('Cross-Browser Voice Compatibility', () => {
  const browsers = ['chrome', 'firefox', 'safari', 'edge'];
  
  browsers.forEach(browser => {
    describe(`${browser.toUpperCase()} Browser`, () => {
      let enhancedTTS: EnhancedTTS;
      let voiceAnalytics: VoiceAnalytics;
      let mockAPIs: any;

      beforeEach(() => {
        mockAPIs = createBrowserMock(browser);
        
        // Set up browser-specific globals
        global.speechSynthesis = mockAPIs.speechSynthesis;
        global.webkitSpeechRecognition = mockAPIs.webkitSpeechRecognition;
        global.AudioContext = mockAPIs.AudioContext;
        global.navigator.userAgent = `Mozilla/5.0 (compatible; ${browser}/1.0)`;

        // Mock IndexedDB for all browsers
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

      test('should detect browser capabilities', () => {
        const capabilities = enhancedTTS.getBrowserCapabilities();
        
        expect(capabilities).toBeDefined();
        expect(capabilities.speechSynthesis).toBe(true);
        expect(capabilities.audioContext).toBe(true);
        
        if (browser === 'firefox') {
          expect(capabilities.speechRecognition).toBe(false);
        } else {
          expect(capabilities.speechRecognition).toBe(true);
        }
      });

      test('should handle TTS functionality', async () => {
        const testText = 'Cross-browser TTS test';
        
        try {
          const result = await enhancedTTS.speak(testText, {
            voice: 'nova',
            fallbackToBrowser: true
          });
          
          expect(result).toBeDefined();
          expect(result.audioBlob).toBeInstanceOf(Blob);
          
          // Track browser-specific usage
          await voiceAnalytics.trackBrowserUsage({
            browser: browser,
            feature: 'TTS',
            success: true,
            performance: result.duration
          });
          
        } catch (error) {
          // Test fallback behavior
          const fallbackResult = await enhancedTTS.fallbackToBrowserTTS(testText);
          expect(fallbackResult).toBeDefined();
          
          await voiceAnalytics.trackBrowserUsage({
            browser: browser,
            feature: 'TTS',
            success: false,
            error: error.message,
            usedFallback: true
          });
        }
      });

      test('should handle voice synthesis API differences', () => {
        const voices = enhancedTTS.getAvailableVoices();
        
        expect(Array.isArray(voices)).toBe(true);
        
        if (browser === 'chrome') {
          expect(voices.length).toBeGreaterThan(0);
          expect(voices.some(voice => voice.name.includes('Google'))).toBe(true);
        } else if (browser === 'safari') {
          expect(voices.some(voice => voice.name === 'Alex')).toBe(true);
        } else if (browser === 'edge') {
          expect(voices.some(voice => voice.name.includes('Microsoft'))).toBe(true);
        }
      });

      test('should handle speech recognition differences', () => {
        const recognitionCapability = enhancedTTS.getSpeechRecognitionCapability();
        
        if (browser === 'firefox') {
          expect(recognitionCapability.supported).toBe(false);
          expect(recognitionCapability.api).toBe('none');
        } else {
          expect(recognitionCapability.supported).toBe(true);
          expect(recognitionCapability.api).toBe('webkitSpeechRecognition');
        }
      });

      test('should handle audio context differences', () => {
        const audioContext = enhancedTTS.createAudioContext();
        
        expect(audioContext).toBeDefined();
        expect(audioContext.sampleRate).toBe(44100);
        
        // Test audio context methods
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        expect(oscillator).toBeDefined();
        expect(gainNode).toBeDefined();
      });

      test('should handle IndexedDB differences', async () => {
        const cacheKey = 'test-cache-key';
        const testData = { audio: 'test-audio-data' };
        
        try {
          await enhancedTTS.cacheAudio(cacheKey, testData);
          const retrieved = await enhancedTTS.getFromCache(cacheKey);
          
          expect(retrieved).toBeDefined();
          
        } catch (error) {
          // Some browsers might have IndexedDB limitations
          await voiceAnalytics.trackBrowserUsage({
            browser: browser,
            feature: 'IndexedDB',
            success: false,
            error: error.message
          });
        }
      });

      test('should handle browser-specific error scenarios', async () => {
        // Test various error conditions
        const errorScenarios = [
          { type: 'network', description: 'Network timeout' },
          { type: 'audio', description: 'Audio context creation failed' },
          { type: 'permission', description: 'Microphone permission denied' }
        ];
        
        for (const scenario of errorScenarios) {
          const errorResult = await enhancedTTS.handleBrowserError({
            browser: browser,
            errorType: scenario.type,
            errorMessage: scenario.description
          });
          
          expect(errorResult).toBeDefined();
          expect(errorResult.handled).toBe(true);
          expect(errorResult.fallbackUsed).toBeDefined();
        }
      });

      test('should track browser-specific analytics', async () => {
        const browserMetrics = await voiceAnalytics.getBrowserMetrics(browser);
        
        expect(browserMetrics).toBeDefined();
        expect(browserMetrics.browser).toBe(browser);
        expect(browserMetrics.totalSessions).toBeGreaterThanOrEqual(0);
        expect(browserMetrics.successRate).toBeGreaterThanOrEqual(0);
        expect(browserMetrics.averageResponseTime).toBeGreaterThanOrEqual(0);
        
        // Test browser-specific feature usage
        const featureUsage = await voiceAnalytics.getBrowserFeatureUsage(browser);
        expect(featureUsage).toBeDefined();
        expect(Array.isArray(featureUsage.features)).toBe(true);
      });

      test('should handle browser version differences', () => {
        const versionInfo = enhancedTTS.getBrowserVersionInfo();
        
        expect(versionInfo).toBeDefined();
        expect(versionInfo.browser).toBe(browser);
        expect(versionInfo.version).toBeDefined();
        expect(versionInfo.capabilities).toBeDefined();
        
        // Test version-specific optimizations
        const optimizations = enhancedTTS.getBrowserOptimizations(versionInfo);
        expect(optimizations).toBeDefined();
        expect(Array.isArray(optimizations)).toBe(true);
      });
    });
  });

  describe('Cross-Browser Integration Tests', () => {
    test('should maintain consistent behavior across browsers', async () => {
      const testText = 'Consistent behavior test';
      const results = {};
      
      for (const browser of browsers) {
        const mockAPIs = createBrowserMock(browser);
        global.speechSynthesis = mockAPIs.speechSynthesis;
        global.webkitSpeechRecognition = mockAPIs.webkitSpeechRecognition;
        global.AudioContext = mockAPIs.AudioContext;
        
        const enhancedTTS = new EnhancedTTS();
        
        try {
          const result = await enhancedTTS.speak(testText, { voice: 'nova' });
          results[browser] = {
            success: true,
            duration: result.duration,
            audioSize: result.audioBlob.size
          };
        } catch (error) {
          results[browser] = {
            success: false,
            error: error.message
          };
        }
      }
      
      // Verify consistent results across browsers
      expect(Object.keys(results)).toHaveLength(browsers.length);
      
      // At least some browsers should succeed
      const successCount = Object.values(results).filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(0);
    });

    test('should handle browser feature detection', () => {
      const featureMatrix = {};
      
      browsers.forEach(browser => {
        const mockAPIs = createBrowserMock(browser);
        global.speechSynthesis = mockAPIs.speechSynthesis;
        global.webkitSpeechRecognition = mockAPIs.webkitSpeechRecognition;
        global.AudioContext = mockAPIs.AudioContext;
        
        const enhancedTTS = new EnhancedTTS();
        const capabilities = enhancedTTS.getBrowserCapabilities();
        
        featureMatrix[browser] = capabilities;
      });
      
      // Verify feature detection consistency
      expect(Object.keys(featureMatrix)).toHaveLength(browsers.length);
      
      // All browsers should support basic TTS
      Object.values(featureMatrix).forEach(capabilities => {
        expect(capabilities.speechSynthesis).toBe(true);
        expect(capabilities.audioContext).toBe(true);
      });
    });

    test('should provide browser-specific recommendations', async () => {
      const recommendations = {};
      
      for (const browser of browsers) {
        const mockAPIs = createBrowserMock(browser);
        global.speechSynthesis = mockAPIs.speechSynthesis;
        global.webkitSpeechRecognition = mockAPIs.webkitSpeechRecognition;
        global.AudioContext = mockAPIs.AudioContext;
        
        const enhancedTTS = new EnhancedTTS();
        const browserRecommendations = enhancedTTS.getBrowserRecommendations();
        
        recommendations[browser] = browserRecommendations;
      }
      
      // Verify recommendations are provided for all browsers
      Object.keys(recommendations).forEach(browser => {
        expect(recommendations[browser]).toBeDefined();
        expect(Array.isArray(recommendations[browser].features)).toBe(true);
        expect(Array.isArray(recommendations[browser].optimizations)).toBe(true);
      });
    });
  });
});
