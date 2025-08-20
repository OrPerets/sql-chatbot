"use client";

import React, { useEffect, useState, useRef } from 'react';
import MichaelSimpleAvatar from './michael-simple-avatar';

// Component that displays just the Michael avatar from your test app
const MichaelAvatarEmbed: React.FC<{ 
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

    // Timeout to fallback if loading takes too long
    const timer = setTimeout(() => {
      console.log('⏰ Michael avatar load timeout - using simple avatar');
      onError();
    }, 3000); // 3 second timeout

    const handleLoad = () => {
      console.log('✅ Michael avatar embedded successfully!');
      clearTimeout(timer);
      setIsLoaded(true);
      onLoad();
      
      // Send state to iframe if possible
      try {
        iframe.contentWindow?.postMessage({
          type: 'AVATAR_STATE',
          state: avatarState
        }, '*');
      } catch (error) {
        console.warn('Could not communicate with Michael avatar:', error);
      }
    };

    const handleError = () => {
      console.log('❌ Michael avatar not available - using simple avatar');
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

  // Send state changes to iframe
  useEffect(() => {
    if (isLoaded && iframeRef.current) {
      try {
        iframeRef.current.contentWindow?.postMessage({
          type: 'AVATAR_STATE',
          state: avatarState
        }, '*');
      } catch (error) {
        // Silently fail - not critical
      }
    }
  }, [avatarState, isLoaded]);

  return (
    <div style={{
      width: getHeight(),
      height: getHeight(),
      borderRadius: '50%',
      overflow: 'hidden',
      position: 'relative',
      background: 'transparent',
      border: 'none'
    }}>
      <iframe
        ref={iframeRef}
        src="http://localhost:3001"
        style={{
          width: '300%', // Scale up to crop the sidebar
          height: '300%',
          transform: 'translate(-33%, -33%) scale(0.4)', // Center and scale down
          border: 'none',
          borderRadius: '50%',
          transformOrigin: 'center center'
        }}
        title="Michael Avatar"
        sandbox="allow-scripts allow-same-origin"
        scrolling="no"
      />
    </div>
  );
};

interface MichaelIntegratedAvatarProps {
  avatarState: 'idle' | 'speaking' | 'listening' | 'thinking';
  size?: 'small' | 'medium' | 'large';
  className?: string;
  tryMichaelFirst?: boolean; // Whether to try the actual Michael avatar first
}

const MichaelIntegratedAvatar: React.FC<MichaelIntegratedAvatarProps> = ({ 
  avatarState, 
  size = 'medium',
  className = '',
  tryMichaelFirst = false
}) => {
  const [useMichael, setUseMichael] = useState(tryMichaelFirst);
  const [isClient, setIsClient] = useState(false);
  const [attemptedLoad, setAttemptedLoad] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleMichaelLoad = () => {
    console.log('🎉 Real Michael avatar loaded successfully!');
    setUseMichael(true);
  };

  const handleMichaelError = () => {
    console.log('📱 Using beautiful simple avatar instead');
    setUseMichael(false);
    setAttemptedLoad(true);
  };

  // Server-side fallback
  if (!isClient) {
    return <MichaelSimpleAvatar avatarState={avatarState} size={size} useIframe={false} />;
  }

  // Try real Michael avatar first if enabled
  if (useMichael && !attemptedLoad && tryMichaelFirst) {
    return (
      <div className={className}>
        <MichaelAvatarEmbed
          avatarState={avatarState}
          size={size}
          onLoad={handleMichaelLoad}
          onError={handleMichaelError}
        />
      </div>
    );
  }

  // Use beautiful simple avatar (always works)
  return (
    <div className={className}>
      <MichaelSimpleAvatar 
        avatarState={avatarState} 
        size={size} 
        useIframe={false}
      />
    </div>
  );
};

export default MichaelIntegratedAvatar; 