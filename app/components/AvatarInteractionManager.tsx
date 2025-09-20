'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { MichaelAvatarDirectRef } from './MichaelAvatarDirect';
import styles from './AvatarInteractionManager.module.css';

interface AvatarInteractionManagerProps {
  children: React.ReactNode;
  avatarRef: React.RefObject<MichaelAvatarDirectRef>;
  onGestureTrigger?: (gesture: string, context: InteractionContext) => void;
  onInteractionAnalytics?: (data: InteractionAnalytics) => void;
  enableHapticFeedback?: boolean;
  enableHoverEffects?: boolean;
  debounceMs?: number;
}

export interface InteractionContext {
  type: 'click' | 'touch' | 'hover' | 'sql_query' | 'auto';
  timestamp: number;
  position?: { x: number; y: number };
  gesture?: string;
  sqlKeywords?: string[];
  userMessage?: string;
}

export interface InteractionAnalytics {
  totalClicks: number;
  totalTouches: number;
  totalHovers: number;
  gestureFrequency: Record<string, number>;
  averageInteractionInterval: number;
  lastInteractionTime: number;
  userPreferencePattern: 'high_interaction' | 'medium_interaction' | 'low_interaction';
}

const AvatarInteractionManager: React.FC<AvatarInteractionManagerProps> = ({
  children,
  avatarRef,
  onGestureTrigger,
  onInteractionAnalytics,
  enableHapticFeedback = true,
  enableHoverEffects = true,
  debounceMs = 300,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [touchStartTime, setTouchStartTime] = useState<number>(0);
  const [lastInteractionTime, setLastInteractionTime] = useState<number>(0);
  const [interactionCounts, setInteractionCounts] = useState({
    clicks: 0,
    touches: 0,
    hovers: 0,
  });
  const [gestureFrequency, setGestureFrequency] = useState<Record<string, number>>({});
  const [currentGesture, setCurrentGesture] = useState<string | null>(null);
  const [isGestureLoading, setIsGestureLoading] = useState(false);
  const [showGestureFeedback, setShowGestureFeedback] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gestureFeedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track interaction analytics
  const trackInteraction = useCallback((type: 'click' | 'touch' | 'hover' | 'sql_query' | 'auto', gesture?: string) => {
    const now = Date.now();
    setLastInteractionTime(now);
    
    // Only track click, touch, and hover interactions in the counts
    if (type === 'click' || type === 'touch' || type === 'hover') {
      setInteractionCounts(prev => ({
        ...prev,
        [type + 's']: prev[type + 's'] + 1,
      }));
    }

    if (gesture) {
      setGestureFrequency(prev => ({
        ...prev,
        [gesture]: (prev[gesture] || 0) + 1,
      }));
    }

    // Calculate user interaction pattern
    const totalInteractions = interactionCounts.clicks + interactionCounts.touches + interactionCounts.hovers + 1;
    const timeSinceLastInteraction = now - lastInteractionTime;
    const avgInterval = timeSinceLastInteraction > 0 ? timeSinceLastInteraction : 1000;
    
    let userPreferencePattern: 'high_interaction' | 'medium_interaction' | 'low_interaction';
    if (avgInterval < 2000 && totalInteractions > 10) {
      userPreferencePattern = 'high_interaction';
    } else if (avgInterval < 5000 && totalInteractions > 5) {
      userPreferencePattern = 'medium_interaction';
    } else {
      userPreferencePattern = 'low_interaction';
    }

    const analytics: InteractionAnalytics = {
      totalClicks: interactionCounts.clicks + (type === 'click' ? 1 : 0),
      totalTouches: interactionCounts.touches + (type === 'touch' ? 1 : 0),
      totalHovers: interactionCounts.hovers + (type === 'hover' ? 1 : 0),
      gestureFrequency: gesture ? { ...gestureFrequency, [gesture]: (gestureFrequency[gesture] || 0) + 1 } : gestureFrequency,
      averageInteractionInterval: avgInterval,
      lastInteractionTime: now,
      userPreferencePattern,
    };

    onInteractionAnalytics?.(analytics);
  }, [interactionCounts, gestureFrequency, lastInteractionTime, onInteractionAnalytics]);

  // Debounced interaction handler
  const handleInteraction = useCallback((context: InteractionContext, gesture?: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      if (gesture && avatarRef.current) {
        // Show gesture loading state
        setIsGestureLoading(true);
        setCurrentGesture(gesture);
        
        // Trigger avatar gesture
        avatarRef.current.playGesture(gesture, 2000);
        
        // Track the interaction
        trackInteraction(context.type, gesture);
        
        // Notify parent component
        onGestureTrigger?.(gesture, context);
        
        // Show gesture feedback
        setShowGestureFeedback(true);
        
        // Clear loading state after gesture duration
        setTimeout(() => {
          setIsGestureLoading(false);
          setCurrentGesture(null);
        }, 2000);
        
        // Hide gesture feedback
        if (gestureFeedbackTimeoutRef.current) {
          clearTimeout(gestureFeedbackTimeoutRef.current);
        }
        gestureFeedbackTimeoutRef.current = setTimeout(() => {
          setShowGestureFeedback(false);
        }, 2500);
      }
    }, debounceMs);
  }, [avatarRef, debounceMs, onGestureTrigger, trackInteraction]);

  // Click handler
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsPressed(false);
    
    const rect = containerRef.current?.getBoundingClientRect();
    const position = rect ? {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    } : undefined;

    // Determine gesture based on click position and context
    let gesture = 'ok'; // Default gesture
    
    // Simple gesture selection based on click position
    if (position && rect) {
      const relativeX = position.x / rect.width;
      const relativeY = position.y / rect.height;
      
      if (relativeX < 0.3) {
        gesture = 'handup'; // Left side - asking question
      } else if (relativeX > 0.7) {
        gesture = 'side'; // Right side - alternative approach
      } else if (relativeY < 0.3) {
        gesture = 'thumbup'; // Top - positive
      } else if (relativeY > 0.7) {
        gesture = 'thinking'; // Bottom - thinking
      }
    }

    const context: InteractionContext = {
      type: 'click',
      timestamp: Date.now(),
      position,
      gesture,
    };

    handleInteraction(context, gesture);
  }, [handleInteraction]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsPressed(true);
    setTouchStartTime(Date.now());
    
    // Haptic feedback
    if (enableHapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(50);
    }
  }, [enableHapticFeedback]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsPressed(false);
    
    const touchDuration = Date.now() - touchStartTime;
    const touch = e.changedTouches[0];
    const rect = containerRef.current?.getBoundingClientRect();
    const position = rect ? {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    } : undefined;

    let gesture = 'ok'; // Default gesture
    
    // Determine gesture based on touch duration and position
    if (touchDuration < 200) {
      // Quick tap
      gesture = position && rect ? 
        (position.x / rect.width < 0.5 ? 'handup' : 'index') : 'ok';
    } else if (touchDuration > 1000) {
      // Long press
      gesture = 'thinking';
    } else {
      // Medium press
      gesture = 'namaste';
    }

    const context: InteractionContext = {
      type: 'touch',
      timestamp: Date.now(),
      position,
      gesture,
    };

    handleInteraction(context, gesture);
  }, [handleInteraction, touchStartTime, enableHapticFeedback]);

  // Hover handlers
  const handleMouseEnter = useCallback(() => {
    if (!enableHoverEffects) return;
    
    setIsHovered(true);
    
    // Clear any existing hover timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    // Trigger hover gesture after a short delay
    hoverTimeoutRef.current = setTimeout(() => {
      const context: InteractionContext = {
        type: 'hover',
        timestamp: Date.now(),
      };
      
      // Subtle hover gesture
      if (avatarRef.current) {
        avatarRef.current.playGesture('index', 1000);
        trackInteraction('hover', 'index');
      }
    }, 500);
  }, [enableHoverEffects, avatarRef, trackInteraction]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  }, []);

  // SQL Query gesture trigger (called from parent)
  const triggerSQLGesture = useCallback((sqlKeywords: string[], userMessage?: string) => {
    let gesture = 'ok'; // Default gesture
    
    // Map SQL keywords to gestures
    const keywordMap: Record<string, string> = {
      'SELECT': 'index',
      'WHERE': 'thinking',
      'JOIN': 'handup',
      'ORDER BY': 'ok',
      'GROUP BY': 'ok',
      'INSERT': 'thumbup',
      'UPDATE': 'side',
      'DELETE': 'thumbdown',
      'CREATE': 'namaste',
      'DROP': 'shrug',
    };

    // Find the most relevant gesture based on keywords
    for (const keyword of sqlKeywords) {
      if (keywordMap[keyword.toUpperCase()]) {
        gesture = keywordMap[keyword.toUpperCase()];
        break;
      }
    }

    const context: InteractionContext = {
      type: 'sql_query',
      timestamp: Date.now(),
      gesture,
      sqlKeywords,
      userMessage,
    };

    handleInteraction(context, gesture);
  }, [handleInteraction]);

  // Note: useImperativeHandle removed since AvatarInteractionManager is not currently used as a wrapper

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (gestureFeedbackTimeoutRef.current) {
        clearTimeout(gestureFeedbackTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`${styles['avatar-interaction-manager']} ${isPressed ? styles.pressed : ''}`}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      role="button"
      tabIndex={0}
      aria-label="Interactive avatar - click or touch to interact"
    >
      {/* Visual feedback for interactions */}
      {(isHovered || isPressed) && (
        <div
          className={`${styles['interaction-overlay']} ${isHovered ? styles.hover : ''} ${isPressed ? styles.pressed : ''}`}
        />
      )}
      
      {/* Hover glow effect */}
      {isHovered && (
        <div className={styles['hover-glow']} />
      )}
      
      {/* Eye contact animation */}
      {isHovered && (
        <div className={styles['eye-contact']} />
      )}
      
      {/* Breathing animation for idle state */}
      {!isHovered && !isPressed && (
        <div className={styles['breathing-animation']} />
      )}
      
      {/* Gesture intensity indicator */}
      {currentGesture && (
        <div 
          className={`${
            currentGesture === 'handup' || currentGesture === 'thinking' ? styles['gesture-intensity-high'] :
            currentGesture === 'index' || currentGesture === 'ok' ? styles['gesture-intensity-medium'] :
            styles['gesture-intensity-low']
          }`}
        />
      )}
      
      {/* Gesture loading indicator */}
      {isGestureLoading && (
        <div className={`${styles['gesture-loading']} ${styles.active}`} />
      )}
      
      {/* Gesture feedback tooltip */}
      {showGestureFeedback && currentGesture && (
        <div className={styles['gesture-feedback']}>
          {currentGesture === 'handup' && '🤚 Asking a question'}
          {currentGesture === 'index' && '👆 Pointing to SQL concept'}
          {currentGesture === 'ok' && '👌 Organization/Order'}
          {currentGesture === 'thumbup' && '👍 Great job!'}
          {currentGesture === 'thumbdown' && '👎 Needs attention'}
          {currentGesture === 'side' && '🤔 Alternative approach'}
          {currentGesture === 'shrug' && '🤷 Not sure'}
          {currentGesture === 'namaste' && '🙏 Respectful greeting'}
          {currentGesture === 'thinking' && '🤔 Processing...'}
        </div>
      )}
      
      {/* Touch ripple effect */}
      {isPressed && (
        <div className={styles['touch-ripple']} />
      )}
      
      {/* Children (avatar component) */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
};

export default AvatarInteractionManager;
