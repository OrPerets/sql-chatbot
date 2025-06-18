"use client";

import React, { useState, useEffect, useRef } from 'react';
import MichaelChatAvatar from './michael-chat-avatar';
import dynamic from 'next/dynamic';

// Dynamically import the 3D avatar component to avoid SSR issues
const SimpleMichaelAvatar = dynamic(() => import('./SimpleMichaelAvatar'), {
  ssr: false,
  loading: () => <div style={{ 
    width: '300px', 
    height: '300px', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
    borderRadius: '12px',
    color: '#6b7280'
  }}>טוען...</div>
});

interface SmartMichaelAvatarProps {
  // Current avatar props
  text?: string;
  autoPlay?: boolean;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  isListening?: boolean;
  isThinking?: boolean;
  className?: string;
  size?: 'small' | 'medium' | 'large';
  
  // New props for smart behavior
  preferMichael?: boolean;
  fallbackToLottie?: boolean;
  loadTimeout?: number;
}

export const SmartMichaelAvatar: React.FC<SmartMichaelAvatarProps> = ({
  text,
  autoPlay = false,
  onSpeechStart,
  onSpeechEnd,
  isListening = false,
  isThinking = false,
  className = '',
  size = 'medium',
  preferMichael = true,
  fallbackToLottie = true,
  loadTimeout = 5000,
}) => {
  const [avatarMode, setAvatarMode] = useState<'loading' | '3d' | 'lottie' | 'error'>('loading');
  const [michael3DReady, setMichael3DReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Determine avatar state for 3D avatar
  const getAvatarState = (): 'idle' | 'speaking' | 'listening' | 'thinking' => {
    if (isThinking) return 'thinking';
    if (isListening) return 'listening';
    if (text && autoPlay) return 'speaking';
    return 'idle';
  };

  // Handle 3D avatar ready
  const handle3DAvatarReady = () => {
    console.log('3D Michael avatar ready!');
    setMichael3DReady(true);
    setAvatarMode('3d');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Handle 3D avatar error
  const handle3DAvatarError = (error: string) => {
    console.warn('3D Michael avatar failed:', error);
    setErrorMessage(error);
    
    if (fallbackToLottie) {
      console.log('Falling back to Lottie avatar');
      setAvatarMode('lottie');
    } else {
      setAvatarMode('error');
    }
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Initialize avatar loading logic
  useEffect(() => {
    if (!preferMichael) {
      setAvatarMode('lottie');
      return;
    }

    // Set a timeout for 3D avatar loading
    timeoutRef.current = setTimeout(() => {
      if (!michael3DReady && fallbackToLottie) {
        console.log('3D avatar loading timeout, falling back to Lottie');
        setAvatarMode('lottie');
      } else if (!michael3DReady) {
        setAvatarMode('error');
      }
    }, loadTimeout);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [preferMichael, fallbackToLottie, loadTimeout, michael3DReady]);

  // Render loading state
  if (avatarMode === 'loading') {
    return (
      <div className={className} style={{ position: 'relative' }}>
        {/* Try to load 3D avatar */}
                 <div style={{ opacity: 0, position: 'absolute', pointerEvents: 'none' }}>
           <SimpleMichaelAvatar
             state={getAvatarState()}
             size={size}
             text={text}
             onReady={handle3DAvatarReady}
             onError={handle3DAvatarError}
             onSpeakingStart={onSpeechStart}
             onSpeakingEnd={onSpeechEnd}
           />
         </div>
        
        {/* Show loading indicator */}
        <div style={{
          width: size === 'small' ? '200px' : size === 'large' ? '400px' : '300px',
          height: size === 'small' ? '200px' : size === 'large' ? '400px' : '300px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
          borderRadius: '12px',
          color: '#6b7280'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '12px'
          }} />
          <div style={{ fontWeight: '500' }}>טוען את מיכל...</div>
          <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>
            {fallbackToLottie ? 'יתבצע מעבר אוטומטי אם נדרש' : 'אנא המתן...'}
          </div>
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // Render 3D avatar
  if (avatarMode === '3d') {
         return (
       <div className={className}>
         <SimpleMichaelAvatar
           state={getAvatarState()}
           size={size}
           text={text}
           onReady={handle3DAvatarReady}
           onError={handle3DAvatarError}
           onSpeakingStart={onSpeechStart}
           onSpeakingEnd={onSpeechEnd}
         />
       </div>
     );
  }

  // Render Lottie fallback
  if (avatarMode === 'lottie') {
    return (
      <div className={className}>
        <MichaelChatAvatar
          text={text}
          autoPlay={autoPlay}
          onSpeechStart={onSpeechStart}
          onSpeechEnd={onSpeechEnd}
          isListening={isListening}
          isThinking={isThinking}
          size={size}
        />
        
        {/* Subtle indicator that this is fallback mode */}
        <div style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          background: 'rgba(0, 0, 0, 0.5)',
          color: 'white',
          padding: '2px 6px',
          borderRadius: '8px',
          fontSize: '10px',
          fontWeight: '500',
          opacity: 0.7
        }}>
          2D
        </div>
      </div>
    );
  }

  // Render error state
  return (
    <div className={className}>
      <div style={{
        width: size === 'small' ? '200px' : size === 'large' ? '400px' : '300px',
        height: size === 'small' ? '200px' : size === 'large' ? '400px' : '300px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
        borderRadius: '12px',
        color: '#dc2626',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚠️</div>
        <div style={{ fontWeight: '500', marginBottom: '8px' }}>
          נכשל בטעינת האווטאר
        </div>
        <div style={{ fontSize: '12px', opacity: 0.8 }}>
          {errorMessage}
        </div>
      </div>
    </div>
  );
};

export default SmartMichaelAvatar; 