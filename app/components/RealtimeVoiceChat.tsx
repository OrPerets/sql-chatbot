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
  conversationMemory?: boolean;
  interruptionHandling?: boolean;
  onConversationSummary?: (summary: string) => void;
}

export const RealtimeVoiceChat: React.FC<RealtimeVoiceChatProps> = ({
  onTranscriptionUpdate,
  onResponseUpdate,
  isEnabled,
  voice = 'alloy',
  instructions,
  className = '',
  conversationMemory = true,
  interruptionHandling = true,
  onConversationSummary
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [conversationHistory, setConversationHistory] = useState<Array<{role: 'user' | 'assistant', content: string, timestamp: number}>>([]);
  const [isInterrupted, setIsInterrupted] = useState(false);
  const [conversationContext, setConversationContext] = useState<string>('');
  
  const realtimeService = useRef<OpenAIRealtimeService | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;
  const conversationMemoryRef = useRef<Array<{role: 'user' | 'assistant', content: string, timestamp: number}>>([]);
  const interruptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initializeRealtimeRef = useRef<() => void>(() => {});

  // Handle reconnection
  const handleReconnect = useCallback(() => {
    if (reconnectAttempts.current < maxReconnectAttempts) {
      reconnectAttempts.current++;
      console.log(`🔄 Attempting to reconnect (${reconnectAttempts.current}/${maxReconnectAttempts})`);
      setTimeout(() => initializeRealtimeRef.current(), 2000 * reconnectAttempts.current);
    } else {
      console.error('❌ Max reconnection attempts reached');
      setConnectionStatus('error');
    }
  }, [maxReconnectAttempts]);

  // Handle interruption
  const handleInterruption = useCallback(() => {
    console.log('🛑 User interrupted assistant response');
    setIsInterrupted(true);

    // Stop current response
    if (realtimeService.current) {
      // realtimeService.current.stopResponse(); // Method doesn't exist yet
    }

    // Clear interruption timeout
    if (interruptionTimeoutRef.current) {
      clearTimeout(interruptionTimeoutRef.current);
    }

    // Set timeout to reset interruption state
    interruptionTimeoutRef.current = setTimeout(() => {
      setIsInterrupted(false);
    }, 2000);
  }, []);

  // Generate conversation summary
  const generateConversationSummary = useCallback(() => {
    if (conversationMemoryRef.current.length < 3) return;

    const recentMessages = conversationMemoryRef.current.slice(-5);
    const context = recentMessages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    setConversationContext(context);

    // Notify parent component
    if (onConversationSummary && recentMessages.length > 0) {
      onConversationSummary(context);
    }
  }, [onConversationSummary]);

  // Update conversation context for memory
  const updateConversationContext = useCallback((role: 'user' | 'assistant', content: string) => {
    const message = {
      role,
      content,
      timestamp: Date.now()
    };

    conversationMemoryRef.current.push(message);

    // Keep only last 10 messages for context
    if (conversationMemoryRef.current.length > 10) {
      conversationMemoryRef.current = conversationMemoryRef.current.slice(-10);
    }

    // Update conversation history state
    setConversationHistory([...conversationMemoryRef.current]);

    // Generate conversation context summary
    generateConversationSummary();
  }, [generateConversationSummary]);

  // Initialize realtime service
  const initializeRealtime = useCallback(async () => {
    if (!isEnabled) return;

    try {
      setConnectionStatus('connecting');
      setError(null);
      
      realtimeService.current = new OpenAIRealtimeService();
      
      // Set up event listeners (use camelCase keys to match RealtimeCallbacks)
      realtimeService.current.on('onSpeechStarted', () => {
        console.log('🎤 Speech started');
        setIsListening(true);
      });
      
      realtimeService.current.on('onSpeechStopped', () => {
        console.log('🎤 Speech stopped');
        setIsListening(false);
      });
      
      realtimeService.current.on('onResponseStarted', () => {
        console.log('🤖 Response started');
        setIsSpeaking(true);
      });
      
      realtimeService.current.on('onResponseEnded', () => {
        console.log('🤖 Response ended');
        setIsSpeaking(false);
      });
      
      realtimeService.current.on('onTranscriptionUpdate', (text: string) => {
        console.log('📝 Transcription update:', text);
        onTranscriptionUpdate(text);
        
        // Handle interruption if user starts speaking while assistant is speaking
        if (interruptionHandling && isSpeaking && text.trim().length > 0) {
          handleInterruption();
        }
      });
      
      realtimeService.current.on('onResponseUpdate', (text: string) => {
        console.log('💬 Response update:', text);
        onResponseUpdate(text);
        
        // Update conversation context for memory
        if (conversationMemory) {
          updateConversationContext('assistant', text);
        }
      });
      
      realtimeService.current.on('onError', (error: Error) => {
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
  }, [
    isEnabled,
    voice,
    instructions,
    onTranscriptionUpdate,
    onResponseUpdate,
    conversationMemory,
    handleInterruption,
    handleReconnect,
    interruptionHandling,
    isSpeaking,
    updateConversationContext
  ]);

  useEffect(() => {
    initializeRealtimeRef.current = () => {
      void initializeRealtime();
    };
  }, [initializeRealtime]);

  // Get conversation memory for context
  const getConversationMemory = useCallback(() => {
    return conversationMemoryRef.current.slice(-5).map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }, []);

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
      
      // Set conversation context if memory is enabled
      if (conversationMemory && conversationMemoryRef.current.length > 0) {
        const context = getConversationMemory();
        // realtimeService.current.setConversationContext(context); // Method doesn't exist yet
      }
      
      await realtimeService.current.startListening(stream);
      
      console.log('🎤 Started listening');
    } catch (error) {
      console.error('❌ Failed to start listening:', error);
      setError(error instanceof Error ? error.message : 'Failed to access microphone');
    }
  }, [isConnected, conversationMemory, getConversationMemory]);

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
        
        {isInterrupted && (
          <div className={`${styles.indicator} ${styles.interrupted}`}>
            <span className={styles.indicatorIcon}>🛑</span>
            <span className={styles.indicatorText}>Interrupted</span>
          </div>
        )}
        
        {conversationMemory && conversationHistory.length > 0 && (
          <div className={`${styles.indicator} ${styles.memory}`}>
            <span className={styles.indicatorIcon}>🧠</span>
            <span className={styles.indicatorText}>Memory: {conversationHistory.length} messages</span>
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
      
      {conversationMemory && conversationHistory.length > 0 && (
        <div className={styles.conversationHistory}>
          <h4>Conversation Memory</h4>
          <div className={styles.historyList}>
            {conversationHistory.slice(-3).map((message, index) => (
              <div key={index} className={`${styles.historyItem} ${styles[message.role]}`}>
                <span className={styles.historyRole}>{message.role}:</span>
                <span className={styles.historyContent}>{message.content.substring(0, 100)}...</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
