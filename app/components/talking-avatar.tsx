"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Settings } from 'lucide-react';
import styles from './talking-avatar.module.css';

interface TalkingAvatarProps {
  text?: string;
  autoPlay?: boolean;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
}

const TalkingAvatar: React.FC<TalkingAvatarProps> = ({ 
  text, 
  autoPlay = false,
  onSpeechStart,
  onSpeechEnd 
}) => {
  const [isTalking, setIsTalking] = useState(false);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(true);
  const [speechRate, setSpeechRate] = useState(1.3); // Faster but still clear speech rate
  const [showSettings, setShowSettings] = useState(false);
  
  console.log('TalkingAvatar rendered with props:', { text, autoPlay, isTalking });
  
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isPlayingRef = useRef(false);

  const speak = (textToSpeak: string) => {
    if (!isSpeechEnabled || !textToSpeak.trim()) {
      console.log('Speech not enabled or empty text:', { isSpeechEnabled, textToSpeak });
      return;
    }
    
    console.log('Speaking:', textToSpeak);
    
    // Check if Speech Synthesis is supported
    if (!('speechSynthesis' in window)) {
      console.error('Speech Synthesis not supported');
      return;
    }

    // Stop any current speech
    stopSpeech();

    // Simple text cleaning for speech
    const cleanText = textToSpeak
      // Remove basic markdown
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
      .replace(/```[\s\S]*?```/g, ' ') // Remove code blocks
      // Remove SQL keywords for better Hebrew pronunciation
      .replace(/\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|TABLE|DATABASE)\b/gi, '')
      .replace(/😊|😀|😃|😄|😁|😆|😅|🤣|😂|🙂|🙃|😉|😇|🥰|😍|🤩|😘|😗|😚|😙|😋|😛|😜|🤪|😝|🤑|🤗|🤭|🤫|🤔|🤐|🤨|😐|😑|😶|😏|😒|🙄|😬|🤥|😌|😔|😪|🤤|😴|😷|🤒|🤕|🤢|🤮|🤧|🥵|🥶|🥴|😵|🤯|🤠|🥳|😎|🤓|🧐|🚀|⚡|💡|🎯|🎓|✨|👍|👎|👏|🔧|🛠️|📝|📊|💻|⭐|🎉|🔥|💪|🏆|📈|🎪/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    const finalText = cleanText || textToSpeak; // Fallback to original if cleaning failed

    console.log('Cleaned text for speech:', finalText);

    // Detect if text contains Hebrew characters
    const hasHebrew = /[\u0590-\u05FF]/.test(finalText);
    const detectedLanguage = hasHebrew ? 'he-IL' : 'en-US';
    
    console.log('Detected language:', detectedLanguage, 'for text:', finalText.substring(0, 50));

    // Create new utterance
    utteranceRef.current = new SpeechSynthesisUtterance(finalText);
    
    // Configure speech synthesis for more natural sound
    utteranceRef.current.rate = speechRate * 0.9; // Slightly slower for better comprehension
    utteranceRef.current.pitch = 0.95; // Slightly lower pitch for male voice
    utteranceRef.current.volume = 0.85;
    
    // Set language based on detected content
    utteranceRef.current.lang = detectedLanguage;
    
    // Try to use appropriate voice based on detected language
    const voices = speechSynthesis.getVoices();
    console.log('Available voices:', voices.map(v => `${v.name} (${v.lang})`));
    
    let selectedVoice = null;
    
    if (hasHebrew) {
      // Hebrew text - prioritize Hebrew voices
      selectedVoice = voices.find(voice => {
        return voice.lang.includes('he') || voice.lang.includes('iw'); // 'iw' is old Hebrew language code
      }) || voices.find(voice => {
        const name = voice.name.toLowerCase();
        return name.includes('carmit') || name.includes('כרמית') || name.includes('hebrew');
      });
    }
    
    // If no Hebrew voice found or text is English, use quality male voices
    if (!selectedVoice) {
      selectedVoice = voices.find(voice => {
        const name = voice.name.toLowerCase();
        return name.includes('grandpa') || name.includes('aaron') || name.includes('arthur') || 
            name.includes('gordon') || name.includes('martin') || name.includes('jacques') ||
            name.includes('eddy') || name.includes('reed') || name.includes('rocko');
      }) || voices.find(voice => {
        const name = voice.name.toLowerCase();
        return name.includes('male') && !name.includes('female');
      });
    }
    
    if (selectedVoice) {
      console.log('Selected voice:', selectedVoice.name, selectedVoice.lang);
      utteranceRef.current.voice = selectedVoice;
    } else {
      console.log('No suitable voice found, using default voice');
    }

    // Set up event handlers
    utteranceRef.current.onstart = () => {
      console.log('Speech started!');
      setIsTalking(true);
      isPlayingRef.current = true;
      onSpeechStart?.();
    };

    utteranceRef.current.onend = () => {
      console.log('Speech ended!');
      setIsTalking(false);
      isPlayingRef.current = false;
      onSpeechEnd?.();
    };

    utteranceRef.current.onerror = (event) => {
      console.error('Speech error:', event);
      setIsTalking(false);
      isPlayingRef.current = false;
      onSpeechEnd?.();
    };

    // Start speaking
    console.log('Starting speech synthesis...');
    
    try {
      speechSynthesis.speak(utteranceRef.current);
      
      // Sometimes browser needs a small delay to start
      setTimeout(() => {
        if (!speechSynthesis.speaking && !isTalking) {
          console.log('Speech did not start, trying again...');
          speechSynthesis.speak(utteranceRef.current);
        }
      }, 100);
      
    } catch (error) {
      console.error('Error starting speech:', error);
    }
  };

  const stopSpeech = () => {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    setIsTalking(false);
    isPlayingRef.current = false;
  };

  const toggleSpeech = () => {
    if (isTalking) {
      stopSpeech();
    } else if (text) {
      speak(text);
    }
  };

  const toggleSpeechEnabled = () => {
    setIsSpeechEnabled(!isSpeechEnabled);
    if (isTalking) {
      stopSpeech();
    }
  };

  // Auto-play effect - only play when message is complete
  useEffect(() => {
    console.log('TalkingAvatar useEffect - text length:', text?.length, 'autoPlay:', autoPlay, 'isSpeechEnabled:', isSpeechEnabled, 'isPlayingRef.current:', isPlayingRef.current);
    
    if (autoPlay && text && isSpeechEnabled && !isPlayingRef.current) {
      // Wait for the message to be complete (no more updates for 1 second)
      const timer = setTimeout(() => {
        // Check if text hasn't changed (message is complete)
        if (text && !isPlayingRef.current) {
          console.log('Auto-playing speech for completed message');
          speak(text);
        }
      }, 1000); // Wait 1 second after last text update
      
      return () => clearTimeout(timer);
    }
  }, [text, autoPlay, isSpeechEnabled]);

  // Load voices when available
  useEffect(() => {
    const loadVoices = () => {
      speechSynthesis.getVoices();
    };

    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Cleanup
    return () => {
      stopSpeech();
    };
  }, []);

  return (
    <div className={styles.talkingAvatar}>
      <div className={`${styles.avatarContainer} ${isTalking ? styles.talking : ''}`}>
        <div className={styles.avatar}>
          <img 
            src="/bot.png" 
            alt="Michael - SQL Teaching Assistant" 
            className={styles.avatarImage}
          />
          
          {/* Talking animation overlay */}
          {isTalking && (
            <div className={styles.talkingIndicator}>
              <div className={styles.soundWave}>
                <div className={styles.wave}></div>
                <div className={styles.wave}></div>
                <div className={styles.wave}></div>
              </div>
            </div>
          )}

          {/* Mouth animation */}
          <div className={`${styles.mouth} ${isTalking ? styles.mouthTalking : ''}`}>
            <div className={styles.mouthInner}></div>
          </div>
        </div>

        {/* Control buttons */}
        <div className={styles.controls}>
          {text && (
            <button
              className={`${styles.controlButton} ${isTalking ? styles.stopButton : styles.playButton}`}
              onClick={toggleSpeech}
              title={isTalking ? "Stop speaking" : "Speak message"}
            >
              {isTalking ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          )}
          


          <button
            className={`${styles.controlButton} ${!isSpeechEnabled ? styles.disabled : ''}`}
            onClick={toggleSpeechEnabled}
            title={isSpeechEnabled ? "Disable speech" : "Enable speech"}
          >
            {isSpeechEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>

          <button
            className={styles.controlButton}
            onClick={() => setShowSettings(!showSettings)}
            title="Speech settings"
          >
            <Settings size={14} />
          </button>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className={styles.settingsPanel}>
            <div className={styles.settingItem}>
              <label>Speech Rate:</label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={speechRate}
                onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                className={styles.slider}
              />
              <span>{speechRate.toFixed(1)}x</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TalkingAvatar; 