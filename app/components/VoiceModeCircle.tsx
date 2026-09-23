'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './VoiceModeCircle.module.css';
import {
  DEFAULT_AVATAR_RENDER_CONFIG,
  type AvatarRenderConfig,
  type GesturePlan,
  type SpeechControllerStatus,
} from '../utils/avatar-speech-controller';

interface VoiceModeCircleProps {
  state?: 'idle' | 'speaking' | 'listening' | 'thinking' | 'userWriting';
  size?: 'small' | 'medium' | 'large';
  text?: string;
  onSpeakingStart?: () => void;
  onSpeakingEnd?: () => void;
  audioData?: Uint8Array;
  voiceActivityLevel?: number;
  enableAccessibility?: boolean;
  speechStatus?: SpeechControllerStatus;
  gesturePlan?: GesturePlan | null;
  renderConfig?: AvatarRenderConfig;
  onPrimaryAction?: () => void;
}

const MAX_WAVE_SAMPLES = 48;

const VoiceModeCircle: React.FC<VoiceModeCircleProps> = ({
  state = 'idle',
  size = 'medium',
  text,
  onSpeakingStart,
  onSpeakingEnd,
  audioData,
  voiceActivityLevel = 0,
  enableAccessibility = true,
  speechStatus = 'idle',
  gesturePlan = null,
  renderConfig = DEFAULT_AVATAR_RENDER_CONFIG,
  onPrimaryAction,
}) => {
  const circleRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const previousSpeakingRef = useRef(false);

  const [isPressed, setIsPressed] = useState(false);
  const [touchStartTime, setTouchStartTime] = useState<number>(0);
  const [currentVoiceLevel, setCurrentVoiceLevel] = useState<number>(0);

  const mergedRenderConfig = useMemo(
    () => ({
      ...DEFAULT_AVATAR_RENDER_CONFIG,
      ...renderConfig,
    }),
    [renderConfig]
  );

  const visualState = speechStatus === 'speaking' || speechStatus === 'preparing' ? 'speaking' : state;
  const isSpeaking = visualState === 'speaking';
  const sampledAudio = useMemo(() => {
    if (!audioData || audioData.length === 0) {
      return null;
    }

    if (audioData.length <= MAX_WAVE_SAMPLES) {
      return audioData;
    }

    const step = Math.ceil(audioData.length / MAX_WAVE_SAMPLES);
    return audioData.filter((_, index) => index % step === 0).slice(0, MAX_WAVE_SAMPLES);
  }, [audioData]);

  const getSizeStyle = () => {
    const sizes = {
      small: { width: '200px', height: '200px' },
      medium: { width: '300px', height: '300px' },
      large: { width: '400px', height: '400px' },
    };
    return sizes[size];
  };

  const getStateClass = () => {
    switch (visualState) {
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

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sampledAudio || !isSpeaking) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;
    context.clearRect(0, 0, width, height);

    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.7)');
    gradient.addColorStop(0.5, 'rgba(99, 102, 241, 1)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.72)');
    context.strokeStyle = gradient;
    context.lineWidth = 2;
    context.lineCap = 'round';

    const sliceWidth = width / sampledAudio.length;
    let x = 0;
    context.beginPath();

    for (let index = 0; index < sampledAudio.length; index += 1) {
      const amplitude = ((sampledAudio[index] ?? 128) - 128) / 128;
      const intensity = 1 + (gesturePlan?.intensity ?? 0.35);
      const y = centerY + amplitude * (centerY * 0.8) * intensity;

      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
      x += sliceWidth;
    }

    context.stroke();
    animationFrameRef.current = requestAnimationFrame(drawWaveform);
  }, [gesturePlan?.intensity, isSpeaking, sampledAudio]);

  useEffect(() => {
    const speakingNow = speechStatus === 'speaking' || speechStatus === 'preparing';
    if (speakingNow && !previousSpeakingRef.current) {
      onSpeakingStart?.();
    }
    if (!speakingNow && previousSpeakingRef.current) {
      onSpeakingEnd?.();
    }
    previousSpeakingRef.current = speakingNow;
  }, [onSpeakingEnd, onSpeakingStart, speechStatus]);

  useEffect(() => {
    const targetLevel =
      sampledAudio && isSpeaking
        ? Math.min(100, voiceActivityLevel + Math.round((gesturePlan?.intensity ?? 0.4) * 20))
        : voiceActivityLevel;

    const frame = window.setTimeout(() => {
      setCurrentVoiceLevel((previous) => previous + (targetLevel - previous) * 0.22);
    }, 40);

    return () => {
      window.clearTimeout(frame);
    };
  }, [gesturePlan?.intensity, isSpeaking, sampledAudio, voiceActivityLevel]);

  useEffect(() => {
    if (isSpeaking && sampledAudio) {
      drawWaveform();
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    return undefined;
  }, [drawWaveform, isSpeaking, sampledAudio]);

  const handleTouchStart = (event: React.TouchEvent) => {
    event.preventDefault();
    setIsPressed(true);
    setTouchStartTime(Date.now());
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    event.preventDefault();
    setIsPressed(false);
    const touchDuration = Date.now() - touchStartTime;
    if (touchDuration < 450) {
      onPrimaryAction?.();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onPrimaryAction?.();
    }
  };

  const getStateIcon = () => {
    switch (visualState) {
      case 'speaking':
      case 'listening':
        return (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        );
      case 'thinking':
        return (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
          </svg>
        );
      case 'userWriting':
        return (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
        );
      default:
        return (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4l3 3" />
          </svg>
        );
    }
  };

  const getAriaLabel = () => {
    if (isSpeaking) {
      return `Assistant speaking${text ? `: ${text.substring(0, 50)}` : ''}`;
    }
    if (visualState === 'thinking') {
      return 'Assistant is thinking';
    }
    if (visualState === 'listening') {
      return 'Listening for voice input';
    }
    if (visualState === 'userWriting') {
      return 'User is typing';
    }
    return 'Voice circle idle';
  };

  const activityBarCount = mergedRenderConfig.motionProfile === 'expressive' ? 8 : 6;

  return (
    <div
      ref={circleRef}
      className={`${styles.voiceCircle} ${getStateClass()} ${isPressed ? styles.pressed : ''}`}
      style={{ ...getSizeStyle(), cursor: onPrimaryAction ? 'pointer' : 'default' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={() => onPrimaryAction?.()}
      onKeyDown={handleKeyDown}
      tabIndex={enableAccessibility && onPrimaryAction ? 0 : -1}
      role={enableAccessibility && onPrimaryAction ? 'button' : undefined}
      aria-label={enableAccessibility ? getAriaLabel() : undefined}
      aria-pressed={enableAccessibility ? isSpeaking : undefined}
    >
      <div className={styles.circleBackground}>
        <div className={styles.animationRings}>
          <div className={styles.ring1}></div>
          <div className={styles.ring2}></div>
          <div className={styles.ring3}></div>
        </div>

        {isSpeaking && sampledAudio && (
          <canvas
            ref={canvasRef}
            className={styles.waveformCanvas}
            width={140}
            height={54}
            aria-hidden="true"
          />
        )}

        {visualState === 'listening' && (
          <div className={styles.voiceActivityIndicator}>
            {Array.from({ length: activityBarCount }).map((_, index) => {
              const height = 6 + (currentVoiceLevel / 100) * (20 - 6) * ((index + 2) / activityBarCount);
              return (
                <div
                  key={`activity-${index}`}
                  className={styles.voiceActivityBar}
                  style={{
                    height: `${height}px`,
                    animationDelay: `${index * 0.08}s`,
                    opacity: currentVoiceLevel > 8 ? 1 : 0.35,
                  }}
                />
              );
            })}
          </div>
        )}

        <div className={styles.centerIcon}>{getStateIcon()}</div>

        {visualState === 'listening' && (
          <div className={styles.soundWaves}>
            <div className={styles.wave1}></div>
            <div className={styles.wave2}></div>
            <div className={styles.wave3}></div>
            <div className={styles.wave4}></div>
          </div>
        )}

        {isSpeaking && (
          <div className={styles.rippleEffects}>
            <div className={styles.ripple1}></div>
            <div className={styles.ripple2}></div>
            <div className={styles.ripple3}></div>
          </div>
        )}

        {visualState === 'thinking' && (
          <div className={styles.thinkingDots}>
            <div className={styles.dot1}></div>
            <div className={styles.dot2}></div>
            <div className={styles.dot3}></div>
          </div>
        )}

        {isSpeaking && (
          <div className={styles.speechPulse}>
            <div className={styles.pulse1}></div>
            <div className={styles.pulse2}></div>
            <div className={styles.pulse3}></div>
          </div>
        )}
      </div>

      {isPressed && (
        <div className={styles.touchFeedback} aria-hidden="true">
          <div className={styles.touchRipple}></div>
        </div>
      )}

      {enableAccessibility && (
        <div className={styles.srOnly} aria-live="polite">
          Current state: {visualState}. Voice activity: {Math.round(currentVoiceLevel)}%
        </div>
      )}
    </div>
  );
};

export default VoiceModeCircle;
