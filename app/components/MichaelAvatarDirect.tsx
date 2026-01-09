'use client';

import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { audioManager } from '../utils/audioContextManager';
import { enhancedTTS, TTSOptions } from '../utils/enhanced-tts';

interface MichaelAvatarDirectProps {
  state?: 'idle' | 'speaking' | 'listening' | 'thinking' | 'userWriting';
  size?: 'small' | 'medium' | 'large';
  text?: string;
  onReady?: () => void;
  onError?: (error: string) => void;
  onSpeakingStart?: () => void;
  onSpeakingEnd?: () => void;
  onAvatarLoaded?: () => void;
  progressiveMode?: boolean;
  isStreaming?: boolean;
  enableGestureQueue?: boolean;
  maxQueueSize?: number;
  onGestureStarted?: (gesture: string) => void;
  onGestureCompleted?: (gesture: string) => void;
}

export interface MichaelAvatarDirectRef {
  setMood: (mood: string) => void;
  playGesture: (gesture: string, duration?: number, mirror?: boolean, transitionMs?: number) => void;
  queueGesture: (gesture: string, duration?: number, mirror?: boolean, transitionMs?: number, priority?: 'low' | 'normal' | 'high') => void;
  clearGestureQueue: () => void;
  getGestureQueue: () => QueuedGesture[];
  lookAt: (x: number | null, y: number | null, duration?: number) => void;
  lookAtCamera: (duration?: number) => void;
  setState: (state: 'idle' | 'speaking' | 'listening' | 'thinking' | 'userWriting') => void;
}

interface QueuedGesture {
  id: string;
  gesture: string;
  duration: number;
  mirror: boolean;
  transitionMs: number;
  priority: 'low' | 'normal' | 'high';
  timestamp: number;
}

