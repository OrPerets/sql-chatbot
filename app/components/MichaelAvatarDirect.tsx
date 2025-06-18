'use client';

import React, { useRef, useEffect, useState } from 'react';
import { audioManager } from '../utils/audioContextManager';
import { enhancedTTS, TTSOptions } from '../utils/enhanced-tts';

interface MichaelAvatarDirectProps {
  state: 'idle' | 'speaking' | 'listening' | 'thinking';
  size: 'small' | 'medium' | 'large';
  text?: string;
  onReady?: () => void;
  onError?: (error: string) => void;
  onSpeakingStart?: () => void;
  onSpeakingEnd?: () => void;
}

// Move forceFaceVisibleLoop to top level to fix linter error and ensure proper scoping
const forceFaceVisibleLoop = (head: any, startTime: number) => {
  if (head.scene && typeof head.scene.traverse === 'function') {
    head.scene.traverse((obj: any) => {
      if (obj.isMesh && obj.name === 'Wolf3D_Head') {
        obj.visible = true;
        if (obj.material) {
          obj.material.transparent = false;
          obj.material.opacity = 1.0;
          obj.material.needsUpdate = true;
        }
      }
    });
  }
  // Continue patching for 5 seconds to override any library modifications
  if (Date.now() - startTime < 5000) {
    requestAnimationFrame(() => forceFaceVisibleLoop(head, startTime));
  } else {
    console.log('✅ Finished forcing Wolf3D_Head mesh visible');
  }
};

