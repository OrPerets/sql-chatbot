'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from './simple-speech-avatar.module.css';

interface SimpleSpeechAvatarProps {
  text?: string;
  autoPlay?: boolean;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  isListening?: boolean;
  isThinking?: boolean;
  className?: string;
}

const SimpleSpeechAvatar: React.FC<SimpleSpeechAvatarProps> = ({
  text,
  autoPlay = false,
  onSpeechStart,
  onSpeechEnd,
  isListening = false,
  isThinking = false,
  className = ''
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastSpokenText, setLastSpokenText] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Initialize audio on user interaction
  const enableAudio = async () => {
    try {
      console.log('🎤 Enabling audio with user interaction...');
      
      // Test basic speech synthesis
      const testUtterance = new SpeechSynthesisUtterance(' ');
      testUtterance.volume = 0.01;
      speechSynthesis.speak(testUtterance);
      
      setAudioEnabled(true);
      console.log('✅ Audio enabled successfully!');
    } catch (error) {
      console.error('❌ Failed to enable audio:', error);
      // Still enable to allow attempts
      setAudioEnabled(true);
    }
  };

  // Handle speech synthesis
  const speak = async (textToSpeak: string) => {
    try {
      console.log('🎤 Starting speech:', textToSpeak.substring(0, 50) + '...');
      
      // Prevent multiple speech attempts
      if (isSpeaking) {
        console.log('🎤 Already speaking, ignoring new request');
        return;
      }
      
      // Cancel any existing speech and wait longer for cleanup
      speechSynthesis.cancel();
      console.log('🎤 Canceled existing speech, waiting for cleanup...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Double-check that speech synthesis is ready
      if (speechSynthesis.speaking || speechSynthesis.pending) {
        console.log('🎤 Still busy after cancel, waiting more...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Create new utterance
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      
      // Detect Hebrew and configure accordingly
      const isHebrew = /[\u0590-\u05FF]/.test(textToSpeak);
      
      if (isHebrew) {
        utterance.lang = 'he-IL';
        utterance.rate = 0.8;
        console.log('🎤 Using Hebrew settings');
      } else {
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        console.log('🎤 Using English settings');
      }
      
      utterance.volume = 1.0;
      utterance.pitch = 1.0;

      // Find appropriate voice
      const voices = speechSynthesis.getVoices();
      let selectedVoice = null;
      
      if (isHebrew) {
        selectedVoice = voices.find(voice => 
          voice.lang.includes('he') || 
          voice?.name?.includes('כרמית') ||
          voice?.name?.includes('Hebrew')
        );
      } else {
        selectedVoice = voices.find(voice => 
          voice.lang.startsWith('en') && 
          !voice?.name?.includes('novelty')
        );
      }
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        console.log('🎤 Using voice:', selectedVoice.name);
      }

      // Set up event handlers
      utterance.onstart = () => {
        console.log('🎤 ✅ Speech ACTUALLY STARTED! You should hear audio now!');
        setIsSpeaking(true);
        onSpeechStart?.();
      };

      utterance.onend = () => {
        console.log('🎤 ✅ Speech ACTUALLY ENDED! Audio should have finished!');
        setIsSpeaking(false);
        currentUtteranceRef.current = null;
        onSpeechEnd?.();
      };

      utterance.onerror = (event) => {
        console.error('🎤 ❌ Speech error occurred:', event);
        console.error('🎤 Error details:', {
          error: event.error,
          type: event.type,
          charIndex: event.charIndex,
          elapsedTime: event.elapsedTime
        });
        setIsSpeaking(false);
        currentUtteranceRef.current = null;
        onSpeechEnd?.();
      };

      utterance.onpause = () => {
        console.log('🎤 ⏸️ Speech paused');
      };

      utterance.onresume = () => {
        console.log('🎤 ▶️ Speech resumed');
      };

      // Store reference and speak
      currentUtteranceRef.current = utterance;
      
      console.log('🎤 About to call speechSynthesis.speak...');
      console.log('🎤 Speech synthesis state before speak:', {
        speaking: speechSynthesis.speaking,
        pending: speechSynthesis.pending,
        paused: speechSynthesis.paused
      });
      
      speechSynthesis.speak(utterance);
      
      console.log('🎤 Speech command sent successfully');
      
      // Monitor if speech actually starts
      setTimeout(() => {
        console.log('🎤 Speech synthesis state after 500ms:', {
          speaking: speechSynthesis.speaking,
          pending: speechSynthesis.pending,
          paused: speechSynthesis.paused
        });
        
        if (!speechSynthesis.speaking && !speechSynthesis.pending) {
          console.warn('🎤 ⚠️ Speech did not start! Trying alternative approach...');
          
          // Alternative approach: trigger on next tick
          setTimeout(() => {
            console.log('🎤 Retry: Calling speechSynthesis.speak again...');
            speechSynthesis.speak(utterance);
          }, 100);
        }
      }, 500);
      
      // Fallback check
      setTimeout(() => {
        if (!speechSynthesis.speaking) {
          console.error('🎤 ❌ Speech synthesis failed to start after retries');
          console.error('🎤 This may be a browser limitation or audio policy issue');
          setIsSpeaking(false);
        }
      }, 2000);
      
    } catch (error) {
      console.error('🎤 Speech setup failed:', error);
      setIsSpeaking(false);
    }
  };

  // Handle text changes for auto-speech
  useEffect(() => {
    const handleAutoSpeech = async () => {
      if (!text || !autoPlay || !audioEnabled || isSpeaking) {
        return;
      }

      // Simple duplicate detection
      if (text === lastSpokenText) {
        console.log('🎤 Skipping duplicate text');
        return;
      }

      // Clean timestamp markers
      const cleanText = text.replace(/\|\|\|TIMESTAMP:\d+$/, '');
      
      setLastSpokenText(text);
      await speak(cleanText);
    };

    if (text && autoPlay && audioEnabled) {
      // Small delay to ensure proper timing
      const timer = setTimeout(handleAutoSpeech, 150);
      return () => clearTimeout(timer);
    }
  }, [text, autoPlay, audioEnabled, lastSpokenText, isSpeaking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentUtteranceRef.current) {
        speechSynthesis.cancel();
      }
    };
  }, []);

  const getStatusText = () => {
    if (isSpeaking) return 'מדבר...';
    if (isListening) return 'מקשיב...';
    if (isThinking) return 'חושב...';
    return 'מוכן';
  };

  const getStatusEmoji = () => {
    if (isSpeaking) return '🗣️';
    if (isListening) return '👂';
    if (isThinking) return '🤔';
    return '😊';
  };

  return (
    <div className={`${styles.avatarContainer} ${className}`}>
      <div className={styles.avatarFace}>
        <div className={styles.emoji}>{getStatusEmoji()}</div>
        <div className={styles.status}>{getStatusText()}</div>
      </div>
      
      {/* Audio enable button */}
      {!audioEnabled && (
        <button onClick={enableAudio} className={styles.enableButton}>
          🔊 הפעל שמע
        </button>
      )}
      

    </div>
  );
};

export default SimpleSpeechAvatar; 