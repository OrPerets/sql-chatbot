'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface VoiceActivationState {
  isVoiceActive: boolean;
  confidenceLevel: number;
  isListening: boolean;
  lastActivation: Date | null;
  activationCount: number;
}

export interface VoiceActivationOptions {
  confidenceThreshold: number;
  activationTimeout: number; // ms
  maxActivationsPerMinute: number;
  enableWakeWords: boolean;
  wakeWords: string[];
  enableCustomWakeWords: boolean;
  customWakeWords: string[];
  enableVoiceProfileRecognition: boolean;
  voiceProfileSensitivity: number;
  ambientNoiseAdaptation: boolean;
  wakeWordTrainingEnabled: boolean;
}

const DEFAULT_OPTIONS: VoiceActivationOptions = {
  confidenceThreshold: 0.7,
  activationTimeout: 30000, // 30 seconds
  maxActivationsPerMinute: 10,
  enableWakeWords: true,
  wakeWords: ['michael', 'מיכאל', 'sql', 'help', 'עזרה'],
  enableCustomWakeWords: false,
  customWakeWords: [],
  enableVoiceProfileRecognition: false,
  voiceProfileSensitivity: 0.8,
  ambientNoiseAdaptation: true,
  wakeWordTrainingEnabled: false
};

export const useSmartVoiceActivation = (options: Partial<VoiceActivationOptions> = {}) => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  const [state, setState] = useState<VoiceActivationState>({
    isVoiceActive: false,
    confidenceLevel: 0,
    isListening: false,
    lastActivation: null,
    activationCount: 0
  });

  const activationHistory = useRef<Date[]>([]);
  const audioContext = useRef<AudioContext | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const silenceDetectionRef = useRef<NodeJS.Timeout | null>(null);
  const recordingIntervalRef = useRef<number | null>(null);
  const voiceProfileRef = useRef<{features: number[], samples: number}>({features: [], samples: 0});
  const ambientNoiseLevelRef = useRef<number>(0);
  const customWakeWordModelRef = useRef<any>(null);
  const wakeWordTrainingDataRef = useRef<ArrayBuffer[]>([]);

  /**
   * Analyze audio buffer for voice intent using enhanced analysis with voice profile recognition
   * In a production environment, this could be enhanced with ML models
   */
  const analyzeVoiceIntent = useCallback(async (audioBuffer: ArrayBuffer): Promise<{
    intent: string;
    confidence: number;
    containsWakeWords: boolean;
    audioLevel: number;
    voiceProfileMatch?: number;
    customWakeWordMatch?: number;
    ambientNoiseLevel: number;
  }> => {
    try {
      // Basic audio analysis
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioData = await audioContext.current.decodeAudioData(audioBuffer.slice(0));
      const samples = audioData.getChannelData(0);
      
      // Calculate audio level (RMS)
      let sum = 0;
      for (let i = 0; i < samples.length; i++) {
        sum += samples[i] * samples[i];
      }
      const rms = Math.sqrt(sum / samples.length);
      const audioLevel = Math.min(1, rms * 10); // Normalize to 0-1

      // Update ambient noise level for adaptation
      if (config.ambientNoiseAdaptation) {
        const currentNoiseLevel = ambientNoiseLevelRef.current;
        const newNoiseLevel = audioLevel < 0.05 ? audioLevel : currentNoiseLevel * 0.95 + audioLevel * 0.05;
        ambientNoiseLevelRef.current = newNoiseLevel;
      }

      // Extract voice features for profile recognition
      const voiceFeatures = extractVoiceFeatures(samples, audioData.sampleRate);
      
      // Check voice profile match if enabled
      let voiceProfileMatch = 0;
      if (config.enableVoiceProfileRecognition && voiceProfileRef.current.samples > 0) {
        voiceProfileMatch = calculateVoiceProfileMatch(voiceFeatures);
      }

      // Check custom wake word match if enabled
      let customWakeWordMatch = 0;
      if (config.enableCustomWakeWords && customWakeWordModelRef.current) {
        customWakeWordMatch = await detectCustomWakeWords(audioBuffer);
      }

      // Simple voice activity detection based on audio level and duration
      const duration = audioData.duration;
      const noiseThreshold = config.ambientNoiseAdaptation ? 
        Math.max(0.01, ambientNoiseLevelRef.current * 2) : 0.01;
      const hasVoiceActivity = audioLevel > noiseThreshold && duration > 0.5 && duration < 10;
      
      let confidence = 0;
      let intent = 'none';
      let containsWakeWords = false;

      if (hasVoiceActivity) {
        // Enhanced confidence calculation with voice profile and custom wake words
        confidence = Math.min(0.9, audioLevel * 2 + (duration > 1 ? 0.3 : 0));
        
        // Boost confidence if voice profile matches
        if (config.enableVoiceProfileRecognition && voiceProfileMatch > config.voiceProfileSensitivity) {
          confidence = Math.min(0.95, confidence + 0.2);
        }
        
        // Boost confidence if custom wake word detected
        if (config.enableCustomWakeWords && customWakeWordMatch > 0.8) {
          confidence = Math.min(0.95, confidence + 0.3);
        }
        
        intent = confidence > config.confidenceThreshold ? 'interaction_request' : 'ambient_sound';
        
        // Enhanced wake word detection
        if (intent === 'interaction_request' && config.enableWakeWords) {
          containsWakeWords = confidence > 0.8 || customWakeWordMatch > 0.8;
        }
        
        // Update voice profile with new sample
        if (config.enableVoiceProfileRecognition && intent === 'interaction_request') {
          updateVoiceProfile(voiceFeatures);
        }
      }

      console.log('🎤 Voice analysis:', {
        audioLevel: audioLevel.toFixed(3),
        duration: duration.toFixed(2),
        confidence: confidence.toFixed(3),
        intent,
        containsWakeWords
      });

      return {
        intent,
        confidence,
        containsWakeWords,
        audioLevel,
        voiceProfileMatch,
        customWakeWordMatch,
        ambientNoiseLevel: ambientNoiseLevelRef.current
      };

    } catch (error) {
      console.error('❌ Voice analysis failed:', error);
      return {
        intent: 'error',
        confidence: 0,
        containsWakeWords: false,
        audioLevel: 0,
        voiceProfileMatch: 0,
        customWakeWordMatch: 0,
        ambientNoiseLevel: 0
      };
    }
  }, [config.confidenceThreshold, config.enableWakeWords, config.enableVoiceProfileRecognition, config.enableCustomWakeWords, config.voiceProfileSensitivity, config.ambientNoiseAdaptation]);

  /**
   * Extract voice features for profile recognition
   */
  const extractVoiceFeatures = useCallback((samples: Float32Array, sampleRate: number): number[] => {
    const features: number[] = [];
    
    // Calculate fundamental frequency (pitch)
    const pitch = calculateFundamentalFrequency(samples, sampleRate);
    features.push(pitch);
    
    // Calculate spectral centroid (brightness)
    const spectralCentroid = calculateSpectralCentroid(samples, sampleRate);
    features.push(spectralCentroid);
    
    // Calculate zero crossing rate
    const zcr = calculateZeroCrossingRate(samples);
    features.push(zcr);
    
    // Calculate energy
    const energy = calculateEnergy(samples);
    features.push(energy);
    
    // Calculate formants (simplified)
    const formants = calculateFormants(samples, sampleRate);
    features.push(...formants);
    
    return features;
  }, []);

  /**
   * Calculate fundamental frequency (pitch)
   */
  const calculateFundamentalFrequency = useCallback((samples: Float32Array, sampleRate: number): number => {
    // Simplified pitch detection using autocorrelation
    const minPeriod = Math.floor(sampleRate / 400); // 400 Hz max
    const maxPeriod = Math.floor(sampleRate / 80);  // 80 Hz min
    
    let bestPeriod = 0;
    let bestCorrelation = 0;
    
    for (let period = minPeriod; period < maxPeriod; period++) {
      let correlation = 0;
      for (let i = 0; i < samples.length - period; i++) {
        correlation += samples[i] * samples[i + period];
      }
      
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestPeriod = period;
      }
    }
    
    return bestPeriod > 0 ? sampleRate / bestPeriod : 0;
  }, []);

  /**
   * Calculate spectral centroid
   */
  const calculateSpectralCentroid = useCallback((samples: Float32Array, sampleRate: number): number => {
    // Simplified spectral centroid calculation
    const fftSize = 1024;
    const frequencyBinSize = sampleRate / fftSize;
    
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < fftSize / 2; i++) {
      const frequency = i * frequencyBinSize;
      const magnitude = Math.abs(samples[i] || 0);
      
      weightedSum += frequency * magnitude;
      magnitudeSum += magnitude;
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }, []);

  /**
   * Calculate zero crossing rate
   */
  const calculateZeroCrossingRate = useCallback((samples: Float32Array): number => {
    let crossings = 0;
    for (let i = 1; i < samples.length; i++) {
      if ((samples[i] >= 0) !== (samples[i - 1] >= 0)) {
        crossings++;
      }
    }
    return crossings / samples.length;
  }, []);

  /**
   * Calculate energy
   */
  const calculateEnergy = useCallback((samples: Float32Array): number => {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
  }, []);

  /**
   * Calculate formants (simplified)
   */
  const calculateFormants = useCallback((samples: Float32Array, sampleRate: number): number[] => {
    // Simplified formant detection - in production, this would use LPC analysis
    const formants = [800, 1200, 2500]; // Typical formant frequencies
    return formants.map(f => f / sampleRate); // Normalize
  }, []);

  /**
   * Calculate voice profile match
   */
  const calculateVoiceProfileMatch = useCallback((features: number[]): number => {
    const profile = voiceProfileRef.current;
    if (profile.features.length === 0) return 0;
    
    // Calculate Euclidean distance between current features and profile
    let distance = 0;
    const minLength = Math.min(features.length, profile.features.length);
    
    for (let i = 0; i < minLength; i++) {
      distance += Math.pow(features[i] - profile.features[i], 2);
    }
    
    distance = Math.sqrt(distance);
    
    // Convert distance to similarity score (0-1)
    return Math.max(0, 1 - distance / 10); // Adjust divisor based on feature scaling
  }, []);

  /**
   * Update voice profile
   */
  const updateVoiceProfile = useCallback((features: number[]): void => {
    const profile = voiceProfileRef.current;
    
    if (profile.features.length === 0) {
      // Initialize profile
      profile.features = [...features];
      profile.samples = 1;
    } else {
      // Update profile with exponential moving average
      const alpha = 0.1; // Learning rate
      for (let i = 0; i < Math.min(features.length, profile.features.length); i++) {
        profile.features[i] = (1 - alpha) * profile.features[i] + alpha * features[i];
      }
      profile.samples++;
    }
  }, []);

  /**
   * Detect custom wake words
   */
  const detectCustomWakeWords = useCallback(async (audioBuffer: ArrayBuffer): Promise<number> => {
    // In production, this would use a trained wake word detection model
    // For now, we'll simulate detection based on audio characteristics
    
    if (!customWakeWordModelRef.current) {
      return 0;
    }
    
    // Simulate custom wake word detection
    // This would typically involve:
    // 1. Preprocessing audio
    // 2. Feature extraction (MFCC, spectrogram, etc.)
    // 3. Model inference
    // 4. Post-processing and thresholding
    
    const audioLevel = calculateAudioLevel(audioBuffer);
    const duration = audioBuffer.byteLength / (44100 * 2); // Assuming 44.1kHz, 16-bit
    
    // Simple heuristic for wake word detection
    if (audioLevel > 0.1 && duration > 0.5 && duration < 3.0) {
      return Math.min(1.0, audioLevel * 2);
    }
    
    return 0;
  }, []);

  /**
   * Calculate audio level from buffer
   */
  const calculateAudioLevel = useCallback((audioBuffer: ArrayBuffer): number => {
    const samples = new Float32Array(audioBuffer);
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
  }, []);

  /**
   * Train custom wake word
   */
  const trainCustomWakeWord = useCallback(async (audioSamples: ArrayBuffer[]): Promise<boolean> => {
    try {
      // Store training data
      wakeWordTrainingDataRef.current = [...audioSamples];
      
      // In production, this would:
      // 1. Extract features from training samples
      // 2. Train a machine learning model
      // 3. Save the model for future use
      
      // For now, we'll create a simple model
      customWakeWordModelRef.current = {
        trained: true,
        samplesCount: audioSamples.length,
        trainedAt: Date.now()
      };
      
      console.log(`🎯 Custom wake word trained with ${audioSamples.length} samples`);
      return true;
    } catch (error) {
      console.error('❌ Failed to train custom wake word:', error);
      return false;
    }
  }, []);

  /**
   * Check if activation is allowed based on rate limiting
   */
  const isActivationAllowed = useCallback((): boolean => {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    
    // Clean old activations
    activationHistory.current = activationHistory.current.filter(
      activation => activation > oneMinuteAgo
    );

    // Check rate limit
    if (activationHistory.current.length >= config.maxActivationsPerMinute) {
      console.warn('⚠️ Voice activation rate limit exceeded');
      return false;
    }

    return true;
  }, [config.maxActivationsPerMinute]);

  /**
   * Activate voice interaction
   */
  const activateVoice = useCallback((confidence: number = 1.0): void => {
    if (!isActivationAllowed()) {
      return;
    }

    const now = new Date();
    activationHistory.current.push(now);

    setState(prev => ({
      ...prev,
      isVoiceActive: true,
      confidenceLevel: confidence,
      lastActivation: now,
      activationCount: prev.activationCount + 1
    }));

    console.log('✅ Voice activated with confidence:', confidence);

    // Auto-deactivate after timeout
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        isVoiceActive: false,
        confidenceLevel: 0
      }));
      console.log('⏰ Voice activation timeout');
    }, config.activationTimeout);
  }, [config.activationTimeout, isActivationAllowed]);

  /**
   * Manually deactivate voice
   */
  const deactivateVoice = useCallback((): void => {
    setState(prev => ({
      ...prev,
      isVoiceActive: false,
      confidenceLevel: 0
    }));
    console.log('🔇 Voice manually deactivated');
  }, []);

  /**
   * Start listening for voice activation
   */
  const startListening = useCallback(async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });

      mediaRecorder.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      const audioChunks: Blob[] = [];

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.current.onstop = async () => {
        if (audioChunks.length > 0) {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
          const audioBuffer = await audioBlob.arrayBuffer();
          
          const analysis = await analyzeVoiceIntent(audioBuffer);
          
          if (analysis.intent === 'interaction_request' && 
              analysis.confidence >= config.confidenceThreshold) {
            activateVoice(analysis.confidence);
          }
        }
        
        // Restart listening if still active
        if (state.isListening) {
          setTimeout(() => {
            if (mediaRecorder.current?.state === 'inactive') {
              mediaRecorder.current.start();
            }
          }, 100);
        }
      };

      // Record in chunks for continuous analysis
      mediaRecorder.current.start();
      
      // Stop and analyze every 2 seconds
      recordingIntervalRef.current = window.setInterval(() => {
        if (mediaRecorder.current?.state === 'recording') {
          mediaRecorder.current.stop();
          setTimeout(() => {
            if (state.isListening && mediaRecorder.current?.state === 'inactive') {
              mediaRecorder.current.start();
            }
          }, 100);
        }
      }, 2000);

      setState(prev => ({ ...prev, isListening: true }));
      console.log('👂 Started listening for voice activation');

    } catch (error) {
      console.error('❌ Failed to start voice listening:', error);
      setState(prev => ({ ...prev, isListening: false }));
    }
  }, [analyzeVoiceIntent, activateVoice, config.confidenceThreshold, state.isListening]);

  /**
   * Stop listening for voice activation
   */
  const stopListening = useCallback((): void => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
    }
    
    setState(prev => ({ ...prev, isListening: false }));
    console.log('🔇 Stopped listening for voice activation');
  }, []);

  /**
   * Toggle listening state
   */
  const toggleListening = useCallback((): void => {
    if (state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [state.isListening, startListening, stopListening]);

  /**
   * Get activation statistics
   */
  const getStats = useCallback(() => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);
    const recentActivations = activationHistory.current.filter(
      activation => activation > oneHourAgo
    ).length;

    return {
      totalActivations: state.activationCount,
      recentActivations,
      isRateLimited: !isActivationAllowed(),
      averageConfidence: state.confidenceLevel,
      lastActivation: state.lastActivation
    };
  }, [state, isActivationAllowed]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const silenceTimer = silenceDetectionRef.current;
      stopListening();
      if (audioContext.current) {
        audioContext.current.close();
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      if (silenceTimer) {
        clearTimeout(silenceTimer);
      }
    };
  }, [stopListening]);

  return {
    ...state,
    activateVoice,
    deactivateVoice,
    startListening,
    stopListening,
    toggleListening,
    analyzeVoiceIntent,
    getStats,
    isActivationAllowed,
    trainCustomWakeWord,
    getVoiceProfile: () => voiceProfileRef.current,
    resetVoiceProfile: () => {
      voiceProfileRef.current = { features: [], samples: 0 };
    },
    getAmbientNoiseLevel: () => ambientNoiseLevelRef.current,
    resetAmbientNoiseLevel: () => {
      ambientNoiseLevelRef.current = 0;
    }
  };
};
