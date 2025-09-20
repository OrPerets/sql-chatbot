'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './MobileVoiceControls.module.css';

interface TouchGesture {
  type: 'tap' | 'long-press' | 'swipe-up' | 'swipe-down' | 'swipe-left' | 'swipe-right' | 'double-tap';
  duration?: number;
  distance?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

interface MobileVoiceControlsProps {
  isRecording?: boolean;
  isPlaying?: boolean;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  onPlayPause?: () => void;
  onVolumeChange?: (volume: number) => void;
  onSpeedChange?: (speed: number) => void;
  volume?: number;
  speed?: number;
  enableHapticFeedback?: boolean;
  gestureEnabled?: boolean;
  showVisualFeedback?: boolean;
}

interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

const MobileVoiceControls: React.FC<MobileVoiceControlsProps> = ({
  isRecording = false,
  isPlaying = false,
  onStartRecording,
  onStopRecording,
  onPlayPause,
  onVolumeChange,
  onSpeedChange,
  volume = 50,
  speed = 1.0,
  enableHapticFeedback = true,
  gestureEnabled = true,
  showVisualFeedback = true
}) => {
  const [touchStart, setTouchStart] = useState<TouchPoint | null>(null);
  const [touchCurrent, setTouchCurrent] = useState<TouchPoint | null>(null);
  const [isPressed, setIsPressed] = useState(false);
  const [pressStartTime, setPressStartTime] = useState<number>(0);
  const [gestureDetected, setGestureDetected] = useState<TouchGesture | null>(null);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showSpeedSlider, setShowSpeedSlider] = useState(false);
  const [ripplePosition, setRipplePosition] = useState<{x: number, y: number} | null>(null);
  
  const controlsRef = useRef<HTMLDivElement>(null);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const doubleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapTimeRef = useRef<number>(0);

