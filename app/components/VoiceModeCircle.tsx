'use client';

import React, { useEffect, useRef } from 'react';
import styles from './VoiceModeCircle.module.css';

interface VoiceModeCircleProps {
  state?: 'idle' | 'speaking' | 'listening' | 'thinking' | 'userWriting';
  size?: 'small' | 'medium' | 'large';
  text?: string;
  onSpeakingStart?: () => void;
  onSpeakingEnd?: () => void;
}

const VoiceModeCircle: React.FC<VoiceModeCircleProps> = ({
  state = 'idle',
  size = 'medium',
  text,
  onSpeakingStart,
  onSpeakingEnd,
}) => {
  const circleRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<HTMLDivElement>(null);

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

  return (
    <div 
      ref={circleRef}
      className={`${styles.voiceCircle} ${getStateClass()}`}
      style={getSizeStyle()}
    >
      {/* Main circle background */}
      <div className={styles.circleBackground}>
        {/* Animated rings */}
        <div ref={animationRef} className={styles.animationRings}>
          <div className={styles.ring1}></div>
          <div className={styles.ring2}></div>
          <div className={styles.ring3}></div>
        </div>
        
        {/* Center icon */}
        <div className={styles.centerIcon}>
          {getStateIcon()}
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
      </div>
    </div>
  );
};

export default VoiceModeCircle;
