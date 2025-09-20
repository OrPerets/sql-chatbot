'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import styles from './VoiceModeCircle.module.css';
import { enhancedTTS, TTSOptions } from '../utils/enhanced-tts';

interface VoiceModeCircleProps {
  state?: 'idle' | 'speaking' | 'listening' | 'thinking' | 'userWriting';
  size?: 'small' | 'medium' | 'large';
  text?: string;
  onSpeakingStart?: () => void;
  onSpeakingEnd?: () => void;
  audioData?: Uint8Array; // Real-time audio data for visualization
  voiceActivityLevel?: number; // Voice activity level (0-100)
  enableAccessibility?: boolean;
}

const VoiceModeCircle: React.FC<VoiceModeCircleProps> = ({
  state = 'idle',
  size = 'medium',
  text,
  onSpeakingStart,
  onSpeakingEnd,
  audioData,
  voiceActivityLevel = 0,
  enableAccessibility = true,
}) => {
  const circleRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  
  // State for touch interactions and animations
  const [isPressed, setIsPressed] = useState(false);
  const [touchStartTime, setTouchStartTime] = useState<number>(0);
  const [currentVoiceLevel, setCurrentVoiceLevel] = useState<number>(0);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastSpokenText, setLastSpokenText] = useState<string>('');
  const speakingInProgress = useRef<boolean>(false);

  const getSizeStyle = () => {
    const sizes = {
      small: { width: '200px', height: '200px' },
      medium: { width: '300px', height: '300px' },
      large: { width: '400px', height: '400px' },
    };
    return sizes[size];
  };

  const getStateClass = () => {
    switch (state) {
      case 'speaking':
        return styles.speaking;
      case 'listening':
        return styles.listening;
      case 'thinking':
        return styles.thinking;
      case 'userWriting':
        return styles.userWriting;
      default:
        return styles.idle;
    }
  };

  // Real-time waveform visualization
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioData) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Set up gradient for waveform
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
    gradient.addColorStop(0.5, 'rgba(99, 102, 241, 1)');
    gradient.addColorStop(1, 'rgba(139, 92, 246, 0.8)');
    
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    
    // Draw waveform
    ctx.beginPath();
    const sliceWidth = width / audioData.length;
    let x = 0;
    
    for (let i = 0; i < audioData.length; i++) {
      const v = audioData[i] / 128.0;
      const y = v * centerY;
      
      if (i === 0) {
        ctx.moveTo(x, centerY + y);
      } else {
        ctx.lineTo(x, centerY + y);
      }
      
      x += sliceWidth;
    }
    
    ctx.stroke();
    
    // Continue animation
    animationFrameRef.current = requestAnimationFrame(drawWaveform);
  }, [audioData]);
  
  // Update voice activity level with smooth animation
  useEffect(() => {
    const targetLevel = voiceActivityLevel;
    const currentLevel = currentVoiceLevel;
    const diff = targetLevel - currentLevel;
    
    if (Math.abs(diff) > 1) {
      const increment = diff * 0.1; // Smooth transition
      setCurrentVoiceLevel(prev => prev + increment);
    }
  }, [voiceActivityLevel, currentVoiceLevel]);
  
  // Start/stop waveform animation based on state
  useEffect(() => {
    if ((state === 'listening' || state === 'speaking') && audioData) {
      drawWaveform();
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [state, audioData, drawWaveform]);
  
  // Touch and gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    setIsPressed(true);
    setTouchStartTime(Date.now());
    
    // Add haptic feedback if available
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  };
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    setIsPressed(false);
    
    const touchDuration = Date.now() - touchStartTime;
    
    // Handle different touch gestures
    if (touchDuration < 200) {
      // Quick tap - toggle voice mode
      handleQuickTap();
    } else if (touchDuration > 1000) {
      // Long press - open voice settings
      handleLongPress();
    }
  };
  
  const handleQuickTap = () => {
    // Quick tap functionality - toggle speech
    console.log('🎤 VoiceModeCircle Quick tap detected:', {
      isSpeaking,
      hasText: !!text,
      textLength: text?.length || 0,
      textPreview: text?.substring(0, 50) + '...'
    });
    
    if (isSpeaking) {
      // Stop current speech
      console.log('🎤 VoiceModeCircle Stopping current speech');
      enhancedTTS.stop();
      setIsSpeaking(false);
      onSpeakingEnd?.();
    } else if (text && text.trim()) {
      // Start speaking
      console.log('🎤 VoiceModeCircle Starting speech manually');
      speakText(text);
    } else {
      console.log('🎤 VoiceModeCircle No text to speak');
    }
  };
  
  const handleLongPress = () => {
    // Long press functionality - could open settings
    console.log('Long press detected');
    // Add haptic feedback for long press
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
  };
  
  // Speech functionality
  const speakText = useCallback(async (textToSpeak: string) => {
    if (!textToSpeak?.trim() || speakingInProgress.current) return;
    
    console.log('🎤 VoiceModeCircle starting speech:', textToSpeak.substring(0, 50) + '...');
    
    try {
      speakingInProgress.current = true;
      setIsSpeaking(true);
      setLastSpokenText(textToSpeak);
      onSpeakingStart?.();
      
      const ttsOptions: TTSOptions = {
        voice: 'echo',
        speed: 1.0,
        volume: 0.9,
        useOpenAI: true,
        characterStyle: 'university_ta',
        enhanceProsody: true,
      };
      
      await enhancedTTS.speak(textToSpeak, ttsOptions);
      
      console.log('🎤 VoiceModeCircle speech completed');
      
    } catch (error) {
      console.error('💥 VoiceModeCircle speech failed:', error);
    } finally {
      speakingInProgress.current = false;
      setIsSpeaking(false);
      onSpeakingEnd?.();
    }
  }, [onSpeakingStart, onSpeakingEnd]);
  
  // Auto-speak when state becomes speaking and we have text
  useEffect(() => {
    console.log('🎤 VoiceModeCircle state/text change:', {
      state,
      hasText: !!text,
      textLength: text?.length || 0,
      textPreview: text?.substring(0, 50) + '...',
      lastSpokenText: lastSpokenText?.substring(0, 30) + '...',
      speakingInProgress: speakingInProgress.current,
      isSpeaking
    });
    
    if (state === 'speaking' && text && text.trim() && text !== lastSpokenText && !speakingInProgress.current) {
      console.log('🎤 VoiceModeCircle auto-speaking new text:', text.substring(0, 50) + '...');
      speakText(text);
    }
    
    // Stop speaking if state changes away from speaking
    if (state !== 'speaking' && isSpeaking) {
      console.log('🎤 VoiceModeCircle stopping speech due to state change');
      enhancedTTS.stop();
      setIsSpeaking(false);
      speakingInProgress.current = false;
    }
  }, [state, text, lastSpokenText, speakText, isSpeaking]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (speakingInProgress.current) {
        enhancedTTS.stop();
      }
    };
  }, []);

  // Keyboard navigation handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleQuickTap();
    }
  };
  
  const getStateIcon = () => {
    switch (state) {
      case 'speaking':
        return (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        );
      case 'listening':
        return (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        );
      case 'thinking':
        return (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
            <line x1="9" y1="9" x2="9.01" y2="9"/>
            <line x1="15" y1="9" x2="15.01" y2="9"/>
          </svg>
        );
      case 'userWriting':
        return (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
            <path d="m15 5 4 4"/>
          </svg>
        );
      default:
        return (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        );
    }
  };

  useEffect(() => {
    if (state === 'speaking' && onSpeakingStart) {
      onSpeakingStart();
    } else if (state !== 'speaking' && onSpeakingEnd) {
      onSpeakingEnd();
    }
  }, [state, onSpeakingStart, onSpeakingEnd]);

  // Get ARIA label for accessibility
  const getAriaLabel = () => {
    const stateLabels = {
      idle: 'Voice mode idle, ready to interact',
      speaking: `Speaking: ${text?.substring(0, 50) || 'Assistant is speaking'}`,
      listening: 'Listening for voice input',
      thinking: 'Processing your request',
      userWriting: 'User is typing'
    };
    return stateLabels[state] || 'Voice mode active';
  };
  
  // Get voice activity indicator bars
  const getVoiceActivityBars = () => {
    const bars = [];
    const barCount = 8;
    const baseHeight = 4;
    
    for (let i = 0; i < barCount; i++) {
      const height = baseHeight + (currentVoiceLevel / 100) * (20 - baseHeight) * Math.random();
      bars.push(
        <div
          key={i}
          className={styles.voiceActivityBar}
          style={{
            height: `${height}px`,
            animationDelay: `${i * 0.1}s`,
            opacity: currentVoiceLevel > 10 ? 1 : 0.3
          }}
        />
      );
    }
    return bars;
  };
  
  return (
    <div 
      ref={circleRef}
      className={`${styles.voiceCircle} ${getStateClass()} ${isPressed ? styles.pressed : ''}`}
      style={{ ...getSizeStyle(), cursor: 'pointer' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleQuickTap}
      onKeyDown={handleKeyDown}
      tabIndex={enableAccessibility ? 0 : -1}
      role={enableAccessibility ? 'button' : undefined}
      aria-label={enableAccessibility ? getAriaLabel() : undefined}
      aria-pressed={enableAccessibility ? (state === 'speaking' || state === 'listening') : undefined}
    >
      {/* Main circle background */}
      <div className={styles.circleBackground}>
        {/* Animated rings */}
        <div ref={animationRef} className={styles.animationRings}>
          <div className={styles.ring1}></div>
          <div className={styles.ring2}></div>
          <div className={styles.ring3}></div>
        </div>
        
        {/* Real-time waveform canvas */}
        {(state === 'listening' || state === 'speaking') && (
          <canvas
            ref={canvasRef}
            className={styles.waveformCanvas}
            width={200}
            height={60}
            aria-hidden="true"
          />
        )}
        
        {/* Voice activity level indicators */}
        {state === 'listening' && (
          <div className={styles.voiceActivityIndicator}>
            {getVoiceActivityBars()}
          </div>
        )}
        
        {/* Center icon */}
        <div className={styles.centerIcon}>
          {getStateIcon()}
          
          {/* Voice level text for accessibility */}
          {enableAccessibility && currentVoiceLevel > 0 && (
            <span className={styles.srOnly}>
              Voice activity level: {Math.round(currentVoiceLevel)}%
            </span>
          )}
        </div>
        
        {/* Sound waves for listening state */}
        {state === 'listening' && (
          <div className={styles.soundWaves}>
            <div className={styles.wave1}></div>
            <div className={styles.wave2}></div>
            <div className={styles.wave3}></div>
            <div className={styles.wave4}></div>
          </div>
        )}
        
        {/* Ripple effects for speaking state */}
        {state === 'speaking' && (
          <div className={styles.rippleEffects}>
            <div className={styles.ripple1}></div>
            <div className={styles.ripple2}></div>
            <div className={styles.ripple3}></div>
          </div>
        )}
        
        {/* Thinking animation */}
        {state === 'thinking' && (
          <div className={styles.thinkingDots}>
            <div className={styles.dot1}></div>
            <div className={styles.dot2}></div>
            <div className={styles.dot3}></div>
          </div>
        )}
        
        {/* Pulsing animation during speech generation */}
        {state === 'speaking' && (
          <div className={styles.speechPulse}>
            <div className={styles.pulse1}></div>
            <div className={styles.pulse2}></div>
            <div className={styles.pulse3}></div>
          </div>
        )}
      </div>
      
      {/* Touch interaction feedback */}
      {isPressed && (
        <div className={styles.touchFeedback} aria-hidden="true">
          <div className={styles.touchRipple}></div>
        </div>
      )}
      
      {/* State description for screen readers */}
      {enableAccessibility && (
        <div className={styles.srOnly} aria-live="polite">
          Current state: {state}. Voice activity: {Math.round(currentVoiceLevel)}%
        </div>
      )}
    </div>
  );
};

export default VoiceModeCircle;
