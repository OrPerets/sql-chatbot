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
}

const DEFAULT_OPTIONS: VoiceActivationOptions = {
  confidenceThreshold: 0.7,
  activationTimeout: 30000, // 30 seconds
  maxActivationsPerMinute: 10,
  enableWakeWords: true,
  wakeWords: ['michael', 'מיכאל', 'sql', 'help', 'עזרה']
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

  /**
   * Analyze audio buffer for voice intent using basic audio analysis
   * In a production environment, this could be enhanced with ML models
   */
  const analyzeVoiceIntent = useCallback(async (audioBuffer: ArrayBuffer): Promise<{
    intent: string;
    confidence: number;
    containsWakeWords: boolean;
    audioLevel: number;
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

      // Simple voice activity detection based on audio level and duration
      const duration = audioData.duration;
      const hasVoiceActivity = audioLevel > 0.01 && duration > 0.5 && duration < 10;
      
      let confidence = 0;
      let intent = 'none';
      let containsWakeWords = false;

      if (hasVoiceActivity) {
        // For now, use basic heuristics
        // In production, this would use OpenAI Whisper or similar
        confidence = Math.min(0.9, audioLevel * 2 + (duration > 1 ? 0.3 : 0));
        intent = confidence > config.confidenceThreshold ? 'interaction_request' : 'ambient_sound';
        
        // Simulate wake word detection (in production, would use actual transcription)
        if (intent === 'interaction_request' && config.enableWakeWords) {
          // Assume wake words are present if confidence is high
          containsWakeWords = confidence > 0.8;
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
        audioLevel
      };

    } catch (error) {
      console.error('❌ Voice analysis failed:', error);
      return {
        intent: 'error',
        confidence: 0,
        containsWakeWords: false,
        audioLevel: 0
      };
    }
  }, [config.confidenceThreshold, config.enableWakeWords]);

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
    isActivationAllowed
  };
};
