"use client";

import React, { useRef, useEffect, useState } from 'react';
import { enhancedTTS, TTSOptions } from '../utils/enhanced-tts';

interface SimpleMichaelAvatarProps {
  state: 'idle' | 'speaking' | 'listening' | 'thinking';
  size: 'small' | 'medium' | 'large';
  text?: string;
  onReady?: () => void;
  onError?: (error: string) => void;
  onSpeakingStart?: () => void;
  onSpeakingEnd?: () => void;
}

export const SimpleMichaelAvatar: React.FC<SimpleMichaelAvatarProps> = ({
  state,
  size,
  text,
  onReady,
  onError,
  onSpeakingStart,
  onSpeakingEnd,
}) => {
  const avatarRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const initializationRef = useRef<boolean>(false);

  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return { width: '200px', height: '200px' };
      case 'large':
        return { width: '400px', height: '400px' };
      default:
        return { width: '300px', height: '300px' };
    }
  };

  const initializeAvatar = async () => {
    // Prevent double initialization in React StrictMode
    if (initializationRef.current) {
      console.log('Avatar initialization already in progress');
      return;
    }
    
    initializationRef.current = true;

    // Initial check
    if (!avatarRef.current) {
      console.log('Avatar ref is null on initial check');
      initializationRef.current = false;
      onError?.('Avatar container not found');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Clear any existing content
      avatarRef.current.innerHTML = '';

      // Import TalkingHead dynamically to avoid SSR issues
      const { TalkingHead } = await import('../lib/talkinghead/talkinghead.mjs');

      // Check again after async import
      if (!avatarRef.current) {
        console.log('Avatar ref became null after import');
        initializationRef.current = false;
        setIsLoading(false);
        return;
      }

      // Create TalkingHead instance with minimal TTS configuration
      const head: any = new (TalkingHead as any)(avatarRef.current, {
        ttsEndpoint: '/api/tts-dummy', // Dummy endpoint to satisfy requirement
        ttsApikey: 'dummy-key',
        ttsVoice: 'he-IL-Standard-A',
        ttsRate: 1.0,
        ttsPitch: 0.0,
        ttsVolume: 1.0,
        lipsyncModules: [], // Disable lipsync to avoid webpack issues
        audioDevice: false, // Disable audio to avoid autoplay restrictions
        modelName: 'M' // Use male model
      });

      // Check again after TalkingHead creation
      if (!avatarRef.current) {
        console.log('Avatar ref became null after TalkingHead creation');
        initializationRef.current = false;
        setIsLoading(false);
        return;
      }

      // Load avatar with fallback strategy
      try {
        // Try local avatar first
        await head.showAvatar('/avatars/michael.glb');
        console.log('Local Michael avatar loaded successfully!');
      } catch (localError) {
        console.warn('Local avatar failed, trying default...', localError);
        // Fallback to default avatar
        await head.showAvatar();
        console.log('Default avatar loaded successfully!');
      }

      // Final check before storing reference
      if (!avatarRef.current) {
        console.log('Avatar ref became null before storing reference');
        initializationRef.current = false;
        setIsLoading(false);
        return;
      }

      // Store reference for state updates (with additional safety check)
      try {
        (avatarRef.current as any).talkingHead = head;
      } catch (refError) {
        console.error('Failed to store TalkingHead reference:', refError);
        initializationRef.current = false;
        setIsLoading(false);
        onError?.('Failed to store avatar reference');
        return;
      }

      setIsInitialized(true);
      setIsLoading(false);
      initializationRef.current = false; // Reset flag on success
      onReady?.();
      
    } catch (err) {
      console.error('Failed to initialize Michael avatar:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setIsLoading(false);
      initializationRef.current = false; // Reset flag on error
      onError?.(errorMessage);
    }
  };

  const speak = async (text: string) => {
    if (!text || isSpeaking) return;
    
    try {
      setIsSpeaking(true);
      onSpeakingStart?.();
      
      // Use simplified OpenAI TTS service for clear speech
      const ttsOptions: TTSOptions = {
        voice: 'onyx', // Warm male voice that's clear and friendly
        speed: 0.95,   // Increased from 0.9 for better conversational pace
        useOpenAI: true,
        characterStyle: 'university_ta',
        enhanceProsody: true,
        humanize: true,           // Enable natural human-like speech
        naturalPauses: true,      // Enable thoughtful pauses for all responses
        emotionalIntonation: false, // Keep disabled for clarity
        onStart: () => {
          console.log('🎤 Michael: Starting natural, clear speech...');
        },
        onEnd: () => {
          console.log('🤐 Michael: Finished speaking naturally');
          setIsSpeaking(false);
          onSpeakingEnd?.();
        },
        onError: (error) => {
          console.error('❌ Michael TTS Error:', error);
          setIsSpeaking(false);
          onSpeakingEnd?.();
          onError?.(error.message);
        }
      };

      await enhancedTTS.speak(text, ttsOptions);
      
    } catch (err) {
      console.error('Failed to speak:', err);
      const errorMessage = err instanceof Error ? err.message : 'Speech failed';
      setIsSpeaking(false);
      onSpeakingEnd?.();
      onError?.(errorMessage);
    }
  };

  const updateAvatarState = (newState: string) => {
    const head = (avatarRef.current as any)?.talkingHead;
    if (!head || !isInitialized) return;

    try {
      switch (newState) {
        case 'speaking':
          head.setMood?.('happy');
          // Start simple lip animation
          head.speakText?.('...');
          break;
        case 'listening':
          head.setMood?.('neutral');
          head.playGesture?.('nod', 2, false, 0);
          break;
        case 'thinking':
          head.setMood?.('neutral');
          head.playGesture?.('think', 3, false, 0);
          break;
        case 'idle':
        default:
          head.setMood?.('neutral');
          head.stopSpeaking?.();
          break;
      }
    } catch (err) {
      console.warn('Failed to update avatar state:', err);
    }
  };

  // Initialize avatar on mount
  useEffect(() => {
    initializeAvatar();

    return () => {
      // Cleanup
      initializationRef.current = false;
      
      // Stop any ongoing speech
      enhancedTTS.stop();
      
      const head = (avatarRef.current as any)?.talkingHead;
      if (head) {
        try {
          head.stop?.();
          head.resetLips?.();
        } catch (err) {
          console.warn('Error during cleanup:', err);
        }
      }
      if (avatarRef.current) {
        try {
          (avatarRef.current as any).talkingHead = null;
        } catch (err) {
          console.warn('Error clearing talkingHead reference:', err);
        }
      }
    };
  }, []);

  // Update avatar state when props change
  useEffect(() => {
    if (isInitialized) {
      updateAvatarState(state);
    }
  }, [state, isInitialized]);

  // Handle speaking when text changes
  useEffect(() => {
    if (isInitialized && text && state === 'speaking') {
      speak(text);
    }
  }, [text, state, isInitialized]);

  // Stop speaking when state changes away from speaking
  useEffect(() => {
    if (state !== 'speaking' && isSpeaking) {
      enhancedTTS.stop();
      setIsSpeaking(false);
    }
  }, [state, isSpeaking]);

  const retryInitialization = () => {
    setError(null);
    setIsInitialized(false);
    initializationRef.current = false;
    enhancedTTS.stop(); // Stop any ongoing speech
    initializeAvatar();
  };

  return (
    <div 
      style={{
        ...getSizeStyle(),
        position: 'relative',
        borderRadius: '12px',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* 3D Avatar Container */}
      <div
        ref={avatarRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(255, 255, 255, 0.9)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '4px solid #e5e7eb',
              borderTop: '4px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <div style={{ marginTop: '12px', color: '#4b5563', fontWeight: '500' }}>
            טוען את מיכל...
          </div>
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(239, 68, 68, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            padding: '20px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚠️</div>
          <div style={{ color: '#dc2626', fontWeight: '500', marginBottom: '12px' }}>
            נכשל בטעינת האווטאר
          </div>
          <div style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px' }}>
            {error}
          </div>
          <button
            onClick={retryInitialization}
            style={{
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            נסה שוב
          </button>
        </div>
      )}

      {/* State Indicator */}
      {isInitialized && !error && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '500',
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '24px',
            minHeight: '24px',
          }}
        >
          {state === 'speaking' && isSpeaking && '🗣️'}
          {state === 'speaking' && !isSpeaking && '⏳'}
          {state === 'listening' && '👂'}
          {state === 'thinking' && '🤔'}
          {state === 'idle' && '😊'}
        </div>
      )}

      {/* Audio Quality Indicator */}
      {isInitialized && !error && (
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            background: 'rgba(34, 197, 94, 0.9)',
            color: 'white',
            padding: '2px 6px',
            borderRadius: '8px',
            fontSize: '10px',
            fontWeight: '500',
            zIndex: 5,
          }}
        >
          🎤 OpenAI HD
        </div>
      )}
    </div>
  );
};

export default SimpleMichaelAvatar; 