// Move forceFaceVisibleLoop to top level to fix linter error and ensure proper scoping
const forceFaceVisibleLoop = (head: any, startTime: number) => {
  if (head.scene && typeof head.scene.traverse === 'function') {
    head.scene.traverse((obj: any) => {
      if (obj && obj.isMesh && obj.name && obj.name === 'Wolf3D_Head') {
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

const MichaelAvatarDirect = forwardRef<MichaelAvatarDirectRef, MichaelAvatarDirectProps>(({
  state = 'idle',
  size = 'large',
  text,
  onReady,
  onError,
  onSpeakingStart,
  onSpeakingEnd,
  onAvatarLoaded,
  progressiveMode = false,
  isStreaming = false,
  enableGestureQueue = true,
  maxQueueSize = 5,
  onGestureStarted,
  onGestureCompleted,
}, ref) => {
  // AVATAR DISABLED: Early return to prevent any execution
  // Return null immediately to prevent any avatar code from running
  if (typeof window === 'undefined' || process.env.NEXT_PUBLIC_AVATAR_ENABLED !== '1') {
    // Set up a minimal ref interface to prevent errors
    useImperativeHandle(ref, () => ({
      setMood: () => {},
      playGesture: () => {},
      queueGesture: () => {},
      clearGestureQueue: () => {},
      getGestureQueue: () => [],
      lookAt: () => {},
      lookAtCamera: () => {},
      setState: () => {},
    }), []);
    return null;
  }
  const avatarRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(true); // Auto-enable since audio is controlled by main chat interface
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const headRef = useRef<any>(null);
  const lastSpokenTextRef = useRef<string>('');
  const speakingInProgress = useRef<boolean>(false);
  const previousState = useRef<string>('idle');
  const thinkingAnimationRef = useRef<NodeJS.Timeout | null>(null);
  const speakingAnimationRef = useRef<NodeJS.Timeout | null>(null);
  const currentStateRef = useRef<string>('idle'); // Track current state for intervals
  const previousTalkingHeadRef = useRef<any>(null); // Track TalkingHead object changes

  // Progressive speech state (simplified)
  const [currentlySpeakingText, setCurrentlySpeakingText] = useState<string>('');

  // Gesture queue system
  const [gestureQueue, setGestureQueue] = useState<QueuedGesture[]>([]);
  const [isPlayingGesture, setIsPlayingGesture] = useState(false);
  const gestureQueueRef = useRef<QueuedGesture[]>([]);
  const currentGestureRef = useRef<QueuedGesture | null>(null);
  const gestureTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getSizeStyle = () => {
    const sizes = {
      small: { width: '200px', height: '200px' },
      medium: { width: '300px', height: '300px' },
      large: { width: '400px', height: '400px' },
    };
    return sizes[size];
  };

  const initializeAvatar = async () => {
    const avatarFeature = typeof window !== 'undefined' && (process.env.NEXT_PUBLIC_AVATAR_ENABLED === '1' || process.env.NODE_ENV === 'development');
    if (!avatarFeature) {
      console.log('⚠️ Avatar feature disabled via flag');
      return;
    }
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
          
          // Audio configuration - allow minimal audio for gesture sync
          lipsyncModules: [], // Disable lipsync to avoid missing module error
          audioDevice: false, // Disable audio device to avoid autoplay restrictions
          audioEnabled: false, // Completely disable TalkingHead audio
          useWebAudio: false, // Disable WebAudio API in TalkingHead
          
          // Visual configuration - enable gestures and animations
          dracoEnabled: true,
          cameraView: "full", // Focus on head/face area
          enableEyeBlink: true,
          enableHeadMovement: true, // Enable head movement for better gesture support
          enableGestures: true, // Explicitly enable gestures
          // Performance tuning
          modelFPS: 24,
          pixelRatio: 1,
          antialias: false,
          
          // Avatar body configuration for proper gesture support
          body: 'M', // Male body for proper gesture animation
          modelRoot: 'Armature', // Ensure it looks for the correct armature
          
          // Explicitly disable all audio-related features while keeping visual ones
          audioFilePlayer: false,
          speechSynthesis: false,
          microphoneEnabled: false,
        });
      console.log('✅ TalkingHead instance created:', !!head);
      // Ensure renderer pixel ratio is 1 for performance
      try {
        if ((head as any).renderer && typeof (head as any).renderer.setPixelRatio === 'function') {
          (head as any).renderer.setPixelRatio(1);
        }
      } catch {}
      
      // Register TalkingHead with audio manager
      audioManager.setTalkingHeadActive(true);
      
      headRef.current = head;
      console.log('✅ headRef set');

      // Prefer a robust ReadyPlayer.me avatar with ARKit morph targets
      console.log('🎭 Loading ReadyPlayer.me avatar with ARKit morph targets...');
      try {
        await head.showAvatar({ 
          url: 'https://models.readyplayer.me/68496fdfb85cb0b4ed9555ee.glb?morphTargets=ARKit,Oculus+Visemes&textureSizeLimit=1024&textureFormat=webp',
          body: 'M',
          avatarMood: 'neutral'
        });
        console.log('✅ RPM avatar loaded');
      } catch (rpmErr) {
        console.warn('⚠️ RPM load failed, trying local avatar with blink disabled', rpmErr);
        try {
          await head.showAvatar({ url: '/michael.glb', body: 'M', avatarMood: 'neutral' });
          // Disable blink morph usage to prevent eyeBlinkLeft/Right errors on models lacking these targets
          try {
            (head as any).enableEyeBlink = false as any;
            if ((head as any).limits) {
              (head as any).limits.eyeBlinkLeft = () => ({ value: 0 });
              (head as any).limits.eyeBlinkRight = () => ({ value: 0 });
            }
          } catch {}
          console.log('✅ Local avatar loaded with blink disabled');
        } catch (localErr) {
          console.error('💥 Local avatar load failed, falling back to default:', localErr);
          await head.showAvatar({ body: 'M', avatarMood: 'neutral' });
          try { (head as any).enableEyeBlink = false as any; } catch {}
        }
      }
      console.log('✅ Avatar loading completed successfully!');

      if (head.scene && typeof head.scene.traverse === 'function') {
        head.scene.traverse((obj: any) => {
          if (obj && obj.isMesh && obj.name) {
            console.log('Mesh found:', obj.name || 'unnamed');
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

      // Comprehensive gesture capability debugging
      console.log('🔍 TalkingHead instance methods:', Object.getOwnPropertyNames(head).filter((name: string) => name && typeof head[name] === 'function'));
      console.log('🔍 TalkingHead prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(head)).filter((name: string) => name && typeof head[name] === 'function'));
      console.log('🔍 Available setMood:', typeof head.setMood === 'function');
      console.log('🔍 Available playGesture:', typeof head.playGesture === 'function');
      console.log('🔍 Available stopGesture:', typeof head.stopGesture === 'function');
      
      // Check gesture-related properties
      console.log('🔍 Avatar armature available:', !!head.armature);
      console.log('🔍 Avatar gestureTemplates available:', !!head.gestureTemplates);
      console.log('🔍 Avatar animEmojis available:', !!head.animEmojis);
      
      if (head.gestureTemplates) {
        console.log('🔍 Available gesture templates:', Object.keys(head.gestureTemplates));
      }
      
      if (head.animEmojis) {
        console.log('🔍 Available animated emojis:', Object.keys(head.animEmojis));
      }
      
      // Test gesture functionality immediately after avatar load
      console.log('🧪 Testing gesture functionality...');
      if (typeof head.playGesture === 'function') {
        try {
          // Wait a bit for avatar to fully load before testing gestures
          setTimeout(() => {
            try {
              console.log('🎭 Testing initial gesture: handup');
              // Test another gesture after a delay
              setTimeout(() => {
                if (typeof head.playGesture === 'function' && head.armature) {
                  console.log('🎭 Testing delayed gesture: thumbup');
                  head.playGesture('namaste', 2, false, 1000);
                  console.log('✅ Delayed gesture test successful');
                }
              }, 1000);
            } catch (gestureError) {
              console.error('❌ Gesture test failed:', gestureError);
            }
          }, 1000); // Wait 2 seconds for avatar to fully initialize
        } catch (gestureError) {
          console.error('❌ Gesture test setup failed:', gestureError);
        }
      } else {
        console.error('❌ playGesture method not available after avatar load!');
      }
      
      // Force gesture system initialization if it's not ready
      setTimeout(() => {
        if (head && !head.armature) {
          console.log('🔧 Attempting to force initialize gesture system...');
          // Try to trigger armature initialization
          if (head.scene && head.scene.children && head.scene.children.length > 0) {
            console.log('🔧 Scene has children, attempting to find armature...');
            head.scene.traverse((obj: any) => {
              if (obj && (obj.type === 'SkinnedMesh' || (obj.name && typeof obj.name === 'string' && obj.name.includes('Armature')) || obj.isSkinnedMesh)) {
                console.log('🔧 Found potential armature object:', (obj && obj.name) || 'unnamed', obj.type);
                if (obj.skeleton) {
                  console.log('🔧 Setting armature from skeleton');
                  head.armature = obj.skeleton.bones[0];
                }
              }
            });
          }
          
          // Force a small test gesture after armature setup
          if (head.armature && typeof head.playGesture === 'function') {
            console.log('🎭 Force testing gesture after armature setup');
            head.playGesture('handup', 1, false, 500);
          }
        }
      }, 5000); // Wait 5 seconds for full initialization
      
      onReady?.();
      onAvatarLoaded?.();
      
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
      // Strategy 1: ReadyPlayer.me avatar with optimal gesture support
      async () => {
        console.log('🎯 Trying strategy 1: ReadyPlayer.me avatar with gesture support...');
        await head.showAvatar({ 
          url: 'https://models.readyplayer.me/68496fdfb85cb0b4ed9555ee.glb?morphTargets=ARKit,Oculus+Visemes&textureSizeLimit=1024&textureFormat=webp',
          body: 'M', // Ensure male body for gesture compatibility
          lipsyncLang: 'en',
          avatarMood: 'neutral',
          modelDynamicBones: true // Enable dynamic bones for better gestures
        });
        console.log('✅ ReadyPlayer.me avatar with gesture support loaded successfully!');
      },
      
      // Strategy 2: Simplified ReadyPlayer.me avatar with ARKit support
      async () => {
        console.log('🎯 Trying strategy 2: Simplified ReadyPlayer.me avatar...');
        await head.showAvatar({ 
          url: 'https://models.readyplayer.me/68496fdfb85cb0b4ed9555ee.glb?morphTargets=ARKit&textureSizeLimit=1024&textureFormat=png',
          body: 'M',
          avatarMood: 'neutral'
        });
        console.log('✅ Simplified ReadyPlayer.me avatar loaded!');
      },
      
      // Strategy 3: Local Michael avatar with proper configuration
      async () => {
        console.log('🎯 Trying strategy 3: Local Michael avatar...');
        await head.showAvatar({ 
          url: '/michael.glb',
          body: 'M',
          avatarMood: 'neutral'
        });
        console.log('✅ Local Michael avatar loaded!');
      },
      
      // Strategy 4: Backup ReadyPlayer.me avatar
      async () => {
        console.log('🎯 Trying strategy 4: Backup avatar...');
        await head.showAvatar({ 
          url: 'https://models.readyplayer.me/64f1a714ce16e342a8cddd5d.glb?morphTargets=ARKit,Oculus+Visemes&textureSizeLimit=1024&textureFormat=png',
          body: 'M',
          avatarMood: 'neutral'
        });
        console.log('✅ Backup avatar loaded!');
      },
      
      // Strategy 5: Alternative ReadyPlayer.me avatar (different model)
      async () => {
        console.log('🎯 Trying strategy 5: Alternative avatar...');
        await head.showAvatar({ 
          url: 'https://models.readyplayer.me/668c7f110b64c8bc6b1b0a65.glb?morphTargets=ARKit,Oculus+Visemes&textureSizeLimit=1024&textureFormat=webp',
          body: 'M',
          avatarMood: 'neutral'
        });
        console.log('✅ Alternative avatar loaded!');
      },
      
      // Strategy 6: Fallback to default avatar with gesture support
      async () => {
        console.log('🎯 Trying strategy 6: Default avatar with gestures...');
        await head.showAvatar({
          body: 'M',
          avatarMood: 'neutral'
        });
        console.log('✅ Default avatar with gestures loaded!');
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
    console.log('🎯 Progressive mode:', progressiveMode, 'Is streaming:', isStreaming);
    
    if (!text || !text.trim()) {
      console.log('❌ No text provided to speak');
      return;
    }
    
    // Check if audio is unlocked
    if (!audioUnlocked) {
      console.log('🔒 Audio not unlocked yet, skipping speech');
      return;
    }

    // Progressive speech handling - let enhanced TTS handle the logic
    if (progressiveMode) {
      console.log('🔄 PROGRESSIVE: Delegating to enhanced TTS service');
      // The enhanced TTS service will handle progressive speech internally
    }
    
    // Check to prevent any overlapping audio (unless in progressive mode)
    const isEnhancedTTSSpeaking = enhancedTTS.isSpeaking();
    
    if (!progressiveMode && (isSpeaking || speakingInProgress.current || isEnhancedTTSSpeaking)) {
      console.log('🚫 BLOCKING: Audio protection active', {
        isSpeaking,
        speakingInProgress: speakingInProgress.current,
        enhancedTTSSpeaking: isEnhancedTTSSpeaking,
        progressiveMode
      });
      return; // HARD STOP - don't even try to stop and restart
    }
    
    // Set the text we're about to speak BEFORE starting
    lastSpokenTextRef.current = text;
    setCurrentlySpeakingText(text);
    
    // Mark that we're starting a speech operation
    speakingInProgress.current = true;
    
    try {
      console.log('🎤 Starting OpenAI TTS speech process...');
      lastSpokenTextRef.current = text;
      
      // For OpenAI TTS, we don't need the audio context manager
      // since we're using HTML5 Audio element, not speechSynthesis
      console.log('🎧 Using OpenAI TTS - bypassing audio context manager...');
      
      // Use enhanced TTS with progressive mode support
      const ttsOptions: TTSOptions = {
        voice: 'onyx', // Warm male voice that's clear and friendly
        speed: 0.95,   // Increased from 0.9 for better conversational pace
        useOpenAI: true,
        characterStyle: 'university_ta',
        enhanceProsody: true,    // Re-enabled for better speech rhythm
        humanize: true,          // Enable natural human-like variations
        naturalPauses: true,     // Enable thoughtful pauses between sentences
        emotionalIntonation: false, // Keep disabled for clarity
        progressiveMode: progressiveMode, // Enable progressive speech if requested
        onStart: () => {
          console.log('🎤 Michael: Starting natural TTS speech...');
          setIsSpeaking(true);
          onSpeakingStart?.();
        },
        onEnd: () => {
          console.log('🤐 Michael: TTS speech ended naturally');
          setIsSpeaking(false);
          speakingInProgress.current = false;
          // Clear speaking animations when speech ends
          if (speakingAnimationRef.current) {
            clearInterval(speakingAnimationRef.current);
            speakingAnimationRef.current = null;
          }
          onSpeakingEnd?.();
          setCurrentlySpeakingText('');
        },
        onError: (error) => {
          console.error('❌ Michael TTS Error:', error);
          setIsSpeaking(false);
          speakingInProgress.current = false;
          // Clear speaking animations on error
          if (speakingAnimationRef.current) {
            clearInterval(speakingAnimationRef.current);
            speakingAnimationRef.current = null;
          }
          onSpeakingEnd?.();
          setCurrentlySpeakingText('');
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
      setCurrentlySpeakingText('');
      onError?.(errorMessage);
    }
  };

  const updateAvatarState = (newState: string) => {
    console.log(`🎭 updateAvatarState called with: ${newState}`, {
      isInitialized,
      hasHeadRef: !!headRef.current,
      currentState: state,
      previousState: previousState.current
    });
    
    // Update current state ref for intervals
    currentStateRef.current = newState;
    previousState.current = newState;
    
    if (!headRef.current || !isInitialized) {
      console.log('❌ Avatar not ready for state update');
      return;
    }

    // Clear any existing animation intervals
    if (thinkingAnimationRef.current) {
      clearInterval(thinkingAnimationRef.current);
      thinkingAnimationRef.current = null;
      console.log('🧹 Cleared thinking animation interval');
    }
    if (speakingAnimationRef.current) {
      clearInterval(speakingAnimationRef.current);
      speakingAnimationRef.current = null;
      console.log('🧹 Cleared speaking animation interval');
    }

    try {
      switch (newState) {
        case 'speaking':
          console.log('🗣️ Setting up speaking animations');
          setIsThinking(false);
          
          // Test basic mood change first
          console.log('🎭 Setting mood to happy');
          try {
            if (typeof headRef.current.setMood === 'function') {
              headRef.current.setMood('happy');
              console.log('✅ Mood set to happy successfully');
            } else {
              console.error('❌ setMood method not available');
            }
          } catch (moodError) {
            console.error('❌ Error setting mood:', moodError);
          }
          
          // Enhanced gesture testing with proper validation
          console.log('🎭 Attempting speaking gesture: handup');
          try {
            if (typeof headRef.current.playGesture === 'function') {
              headRef.current.playGesture('handup', 2, false, 1000);
              console.log('✅ Speaking gesture handup executed successfully');
            } else {
              console.error('❌ playGesture method not available for speaking');
            }
          } catch (gestureError) {
            console.error('❌ Error playing speaking gesture:', gestureError);
          }
          
          // Set up interval for repeated gestures with better error handling
          const startSpeakingAnimation = () => {
            console.log('🎭 Speaking interval triggered', { 
              currentState: currentStateRef.current, 
              isSpeaking, 
              hasHead: !!headRef.current,
              headRefExists: !!headRef.current,
              intervalExists: !!speakingAnimationRef.current
            });
            
            // Very simple check - just check if we have headRef
            if (headRef.current) {
              console.log('🎭 Speaking interval: Attempting gesture');
              try {
                if (typeof headRef.current.playGesture === 'function') {
                  // Use available gestures from the library
                  const gestures = ['handup', 'index', 'ok', 'thumbup', 'side'];
                  const randomGesture = gestures[Math.floor(Math.random() * gestures.length)];
                  headRef.current.playGesture(randomGesture, 1.5, false, 800);
                  console.log(`✅ Speaking interval gesture ${randomGesture} executed`);
                  
                  // Also try animated emojis for facial expressions
                  try {
                    if (typeof headRef.current.speakEmoji === 'function') {
                      const speakingEmojis = ['😊', '😄', '🙂', '😉'];
                      const randomEmoji = speakingEmojis[Math.floor(Math.random() * speakingEmojis.length)];
                      headRef.current.speakEmoji(randomEmoji, 1000);
                      console.log(`✅ Speaking emoji ${randomEmoji} executed`);
                    }
                  } catch (emojiError) {
                    console.log('📝 Emoji not available or failed:', emojiError.message);
                  }
                } else {
                  console.error('❌ playGesture not available in speaking interval');
                }
              } catch (intervalGestureError) {
                console.error('❌ Error in speaking interval gesture:', intervalGestureError);
              }
            } else {
              console.log('🎭 Speaking interval: skipping gesture (not in speaking state)', { 
                currentState: currentStateRef.current, 
                isSpeaking, 
                hasHead: !!headRef.current 
              });
            }
          };
          
          speakingAnimationRef.current = setInterval(startSpeakingAnimation, 3000);
          console.log('⏰ Speaking animation interval started with random gestures (every 3s)');
          
          // Start the first gesture immediately
          setTimeout(startSpeakingAnimation, 1000);
          break;
          
        case 'listening':
          console.log('👂 Setting up listening animations');
          setIsThinking(false);
          
          console.log('🎭 Setting mood to neutral');
          try {
            if (typeof headRef.current.setMood === 'function') {
              headRef.current.setMood('neutral');
              console.log('✅ Mood set to neutral for listening');
            } else {
              console.error('❌ setMood method not available for listening');
            }
          } catch (moodError) {
            console.error('❌ Error setting listening mood:', moodError);
          }
          
          console.log('🎭 Attempting listening gesture: index');
          try {
            if (typeof headRef.current.playGesture === 'function') {
              headRef.current.playGesture('index', 1.5, false, 800);
              console.log('✅ Listening gesture index executed successfully');
            } else {
              console.error('❌ playGesture method not available for listening');
            }
          } catch (gestureError) {
            console.error('❌ Error playing listening gesture:', gestureError);
          }
          break;
          
        case 'thinking':
          console.log('🤔 Setting up thinking animations');
          setIsThinking(true);
          
          console.log('🎭 Setting mood to neutral');
          try {
            if (typeof headRef.current.setMood === 'function') {
              headRef.current.setMood('neutral');
              console.log('✅ Mood set to neutral for thinking');
            } else {
              console.error('❌ setMood method not available for thinking');
            }
          } catch (moodError) {
            console.error('❌ Error setting thinking mood:', moodError);
          }
          
          // Enhanced thinking gesture with proper validation
          console.log('🎭 Attempting thinking gesture: side');
          try {
            if (typeof headRef.current.playGesture === 'function') {
              headRef.current.playGesture('side', 2, false, 1000);
              console.log('✅ Thinking gesture side executed successfully');
            } else {
              console.error('❌ playGesture method not available for thinking');
            }
          } catch (gestureError) {
            console.error('❌ Error playing thinking gesture:', gestureError);
          }

          // Add looking up for thinking (simulates deep thought)
          try {
            if (typeof headRef.current.lookAt === 'function') {
              // Look slightly up and to the side for thinking pose
              const rect = headRef.current.nodeAvatar?.getBoundingClientRect();
              if (rect) {
                const thinkingX = rect.left + rect.width * 0.3; // Look slightly left
                const thinkingY = rect.top + rect.height * 0.2; // Look slightly up
                headRef.current.lookAt(thinkingX, thinkingY, 1000);
                console.log('✅ Thinking lookAt executed: looking up and to side');
              }
            }
          } catch (lookError) {
            console.log('📝 Thinking lookAt not available or failed:', lookError.message);
          }
          
          // Set up interval for repeated thinking gestures with variety
          const startThinkingAnimation = () => {
            console.log('🎭 Thinking interval triggered', { 
              currentState: currentStateRef.current, 
              isThinking, 
              hasHead: !!headRef.current,
              headRefExists: !!headRef.current,
              intervalExists: !!thinkingAnimationRef.current
            });
            
            // Very simple check - just check if we have headRef
            if (headRef.current && currentStateRef.current === 'thinking') {
              console.log('🎭 Thinking interval: Attempting gesture and look direction');
              try {
                if (typeof headRef.current.playGesture === 'function') {
                  // Use available thinking gestures from the library
                  const thinkingGestures = ['shrug', 'side', 'index'];
                  const randomGesture = thinkingGestures[Math.floor(Math.random() * thinkingGestures.length)];
                  headRef.current.playGesture(randomGesture, 2, false, 1000);
                  console.log(`✅ Thinking interval gesture ${randomGesture} executed`);
                }

                // Randomly change look direction for thinking
                if (typeof headRef.current.lookAt === 'function' && Math.random() > 0.6) {
                  const rect = headRef.current.nodeAvatar?.getBoundingClientRect();
                  if (rect) {
                    // Random thinking look directions
                    const directions = [
                      { x: rect.left + rect.width * 0.2, y: rect.top + rect.height * 0.3 }, // Up left
                      { x: rect.left + rect.width * 0.8, y: rect.top + rect.height * 0.3 }, // Up right  
                      { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.1 }, // Straight up
                    ];
                    const randomDirection = directions[Math.floor(Math.random() * directions.length)];
                    headRef.current.lookAt(randomDirection.x, randomDirection.y, 1500);
                    console.log('✅ Thinking look direction updated');
                  }
                }
                  
                // Also try animated emojis for thinking expressions
                try {
                  if (typeof headRef.current.speakEmoji === 'function') {
                    const thinkingEmojis = ['🤔', '😐', '🙄'];
                    const randomEmoji = thinkingEmojis[Math.floor(Math.random() * thinkingEmojis.length)];
                    headRef.current.speakEmoji(randomEmoji, 1500);
                    console.log(`✅ Thinking emoji ${randomEmoji} executed`);
                  }
                } catch (emojiError) {
                  console.log('📝 Emoji not available or failed:', emojiError.message);
                }
              } catch (intervalGestureError) {
                console.error('❌ Error in thinking interval gesture:', intervalGestureError);
              }
            } else {
              console.log('🎭 Thinking interval: skipping gesture (not in thinking state)', { 
                currentState: currentStateRef.current, 
                isThinking, 
                hasHead: !!headRef.current 
              });
            }
          };
          
          thinkingAnimationRef.current = setInterval(startThinkingAnimation, 4000);
          console.log('⏰ Thinking animation interval started with varied gestures (every 4s)');
          
          // Start the first gesture immediately
          setTimeout(startThinkingAnimation, 1500);
          break;

        case 'userWriting':
          console.log('🎯 FINAL HYPOTHESIS TEST - Mimicking Working Initialization Conditions');
          console.log('🔍 Theory: Gestures only work in specific initialization context');
          
          setIsThinking(false);
          currentStateRef.current = 'userWriting';
          
          // CRITICAL TEST: Clear animation queue and restart
          console.log('🔄 QUEUE REPAIR TEST: Clearing stuck animation queue...');
          if (headRef.current) {
            // STEP 1: Clear the stuck animation queue
            if (headRef.current.animQueue && Array.isArray(headRef.current.animQueue)) {
              const oldQueueLength = headRef.current.animQueue.length;
              console.log(`🧹 Clearing stuck animQueue (length: ${oldQueueLength})`);
              headRef.current.animQueue.length = 0; // Clear array
              console.log('✅ Animation queue cleared');
            }
            
            // STEP 2: Reset gesture timeout
            if (headRef.current.gestureTimeout) {
              console.log('🧹 Clearing gestureTimeout');
              clearTimeout(headRef.current.gestureTimeout);
              headRef.current.gestureTimeout = null;
            }
            
                      // STEP 3: RESTART ANIMATION LOOP PROPERLY
          console.log('🔧 CRITICAL FIX: Restarting animation loop with proper implementation...');
          
          // Clean restart of animation loop
          if (typeof headRef.current.stop === 'function') {
            console.log('🛑 Stopping TalkingHead animation loop');
            headRef.current.stop();
          }
          
          // Start the animation loop
          setTimeout(() => {
            if (headRef.current && typeof headRef.current.start === 'function') {
              console.log('▶️ Starting TalkingHead animation loop...');
              headRef.current.start();
              
              // Verify it started correctly
              setTimeout(() => {
                if (headRef.current) {
                  const isRunning = !!headRef.current.animationId && !!headRef.current.isRunning;
                  console.log('🔍 Animation loop started successfully?', isRunning);
                  console.log('🔍 Animation ID:', headRef.current.animationId);
                  console.log('🔍 Is Running:', headRef.current.isRunning);
                }
              }, 100);
            }
          }, 100);
            
            // STEP 4: Deep dive into TalkingHead animation system
            setTimeout(() => {
              if (headRef.current) {
                console.log('🔍 DEEP ANIMATION SYSTEM ANALYSIS:');
                console.log('📊 Queue status:', {
                  animQueue: headRef.current.animQueue?.length || 0,
                  gestureTimeout: headRef.current.gestureTimeout,
                  gesture: headRef.current.gesture
                });
                
                // Check if animation loop is actually running
                console.log('🔍 Animation loop status:', {
                  animationId: headRef.current.animationId,
                  isRunning: !!headRef.current.animationId,
                  lastFrame: headRef.current.lastFrame,
                  clock: headRef.current.clock
                });
                
                // Check if renderer is working
                console.log('🔍 Renderer status:', {
                  renderer: !!headRef.current.renderer,
                  scene: !!headRef.current.scene,
                  camera: !!headRef.current.camera
                });
                
                // FORCE MANUAL QUEUE PROCESSING
                console.log('🔧 ATTEMPTING MANUAL QUEUE PROCESSING...');
                if (headRef.current.animQueue && headRef.current.animQueue.length > 0) {
                  console.log('🎯 Found queue items, attempting manual processing');
                  
                  // Try to manually trigger the animation processor
                  if (typeof headRef.current.processAnimation === 'function') {
                    console.log('🔧 Calling processAnimation()');
                    headRef.current.processAnimation();
                  }
                  
                  if (typeof headRef.current.updateFrame === 'function') {
                    console.log('🔧 Calling updateFrame()');
                    headRef.current.updateFrame();
                  }
                  
                  if (typeof headRef.current.render === 'function') {
                    console.log('🔧 Calling render()');
                    headRef.current.render();
                  }
                }
              }
            }, 1000);
          }

                      // Clear any existing intervals  
            if (thinkingAnimationRef.current) {
              clearInterval(thinkingAnimationRef.current);
            }
            
                      // ULTIMATE TEST: Recreate exact initialization conditions
          console.log('🚀 INITIALIZATION RECREATION TEST - Exact copy of working conditions');
          try {
            const talkingHeadInstance = headRef.current;
            if (talkingHeadInstance && typeof talkingHeadInstance.playGesture === 'function') {
              // Store reference outside React lifecycle
              (window as any).__testTalkingHead = talkingHeadInstance;
              console.log('✅ TalkingHead stored in window.__testTalkingHead for bypass testing');
              
              // RECREATE EXACT INITIALIZATION GESTURE CONDITIONS
              console.log('🎯 RECREATING: Exact initialization gesture test conditions');
              
              // COMPREHENSIVE DIAGNOSTIC LOGGING
              console.log('🔬 COMPREHENSIVE DIAGNOSTIC - TalkingHead Object Analysis:');
              console.log('📊 Core Properties:', {
                armature: !!talkingHeadInstance.armature,
                scene: !!talkingHeadInstance.scene,
                renderer: !!talkingHeadInstance.renderer,
                camera: !!talkingHeadInstance.camera,
                animationId: talkingHeadInstance.animationId,
                gestureTemplates: !!talkingHeadInstance.gestureTemplates,
                animEmojis: !!talkingHeadInstance.animEmojis
              });
              
              // Deep 3D scene analysis
              console.log('🔬 3D SCENE ANALYSIS:');
              if (talkingHeadInstance.scene) {
                let meshCount = 0;
                let skinnedMeshCount = 0;
                let boneCount = 0;
                const meshNames = [];
                
                talkingHeadInstance.scene.traverse((obj: any) => {
                  if (obj && obj.isMesh && obj.name) {
                    meshCount++;
                    meshNames.push(obj.name);
                  }
                  if (obj && obj.type === 'SkinnedMesh') {
                    skinnedMeshCount++;
                    if (obj.skeleton) {
                      boneCount += obj.skeleton.bones.length;
                      console.log('🦴 SkinnedMesh found:', obj.name || 'unnamed', 'bones:', obj.skeleton.bones.length);
                    }
                  }
                });
                
                console.log('📊 Scene Statistics:', {
                  totalMeshes: meshCount,
                  skinnedMeshes: skinnedMeshCount,
                  totalBones: boneCount,
                  meshNames: meshNames
                });
              }
              
              // Gesture system deep dive
              console.log('🔬 GESTURE SYSTEM ANALYSIS:');
              if (talkingHeadInstance.gestureTemplates) {
                console.log('📊 Available Gestures:', Object.keys(talkingHeadInstance.gestureTemplates));
                
                // Check each gesture template structure
                Object.keys(talkingHeadInstance.gestureTemplates).forEach((gestureName: string) => {
                  if (!gestureName) return; // Skip null/undefined names
                  const template = talkingHeadInstance.gestureTemplates[gestureName];
                  console.log(`🎭 Gesture "${gestureName}":`, {
                    hasTemplate: !!template,
                    keys: template ? Object.keys(template) : null
                  });
                });
              }
              
              // Animation queue detailed analysis
              console.log('🔬 ANIMATION QUEUE DEEP ANALYSIS:');
              if (talkingHeadInstance.animQueue) {
                console.log('📊 Queue Details:', {
                  length: talkingHeadInstance.animQueue.length,
                  items: talkingHeadInstance.animQueue.map((item: any, index: number) => ({
                    index,
                    type: typeof item,
                    keys: item ? Object.keys(item) : null
                  }))
                });
              }
              
              // Check if armature is available (same check as init)
              if (talkingHeadInstance.armature) {
                console.log('✅ Armature available - same as working init conditions');
                console.log('🔬 ARMATURE ANALYSIS:', {
                  armatureType: typeof talkingHeadInstance.armature,
                  armatureName: talkingHeadInstance.armature?.name || 'unnamed',
                  armatureParent: talkingHeadInstance.armature?.parent?.name || 'no parent',
                  armatureChildren: talkingHeadInstance.armature?.children?.length || 0
                });
                
                // Use EXACT same setTimeout timing as working init gestures
                setTimeout(() => {
                  if (talkingHeadInstance.armature) {
                    console.log('🎭 INIT RECREATION: handup gesture with exact init conditions');
                    console.log('🔬 PRE-GESTURE STATE:', {
                      armature: !!talkingHeadInstance.armature,
                      animQueue: talkingHeadInstance.animQueue?.length || 0,
                      gesture: talkingHeadInstance.gesture,
                      gestureTimeout: talkingHeadInstance.gestureTimeout,
                      animationId: talkingHeadInstance.animationId
                    });
                    
                    // Try to hook into the actual gesture execution
                    const originalPlayGesture = talkingHeadInstance.playGesture;
                    talkingHeadInstance.playGesture = function(...args: any[]) {
                      console.log('🎯 GESTURE INTERCEPTION:', args);
                      console.log('🔬 GESTURE CALL CONTEXT:', {
                        thisObject: this,
                        armature: !!this.armature,
                        animQueue: this.animQueue?.length || 0
                      });
                      const result = originalPlayGesture.apply(this, args);
                      console.log('🔬 GESTURE RESULT:', result);
                      console.log('🔬 POST-GESTURE STATE:', {
                        animQueue: this.animQueue?.length || 0,
                        gesture: this.gesture,
                        gestureTimeout: this.gestureTimeout
                      });
                      // Restore original function
                      this.playGesture = originalPlayGesture;
                      return result;
                    };
                    
                    talkingHeadInstance.playGesture('handup', 2, false, 1000);
                    console.log('✅ Init recreation gesture executed');
                  } else {
                    console.error('❌ Armature lost during recreation test');
                  }
                }, 2000); // Exact same 2-second delay as working init
                
                // Second gesture with same timing as working init
                setTimeout(() => {
                  if (talkingHeadInstance.armature) {
                    console.log('🎭 INIT RECREATION: thumbup gesture with exact init conditions');
                    talkingHeadInstance.playGesture('thumbup', 2, false, 1000);
                    console.log('✅ Init recreation second gesture executed');
                  }
                }, 5000); // Same 3-second gap as working init (2000 + 3000)
                
              } else {
                console.error('❌ CRITICAL: Armature not available - THIS IS THE DIFFERENCE!');
                console.log('🔧 Attempting to restore armature...');
                
                // Try to find and restore armature like init does
                if (talkingHeadInstance.scene && talkingHeadInstance.scene.children) {
                  talkingHeadInstance.scene.traverse((obj: any) => {
                    if (obj && (obj.type === 'SkinnedMesh' || (obj.name && typeof obj.name === 'string' && obj.name.includes('Armature')) || obj.isSkinnedMesh)) {
                      console.log('🔧 Found armature candidate:', (obj && obj.name) || 'unnamed', obj.type);
                      if (obj.skeleton) {
                        console.log('🔧 Restoring armature from skeleton');
                        talkingHeadInstance.armature = obj.skeleton.bones[0];
                        console.log('✅ Armature restored!');
                        
                        // Now try gesture with restored armature
                        setTimeout(() => {
                          console.log('🎭 POST-ARMATURE-RESTORE: Testing gesture');
                          talkingHeadInstance.playGesture('handup', 2, false, 1000);
                          console.log('✅ Post-armature-restore gesture executed');
                        }, 1000);
                      }
                    }
                  });
                }
              }
                
                // Add comprehensive queue management functions to window
                (window as any).__clearQueueAndGesture = (gesture = 'thumbup', duration = 3) => {
                  const th = (window as any).__testTalkingHead;
                  if (th && th.animQueue) {
                    console.log(`🧹 Manual queue clear (was ${th.animQueue.length})`);
                    th.animQueue.length = 0;
                    if (th.gestureTimeout) {
                      clearTimeout(th.gestureTimeout);
                      th.gestureTimeout = null;
                    }
                    
                    // CRITICAL: Check armature before gesture
                    console.log('🔍 Armature check:', !!th.armature);
                    if (!th.armature) {
                      console.log('🔧 CRITICAL: Armature missing! Attempting restore...');
                      if (th.scene) {
                        th.scene.traverse((obj: any) => {
                          if (obj && obj.type === 'SkinnedMesh' && obj.skeleton) {
                            th.armature = obj.skeleton.bones[0];
                            console.log('✅ Armature restored for manual gesture');
                          }
                        });
                      }
                    }
                    
                    console.log(`🎭 Manual gesture: ${gesture} (armature: ${!!th.armature})`);
                    
                    // Add comprehensive logging for manual gesture calls
                    console.log('🔬 MANUAL GESTURE - PRE-CALL STATE:', {
                      animQueue: th.animQueue?.length || 0,
                      gesture: th.gesture,
                      gestureTimeout: th.gestureTimeout,
                      animationId: th.animationId,
                      renderer: !!th.renderer,
                      scene: !!th.scene
                    });
                    
                    // Hook into the gesture call for debugging
                    const originalMethod = th.playGesture;
                    th.playGesture = function(...args: any[]) {
                      console.log('🎯 MANUAL GESTURE INTERCEPTION:', args);
                      const result = originalMethod.apply(this, args);
                      console.log('🔬 MANUAL GESTURE RESULT:', result);
                      console.log('🔬 MANUAL POST-GESTURE STATE:', {
                        animQueue: this.animQueue?.length || 0,
                        gesture: this.gesture,
                        gestureTimeout: this.gestureTimeout
                      });
                      this.playGesture = originalMethod; // Restore
                      return result;
                    };
                    
                    th.playGesture(gesture, duration, false, 1000);
                    return `Queue cleared, playing ${gesture} (armature: ${!!th.armature})`;
                  }
                  return 'TalkingHead not available';
                };
                
                (window as any).__forceProcessQueue = () => {
                  const th = (window as any).__testTalkingHead;
                  if (th) {
                    console.log('🔧 FORCE PROCESSING queue length:', th.animQueue?.length || 0);
                    
                    // Try multiple processing methods
                    const methods = ['processAnimation', 'updateFrame', 'render', 'update', 'animate'];
                    methods.forEach(method => {
                      if (typeof th[method] === 'function') {
                        console.log(`🔧 Calling ${method}()`);
                        try {
                          th[method]();
                        } catch (e) {
                          console.log(`⚠️ ${method}() failed:`, e);
                        }
                      }
                    });
                    
                    // Force restart animation loop with verification
                    if (typeof th.stop === 'function' && typeof th.start === 'function') {
                      console.log('🔄 Force restart animation loop');
                      th.stop();
                      setTimeout(() => {
                        th.start();
                        setTimeout(() => {
                          console.log('🔍 Animation loop running after restart?', !!th.animationId);
                          if (!th.animationId) {
                            console.log('🚨 Creating manual animation loop...');
                            const manualAnimate = () => {
                              if (th && th.render) {
                                th.render();
                                if (th.animate) th.animate();
                                requestAnimationFrame(manualAnimate);
                              }
                            };
                            manualAnimate();
                          }
                        }, 200);
                      }, 100);
                    }
                    
                    return `Attempted force processing`;
                  }
                  return 'TalkingHead not available';
                };
                
                console.log('✅ Added window.__clearQueueAndGesture() and window.__forceProcessQueue() for manual testing');
                console.log('💡 Try: window.__forceProcessQueue() to manually process stuck animations');
                
                // Immediate direct call (not through React)
                console.log('🎯 BYPASS: Direct playGesture call outside React context');
                talkingHeadInstance.playGesture.call(talkingHeadInstance, 'ok', 3, false, 1000);
                console.log('✅ BYPASS gesture executed');
              }
            } catch (bypassError) {
              console.error('❌ Bypass test failed:', bypassError);
            }
          
          // Step 1: Test React ref stability and TalkingHead object integrity
          console.log('🔍 STEP 1: Testing React ref stability...');
          console.log('🧪 headRef.current object:', headRef.current);
          console.log('🧪 headRef.current === previous ref:', headRef.current === previousTalkingHeadRef.current);
          previousTalkingHeadRef.current = headRef.current;
          
          try {
            if (typeof headRef.current?.setMood === 'function') {
              console.log('🎭 Testing setMood after potential React interference...');
              headRef.current.setMood('neutral');
              console.log('✅ setMood("neutral") called successfully');
              
              // Cycle through other moods to test visibility
              setTimeout(() => {
                if (headRef.current && currentStateRef.current === 'userWriting') {
                  headRef.current.setMood('happy');
                  console.log('✅ setMood("happy") called successfully');
                }
              }, 2000);
              
              setTimeout(() => {
                if (headRef.current && currentStateRef.current === 'userWriting') {
                  headRef.current.setMood('neutral');
                  console.log('✅ setMood("neutral") restored');
                }
              }, 4000);
            } else {
              console.error('❌ setMood not available');
            }
          } catch (error) {
            console.error('❌ setMood error:', error);
          }

          // Step 2: Test IMMEDIATE gestures (no setTimeout) vs delayed ones
          console.log('🎭 STEP 2: Testing IMMEDIATE vs DELAYED gestures...');
          
                    if (typeof headRef.current?.playGesture === 'function') {
            // TEST AFTER RESTART: Execute gesture after forcing animation restart
            console.log('🚨 POST-RESTART TEST: Gesture after forcing animation restart');
            setTimeout(() => {
              if (headRef.current && currentStateRef.current === 'userWriting') {
                console.log('🎭 Executing gesture 2 seconds AFTER restart...');
                headRef.current.playGesture('thumbup', 4, false, 1500);
                console.log('✅ POST-RESTART thumbup executed');
              }
            }, 2000);
            
            // QUEUE-CLEARED TEST: Clear queue before each gesture
            console.log('🚨 QUEUE-CLEARED TEST: Gesture with pre-cleared queue');
            if (headRef.current.animQueue && Array.isArray(headRef.current.animQueue)) {
              headRef.current.animQueue.length = 0; // Clear before gesture
              console.log('🧹 Pre-cleared queue for gesture test');
            }
            headRef.current.playGesture('thumbup', 3, false, 1000);
            console.log('✅ QUEUE-CLEARED thumbup executed');
            
            // IMMEDIATE TEST: Execute right now (like the working initialization gestures)
            console.log('🚨 IMMEDIATE TEST: Direct thumbup gesture (no setTimeout)');
            headRef.current.playGesture('thumbup', 3, false, 1000);
            console.log('✅ IMMEDIATE thumbup executed (should work like init gestures)');
             
             // ANOTHER IMMEDIATE TEST: Different gesture, still no setTimeout
             console.log('🚨 IMMEDIATE TEST 2: Direct shrug gesture (no setTimeout)');
             headRef.current.playGesture('shrug', 2, false, 800);
             console.log('✅ IMMEDIATE shrug executed');
             
             // Check TalkingHead state that might affect gesture execution
             console.log('🔍 AVATAR STATE CHECK:', {
               isListening: headRef.current.isListening,
               isSpeaking: headRef.current.isSpeaking,
               animQueue: headRef.current.animQueue?.length || 0,
               gesture: headRef.current.gesture,
               gestureTimeout: headRef.current.gestureTimeout,
               nodeAvatar: !!headRef.current.nodeAvatar
             });
             
             // DELAYED TEST: Same gesture with setTimeout
             setTimeout(() => {
               if (headRef.current && currentStateRef.current === 'userWriting') {
                 console.log('🚨 DELAYED TEST: Same thumbup gesture but with setTimeout');
                 console.log('🔍 DELAYED STATE CHECK:', {
                   isListening: headRef.current.isListening,
                   isSpeaking: headRef.current.isSpeaking,
                   animQueue: headRef.current.animQueue?.length || 0,
                   gesture: headRef.current.gesture,
                   gestureTimeout: headRef.current.gestureTimeout
                 });
                 
                 // Try to "wake up" the avatar before gesture
                 if (typeof headRef.current.start === 'function') {
                   console.log('🔄 Calling start() before delayed gesture');
                   headRef.current.start();
                 }
                 
                 headRef.current.playGesture('thumbup', 3, false, 1000);
                 console.log('✅ DELAYED thumbup executed (may not work visually)');
               }
             }, 3000);
             
             // Test if gestures work when called during animation loops
             setTimeout(() => {
               if (headRef.current && currentStateRef.current === 'userWriting') {
                 console.log('🚨 ANIMATION CONTEXT TEST: Gesture during requestAnimationFrame');
                 requestAnimationFrame(() => {
                   if (headRef.current && currentStateRef.current === 'userWriting') {
                     headRef.current.playGesture('ok', 2, false, 500);
                     console.log('✅ Animation frame gesture executed');
                   }
                 });
               }
             }, 6000);
            
            // Test 2: Try animated emoji after 8 seconds
            setTimeout(() => {
              if (headRef.current && currentStateRef.current === 'userWriting') {
                console.log('🚨 EMOJI TEST: Trying animated emoji 👋');
                try {
                  headRef.current.playGesture('👋', 3, false, 1000);
                  console.log('✅ Animated emoji 👋 executed');
                } catch (emojiError) {
                  console.log('⚠️ Emoji gesture failed, trying wave emoji differently');
                  // Try without playGesture - maybe there's a different method
                }
              }
            }, 8000);
            
            // Test 3: Try namaste (the extra gesture we found) after 13 seconds
            setTimeout(() => {
              if (headRef.current && currentStateRef.current === 'userWriting') {
                console.log('🚨 NAMASTE TEST: Trying the extra gesture found');
                headRef.current.playGesture('namaste', 4, false, 1500);
                console.log('✅ Namaste gesture executed');
              }
            }, 13000);
            
            // Test 4: Try stopGesture then new gesture after 18 seconds
            setTimeout(() => {
              if (headRef.current && currentStateRef.current === 'userWriting') {
                console.log('🚨 STOP+START TEST: stopGesture then new gesture');
                if (typeof headRef.current.stopGesture === 'function') {
                  headRef.current.stopGesture(500);
                  console.log('✅ stopGesture called');
                  
                  setTimeout(() => {
                    if (headRef.current && currentStateRef.current === 'userWriting') {
                      headRef.current.playGesture('ok', 4, false, 1500);
                      console.log('✅ OK gesture after stop executed');
                    }
                  }, 1000);
                }
              }
            }, 18000);
          }

          // Step 3: Test speakEmoji method (separate from playGesture)
          console.log('🎭 STEP 3: Testing speakEmoji method...');
          
          setTimeout(() => {
            if (headRef.current && currentStateRef.current === 'userWriting') {
              console.log('🚨 EMOJI SPEAK TEST: Using speakEmoji method');
              if (typeof headRef.current.speakEmoji === 'function') {
                headRef.current.speakEmoji('👋');
                console.log('✅ speakEmoji("👋") executed');
              } else {
                console.log('⚠️ speakEmoji method not available');
              }
            }
          }, 5000);

          // Step 4: Test lookAt with EXTREME coordinates for visibility
          console.log('👀 STEP 4: Testing lookAt with EXTREME coordinates...');
          
          setTimeout(() => {
            if (headRef.current && currentStateRef.current === 'userWriting' && typeof headRef.current.lookAt === 'function') {
              console.log('🧪 Test A: EXTREME left look');
              headRef.current.lookAt(-1000, 0, 2000); // Very far left
              console.log('✅ lookAt(-1000, 0, 2000) - extreme left executed');
            }
          }, 10000);

          setTimeout(() => {
            if (headRef.current && currentStateRef.current === 'userWriting' && typeof headRef.current.lookAt === 'function') {
              console.log('🧪 Test B: EXTREME down look');
              headRef.current.lookAt(0, 1000, 2000); // Very far down
              console.log('✅ lookAt(0, 1000, 2000) - extreme down executed');
            }
          }, 15000);

          setTimeout(() => {
            if (headRef.current && currentStateRef.current === 'userWriting' && typeof headRef.current.lookAt === 'function') {
              console.log('🧪 Test C: Return to center');
              headRef.current.lookAt(0, 0, 1000); // Center
              console.log('✅ lookAt(0, 0, 1000) - center executed');
            }
          }, 20000);

          // Step 4: Test lookAtCamera for comparison
          setTimeout(() => {
            if (headRef.current && currentStateRef.current === 'userWriting' && typeof headRef.current.lookAtCamera === 'function') {
              console.log('👁️ COMPARISON TEST: lookAtCamera');
              headRef.current.lookAtCamera(3000);
              console.log('✅ lookAtCamera(3000) executed for comparison');
            }
          }, 24000);

          // Step 5: Comprehensive status report
          setTimeout(() => {
            if (headRef.current) {
              console.log('📊 COMPREHENSIVE STATUS REPORT:');
              console.log('🔍 Avatar properties:', {
                moodName: headRef.current.moodName,
                gesture: headRef.current.gesture,
                gestureTimeout: headRef.current.gestureTimeout,
                isListening: headRef.current.isListening,
                isSpeaking: headRef.current.isSpeaking,
                nodeAvatar: !!headRef.current.nodeAvatar,
                armature: !!headRef.current.armature
              });
              
              // Check if any animation queues exist
              if (headRef.current.animQueue) {
                console.log('📋 Animation queue length:', headRef.current.animQueue.length);
              }
            }
          }, 28000);

          // Step 6: Simple continuous testing (reduced conflicts)
          const startUserWritingAnimation = () => {
            if (headRef.current && currentStateRef.current === 'userWriting') {
              console.log('🔄 SIMPLE CONTINUOUS TEST');
              try {
                // Just one simple, obvious test per interval
                if (typeof headRef.current.playGesture === 'function') {
                  console.log('🔄 Simple test: shrug gesture');
                  headRef.current.playGesture('shrug', 2, false, 800);
                  console.log('✅ Simple shrug executed');
                }
              } catch (intervalError) {
                console.error('❌ Error in simple continuous test:', intervalError);
              }
            }
          };

          // Set up simple continuous testing - longer interval to avoid conflicts
          thinkingAnimationRef.current = setInterval(startUserWritingAnimation, 25000);
          console.log('⏰ SIMPLE CONTINUOUS TESTING interval started (every 25s)');
          console.log('🔍 Keep typing to stay in userWriting state and observe the tests!');
          break;
          
        case 'idle':
        default:
          console.log('😐 Setting up idle animations');
          setIsThinking(false);
          
          console.log('🎭 Setting mood to neutral');
          headRef.current.setMood?.('neutral');
          
          // Very simple idle animation
          setTimeout(() => {
            if (headRef.current && state === 'idle') {
              console.log('🎭 Delayed idle gesture: side');
              headRef.current.playGesture?.('side', 0.3, false, 0);
            }
          }, 2000);
          break;
      }
    } catch (err) {
      console.error('💥 Failed to update avatar state:', err);
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
      
      // Clear animation intervals
      if (thinkingAnimationRef.current) {
        clearInterval(thinkingAnimationRef.current);
        thinkingAnimationRef.current = null;
      }
      if (speakingAnimationRef.current) {
        clearInterval(speakingAnimationRef.current);
        speakingAnimationRef.current = null;
      }
      
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
    console.log('🎭 Props state change detected:', {
      newState: state,
      isInitialized,
      previousStateRef: previousState.current
    });
    
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
        // Clear speaking animations when not speaking
        if (speakingAnimationRef.current) {
          clearInterval(speakingAnimationRef.current);
          speakingAnimationRef.current = null;
        }
        // Only reset lastSpokenTextRef when we're definitely not in speaking state
        if (state === 'idle') {
          console.log('🔄 Resetting lastSpokenTextRef because state is idle');
          lastSpokenTextRef.current = '';
        }
      }
      
      // Stop thinking animations when not thinking
      if (state !== 'thinking') {
        setIsThinking(false);
        if (thinkingAnimationRef.current) {
          clearInterval(thinkingAnimationRef.current);
          thinkingAnimationRef.current = null;
        }
      }

      // Stop user writing animations when not in userWriting state
      if (state !== 'userWriting') {
        if (thinkingAnimationRef.current && currentStateRef.current === 'userWriting') {
          clearInterval(thinkingAnimationRef.current);
          thinkingAnimationRef.current = null;
          console.log('🧹 Cleared user writing animation interval');
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

  // Handle speaking when state or text changes (enhanced for progressive speech)
  useEffect(() => {
    const stateChanged = previousState.current !== state;
    const isTransitionToSpeaking = previousState.current !== 'speaking' && state === 'speaking';
    const textChanged = text !== lastSpokenTextRef.current;
    
    console.log('🎯 Speech trigger useEffect:', { 
      isInitialized, 
      hasText: !!text, 
      textLength: text?.length || 0,
      state, 
      previousState: previousState.current,
      stateChanged,
      isTransitionToSpeaking,
      textChanged,
      isSpeaking,
      audioUnlocked,
      progressiveMode,
      isStreaming,
      textPreview: text?.substring(0, 50) + '...',
      lastSpokenText: lastSpokenTextRef.current?.substring(0, 30) + '...',
      currentlySpeakingText: currentlySpeakingText?.substring(0, 30) + '...'
    });
    
    // Update previous state
    previousState.current = state;
    
    // Progressive mode: Handle text updates during streaming
    if (progressiveMode && state === 'speaking' && isInitialized && text && audioUnlocked) {
      // Start speech once per message; enhanced TTS handles internal updates
      if (!isSpeaking && !speakingInProgress.current && text !== lastSpokenTextRef.current) {
        console.log('✅ PROGRESSIVE: Starting initial speech');
        speak(text);
        return;
      }
      // Do NOT call speak on subsequent text length changes to avoid double audio
    }
    
    // Standard mode: Only speak when transitioning TO speaking state with new text
    if (!progressiveMode && isTransitionToSpeaking && isInitialized && text && audioUnlocked) {
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
  }, [text, state, isInitialized, audioUnlocked, progressiveMode, isStreaming, currentlySpeakingText]);

  const retryInitialization = () => {
    setError(null);
    setIsInitialized(false);
    headRef.current = null;
    initializeAvatar();
  };

  // Gesture queue processing functions
  const processGestureQueue = useCallback(() => {
    if (!enableGestureQueue || isPlayingGesture || !headRef.current || !isInitialized) {
      return;
    }

    const queue = gestureQueueRef.current;
    if (queue.length === 0) {
      return;
    }

    // Sort queue by priority (high -> normal -> low) and then by timestamp
    const sortedQueue = [...queue].sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      return a.timestamp - b.timestamp;
    });

    const nextGesture = sortedQueue[0];
    if (!nextGesture) return;

    setIsPlayingGesture(true);
    currentGestureRef.current = nextGesture;

    try {
      onGestureStarted?.(nextGesture.gesture);
      
      // Remove the gesture from queue
      setGestureQueue(prev => prev.filter(g => g.id !== nextGesture.id));
      gestureQueueRef.current = gestureQueueRef.current.filter(g => g.id !== nextGesture.id);

      // Play the gesture
      if (typeof headRef.current.playGesture === 'function') {
        headRef.current.playGesture(nextGesture.gesture, nextGesture.duration, nextGesture.mirror, nextGesture.transitionMs);
        console.log(`✅ Playing queued gesture: ${nextGesture.gesture} (priority: ${nextGesture.priority})`);
      }

      // Set timeout to process next gesture
      gestureTimeoutRef.current = setTimeout(() => {
        setIsPlayingGesture(false);
        currentGestureRef.current = null;
        onGestureCompleted?.(nextGesture.gesture);
        
        // Process next gesture in queue
        setTimeout(() => processGestureQueue(), 100);
      }, nextGesture.duration * 1000);

    } catch (error) {
      console.error('❌ Error playing queued gesture:', error);
      setIsPlayingGesture(false);
      currentGestureRef.current = null;
      
      // Continue processing queue even if one gesture fails
      setTimeout(() => processGestureQueue(), 100);
    }
  }, [enableGestureQueue, isPlayingGesture, isInitialized, onGestureStarted, onGestureCompleted]);

  // Add gesture to queue
  const addToGestureQueue = useCallback((gesture: QueuedGesture) => {
    if (!enableGestureQueue) {
      return false;
    }

    const currentQueue = gestureQueueRef.current;
    
    // Check queue size limit
    if (currentQueue.length >= maxQueueSize) {
      // Remove oldest low priority gesture if queue is full
      const lowPriorityIndex = currentQueue.findIndex(g => g.priority === 'low');
      if (lowPriorityIndex !== -1) {
        currentQueue.splice(lowPriorityIndex, 1);
      } else {
        console.warn(`⚠️ Gesture queue full (${maxQueueSize}), dropping gesture: ${gesture.gesture}`);
        return false;
      }
    }

    gestureQueueRef.current = [...currentQueue, gesture];
    setGestureQueue(gestureQueueRef.current);
    
    console.log(`📝 Added gesture to queue: ${gesture.gesture} (priority: ${gesture.priority}), queue size: ${gestureQueueRef.current.length}`);
    
    // Process queue if not currently playing
    if (!isPlayingGesture) {
      setTimeout(() => processGestureQueue(), 50);
    }
    
    return true;
  }, [enableGestureQueue, maxQueueSize, isPlayingGesture, processGestureQueue]);

  // Clear gesture queue
  const clearGestureQueue = useCallback(() => {
    setGestureQueue([]);
    gestureQueueRef.current = [];
    
    // Clear current gesture timeout
    if (gestureTimeoutRef.current) {
      clearTimeout(gestureTimeoutRef.current);
      gestureTimeoutRef.current = null;
    }
    
    setIsPlayingGesture(false);
    currentGestureRef.current = null;
    
    console.log('🧹 Gesture queue cleared');
  }, []);

  // Process queue when it changes
  useEffect(() => {
    gestureQueueRef.current = gestureQueue;
    if (gestureQueue.length > 0 && !isPlayingGesture) {
      setTimeout(() => processGestureQueue(), 50);
    }
  }, [gestureQueue, isPlayingGesture, processGestureQueue]);

  // Expose methods through ref
  useImperativeHandle(ref, () => ({
    setMood: (mood: string) => {
      console.log(`🎭 External setMood call: ${mood}`);
      if (headRef.current && isInitialized) {
        try {
          // Check if the TalkingHead instance has the setMood method
          if (typeof headRef.current.setMood === 'function') {
            headRef.current.setMood(mood);
            console.log(`✅ External mood set to: ${mood}`);
          } else {
            console.error('❌ setMood method not available on TalkingHead instance');
          }
        } catch (error) {
          console.error('❌ Error setting external mood:', error);
        }
      } else {
        console.warn('⚠️ Avatar not initialized or ready, cannot set external mood');
      }
    },
    playGesture: (gesture: string, duration = 3, mirror = false, transitionMs = 1000) => {
      console.log(`🎭 External playGesture call: ${gesture} (dur: ${duration}, mirror: ${mirror}, ms: ${transitionMs})`);
      if (headRef.current && isInitialized) {
        try {
          // Validate gesture name
          const validGestures = ['handup', 'index', 'ok', 'thumbup', 'thumbdown', 'side', 'shrug', 'namaste'];
          if (!validGestures.includes(gesture)) {
            console.warn(`⚠️ Unknown gesture: ${gesture}. Valid gestures: ${validGestures.join(', ')}`);
          }
          
          // Check if the TalkingHead instance has the playGesture method
          if (typeof headRef.current.playGesture === 'function') {
            headRef.current.playGesture(gesture, duration, mirror, transitionMs);
            console.log(`✅ External gesture played: ${gesture}`);
          } else {
            console.error('❌ playGesture method not available on TalkingHead instance');
            // Try alternative approach by checking if gesture object exists
            if (headRef.current.gesture) {
              console.log('🔄 Trying alternative gesture approach...');
              headRef.current.gesture(gesture, duration);
            }
          }
        } catch (error) {
          console.error('❌ Error playing external gesture:', error);
        }
      } else {
        console.warn('⚠️ Avatar not initialized or ready, cannot play external gesture');
      }
    },
    queueGesture: (gesture: string, duration = 3, mirror = false, transitionMs = 1000, priority: 'low' | 'normal' | 'high' = 'normal') => {
      console.log(`🎭 External queueGesture call: ${gesture} (priority: ${priority})`);
      
      const validGestures = ['handup', 'index', 'ok', 'thumbup', 'thumbdown', 'side', 'shrug', 'namaste'];
      if (!validGestures.includes(gesture)) {
        console.warn(`⚠️ Unknown gesture: ${gesture}. Valid gestures: ${validGestures.join(', ')}`);
        return;
      }

      const queuedGesture: QueuedGesture = {
        id: `${gesture}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        gesture,
        duration,
        mirror,
        transitionMs,
        priority,
        timestamp: Date.now(),
      };

      const success = addToGestureQueue(queuedGesture);
      if (success) {
        console.log(`✅ Gesture queued: ${gesture} (priority: ${priority})`);
      } else {
        console.warn(`⚠️ Failed to queue gesture: ${gesture}`);
      }
    },
    clearGestureQueue: () => {
      console.log('🎭 External clearGestureQueue call');
      clearGestureQueue();
    },
    getGestureQueue: () => {
      return [...gestureQueueRef.current];
    },
    lookAt: (x: number | null, y: number | null, duration?: number) => {
      console.log(`🎭 External lookAt call: x=${x}, y=${y}, duration=${duration}`);
      if (headRef.current && isInitialized) {
        try {
          if (typeof headRef.current.lookAt === 'function') {
            headRef.current.lookAt(x, y, duration);
            console.log(`✅ External lookAt executed: x=${x}, y=${y}, duration=${duration}`);
          } else {
            console.error('❌ lookAt method not available on TalkingHead instance');
          }
        } catch (error) {
          console.error('❌ Error executing external lookAt:', error);
        }
      } else {
        console.warn('⚠️ Avatar not initialized or ready, cannot execute external lookAt');
      }
    },
    lookAtCamera: (duration?: number) => {
      console.log(`🎭 External lookAtCamera call: duration=${duration}`);
      if (headRef.current && isInitialized) {
        try {
          if (typeof headRef.current.lookAtCamera === 'function') {
            headRef.current.lookAtCamera(duration);
            console.log(`✅ External lookAtCamera executed: duration=${duration}`);
          } else {
            console.error('❌ lookAtCamera method not available on TalkingHead instance');
          }
        } catch (error) {
          console.error('❌ Error executing external lookAtCamera:', error);
        }
      } else {
        console.warn('⚠️ Avatar not initialized or ready, cannot execute external lookAtCamera');
      }
    },
    setState: (state: 'idle' | 'speaking' | 'listening' | 'thinking' | 'userWriting') => {
      console.log(`🎭 External setState call: ${state}`);
      if (isInitialized) {
        try {
          updateAvatarState(state);
        } catch (error) {
          console.error('❌ Error executing external setState:', error);
        }
      } else {
        console.warn('⚠️ Avatar not initialized, cannot execute external setState');
      }
    }
  }), [isInitialized, addToGestureQueue, clearGestureQueue]);

  // Cleanup gesture queue timeout on unmount
  useEffect(() => {
    return () => {
      if (gestureTimeoutRef.current) {
        clearTimeout(gestureTimeoutRef.current);
      }
    };
  }, []);

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
        height: '100%',
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
            background: 'rgba(76, 175, 80, 0.95)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: '600',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'speakingPulse 1s ease-in-out infinite',
            boxShadow: '0 2px 12px rgba(76, 175, 80, 0.4)',
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'white',
              animation: 'speakingBlink 0.5s ease-in-out infinite',
            }}
          />
          {/* Removed text: מדבר... */}
        </div>
      )}

      {/* Thinking Indicator */}
      {isThinking && state === 'thinking' && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(156, 163, 175, 0.95)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: '600',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'thinkingGlow 2s ease-in-out infinite',
            boxShadow: '0 2px 12px rgba(156, 163, 175, 0.4)',
          }}
        >
          {/* Removed text: חושב */}
          <div style={{ display: 'flex', gap: '2px' }}>
            <div
              style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                background: 'white',
                animation: 'thinkingDot1 1.5s ease-in-out infinite',
              }}
            />
            <div
              style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                background: 'white',
                animation: 'thinkingDot2 1.5s ease-in-out infinite',
              }}
            />
            <div
              style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                background: 'white',
                animation: 'thinkingDot3 1.5s ease-in-out infinite',
              }}
            />
          </div>
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
        @keyframes speakingPulse {
          0%, 100% { 
            opacity: 1; 
            transform: translateX(-50%) scale(1);
          }
          50% { 
            opacity: 0.8; 
            transform: translateX(-50%) scale(1.05);
          }
        }
        
        @keyframes speakingBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        
        @keyframes thinkingGlow {
          0%, 100% { 
            opacity: 1; 
            box-shadow: 0 2px 12px rgba(156, 163, 175, 0.4);
          }
          50% { 
            opacity: 0.85; 
            box-shadow: 0 4px 20px rgba(156, 163, 175, 0.6);
          }
        }
        
        @keyframes thinkingDot1 {
          0%, 80%, 100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          40% {
            opacity: 1;
            transform: scale(1.2);
          }
        }
        
        @keyframes thinkingDot2 {
          0%, 80%, 100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          60% {
            opacity: 1;
            transform: scale(1.2);
          }
        }
        
        @keyframes thinkingDot3 {
          0%, 80%, 100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          80% {
            opacity: 1;
            transform: scale(1.2);
          }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
});

MichaelAvatarDirect.displayName = 'MichaelAvatarDirect';

export default MichaelAvatarDirect; 