"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Volume2, VolumeX, Mic, Settings, Square } from 'lucide-react';
// TalkingHeadManager removed - using direct speech synthesis
import styles from './michael-3d-avatar.module.css';

interface Michael3DAvatarProps {
  text?: string;
  autoPlay?: boolean;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  isListening?: boolean;
  isThinking?: boolean;
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

const Michael3DAvatar: React.FC<Michael3DAvatarProps> = ({
  text,
  autoPlay = false,
  onSpeechStart,
  onSpeechEnd,
  isListening = false,
  isThinking = false,
  className = '',
  size = 'medium'
}) => {
  const avatarRef = useRef<HTMLDivElement>(null);
  // Removed TalkingHeadManager reference - using direct speech only
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avatarStatus, setAvatarStatus] = useState<'idle' | 'speaking' | 'listening' | 'thinking' | 'loading'>('loading');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [lastSpokenText, setLastSpokenText] = useState<string>('');

  // Initialize speech-only mode (bypass problematic 3D avatar)
  useEffect(() => {
    const initializeSpeechMode = async () => {
      try {
        console.log('🎭 Initializing speech-only mode (skipping 3D avatar)...');
        setIsLoading(false); // No loading needed
        setError(null);
        setAvatarStatus('idle');
        
        // Enable audio immediately
        setAudioEnabled(true);
        console.log('🎭 ✅ Speech-only mode ready!');
        
        // Initialize speech synthesis voices
        if ('speechSynthesis' in window) {
          const voices = speechSynthesis.getVoices();
          if (voices.length === 0) {
            speechSynthesis.addEventListener('voiceschanged', () => {
              console.log('🎭 Voices loaded:', speechSynthesis.getVoices().length);
            });
          } else {
            console.log('🎭 Voices already loaded:', voices.length);
          }
        }
        
      } catch (error) {
        console.error('🎭 Failed to initialize speech mode:', error);
        setError(`Speech initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsLoading(false);
      }
    };

    initializeSpeechMode();

    // Cleanup on unmount - only speech synthesis
    return () => {
      if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
      }
    };
  }, []);

  // Handle auto-play speech when conditions are met
  useEffect(() => {
    if (!text?.trim() || !autoPlay || !audioEnabled) {
      return;
    }

    const handleSpeech = async () => {
      try {
        console.log('🎭 Auto-play speech for text:', text.substring(0, 50) + '...');
        setAvatarStatus('speaking');
        onSpeechStart?.();
        
        // Clean text for speech
        const cleanText = text
          .replace(/😊|😀|😃|😄|😁|😆|😅|🤣|😂|🙂|🙃|😉|😇|🥰|😍|🤩|😘|😗|😚|😙|😋|😛|😜|🤪|😝|🤑|🤗|🤭|🤫|🤔|🤐|🤨|😐|😑|😶|😏|😒|🙄|😬|🤥|😌|😔|😪|🤤|😴|😷|🤒|🤕|🤢|🤮|🤧|🥵|🥶|🥴|😵|🤯|🤠|🥳|😎|🤓|🧐|🚀|⚡|💡|🎯|🎓|✨|👍|👎|👏|🔧|🛠️|📝|📊|💻|⭐|🎉|🔥|💪|🏆|📈|🎪/g, '')
          .trim();
        
        const utterance = new SpeechSynthesisUtterance(cleanText);
        
        // Detect Hebrew and configure appropriately
        const hasHebrew = /[\u0590-\u05FF]/.test(cleanText);
        
        if (hasHebrew) {
          utterance.lang = 'he-IL';
          utterance.rate = 0.8;
          utterance.pitch = 1.0;
          utterance.volume = 1.0;
        } else {
          utterance.lang = 'en-US';
          utterance.rate = 0.9;
          utterance.pitch = 1.0;
          utterance.volume = 0.8;
        }
        
        // Select best voice
        const voices = speechSynthesis.getVoices();
        let selectedVoice = null;
        
        if (hasHebrew) {
          selectedVoice = voices.find(voice => 
            voice.lang.includes('he') || 
            voice.lang.includes('iw') ||
            voice.name.toLowerCase().includes('hebrew') ||
            voice.name.toLowerCase().includes('carmit') ||
            voice.name.toLowerCase().includes('כרמית')
          );
        }
        
        if (!selectedVoice) {
          selectedVoice = voices.find(voice => 
            voice.name.toLowerCase().includes('alex') ||
            voice.name.toLowerCase().includes('daniel') ||
            voice.name.toLowerCase().includes('david')
          ) || voices.find(voice => voice.lang.startsWith(hasHebrew ? 'he' : 'en'));
        }
        
        if (selectedVoice) {
          utterance.voice = selectedVoice;
          console.log('🎤 Using voice:', selectedVoice.name);
        }
        
        utterance.onstart = () => {
          console.log('🔊 Direct speech started successfully!');
          setIsSpeaking(true);
        };
        
        utterance.onend = () => {
          console.log('🔊 Direct speech ended successfully!');
          setAvatarStatus('idle');
          setIsSpeaking(false);
          onSpeechEnd?.();
        };
        
        utterance.onerror = (error) => {
          console.error('🔊 Direct speech error:', error);
          console.error('🔊 Error details:', {
            error: error.error,
            charIndex: error.charIndex,
            elapsedTime: error.elapsedTime,
            name: error.name,
            utterance: error.utterance
          });
          setAvatarStatus('idle');
          setIsSpeaking(false);
          onSpeechEnd?.();
        };
        
        // Add additional debugging
        utterance.onpause = () => {
          console.log('🔊 Speech paused');
        };
        
        utterance.onresume = () => {
          console.log('🔊 Speech resumed');
        };
        
        utterance.onmark = (event) => {
          console.log('🔊 Speech mark:', event);
        };
        
        utterance.onboundary = (event) => {
          console.log('🔊 Speech boundary:', event.name, 'at', event.charIndex);
        };
        
        // Cancel any existing speech
        speechSynthesis.cancel();
        
        // Wait a moment for cancellation to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check if we need user interaction for autoplay
        console.log('🔊 Speech synthesis state:', {
          speaking: speechSynthesis.speaking,
          pending: speechSynthesis.pending,
          paused: speechSynthesis.paused,
          voicesLength: speechSynthesis.getVoices().length
        });
        
        // Force user interaction context by clicking a hidden button
        try {
          // Create a hidden button and click it to establish user interaction
          const hiddenButton = document.createElement('button');
          hiddenButton.style.position = 'absolute';
          hiddenButton.style.left = '-9999px';
          hiddenButton.style.width = '1px';
          hiddenButton.style.height = '1px';
          hiddenButton.style.opacity = '0';
          document.body.appendChild(hiddenButton);
          
          // Use the click to establish user interaction context
          const clickEvent = new MouseEvent('click', { bubbles: true });
          hiddenButton.dispatchEvent(clickEvent);
          
          // Clean up
          document.body.removeChild(hiddenButton);
          console.log('🎤 User interaction context established');
        } catch (e) {
          console.log('🎤 Could not establish user interaction context:', e);
        }
        
        // Start speech
        console.log('🎤 Starting direct browser speech synthesis...');
        speechSynthesis.speak(utterance);
        
        // Fallback: if speech doesn't start, try again with a delay
        setTimeout(() => {
          if (!speechSynthesis.speaking && !speechSynthesis.pending) {
            console.log('🎤 Retrying speech synthesis...');
            speechSynthesis.speak(utterance);
          }
        }, 500);
        
      } catch (error) {
        console.error('Speech failed:', error);
        setAvatarStatus('idle');
        onSpeechEnd?.();
      }
    };

    // Add delay to ensure everything is ready
    const timer = setTimeout(handleSpeech, 500);
    return () => clearTimeout(timer);
  }, [text, autoPlay, audioEnabled]);

  // Handle listening state
  useEffect(() => {
    if (isListening) {
      setAvatarStatus('listening');
    } else if (isThinking) {
      setAvatarStatus('thinking');
    } else if (!isSpeaking) {
      setAvatarStatus('idle');
    }
  }, [isListening, isThinking, isSpeaking]);

  const handleRetry = () => {
    setError(null);
    setIsLoading(false); // Speech-only mode doesn't need loading
    setAvatarStatus('idle');
    setAudioEnabled(true);
    console.log('🎭 Speech mode re-enabled');
  };

  const enableAudio = async () => {
    try {
      console.log('🎭 enableAudio called - speech-only mode...');
      
      // Initialize audio context for Web Audio API
      if (typeof window !== 'undefined' && window.AudioContext) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
          console.log('🎭 Web Audio API context resumed');
        }
      }
      
      // Test speech synthesis
      if ('speechSynthesis' in window) {
        console.log('🎭 Testing speech synthesis...');
        speechSynthesis.cancel(); // Clear any existing speech
        const testUtterance = new SpeechSynthesisUtterance(' '); // Very short test
        testUtterance.volume = 0.01; // Very quiet test
        speechSynthesis.speak(testUtterance);
        console.log('🎭 Speech synthesis test completed');
      }
      
      setAudioEnabled(true);
      console.log('🎭 ✅ Audio fully enabled! audioEnabled state set to true');
      
    } catch (error) {
      console.error('🎭 Failed to enable audio:', error);
      // Still set audio enabled to true so we can attempt speech
      setAudioEnabled(true);
      console.log('🎭 Audio enabled despite error (fallback)');
    }
  };

  const getSizeClass = () => {
    switch (size) {
      case 'small': return styles.small;
      case 'large': return styles.large;
      default: return styles.medium;
    }
  };

  return (
    <div className={`${styles.avatarContainer} ${getSizeClass()} ${className}`}>
      <div className={styles.avatarWrapper}>
        {/* Simple Avatar Display (No 3D - Speech Only) */}
        <div 
          ref={avatarRef} 
          id="michael-3d-avatar" 
          className={styles.avatarCanvas}
        >
          <div className={styles.simpleAvatar}>
            <div className={`${styles.avatarFace} ${avatarStatus === 'speaking' ? styles.speaking : ''} ${avatarStatus === 'listening' ? styles.listening : ''}`}>
              👨‍🏫
            </div>
            <div className={styles.avatarName}>מייקל</div>
            <div className={styles.avatarStatus}>
              {avatarStatus === 'speaking' && '🎤 מדבר...'}
              {avatarStatus === 'listening' && '👂 מקשיב...'}
              {avatarStatus === 'thinking' && '🤔 חושב...'}
              {avatarStatus === 'idle' && '😊 מוכן לעזור'}
            </div>
            {audioEnabled && (
              <div className={styles.audioIndicator}>🔊 אודיו מופעל</div>
            )}
          </div>
        </div>
        
        {/* Loading Overlay */}
        {isLoading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.loadingSpinner}></div>
            <div className={styles.loadingText}>מייקל בטעינה...</div>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className={styles.loadingOverlay}>
            <div className={styles.errorMessage}>
              <h3>Avatar Error</h3>
              <p>{error}</p>
              <button onClick={handleRetry} className={styles.retryButton}>
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Audio Test Button */}
        {!audioEnabled && !isLoading && !error && (
          <div className={styles.audioPrompt}>
            <button onClick={enableAudio} className={styles.enableAudioButton}>
              🔊 Enable Audio
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Michael3DAvatar; 