  // Haptic feedback function
  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error') => {
    if (!enableHapticFeedback || !('vibrate' in navigator)) return;

    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30],
      success: [10, 50, 10],
      warning: [20, 100, 20],
      error: [50, 100, 50, 100, 50]
    };

    navigator.vibrate(patterns[type]);
  }, [enableHapticFeedback]);

  // Touch gesture detection
  const detectGesture = useCallback((start: TouchPoint, end: TouchPoint, duration: number): TouchGesture | null => {
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Long press detection
    if (duration > 800 && distance < 20) {
      return { type: 'long-press', duration };
    }

    // Swipe detection
    if (distance > 50) {
      const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
      
      if (Math.abs(angle) < 45) {
        return { type: 'swipe-right', distance, direction: 'right' };
      } else if (Math.abs(angle) > 135) {
        return { type: 'swipe-left', distance, direction: 'left' };
      } else if (angle > 45 && angle < 135) {
        return { type: 'swipe-down', distance, direction: 'down' };
      } else if (angle > -135 && angle < -45) {
        return { type: 'swipe-up', distance, direction: 'up' };
      }
    }

    // Quick tap
    if (duration < 300 && distance < 20) {
      return { type: 'tap', duration };
    }

    return null;
  }, []);

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    
    const touch = e.touches[0];
    const rect = controlsRef.current?.getBoundingClientRect();
    if (!rect) return;

    const touchPoint: TouchPoint = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
      timestamp: Date.now()
    };

    setTouchStart(touchPoint);
    setTouchCurrent(touchPoint);
    setIsPressed(true);
    setPressStartTime(Date.now());

    // Show ripple effect
    if (showVisualFeedback) {
      setRipplePosition({ x: touchPoint.x, y: touchPoint.y });
    }

    // Start long press timer
    longPressTimeoutRef.current = setTimeout(() => {
      triggerHaptic('medium');
      setGestureDetected({ type: 'long-press', duration: Date.now() - pressStartTime });
    }, 800);

    triggerHaptic('light');
  }, [showVisualFeedback, triggerHaptic, pressStartTime]);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    
    if (!touchStart) return;

    const touch = e.touches[0];
    const rect = controlsRef.current?.getBoundingClientRect();
    if (!rect) return;

    const touchPoint: TouchPoint = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
      timestamp: Date.now()
    };

    setTouchCurrent(touchPoint);

    // Cancel long press if moved too much
    const distance = Math.sqrt(
      Math.pow(touchPoint.x - touchStart.x, 2) + 
      Math.pow(touchPoint.y - touchStart.y, 2)
    );

    if (distance > 20 && longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }, [touchStart]);

  // Handle touch end
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    
    if (!touchStart || !touchCurrent) return;

    const endTime = Date.now();
    const duration = endTime - pressStartTime;
    const gesture = detectGesture(touchStart, touchCurrent, duration);

    // Clear timers
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    // Handle double tap detection
    if (gesture?.type === 'tap') {
      const timeSinceLastTap = endTime - lastTapTimeRef.current;
      
      if (timeSinceLastTap < 300) {
        // Double tap detected
        setGestureDetected({ type: 'double-tap', duration });
        triggerHaptic('success');
        handleDoubleTap();
      } else {
        // Single tap - wait to see if there's a second tap
        doubleTapTimeoutRef.current = setTimeout(() => {
          handleSingleTap();
        }, 300);
      }
      
      lastTapTimeRef.current = endTime;
    } else if (gesture) {
      setGestureDetected(gesture);
      handleGesture(gesture);
    }

    // Reset state
    setTouchStart(null);
    setTouchCurrent(null);
    setIsPressed(false);
    setPressStartTime(0);
    
    // Clear ripple effect
    setTimeout(() => setRipplePosition(null), 600);
  }, [touchStart, touchCurrent, pressStartTime, detectGesture, triggerHaptic]);

  // Gesture handlers
  const handleSingleTap = useCallback(() => {
    if (isRecording) {
      onStopRecording?.();
    } else {
      onStartRecording?.();
    }
    triggerHaptic('light');
  }, [isRecording, onStartRecording, onStopRecording, triggerHaptic]);

  const handleDoubleTap = useCallback(() => {
    onPlayPause?.();
    triggerHaptic('medium');
  }, [onPlayPause, triggerHaptic]);

  const handleGesture = useCallback((gesture: TouchGesture) => {
    switch (gesture.type) {
      case 'long-press':
        // Toggle volume slider
        setShowVolumeSlider(prev => !prev);
        setShowSpeedSlider(false);
        triggerHaptic('heavy');
        break;
        
      case 'swipe-up':
        // Increase volume
        const newVolumeUp = Math.min(100, volume + 10);
        onVolumeChange?.(newVolumeUp);
        triggerHaptic('light');
        break;
        
      case 'swipe-down':
        // Decrease volume
        const newVolumeDown = Math.max(0, volume - 10);
        onVolumeChange?.(newVolumeDown);
        triggerHaptic('light');
        break;
        
      case 'swipe-left':
        // Decrease speed
        const newSpeedDown = Math.max(0.5, speed - 0.1);
        onSpeedChange?.(Number(newSpeedDown.toFixed(1)));
        triggerHaptic('light');
        break;
        
      case 'swipe-right':
        // Increase speed
        const newSpeedUp = Math.min(2.0, speed + 0.1);
        onSpeedChange?.(Number(newSpeedUp.toFixed(1)));
        triggerHaptic('light');
        break;
    }
  }, [volume, speed, onVolumeChange, onSpeedChange, triggerHaptic]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
      }
      if (doubleTapTimeoutRef.current) {
        clearTimeout(doubleTapTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={styles.mobileVoiceControls}>
      {/* Main Control Button */}
      <div
        ref={controlsRef}
        className={`${styles.mainControl} ${isPressed ? styles.pressed : ''} ${isRecording ? styles.recording : ''}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="button"
        aria-label={isRecording ? "Stop recording" : "Start recording"}
        tabIndex={0}
      >
        {/* Ripple Effect */}
        {ripplePosition && showVisualFeedback && (
          <div 
            className={styles.ripple}
            style={{
              left: `${ripplePosition.x}px`,
              top: `${ripplePosition.y}px`
            }}
          />
        )}
        
        {/* Main Icon */}
        <div className={styles.mainIcon}>
          {isRecording ? (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          )}
        </div>
        
        {/* Status Ring */}
        <div className={`${styles.statusRing} ${isRecording ? styles.active : ''}`} />
        
        {/* Gesture Indicator */}
        {gestureDetected && showVisualFeedback && (
          <div className={styles.gestureIndicator}>
            {gestureDetected.type.replace('-', ' ').toUpperCase()}
          </div>
        )}
      </div>
      
      {/* Volume Slider */}
      {showVolumeSlider && (
        <div className={styles.sliderPanel}>
          <div className={styles.sliderHeader}>
            <span>🔊 Volume</span>
            <button 
              className={styles.closeSlider}
              onClick={() => setShowVolumeSlider(false)}
              aria-label="Close volume slider"
            >
              ×
            </button>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => onVolumeChange?.(Number(e.target.value))}
            className={styles.slider}
            aria-label="Volume control"
          />
          <div className={styles.sliderValue}>{volume}%</div>
        </div>
      )}
      
      {/* Speed Slider */}
      {showSpeedSlider && (
        <div className={styles.sliderPanel}>
          <div className={styles.sliderHeader}>
            <span>⚡ Speed</span>
            <button 
              className={styles.closeSlider}
              onClick={() => setShowSpeedSlider(false)}
              aria-label="Close speed slider"
            >
              ×
            </button>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={speed}
            onChange={(e) => onSpeedChange?.(Number(e.target.value))}
            className={styles.slider}
            aria-label="Speed control"
          />
          <div className={styles.sliderValue}>{speed}x</div>
        </div>
      )}
      
      {/* Gesture Help */}
      {gestureEnabled && (
        <div className={styles.gestureHelp}>
          <div className={styles.helpItem}>👆 Tap: Record</div>
          <div className={styles.helpItem}>👆👆 Double tap: Play/Pause</div>
          <div className={styles.helpItem}>👆⏱️ Long press: Volume</div>
          <div className={styles.helpItem}>👆↕️ Swipe up/down: Volume</div>
          <div className={styles.helpItem}>👆↔️ Swipe left/right: Speed</div>
        </div>
      )}
    </div>
  );
};

export default MobileVoiceControls;