export const MichaelAvatarDirect: React.FC<MichaelAvatarDirectProps> = ({
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
  const [audioUnlocked, setAudioUnlocked] = useState(true); // Auto-enable since audio is controlled by main chat interface
  const [isSpeaking, setIsSpeaking] = useState(false);
  const headRef = useRef<any>(null);
  const lastSpokenTextRef = useRef<string>('');
  const speakingInProgress = useRef<boolean>(false);
  const previousState = useRef<string>('idle');

  const getSizeStyle = () => {
    const sizes = {
      small: { width: '200px', height: '200px' },
      medium: { width: '300px', height: '300px' },
      large: { width: '400px', height: '400px' },
    };
    return sizes[size];
  };

  const initializeAvatar = async () => {
    console.log('🚀 initializeAvatar called');
    console.log('📊 avatarRef.current:', !!avatarRef.current);
    console.log('📊 headRef.current:', !!headRef.current);
    
    if (!avatarRef.current || headRef.current) {
      console.log('❌ Avatar already initialized or container not ready');
      return;
    }

    try {
      console.log('🎯 Setting loading state...');
      setIsLoading(true);
      setError(null);

      console.log('🔧 Initializing Michael avatar with direct approach...');

      // Clear container
      console.log('🧹 Clearing avatar container...');
      avatarRef.current.innerHTML = '';

      // Note: TalkingHead library has been patched to handle missing morph targets gracefully
      // No need for extensive error suppression anymore

      // Import TalkingHead module
      console.log('📦 Importing TalkingHead module...');
      const { TalkingHead } = await import('../lib/talkinghead/talkinghead.mjs');
      console.log('✅ TalkingHead module imported');

      if (!TalkingHead) {
        throw new Error('TalkingHead class not found in module');
      }
      console.log('✅ TalkingHead class found');

      // Create TalkingHead with minimal configuration but satisfy TTS requirement
      console.log('🎨 Creating TalkingHead instance...');
      console.log('📊 Container element:', avatarRef.current);
      
              const head = new (TalkingHead as any)(avatarRef.current, {
          // ⚠️ REQUIRED: TalkingHead library mandates TTS config (but we disable the actual TTS)
          ttsEndpoint: '/api/tts-dummy',
          ttsApikey: 'dummy-key', 
          ttsVoice: 'en-US-Standard-A',
          
          // Audio completely disabled
          lipsyncModules: [], // Disable lipsync to avoid missing module error
          audioDevice: false, // Disable audio device to avoid autoplay restrictions
          audioEnabled: false, // Completely disable TalkingHead audio
          useWebAudio: false, // Disable WebAudio API in TalkingHead
          
          // Visual configuration only
          cameraView: "head", // Focus on head/face area
          enableEyeBlink: false,
          enableHeadMovement: false,
          
          // Explicitly disable all audio-related features
          audioFilePlayer: false,
          speechSynthesis: false,
          microphoneEnabled: false,
        });
      console.log('✅ TalkingHead instance created:', !!head);
      
      // Register TalkingHead with audio manager
      audioManager.setTalkingHeadActive(true);
      
      headRef.current = head;
      console.log('✅ headRef set');

      // Try multiple avatar loading strategies
      console.log('🎭 Starting avatar loading process...');
      await loadAvatarWithFallbacks(head);
      console.log('✅ Avatar loading completed successfully!');

      if (head.scene && typeof head.scene.traverse === 'function') {
        head.scene.traverse((obj: any) => {
          if (obj.isMesh) {
            console.log('Mesh found:', obj.name);
          }
        });
      }

      // Start the continuous face visibility patch immediately after load
      console.log('🔧 Starting continuous face mesh visibility patch...');
      const patchStart = Date.now();
      forceFaceVisibleLoop(head, patchStart);

      // Let TalkingHead run normally - don't patch core functions to avoid breaking avatar

      console.log('🏁 Setting final state...');
      setIsInitialized(true);
      setIsLoading(false);
      onReady?.();
      
      // Note: With the patched TalkingHead library, no error suppression needed
      
      console.log('🎉 Michael avatar initialized successfully!');
      
    } catch (err) {
      console.error('💥 Failed to initialize Michael avatar:', err);
      console.error('💥 Error details:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setIsLoading(false);
      onError?.(errorMessage);
    }
  };

  const loadAvatarWithFallbacks = async (head: any) => {
    const strategies = [
      // Strategy 1: ReadyPlayer.me avatar (the one that worked before!)
      async () => {
        console.log('🎯 Trying strategy 1: ReadyPlayer.me avatar (primary)...');
        await head.showAvatar({ 
          url: 'https://models.readyplayer.me/68496fdfb85cb0b4ed9555ee.glb?morphTargets=ARKit,Oculus+Visemes&textureSizeLimit=1024&textureFormat=webp' 
        });
        console.log('✅ ReadyPlayer.me avatar loaded successfully!');
      },
      
      // Strategy 2: Simplified ReadyPlayer.me avatar (no extra params)
      async () => {
        console.log('🎯 Trying strategy 2: Simplified ReadyPlayer.me avatar...');
        await head.showAvatar({ 
          url: 'https://models.readyplayer.me/68496fdfb85cb0b4ed9555ee.glb?morphTargets=ARKit,Oculus+Visemes&textureSizeLimit=1024&textureFormat=png' 
        });
        console.log('✅ Simplified ReadyPlayer.me avatar loaded!');
      },
      
      // Strategy 3: Local Michael avatar  
      async () => {
        console.log('🎯 Trying strategy 3: Local Michael avatar...');
        await head.showAvatar({ url: '/michael.glb' });
        console.log('✅ Local Michael avatar loaded!');
      },
      
      // Strategy 4: Backup ReadyPlayer.me avatar
      async () => {
        console.log('🎯 Trying strategy 4: Backup avatar...');
        await head.showAvatar({ 
          url: 'https://models.readyplayer.me/64f1a714ce16e342a8cddd5d.glb?morphTargets=ARKit,Oculus+Visemes&textureSizeLimit=1024&textureFormat=png' 
        });
        console.log('✅ Backup avatar loaded!');
      },
      
      // Strategy 5: Alternative ReadyPlayer.me avatar (different model)
      async () => {
        console.log('🎯 Trying strategy 5: Alternative avatar...');
        await head.showAvatar({ 
          url: 'https://models.readyplayer.me/668c7f110b64c8bc6b1b0a65.glb?morphTargets=ARKit,Oculus+Visemes&textureSizeLimit=1024&textureFormat=webp' 
        });
        console.log('✅ Alternative avatar loaded!');
      },
      
      // Strategy 6: Basic avatar from external source
      async () => {
        console.log('🎯 Trying strategy 6: Basic external avatar...');
        await head.showAvatar({ 
          url: 'https://github.com/mrdoob/three.js/raw/dev/examples/models/gltf/RobotExpressive/RobotExpressive.glb'
        });
        console.log('✅ Basic external avatar loaded!');
      }
    ];

    console.log(`🚀 Starting avatar loading with ${strategies.length} strategies...`);
    
    let lastError;
    for (let i = 0; i < strategies.length; i++) {
      try {
        console.log(`📊 Attempting strategy ${i + 1}/${strategies.length}...`);
        
        // Add timeout to prevent hanging
        const strategyPromise = strategies[i]();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Strategy timeout (30s)')), 30000);
        });
        
        await Promise.race([strategyPromise, timeoutPromise]);
        console.log(`🎉 Strategy ${i + 1} succeeded! Avatar loading complete.`);
        return; // Success, exit function
      } catch (err) {
        console.warn(`❌ Strategy ${i + 1} failed:`, err.message);
        console.warn('Full error details:', err);
        lastError = err;
        continue; // Try next strategy
      }
    }
    
    // If all strategies failed
    console.error('💥 All avatar loading strategies failed!');
    throw new Error(`All avatar loading strategies failed. Last error: ${lastError?.message}`);
  };

  const speak = async (text: string) => {
    console.log('🎯 speak() called with text:', text?.substring(0, 100) + '...');
    if (!text || !text.trim()) {
      console.log('❌ No text provided to speak');
      return;
    }
    
    // Check if audio is unlocked
    if (!audioUnlocked) {
      console.log('🔒 Audio not unlocked yet, skipping speech');
      return;
    }
    
    // Check to prevent any overlapping audio
    const isEnhancedTTSSpeaking = enhancedTTS.isSpeaking();
    
    if (isSpeaking || speakingInProgress.current || isEnhancedTTSSpeaking) {
      console.log('🚫 BLOCKING: Audio protection active', {
        isSpeaking,
        speakingInProgress: speakingInProgress.current,
        enhancedTTSSpeaking: isEnhancedTTSSpeaking
      });
      return; // HARD STOP - don't even try to stop and restart
    }
    
    // Set the text we're about to speak BEFORE starting
    lastSpokenTextRef.current = text;
    
    // Mark that we're starting a speech operation
    speakingInProgress.current = true;
    
    try {
      console.log('🎤 Starting OpenAI TTS speech process...');
      setIsSpeaking(true);
      lastSpokenTextRef.current = text;
      onSpeakingStart?.();
      
      // For OpenAI TTS, we don't need the audio context manager
      // since we're using HTML5 Audio element, not speechSynthesis
      console.log('🎧 Using OpenAI TTS - bypassing audio context manager...');
      
      // Use enhanced OpenAI TTS service
      const ttsOptions: TTSOptions = {
        voice: 'echo', // Deep male voice perfect for Michael
        speed: 0.95,
        useOpenAI: true,
        characterStyle: 'university_ta',
        enhanceProsody: true,
        onStart: () => {
          console.log('🎤 Michael: Starting OpenAI TTS speech...');
        },
                 onEnd: () => {
           console.log('🤐 Michael: OpenAI TTS speech ended');
           setIsSpeaking(false);
           speakingInProgress.current = false;
           onSpeakingEnd?.();
         },
         onError: (error) => {
           console.error('❌ Michael OpenAI TTS Error:', error);
           setIsSpeaking(false);
           speakingInProgress.current = false;
           onSpeakingEnd?.();
           onError?.(error.message);
         }
      };

      await enhancedTTS.speak(text, ttsOptions);
      
    } catch (err) {
      console.error('💥 Failed to speak with OpenAI TTS:', err);
      const errorMessage = err instanceof Error ? err.message : 'Speech failed';
      setIsSpeaking(false);
      speakingInProgress.current = false;
      onSpeakingEnd?.();
      onError?.(errorMessage);
    }
  };



  const updateAvatarState = (newState: string) => {
    if (!headRef.current || !isInitialized) return;

    try {
      switch (newState) {
        case 'speaking':
          headRef.current.setMood?.('happy');
          break;
        case 'listening':
          headRef.current.setMood?.('neutral');
          headRef.current.playGesture?.('nod', 2, false, 0);
          break;
        case 'thinking':
          headRef.current.setMood?.('neutral');
          headRef.current.playGesture?.('think', 3, false, 0);
          break;
        case 'idle':
        default:
          headRef.current.setMood?.('neutral');
          break;
      }
    } catch (err) {
      console.warn('Failed to update avatar state:', err);
    }
  };

  // Initialize on mount
  useEffect(() => {
    console.log('🌟 MichaelAvatarDirect useEffect mounted!');
    
    let handleVoicesChanged: (() => void) | null = null;
    
    // Skip global error handler - use only console.error suppression during init
    
    // Initialize OpenAI TTS service
    console.log('🔊 Setting up OpenAI TTS service...');
    console.log('✅ OpenAI TTS service ready');
    
    console.log('🎯 About to call initializeAvatar...');
    initializeAvatar();

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up MichaelAvatarDirect...');
      
      // Stop OpenAI TTS and release audio resources
      enhancedTTS.stop();
      setIsSpeaking(false);
      speakingInProgress.current = false;
      audioManager.releaseSpeechAccess();
      audioManager.setTalkingHeadActive(false);
      
      // Cleanup avatar
      if (headRef.current) {
        try {
          headRef.current.stop?.();
        } catch (err) {
          console.warn('Error during avatar cleanup:', err);
        }
      }
      headRef.current = null;
    };
  }, []);

  // Update state when props change
  useEffect(() => {
    if (isInitialized) {
      updateAvatarState(state);
      
      // Stop speaking when state changes away from speaking
      if (state !== 'speaking') {
        if (isSpeaking) {
          console.log('🛑 State changed away from speaking, stopping audio');
          enhancedTTS.stop();
          setIsSpeaking(false);
          speakingInProgress.current = false;
        }
        // Only reset lastSpokenTextRef when we're definitely not in speaking state
        if (state === 'idle') {
          console.log('🔄 Resetting lastSpokenTextRef because state is idle');
          lastSpokenTextRef.current = '';
        }
      }
      
      // Show a console message to guide users to enable audio
      if (!audioUnlocked) {
        console.log('🔔 IMPORTANT: Audio control is handled by the main chat interface');
      }
    }
  }, [state, isInitialized, audioUnlocked, isSpeaking]);

  // Track when text actually changes to reset spoken text tracking
  useEffect(() => {
    if (text && text !== lastSpokenTextRef.current) {
      console.log('📝 Text prop changed, ready for new speech:', {
        newText: text?.substring(0, 50) + '...',
        oldText: lastSpokenTextRef.current?.substring(0, 50) + '...'
      });
      // Don't reset lastSpokenTextRef here - let the speech function handle it
    }
  }, [text]);

  // Handle speaking when state or text changes
  useEffect(() => {
    const stateChanged = previousState.current !== state;
    const isTransitionToSpeaking = previousState.current !== 'speaking' && state === 'speaking';
    
    console.log('🎯 Speech trigger useEffect:', { 
      isInitialized, 
      hasText: !!text, 
      textLength: text?.length || 0,
      state, 
      previousState: previousState.current,
      stateChanged,
      isTransitionToSpeaking,
      isSpeaking,
      audioUnlocked,
      textPreview: text?.substring(0, 50) + '...',
      lastSpokenText: lastSpokenTextRef.current?.substring(0, 30) + '...'
    });
    
    // Update previous state
    previousState.current = state;
    
    // Only speak when transitioning TO speaking state with new text
    if (isTransitionToSpeaking && isInitialized && text && audioUnlocked) {
      // Check if this is new text
      if (lastSpokenTextRef.current === text) {
        console.log('🔄 Same text as before, not speaking again');
        return;
      }
      
      // Check if audio is already playing
      if (isSpeaking || speakingInProgress.current || enhancedTTS.isSpeaking()) {
        console.log('🚫 Audio already playing, not starting new speech');
        return;
      }
      
      console.log('✅ Transitioning to speaking state with new text - starting speech');
      speak(text);
    }
  }, [text, state, isInitialized, audioUnlocked]);

  const retryInitialization = () => {
    setError(null);
    setIsInitialized(false);
    headRef.current = null;
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


      
      {/* {audioUnlocked && isInitialized && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'rgba(34, 197, 94, 0.9)',
            color: 'white',
            border: 'none',
            padding: '6px 10px',
            borderRadius: '16px',
            fontSize: '11px',
            fontWeight: '500',
            zIndex: 15,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          🔊 קול פעיל
        </div>
      )} */}



      {/* Speaking Indicator */}
      {isSpeaking && audioUnlocked && (
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(76, 175, 80, 0.9)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: '600',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'white',
              animation: 'blink 1s ease-in-out infinite',
            }}
          />
          🗣️ מייקל מדבר...
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(255, 255, 255, 0.95)',
            padding: '20px',
            borderRadius: '15px',
            fontSize: '16px',
            fontWeight: '600',
            color: '#666',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
          }}
        >
          <div
            style={{
              width: '20px',
              height: '20px',
              border: '3px solid #f3f3f3',
              borderTop: '3px solid #4CAF50',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          טוען את מייקל...
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(244, 67, 54, 0.95)',
            color: 'white',
            padding: '16px 20px',
            borderRadius: '15px',
            fontSize: '14px',
            fontWeight: '600',
            zIndex: 10,
            textAlign: 'center',
            maxWidth: '80%',
            boxShadow: '0 4px 15px rgba(244, 67, 54, 0.3)',
          }}
        >
          <div style={{ marginBottom: '12px' }}>⚠️ שגיאה בטעינת מייקל</div>
          <button
            onClick={retryInitialization}
            style={{
              background: 'white',
              color: '#f44336',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            נסה שוב
          </button>
        </div>
      )}





      {/* Add CSS animations */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}; 