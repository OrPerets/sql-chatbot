"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Volume2, Mic, Settings, VolumeX } from 'lucide-react';
import Lottie from 'lottie-react';
import { enhancedTTS, TTSOptions } from '../utils/enhanced-tts';
import EnhancedVoiceSettings from './enhanced-voice-settings';
import styles from './michael-chat-avatar.module.css';

interface MichaelChatAvatarProps {
  text?: string;
  autoPlay?: boolean;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  isListening?: boolean;
  isThinking?: boolean;
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

// Simple Lottie animation data for a talking character
const talkingAnimationData = {
  v: "5.7.4",
  fr: 30,
  ip: 0,
  op: 60,
  w: 200,
  h: 200,
  nm: "Talking Avatar",
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "Head",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { 
          a: 1, 
          k: [
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 0, s: [0] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 30, s: [3] },
            { t: 60, s: [0] }
          ]
        },
        p: { a: 0, k: [100, 80, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { 
          a: 1,
          k: [
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 0, s: [100, 100, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 15, s: [102, 98, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 30, s: [98, 102, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 45, s: [102, 98, 100] },
            { t: 60, s: [100, 100, 100] }
          ]
        }
      },
      shapes: [
        {
          ty: "gr",
          it: [
            {
              d: 1,
              ty: "el",
              nm: "Head Circle",
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [80, 80] }
            },
            {
              ty: "fl",
              c: { a: 0, k: [0.9, 0.95, 1, 1] },
              o: { a: 0, k: 100 }
            },
            {
              ty: "st",
              c: { a: 0, k: [0.2, 0.4, 0.8, 1] },
              o: { a: 0, k: 100 },
              w: { a: 0, k: 2 }
            }
          ]
        }
      ]
    },
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: "Mouth",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [100, 110, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { 
          a: 1,
          k: [
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 0, s: [100, 20, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 10, s: [120, 100, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 20, s: [80, 40, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 30, s: [110, 80, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 40, s: [90, 60, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 50, s: [100, 90, 100] },
            { t: 60, s: [100, 20, 100] }
          ]
        }
      },
      shapes: [
        {
          ty: "gr",
          it: [
            {
              d: 1,
              ty: "el",
              nm: "Mouth Ellipse",
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [20, 8] }
            },
            {
              ty: "fl",
              c: { a: 0, k: [0.1, 0.1, 0.2, 1] },
              o: { a: 0, k: 100 }
            }
          ]
        }
      ]
    },
    {
      ddd: 0,
      ind: 3,
      ty: 4,
      nm: "Eyes",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [100, 70, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { 
          a: 1,
          k: [
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 0, s: [100, 100, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 45, s: [100, 100, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 50, s: [100, 10, 100] },
            { t: 55, s: [100, 100, 100] }
          ]
        }
      },
      shapes: [
        {
          ty: "gr",
          it: [
            {
              d: 1,
              ty: "el",
              nm: "Left Eye",
              p: { a: 0, k: [-15, 0] },
              s: { a: 0, k: [8, 8] }
            },
            {
              d: 1,
              ty: "el",
              nm: "Right Eye",
              p: { a: 0, k: [15, 0] },
              s: { a: 0, k: [8, 8] }
            },
            {
              ty: "fl",
              c: { a: 0, k: [0.1, 0.1, 0.3, 1] },
              o: { a: 0, k: 100 }
            }
          ]
        }
      ]
    }
  ]
};

// Idle animation data
const idleAnimationData = {
  v: "5.7.4",
  fr: 30,
  ip: 0,
  op: 90,
  w: 200,
  h: 200,
  nm: "Idle Avatar",
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "Head",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { 
          a: 1, 
          k: [
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 0, s: [0] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 45, s: [1] },
            { t: 90, s: [0] }
          ]
        },
        p: { a: 0, k: [100, 80, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { 
          a: 1,
          k: [
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 0, s: [100, 100, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 45, s: [101, 100, 100] },
            { t: 90, s: [100, 100, 100] }
          ]
        }
      },
      shapes: [
        {
          ty: "gr",
          it: [
            {
              d: 1,
              ty: "el",
              nm: "Head Circle",
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [80, 80] }
            },
            {
              ty: "fl",
              c: { a: 0, k: [0.9, 0.95, 1, 1] },
              o: { a: 0, k: 100 }
            },
            {
              ty: "st",
              c: { a: 0, k: [0.2, 0.4, 0.8, 1] },
              o: { a: 0, k: 100 },
              w: { a: 0, k: 2 }
            }
          ]
        }
      ]
    },
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: "Eyes",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [100, 70, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { 
          a: 1,
          k: [
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 0, s: [100, 100, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 80, s: [100, 100, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 85, s: [100, 10, 100] },
            { t: 90, s: [100, 100, 100] }
          ]
        }
      },
      shapes: [
        {
          ty: "gr",
          it: [
            {
              d: 1,
              ty: "el",
              nm: "Left Eye",
              p: { a: 0, k: [-15, 0] },
              s: { a: 0, k: [8, 8] }
            },
            {
              d: 1,
              ty: "el",
              nm: "Right Eye",
              p: { a: 0, k: [15, 0] },
              s: { a: 0, k: [8, 8] }
            },
            {
              ty: "fl",
              c: { a: 0, k: [0.1, 0.1, 0.3, 1] },
              o: { a: 0, k: 100 }
            }
          ]
        }
      ]
    }
  ]
};

