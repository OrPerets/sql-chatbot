"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, Settings, Mic, MicOff } from 'lucide-react';
import styles from './michael-3d-simple.module.css';

interface Michael3DSimpleProps {
  text?: string;
  autoPlay?: boolean;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  isListening?: boolean;
  onToggleListening?: () => void;
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

type AvatarState = "idle" | "listening" | "talking" | "thinking";

// Simple 3D-style Michael Character using CSS 3D transforms
const MichaelCharacter3D: React.FC<{ 
  state: AvatarState;
  animationTime: number;
}> = ({ state, animationTime }) => {
  const [blinkPhase, setBlinkPhase] = useState(0);
  
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlinkPhase(prev => (prev + 1) % 100);
    }, 50);
    return () => clearInterval(blinkInterval);
  }, []);

  const getStateColors = () => {
    switch (state) {
      case 'thinking':
        return { primary: '#8B5CF6', secondary: '#A78BFA', accent: '#C4B5FD', shadow: 'rgba(139, 92, 246, 0.3)' };
      case 'listening':
        return { primary: '#10B981', secondary: '#34D399', accent: '#6EE7B7', shadow: 'rgba(16, 185, 129, 0.3)' };
      case 'talking':
        return { primary: '#EF4444', secondary: '#F87171', accent: '#FCA5A5', shadow: 'rgba(239, 68, 68, 0.3)' };
      default:
        return { primary: '#3B82F6', secondary: '#60A5FA', accent: '#93C5FD', shadow: 'rgba(59, 130, 246, 0.3)' };
    }
  };

  const colors = getStateColors();
  
  // Animation calculations
  const baseFloat = Math.sin(animationTime * 1.5) * 3;
  const headBob = Math.sin(animationTime * 2) * 1;
  const armSway = Math.sin(animationTime * 1.2) * 5;
  
  // State-specific transformations
  const getStateTransform = () => {
    switch (state) {
      case 'thinking':
        return `rotateX(5deg) rotateY(${Math.sin(animationTime * 0.8) * 10}deg)`;
      case 'listening':
        return `rotateX(-3deg) rotateY(${Math.sin(animationTime * 0.5) * 5}deg)`;
      case 'talking':
        return `rotateX(${Math.sin(animationTime * 4) * 3}deg) rotateY(${Math.sin(animationTime * 2) * 8}deg)`;
      default:
        return `rotateX(${Math.sin(animationTime * 0.8) * 2}deg) rotateY(${Math.sin(animationTime * 0.6) * 3}deg)`;
    }
  };

  const eyeScale = blinkPhase > 95 ? 0.1 : 1;
  const mouthScale = state === 'talking' ? 1 + Math.sin(animationTime * 12) * 0.3 : 1;

  return (
    <div 
      className={`${styles.character} ${styles[state]}`}
      style={{
        transform: `translateY(${baseFloat}px) ${getStateTransform()}`,
        boxShadow: `0 20px 60px ${colors.shadow}`,
      }}
    >
      {/* Character Container */}
      <div className={styles.characterBody}>
        
        {/* Head */}
        <div 
          className={styles.head}
          style={{
            transform: `translateY(${headBob}px)`,
            background: `linear-gradient(135deg, #FDBCB4, #F4A195)`,
          }}
        >
          {/* Hair */}
          <div 
            className={styles.hair}
            style={{ background: `linear-gradient(135deg, #8B4513, #6B3410)` }}
          />
          
          {/* Eyes */}
          <div className={styles.eyesContainer}>
            <div 
              className={styles.eye}
              style={{ 
                transform: `scaleY(${eyeScale})`,
                background: 'radial-gradient(circle, #2D3748, #000)'
              }}
            />
            <div 
              className={styles.eye}
              style={{ 
                transform: `scaleY(${eyeScale})`,
                background: 'radial-gradient(circle, #2D3748, #000)'
              }}
            />
          </div>
          
          {/* Nose */}
          <div 
            className={styles.nose}
            style={{ background: '#FDBCB4' }}
          />
          
          {/* Mouth */}
          <div 
            className={styles.mouth}
            style={{ 
              transform: `scale(${mouthScale})`,
              background: colors.accent 
            }}
          />
        </div>

        {/* Torso */}
        <div 
          className={styles.torso}
          style={{
            background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
          }}
        />

        {/* Arms */}
        <div 
          className={styles.leftArm}
          style={{
            transform: `rotate(${armSway + (state === 'thinking' ? 15 : 0)}deg)`,
            background: `linear-gradient(135deg, #FDBCB4, #F4A195)`,
          }}
        >
          <div className={styles.hand} style={{ background: '#FDBCB4' }} />
        </div>
        
        <div 
          className={styles.rightArm}
          style={{
            transform: `rotate(${-armSway + (state === 'thinking' ? -30 : 0)}deg)`,
            background: `linear-gradient(135deg, #FDBCB4, #F4A195)`,
          }}
        >
          <div className={styles.hand} style={{ background: '#FDBCB4' }} />
        </div>

        {/* Legs */}
        <div 
          className={styles.leftLeg}
          style={{
            background: `linear-gradient(135deg, ${colors.secondary}, ${colors.accent})`,
          }}
        >
          <div className={styles.foot} style={{ background: '#2D3748' }} />
        </div>
        
        <div 
          className={styles.rightLeg}
          style={{
            background: `linear-gradient(135deg, ${colors.secondary}, ${colors.accent})`,
          }}
        >
          <div className={styles.foot} style={{ background: '#2D3748' }} />
        </div>
      </div>

      {/* State Effects */}
      {state === 'thinking' && (
        <div className={styles.thinkingEffect}>
          <div className={styles.thoughtBubble}>🤔</div>
        </div>
      )}

      {state === 'listening' && (
        <div className={styles.listeningEffect}>
          <div className={styles.soundWave} />
          <div className={styles.soundWave} />
          <div className={styles.soundWave} />
        </div>
      )}

      {state === 'talking' && (
        <div className={styles.talkingEffect}>
          <div className={styles.speechBubble}>💬</div>
        </div>
      )}

      {/* Floating particles */}
      <div className={styles.particleContainer}>
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className={styles.particle}
            style={{
              background: colors.accent,
              animationDelay: `${i * 0.5}s`,
              transform: `rotate(${i * 60}deg) translateY(-80px)`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

// Main component with same interface as the original
const Michael3DSimple: React.FC<Michael3DSimpleProps> = ({ 
  text, 
  autoPlay = false,
  onSpeechStart,
  onSpeechEnd,
  isListening = false,
  onToggleListening,
  className = '',
  size = 'medium'
}) => {
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const [isTalking, setIsTalking] = useState(false);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(true);
  const [speechRate, setSpeechRate] = useState(1.3); // Faster but still clear speech rate
  const [showSettings, setShowSettings] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [animationTime, setAnimationTime] = useState(0);
  
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isPlayingRef = useRef(false);

  // Animation timer
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationTime(prev => prev + 0.016);
    }, 16);
    return () => clearInterval(interval);
  }, []);

  const speak = useCallback((textToSpeak: string) => {
    if (!isSpeechEnabled || !textToSpeak.trim()) return;
    
    if (!('speechSynthesis' in window)) {
      console.error('Speech Synthesis not supported');
      return;
    }

    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }

    const cleanText = textToSpeak
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|TABLE|DATABASE)\b/gi, '')
      .replace(/😊|😀|😃|😄|😁|😆|😅|🤣|😂|🙂|🙃|😉|😇|🥰|😍|🤩|😘|😗|😚|😙|😋|😛|😜|🤪|😝|🤑|🤗|🤭|🤫|🤔|🤐|🤨|😐|😑|😶|😏|😒|🙄|😬|🤥|😌|😔|😪|🤤|😴|😷|🤒|🤕|🤢|🤮|🤧|🥵|🥶|🥴|😵|🤯|🤠|🥳|😎|🤓|🧐|🚀|⚡|💡|🎯|🎓|✨|👍|👎|👏|🔧|🛠️|📝|📊|💻|⭐|🎉|🔥|💪|🏆|📈|🎪/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    const finalText = cleanText || textToSpeak;
    const hasHebrew = /[\u0590-\u05FF]/.test(finalText);
    const detectedLanguage = hasHebrew ? 'he-IL' : 'en-US';

    utteranceRef.current = new SpeechSynthesisUtterance(finalText);
    utteranceRef.current.rate = speechRate * 0.9;
    utteranceRef.current.pitch = 0.95;
    utteranceRef.current.volume = 0.85;
    utteranceRef.current.lang = detectedLanguage;

    utteranceRef.current.onstart = () => {
      setIsTalking(true);
      setIsThinking(false);
      setAvatarState('talking');
      isPlayingRef.current = true;
      onSpeechStart?.();
    };

    utteranceRef.current.onend = () => {
      setIsTalking(false);
      setAvatarState('idle');
      isPlayingRef.current = false;
      onSpeechEnd?.();
    };

    utteranceRef.current.onerror = () => {
      setIsTalking(false);
      setAvatarState('idle');
      isPlayingRef.current = false;
      onSpeechEnd?.();
    };

    setIsThinking(true);
    setAvatarState('thinking');
    setTimeout(() => {
      try {
        speechSynthesis.speak(utteranceRef.current!);
      } catch (error) {
        console.error('Error starting speech:', error);
        setIsThinking(false);
        setAvatarState('idle');
      }
    }, 1000);
  }, [isSpeechEnabled, speechRate, onSpeechStart, onSpeechEnd]);

  const stopSpeech = useCallback(() => {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    setIsTalking(false);
    setIsThinking(false);
    setAvatarState('idle');
    isPlayingRef.current = false;
  }, []);

  const toggleSpeech = useCallback(() => {
    if (isTalking) {
      stopSpeech();
    } else if (text) {
      speak(text);
    }
  }, [isTalking, text, speak, stopSpeech]);

  const toggleSpeechEnabled = useCallback(() => {
    setIsSpeechEnabled(!isSpeechEnabled);
    if (isTalking) {
      stopSpeech();
    }
  }, [isSpeechEnabled, isTalking, stopSpeech]);

  // Update avatar state based on props
  useEffect(() => {
    if (isTalking) {
      setAvatarState('talking');
    } else if (isThinking) {
      setAvatarState('thinking');
    } else if (isListening) {
      setAvatarState('listening');
    } else {
      setAvatarState('idle');
    }
  }, [isTalking, isThinking, isListening]);

  // Auto-play effect
  useEffect(() => {
    if (autoPlay && text && isSpeechEnabled && !isPlayingRef.current) {
      const timer = setTimeout(() => {
        if (text && !isPlayingRef.current) {
          speak(text);
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [text, autoPlay, isSpeechEnabled, speak]);

  const getSizeClass = () => {
    switch (size) {
      case 'small': return styles.small;
      case 'large': return styles.large;
      default: return styles.medium;
    }
  };

  return (
    <div className={`${styles.michael3D} ${getSizeClass()} ${styles[avatarState]} ${className}`}>
      <div className={styles.canvasContainer}>
        <MichaelCharacter3D state={avatarState} animationTime={animationTime} />
      </div>

      {/* Control Panel */}
      <div className={styles.controlPanel}>
        <div className={styles.primaryControls}>
          {text && (
            <button
              className={`${styles.controlButton} ${styles.speechButton} ${isTalking ? styles.stopButton : styles.playButton}`}
              onClick={toggleSpeech}
              title={isTalking ? "Stop speaking" : "Speak message"}
              disabled={isThinking}
            >
              {isThinking ? (
                <div className={styles.loadingSpinner}></div>
              ) : isTalking ? (
                <VolumeX size={18} />
              ) : (
                <Volume2 size={18} />
              )}
            </button>
          )}

          {onToggleListening && (
            <button
              className={`${styles.controlButton} ${styles.listenButton} ${isListening ? styles.listeningActive : ''}`}
              onClick={onToggleListening}
              title={isListening ? "Stop listening" : "Start listening"}
              disabled={isTalking || isThinking}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}
        </div>

        <div className={styles.secondaryControls}>
          <button
            className={`${styles.controlButton} ${styles.toggleButton} ${!isSpeechEnabled ? styles.disabled : ''}`}
            onClick={toggleSpeechEnabled}
            title={isSpeechEnabled ? "Disable speech" : "Enable speech"}
          >
            {isSpeechEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>

          <button
            className={`${styles.controlButton} ${styles.settingsButton}`}
            onClick={() => setShowSettings(!showSettings)}
            title="Speech settings"
          >
            <Settings size={14} />
          </button>
        </div>

        {showSettings && (
          <div className={styles.settingsPanel}>
            <div className={styles.settingGroup}>
              <label className={styles.settingLabel}>Speech Rate:</label>
              <div className={styles.sliderContainer}>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={speechRate}
                  onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                  className={styles.slider}
                />
                <span className={styles.sliderValue}>{speechRate.toFixed(1)}x</span>
              </div>
            </div>
            
            <div className={styles.settingGroup}>
              <label className={styles.settingLabel}>Animation:</label>
              <div className={styles.animationStatus}>
                <span className={styles.statusBadge}>
                  {avatarState.charAt(0).toUpperCase() + avatarState.slice(1)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Michael3DSimple; 