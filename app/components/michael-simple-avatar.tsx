"use client";

import React, { useEffect, useState, useRef } from 'react';

// Add global styles for animations
const GlobalStyles = () => (
  <style jsx global>{`
    @keyframes pulse {
      0% { transform: scale(1); }
      100% { transform: scale(1.08); }
    }
    @keyframes bounce {
      0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-10px); }
      60% { transform: translateY(-5px); }
    }
  `}</style>
);

// Simple fallback avatar with proper emoji display
const FallbackAvatar: React.FC<{ avatarState: string; size: string }> = ({ avatarState, size }) => {
  const getHeight = () => {
    switch (size) {
      case 'small': return '80px';
      case 'large': return '160px';
      default: return '120px';
    }
  };

  const getEmoji = () => {
    switch (avatarState) {
      case 'speaking': return '🗣️';
      case 'listening': return '👂';
      case 'thinking': return '🤔';
      default: return '👨‍💼';
    }
  };

  return (
    <div 
      style={{ 
        width: getHeight(), 
        height: getHeight(),
        borderRadius: '50%',
        background: `linear-gradient(135deg, 
          ${avatarState === 'speaking' ? '#22c55e' : 
            avatarState === 'thinking' ? '#a855f7' : 
            avatarState === 'listening' ? '#3b82f6' : '#6b7280'} 0%, 
          ${avatarState === 'speaking' ? '#16a34a' : 
            avatarState === 'thinking' ? '#7c3aed' : 
            avatarState === 'listening' ? '#2563eb' : '#4b5563'} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: size === 'small' ? '32px' : size === 'large' ? '48px' : '40px',
        fontWeight: 'bold',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        transform: avatarState === 'speaking' ? 'scale(1.05)' : 'scale(1)',
        transition: 'all 0.3s ease',
        border: '3px solid rgba(255, 255, 255, 0.2)',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden'
      }}
      title={`Michael is ${avatarState}`}
    >
      <span style={{
        position: 'relative',
        zIndex: 2,
        textShadow: '0 2px 4px rgba(0,0,0,0.3)'
      }}>
        {getEmoji()}
      </span>
      
      {/* Animated ring for speaking */}
      {avatarState === 'speaking' && (
        <div style={{
          position: 'absolute',
          top: '-5px',
          left: '-5px',
          right: '-5px',
          bottom: '-5px',
          borderRadius: '50%',
          border: '3px solid rgba(255, 255, 255, 0.5)',
          animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite'
        }} />
      )}
      
      {/* Pulse effect for thinking */}
      {avatarState === 'thinking' && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '6px',
          height: '6px',
          background: 'rgba(255, 255, 255, 0.8)',
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          animation: 'pulse 1.5s ease-in-out infinite'
        }} />
      )}
      
      <style jsx global>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(1.1);
            opacity: 0;
          }
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
};

// Avatar that loads from your working michael-test-app
const WorkingAvatarEmbed: React.FC<{ 
  avatarState: string; 
  size: string;
  onLoad: () => void;
  onError: () => void;
}> = ({ avatarState, size, onLoad, onError }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const getHeight = () => {
    switch (size) {
      case 'small': return '80px';
      case 'large': return '160px';
      default: return '120px';
    }
  };

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const timer = setTimeout(() => {
      console.log('❌ Iframe load timeout - using fallback');
      onError();
    }, 5000); // 5 second timeout

    const handleLoad = () => {
      console.log('✅ Michael avatar iframe loaded successfully!');
      clearTimeout(timer);
      setIsLoaded(true);
      onLoad();
    };

    const handleError = () => {
      console.error('❌ Failed to load Michael avatar iframe');
      clearTimeout(timer);
      onError();
    };

    iframe.addEventListener('load', handleLoad);
    iframe.addEventListener('error', handleError);

    return () => {
      clearTimeout(timer);
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);
    };
  }, [onLoad, onError]);

  return (
    <div style={{
      width: getHeight(),
      height: getHeight(),
      borderRadius: '50%',
      overflow: 'hidden',
      position: 'relative',
      background: '#f0f0f0',
      border: '2px solid rgba(255, 255, 255, 0.3)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)'
    }}>
      <iframe
        ref={iframeRef}
        src={`${window.location.protocol}//${window.location.hostname}:3001`}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '50%'
        }}
        title="Michael Avatar"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
};

interface MichaelSimpleAvatarProps {
  avatarState: 'idle' | 'speaking' | 'listening' | 'thinking';
  size?: 'small' | 'medium' | 'large';
  className?: string;
  useIframe?: boolean; // Option to try iframe first
}

const MichaelSimpleAvatar: React.FC<MichaelSimpleAvatarProps> = ({ 
  avatarState, 
  size = 'medium',
  className = '',
  useIframe = true
}) => {
  const [useWorking, setUseWorking] = useState(useIframe);
  const [isClient, setIsClient] = useState(false);
  const [attemptedLoad, setAttemptedLoad] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleAvatarLoad = () => {
    console.log('🎉 Working Michael avatar loaded!');
    setUseWorking(true);
  };

  const handleAvatarError = () => {
    console.log('📱 Using fallback avatar - michael-test-app not available');
    setUseWorking(false);
    setAttemptedLoad(true);
  };

  // Don't render on server side
  if (!isClient) {
    return <FallbackAvatar avatarState={avatarState} size={size} />;
  }

  // Try working avatar first (if enabled and michael-test-app is running)
  if (useWorking && !attemptedLoad && useIframe) {
    return (
      <div className={className}>
        <WorkingAvatarEmbed
          avatarState={avatarState}
          size={size}
          onLoad={handleAvatarLoad}
          onError={handleAvatarError}
        />
      </div>
    );
  }

  // Fallback to simple avatar
  return (
    <div className={className}>
      <FallbackAvatar avatarState={avatarState} size={size} />
    </div>
  );
};

export default MichaelSimpleAvatar; 