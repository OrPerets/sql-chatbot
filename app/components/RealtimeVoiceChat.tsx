'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { OpenAIRealtimeService } from '../services/openai-realtime';
import styles from './RealtimeVoiceChat.module.css';

interface RealtimeVoiceChatProps {
  onTranscriptionUpdate: (text: string) => void;
  onResponseUpdate: (text: string) => void;
  isEnabled: boolean;
  voice?: string;
  instructions?: string;
  className?: string;
}

export const RealtimeVoiceChat: React.FC<RealtimeVoiceChatProps> = ({
  onTranscriptionUpdate,
  onResponseUpdate,
  isEnabled,
  voice = 'alloy',
  instructions,
  className = ''
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  
  const realtimeService = useRef<OpenAIRealtimeService | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;

  // Initialize realtime service
  const initializeRealtime = useCallback(async () => {
    if (!isEnabled) return;

    try {
      setConnectionStatus('connecting');
      setError(null);
      
      realtimeService.current = new OpenAIRealtimeService();
      
      // Set up event listeners
      realtimeService.current.on('speechStarted', () => {
        console.log('🎤 Speech started');
        setIsListening(true);
      });
      
      realtimeService.current.on('speechStopped', () => {
        console.log('🎤 Speech stopped');
        setIsListening(false);
      });
      
      realtimeService.current.on('responseStarted', () => {
        console.log('🤖 Response started');
        setIsSpeaking(true);
      });
      
      realtimeService.current.on('responseEnded', () => {
        console.log('🤖 Response ended');
        setIsSpeaking(false);
      });
      
      realtimeService.current.on('transcriptionUpdate', (text: string) => {
        console.log('📝 Transcription update:', text);
        onTranscriptionUpdate(text);
      });
      
      realtimeService.current.on('responseUpdate', (text: string) => {
        console.log('💬 Response update:', text);
        onResponseUpdate(text);
      });
      
      realtimeService.current.on('error', (error: Error) => {
        console.error('❌ Realtime service error:', error);
        setError(error.message);
        setConnectionStatus('error');
        handleReconnect();
      });

      // Configure service
      if (voice) {
        realtimeService.current.setVoice(voice);
      }
      if (instructions) {
        realtimeService.current.setInstructions(instructions);
      }

      // Connect to service
      await realtimeService.current.connect();
      
      setIsConnected(true);
      setConnectionStatus('connected');
      reconnectAttempts.current = 0;
      
      console.log('✅ Realtime voice chat initialized');
    } catch (error) {
      console.error('❌ Failed to initialize realtime voice:', error);
      setError(error instanceof Error ? error.message : 'Failed to initialize voice chat');
      setConnectionStatus('error');
      handleReconnect();
    }
  }, [isEnabled, voice, instructions, onTranscriptionUpdate, onResponseUpdate]);

  // Handle reconnection
  const handleReconnect = useCallback(() => {
    if (reconnectAttempts.current < maxReconnectAttempts) {
      reconnectAttempts.current++;
      console.log(`🔄 Attempting to reconnect (${reconnectAttempts.current}/${maxReconnectAttempts})`);
      setTimeout(initializeRealtime, 2000 * reconnectAttempts.current);
    } else {
      console.error('❌ Max reconnection attempts reached');
      setConnectionStatus('error');
    }
  }, [initializeRealtime]);

  // Start listening
  const startListening = useCallback(async () => {
    if (!realtimeService.current || !isConnected) {
      console.warn('⚠️ Service not ready for listening');
      return;
    }

    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      mediaStream.current = stream;
      await realtimeService.current.startListening(stream);
      
      console.log('🎤 Started listening');
    } catch (error) {
      console.error('❌ Failed to start listening:', error);
      setError(error instanceof Error ? error.message : 'Failed to access microphone');
    }
  }, [isConnected]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (realtimeService.current) {
      realtimeService.current.stopListening();
    }
    
    if (mediaStream.current) {
      mediaStream.current.getTracks().forEach(track => track.stop());
      mediaStream.current = null;
    }
    
    setIsListening(false);
    console.log('🎤 Stopped listening');
  }, []);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Cleanup function
  const cleanup = useCallback(() => {
    stopListening();
    
    if (realtimeService.current) {
      realtimeService.current.disconnect();
      realtimeService.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, [stopListening]);

  // Initialize on enable
  useEffect(() => {
    if (isEnabled && !realtimeService.current) {
      initializeRealtime();
    } else if (!isEnabled && realtimeService.current) {
      cleanup();
    }
  }, [isEnabled, initializeRealtime, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Get status indicator
  const getStatusIndicator = () => {
    switch (connectionStatus) {
      case 'connected':
        return { icon: '🟢', text: 'Connected', color: 'green' };
      case 'connecting':
        return { icon: '🟡', text: 'Connecting...', color: 'orange' };
      case 'error':
        return { icon: '🔴', text: 'Error', color: 'red' };
      default:
        return { icon: '⚫', text: 'Disconnected', color: 'gray' };
    }
  };

  const statusIndicator = getStatusIndicator();

  if (!isEnabled) {
    return null;
  }

  return (
    <div className={`${styles.realtimeVoiceChat} ${className}`}>
      <div className={styles.controls}>
        <button 
          onClick={toggleListening}
          disabled={!isConnected}
          className={`${styles.voiceButton} ${isListening ? styles.listening : ''} ${!isConnected ? styles.disabled : ''}`}
          title={isListening ? 'Stop listening' : 'Start voice chat'}
        >
          <span className={styles.buttonIcon}>
            {isListening ? '🎤' : '🎙️'}
          </span>
          <span className={styles.buttonText}>
            {isListening ? 'Listening...' : 'Start Voice Chat'}
          </span>
        </button>
      </div>
      
      <div className={styles.statusIndicators}>
        <div 
          className={`${styles.indicator} ${styles[connectionStatus]}`}
          style={{ color: statusIndicator.color }}
        >
          <span className={styles.indicatorIcon}>{statusIndicator.icon}</span>
          <span className={styles.indicatorText}>{statusIndicator.text}</span>
        </div>
        
        {isSpeaking && (
          <div className={`${styles.indicator} ${styles.speaking}`}>
            <span className={styles.indicatorIcon}>🔊</span>
            <span className={styles.indicatorText}>Speaking</span>
          </div>
        )}
      </div>
      
      {error && (
        <div className={styles.errorMessage}>
          <span className={styles.errorIcon}>⚠️</span>
          <span className={styles.errorText}>{error}</span>
          <button 
            onClick={initializeRealtime}
            className={styles.retryButton}
            title="Retry connection"
          >
            🔄
          </button>
        </div>
      )}
    </div>
  );
};
