"use client";

import React, { useRef, useEffect, useState } from 'react';

interface MichaelAvatarCoreProps {
  state: 'idle' | 'speaking' | 'listening' | 'thinking';
  size: 'small' | 'medium' | 'large';
  onReady?: () => void;
  onError?: (error: string) => void;
  onStateChange?: (state: string) => void;
}

export const MichaelAvatarCore: React.FC<MichaelAvatarCoreProps> = ({
  state,
  size,
  onReady,
  onError,
  onStateChange,
}) => {
  const avatarRef = useRef<HTMLDivElement>(null);
  const talkingHeadRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

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
    if (!avatarRef.current) {
      onError?.('Avatar container not found');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Clear any existing content
      avatarRef.current.innerHTML = '';

      // Import TalkingHead dynamically to avoid TypeScript issues
      const { TalkingHead } = await import('../lib/talkinghead/talkinghead.mjs');
      
      // Create TalkingHead instance
      const head = new (TalkingHead as any)(avatarRef.current, {
        ttsEndpoint: '', // We'll handle TTS separately
        cameraView: 'upper',
      });

      talkingHeadRef.current = head;

      // Load avatar (trying multiple fallbacks like the working example)
      try {
        // First try: local avatar
        await head.showAvatar({ url: '/avatars/michael.glb' });
        console.log('Local Michael avatar loaded successfully!');
      } catch (localError) {
        console.warn('Local avatar failed, trying default...', localError);
        // Fallback: use default avatar (minimal required object)
        await head.showAvatar({ url: '' });
        console.log('Default avatar loaded successfully!');
      }

      setIsInitialized(true);
      setIsLoading(false);
      onReady?.();
      
    } catch (err) {
      console.error('Failed to initialize Michael avatar:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setIsLoading(false);
      onError?.(errorMessage);
    }
  };

  const updateAvatarState = (newState: string) => {
    if (!talkingHeadRef.current || !isInitialized) return;

    try {
      switch (newState) {
        case 'speaking':
          talkingHeadRef.current.setMood('happy');
          break;
        case 'listening':
          talkingHeadRef.current.setMood('neutral');
          talkingHeadRef.current.playGesture('nod', 2, false, 0);
          break;
        case 'thinking':
          talkingHeadRef.current.setMood('neutral');
          talkingHeadRef.current.playGesture('think', 3, false, 0);
          break;
        case 'idle':
        default:
          talkingHeadRef.current.setMood('neutral');
          break;
      }
      onStateChange?.(newState);
    } catch (err) {
      console.warn('Failed to update avatar state:', err);
    }
  };

  // Initialize avatar on mount
  useEffect(() => {
    initializeAvatar();

    return () => {
      // Cleanup
      if (talkingHeadRef.current) {
        try {
          talkingHeadRef.current.stopSpeaking();
          talkingHeadRef.current.resetHead();
        } catch (err) {
          console.warn('Error during cleanup:', err);
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

  const retryInitialization = () => {
    setError(null);
    setIsInitialized(false);
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
          }}
        >
          {state === 'speaking' && '🗣️ מדבר'}
          {state === 'listening' && '👂 מקשיב'}
          {state === 'thinking' && '🤔 חושב'}
          {state === 'idle' && '😊 מוכן'}
        </div>
      )}
    </div>
  );
};

export default MichaelAvatarCore; 