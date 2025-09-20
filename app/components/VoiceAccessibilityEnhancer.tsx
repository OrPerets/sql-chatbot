'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import styles from './VoiceAccessibilityEnhancer.module.css';

interface VoiceAccessibilityEnhancerProps {
  children: React.ReactNode;
  enableKeyboardNavigation?: boolean;
  enableScreenReader?: boolean;
  enableHighContrast?: boolean;
  enableFocusManagement?: boolean;
  announceStateChanges?: boolean;
  voiceState?: 'idle' | 'speaking' | 'listening' | 'thinking' | 'userWriting';
  currentText?: string;
}

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  description: string;
  action: () => void;
}

const VoiceAccessibilityEnhancer: React.FC<VoiceAccessibilityEnhancerProps> = ({
  children,
  enableKeyboardNavigation = true,
  enableScreenReader = true,
  enableHighContrast = true,
  enableFocusManagement = true,
  announceStateChanges = true,
  voiceState = 'idle',
  currentText = ''
}) => {
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [keyboardShortcutsVisible, setKeyboardShortcutsVisible] = useState(false);
  const [focusedElement, setFocusedElement] = useState<HTMLElement | null>(null);
  const [screenReaderText, setScreenReaderText] = useState('');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const announcementRef = useRef<HTMLDivElement>(null);
  const keyboardShortcuts = useRef<KeyboardShortcut[]>([]);

  // Initialize keyboard shortcuts
  useEffect(() => {
    keyboardShortcuts.current = [
      {
        key: 'Space',
        description: 'Start/Stop voice recording',
        action: () => {
          const recordButton = document.querySelector('[aria-label*="recording"], [aria-label*="record"]') as HTMLElement;
          recordButton?.click();
        }
      },
      {
        key: 'Enter',
        description: 'Activate focused voice control',
        action: () => {
          if (focusedElement) {
            focusedElement.click();
          }
        }
      },
      {
        key: 'Escape',
        description: 'Close voice settings or stop current action',
        action: () => {
          const closeButton = document.querySelector('[aria-label*="close"], [aria-label*="Close"]') as HTMLElement;
          closeButton?.click();
        }
      },
      {
        key: 'h',
        ctrlKey: true,
        description: 'Toggle high contrast mode',
        action: () => setIsHighContrast(prev => !prev)
      },
      {
        key: 'k',
        ctrlKey: true,
        description: 'Show/hide keyboard shortcuts',
        action: () => setKeyboardShortcutsVisible(prev => !prev)
      },
      {
        key: 'ArrowUp',
        description: 'Increase volume',
        action: () => {
          const volumeSlider = document.querySelector('input[aria-label*="volume"], input[aria-label*="Volume"]') as HTMLInputElement;
          if (volumeSlider) {
            const currentValue = parseInt(volumeSlider.value) || 0;
            volumeSlider.value = Math.min(100, currentValue + 10).toString();
            volumeSlider.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      },
      {
        key: 'ArrowDown',
        description: 'Decrease volume',
        action: () => {
          const volumeSlider = document.querySelector('input[aria-label*="volume"], input[aria-label*="Volume"]') as HTMLInputElement;
          if (volumeSlider) {
            const currentValue = parseInt(volumeSlider.value) || 0;
            volumeSlider.value = Math.max(0, currentValue - 10).toString();
            volumeSlider.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      },
      {
        key: 'ArrowLeft',
        description: 'Decrease speech speed',
        action: () => {
          const speedSlider = document.querySelector('input[aria-label*="speed"], input[aria-label*="Speed"]') as HTMLInputElement;
          if (speedSlider) {
            const currentValue = parseFloat(speedSlider.value) || 1.0;
            speedSlider.value = Math.max(0.5, currentValue - 0.1).toFixed(1);
            speedSlider.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      },
      {
        key: 'ArrowRight',
        description: 'Increase speech speed',
        action: () => {
          const speedSlider = document.querySelector('input[aria-label*="speed"], input[aria-label*="Speed"]') as HTMLInputElement;
          if (speedSlider) {
            const currentValue = parseFloat(speedSlider.value) || 1.0;
            speedSlider.value = Math.min(2.0, currentValue + 0.1).toFixed(1);
            speedSlider.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      }
    ];
  }, [focusedElement]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enableKeyboardNavigation) return;

    // Find matching shortcut
    const matchingShortcut = keyboardShortcuts.current.find(shortcut => 
      shortcut.key === e.key &&
      !!shortcut.ctrlKey === e.ctrlKey &&
      !!shortcut.altKey === e.altKey &&
      !!shortcut.shiftKey === e.shiftKey
    );

    if (matchingShortcut) {
      e.preventDefault();
      matchingShortcut.action();
      
      // Announce action to screen reader
      if (enableScreenReader) {
        announceToScreenReader(`Executed: ${matchingShortcut.description}`);
      }
    }

    // Tab navigation enhancement
    if (e.key === 'Tab') {
      const focusableElements = containerRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements && focusableElements.length > 0) {
        const currentIndex = Array.from(focusableElements).indexOf(document.activeElement as HTMLElement);
        let nextIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1;
        
        if (nextIndex < 0) nextIndex = focusableElements.length - 1;
        if (nextIndex >= focusableElements.length) nextIndex = 0;
        
        (focusableElements[nextIndex] as HTMLElement).focus();
        setFocusedElement(focusableElements[nextIndex] as HTMLElement);
        e.preventDefault();
      }
    }
  }, [enableKeyboardNavigation, enableScreenReader]);

  // Announce state changes to screen reader
  const announceToScreenReader = useCallback((message: string) => {
    if (!enableScreenReader) return;
    
    setScreenReaderText(message);
    
    // Clear after announcement
    setTimeout(() => setScreenReaderText(''), 1000);
  }, [enableScreenReader]);

  // Monitor voice state changes
  useEffect(() => {
    if (!announceStateChanges) return;

    const stateMessages = {
      idle: 'Voice mode is ready. Press space to start recording.',
      speaking: `Assistant is speaking: ${currentText.substring(0, 100)}${currentText.length > 100 ? '...' : ''}`,
      listening: 'Listening for your voice input. Speak now.',
      thinking: 'Processing your request. Please wait.',
      userWriting: 'User is typing a message.'
    };

    const message = stateMessages[voiceState];
    if (message) {
      announceToScreenReader(message);
    }
  }, [voiceState, currentText, announceStateChanges, announceToScreenReader]);

  // Focus management
  useEffect(() => {
    if (!enableFocusManagement) return;

    const handleFocusIn = (e: FocusEvent) => {
      setFocusedElement(e.target as HTMLElement);
    };

    const handleFocusOut = () => {
      // Delay to allow focus to move to next element
      setTimeout(() => {
        if (!document.activeElement || document.activeElement === document.body) {
          // Focus lost, restore to first focusable element
          const firstFocusable = containerRef.current?.querySelector(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          ) as HTMLElement;
          firstFocusable?.focus();
        }
      }, 10);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, [enableFocusManagement]);

  // Keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // High contrast mode detection and override
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    setIsHighContrast(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsHighContrast(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Apply high contrast styles
  useEffect(() => {
    if (enableHighContrast && isHighContrast) {
      document.documentElement.classList.add('high-contrast-mode');
    } else {
      document.documentElement.classList.remove('high-contrast-mode');
    }

    return () => {
      document.documentElement.classList.remove('high-contrast-mode');
    };
  }, [isHighContrast, enableHighContrast]);

  return (
    <div 
      ref={containerRef}
      className={`${styles.accessibilityContainer} ${isHighContrast ? styles.highContrast : ''}`}
      role="application"
      aria-label="Voice-enabled chat interface"
    >
      {children}

      {/* Screen Reader Announcements */}
      {enableScreenReader && (
        <div
          ref={announcementRef}
          className={styles.screenReaderOnly}
          aria-live="polite"
          aria-atomic="true"
          role="status"
        >
          {screenReaderText}
        </div>
      )}

      {/* Keyboard Shortcuts Help */}
      {keyboardShortcutsVisible && (
        <div className={styles.keyboardShortcuts} role="dialog" aria-labelledby="shortcuts-title">
          <div className={styles.shortcutsHeader}>
            <h3 id="shortcuts-title">Keyboard Shortcuts</h3>
            <button
              className={styles.closeShortcuts}
              onClick={() => setKeyboardShortcutsVisible(false)}
              aria-label="Close keyboard shortcuts"
            >
              ×
            </button>
          </div>
          <div className={styles.shortcutsList}>
            {keyboardShortcuts.current.map((shortcut, index) => (
              <div key={index} className={styles.shortcutItem}>
                <span className={styles.shortcutKey}>
                  {shortcut.ctrlKey && 'Ctrl + '}
                  {shortcut.altKey && 'Alt + '}
                  {shortcut.shiftKey && 'Shift + '}
                  {shortcut.key}
                </span>
                <span className={styles.shortcutDescription}>
                  {shortcut.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accessibility Status Indicator */}
      <div className={styles.accessibilityStatus} aria-hidden="true">
        <div className={styles.statusItem} title="Keyboard navigation enabled">
          ⌨️
        </div>
        <div className={styles.statusItem} title="Screen reader support enabled">
          🔊
        </div>
        {isHighContrast && (
          <div className={styles.statusItem} title="High contrast mode active">
            🔲
          </div>
        )}
        <button
          className={styles.shortcutsToggle}
          onClick={() => setKeyboardShortcutsVisible(prev => !prev)}
          aria-label="Show keyboard shortcuts"
          title="Press Ctrl+K to toggle shortcuts"
        >
          ?
        </button>
      </div>

      {/* Focus Indicator Enhancement */}
      <style jsx global>{`
        .high-contrast-mode * {
          transition: none !important;
          animation: none !important;
        }
        
        .high-contrast-mode *:focus {
          outline: 4px solid #000 !important;
          outline-offset: 2px !important;
          box-shadow: 0 0 0 6px #fff, 0 0 0 8px #000 !important;
        }
        
        .high-contrast-mode button,
        .high-contrast-mode [role="button"] {
          background: #fff !important;
          color: #000 !important;
          border: 3px solid #000 !important;
        }
        
        .high-contrast-mode button:hover,
        .high-contrast-mode [role="button"]:hover {
          background: #000 !important;
          color: #fff !important;
        }
        
        .high-contrast-mode input,
        .high-contrast-mode select,
        .high-contrast-mode textarea {
          background: #fff !important;
          color: #000 !important;
          border: 3px solid #000 !important;
        }
        
        .high-contrast-mode [aria-pressed="true"],
        .high-contrast-mode [aria-selected="true"] {
          background: #000 !important;
          color: #fff !important;
        }
      `}</style>
    </div>
  );
};

export default VoiceAccessibilityEnhancer;