// Hebrew state indicators
const StateIndicator: React.FC<{ 
  state: 'idle' | 'listening' | 'talking' | 'thinking';
  isVisible: boolean;
}> = ({ state, isVisible }) => {
  const getStateText = () => {
    switch (state) {
      case 'thinking':
        return 'חושב...';
      case 'listening':
        return 'מקשיב...';
      case 'talking':
        return 'מדבר...';
      default:
        return '';
    }
  };

  const getStateColor = () => {
    switch (state) {
      case 'thinking':
        return '#8B5CF6';
      case 'listening':
        return '#10B981';
      case 'talking':
        return '#EF4444';
      default:
        return '#3B82F6';
    }
  };

  if (!isVisible || state === 'idle') return null;

  return (
    <div 
      className={styles.stateIndicator}
      style={{ 
        color: getStateColor(),
        borderColor: getStateColor() + '30'
      }}
    >
      {getStateText()}
    </div>
  );
};

const MichaelChatAvatar: React.FC<MichaelChatAvatarProps> = ({ 
  text, 
  autoPlay = false,
  onSpeechStart,
  onSpeechEnd,
  isListening = false,
  isThinking = false,
  className = '',
  size = 'medium'
}) => {
  const [isTalking, setIsTalking] = useState(false);
  const [isInternalThinking, setIsInternalThinking] = useState(false);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(true);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState<TTSOptions>({
    voice: 'echo',
    speed: 0.9,
    volume: 0.75,
    useOpenAI: false,
    characterStyle: 'university_ta',
    enhanceProsody: true,
    backgroundAmbiance: false
  });
  
  const isPlayingRef = useRef(false);
  const lottieRef = useRef<any>(null);

  const speak = useCallback(async (textToSpeak: string) => {
    if (!textToSpeak.trim() || !isSpeechEnabled) return;
    
    try {
      // Stop any current speech
      enhancedTTS.stop();
      
      // Set talking state IMMEDIATELY for instant visual feedback
      setIsTalking(true);
      setIsInternalThinking(false);
      isPlayingRef.current = true;
      onSpeechStart?.();
      
      // Clean text for natural teaching speech with student comprehension focus
      const cleanText = textToSpeak
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/^\s+|\s+$/g, '') // Trim leading/trailing spaces
        .replace(/\n\n+/g, '... ') // Double newlines become thoughtful pauses
        .replace(/\n+/g, '. ') // Single newlines become sentence breaks
        .replace(/([.!?])\s*([A-Z])/g, '$1... $2') // Add thoughtful pause after sentences
        .replace(/[.]{2,}/g, '...') // Normalize multiple dots to ellipses
        .replace(/\s*[.]\s*/g, '. ') // Proper period spacing for natural pauses
        .replace(/\s*[,]\s*/g, ', ') // Proper comma spacing for brief pauses
        .replace(/\s*[...]\s*/g, '... ') // Proper ellipses spacing for thinking pauses
        .trim();
      
      // Use enhanced TTS with current voice settings
      await enhancedTTS.speak(cleanText, {
        ...voiceSettings,
        onStart: () => {
          // Already set above for instant feedback
          console.log('Speech started');
        },
        onEnd: () => {
          setIsTalking(false);
          isPlayingRef.current = false;
          onSpeechEnd?.();
        },
        onError: (error) => {
          console.error('TTS Error:', error);
          setIsTalking(false);
          setIsInternalThinking(false);
          isPlayingRef.current = false;
          onSpeechEnd?.();
        }
      });
      
    } catch (error) {
      console.error('Enhanced TTS failed:', error);
      setIsTalking(false);
      setIsInternalThinking(false);
      isPlayingRef.current = false;
      onSpeechEnd?.();
    }
  }, [voiceSettings, isSpeechEnabled, onSpeechStart, onSpeechEnd]);

  // Stop speech function
  const stopSpeech = useCallback(() => {
    enhancedTTS.stop();
    setIsTalking(false);
    setIsInternalThinking(false);
    isPlayingRef.current = false;
  }, []);

  // Load voice settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('michaelVoiceSettings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setVoiceSettings(prev => ({ ...prev, ...parsedSettings }));
      } catch (error) {
        console.warn('Failed to load voice settings from localStorage:', error);
      }
    }
  }, []);

  // Auto-play effect
  useEffect(() => {
    if (autoPlay && text && isSpeechEnabled && !isPlayingRef.current) {
      const timer = setTimeout(() => {
        if (text && !isPlayingRef.current) {
          speak(text);
        }
      }, 0); // INSTANT response - 0ms delay for perfect text-audio synchronization
      
      return () => clearTimeout(timer);
    }
  }, [text, autoPlay, isSpeechEnabled, speak]);

  // Determine animation state
  const getAnimationState = () => {
    if (isTalking) return 'talking';
    if (isThinking || isInternalThinking) return 'thinking';
    if (isListening) return 'listening';
    return 'idle';
  };

  const animationState = getAnimationState();

  const getSizeClass = () => {
    switch (size) {
      case 'small': return styles.small;
      case 'large': return styles.large;
      default: return styles.medium;
    }
  };

  return (
    <div className={`${styles.michaelChatAvatar} ${getSizeClass()} ${className}`}>
      <div className={`${styles.avatarContainer} ${styles[animationState]}`}>
        <div className={styles.avatarWrapper}>
          {/* Fallback image for browsers that don't support advanced animations */}
          <div className={styles.fallbackAvatar}>
            <img 
              src="/bot.png" 
              alt="Michael - SQL Teaching Assistant" 
              className={styles.avatarImage}
            />
          </div>

          {/* Lottie Animation Overlay */}
          <div className={styles.lottieContainer}>
            <Lottie
              lottieRef={lottieRef}
              animationData={isTalking ? talkingAnimationData : idleAnimationData}
              loop={true}
              autoplay={true}
              className={styles.lottieAnimation}
              rendererSettings={{
                preserveAspectRatio: 'xMidYMid slice'
              }}
            />
          </div>
          
          {/* State indicators */}
          {isListening && (
            <div className={styles.listeningIndicator}>
              <div className={styles.micIcon}>
                <Mic size={12} />
              </div>
              <div className={styles.soundWaves}>
                <div className={styles.wave}></div>
                <div className={styles.wave}></div>
                <div className={styles.wave}></div>
                <div className={styles.wave}></div>
              </div>
            </div>
          )}

          {(isThinking || isInternalThinking) && (
            <div className={styles.thinkingIndicator}>
              <div className={styles.thinkingDots}>
                <div className={styles.dot}></div>
                <div className={styles.dot}></div>
                <div className={styles.dot}></div>
              </div>
            </div>
          )}

          {isTalking && (
            <div className={styles.talkingIndicator}>
              <div className={styles.speakerIcon}>
                <Volume2 size={12} />
              </div>
              <div className={styles.speechWaves}>
                <div className={styles.speechWave}></div>
                <div className={styles.speechWave}></div>
                <div className={styles.speechWave}></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Voice Controls */}
      {/* <div className={styles.voiceControls}>

      {/* Hebrew State Indicator */}
      <StateIndicator 
        state={animationState} 
        isVisible={animationState !== 'idle'} 
      />

      {/* Enhanced Voice Settings Modal */}
      <EnhancedVoiceSettings
        isOpen={showVoiceSettings}
        onClose={() => setShowVoiceSettings(false)}
        currentSettings={voiceSettings}
        onSettingsChange={(newSettings) => {
          setVoiceSettings(newSettings);
          // Save to localStorage for persistence
          localStorage.setItem('michaelVoiceSettings', JSON.stringify(newSettings));
        }}
      />
    </div>
  );
};

export default MichaelChatAvatar; 