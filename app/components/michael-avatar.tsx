"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Settings, Mic, MicOff } from 'lucide-react';
import Lottie from 'lottie-react';
import styles from './michael-avatar.module.css';

interface MichaelAvatarProps {
  text?: string;
  autoPlay?: boolean;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  isListening?: boolean;
  onToggleListening?: () => void;
}

// Simple Lottie animation data for a talking character
const talkingAnimationData = {
  v: "5.7.4",
  fr: 30,
  ip: 0,
  op: 60,
  w: 200,
  h: 200,
  nm: "Talking Avatar",
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "Head",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { 
          a: 1, 
          k: [
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 0, s: [0] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 30, s: [3] },
            { t: 60, s: [0] }
          ]
        },
        p: { a: 0, k: [100, 80, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { 
          a: 1,
          k: [
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 0, s: [100, 100, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 15, s: [102, 98, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 30, s: [98, 102, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 45, s: [102, 98, 100] },
            { t: 60, s: [100, 100, 100] }
          ]
        }
      },
      shapes: [
        {
          ty: "gr",
          it: [
            {
              d: 1,
              ty: "el",
              nm: "Head Circle",
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [80, 80] }
            },
            {
              ty: "fl",
              c: { a: 0, k: [0.9, 0.95, 1, 1] },
              o: { a: 0, k: 100 }
            },
            {
              ty: "st",
              c: { a: 0, k: [0.2, 0.4, 0.8, 1] },
              o: { a: 0, k: 100 },
              w: { a: 0, k: 2 }
            }
          ]
        }
      ]
    },
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: "Mouth",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [100, 110, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { 
          a: 1,
          k: [
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 0, s: [100, 20, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 10, s: [120, 100, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 20, s: [80, 40, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 30, s: [110, 80, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 40, s: [90, 60, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 50, s: [100, 90, 100] },
            { t: 60, s: [100, 20, 100] }
          ]
        }
      },
      shapes: [
        {
          ty: "gr",
          it: [
            {
              d: 1,
              ty: "el",
              nm: "Mouth Ellipse",
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [20, 8] }
            },
            {
              ty: "fl",
              c: { a: 0, k: [0.1, 0.1, 0.2, 1] },
              o: { a: 0, k: 100 }
            }
          ]
        }
      ]
    },
    {
      ddd: 0,
      ind: 3,
      ty: 4,
      nm: "Eyes",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [100, 70, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { 
          a: 1,
          k: [
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 0, s: [100, 100, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 45, s: [100, 100, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 50, s: [100, 10, 100] },
            { t: 55, s: [100, 100, 100] }
          ]
        }
      },
      shapes: [
        {
          ty: "gr",
          it: [
            {
              d: 1,
              ty: "el",
              nm: "Left Eye",
              p: { a: 0, k: [-15, 0] },
              s: { a: 0, k: [8, 8] }
            },
            {
              d: 1,
              ty: "el",
              nm: "Right Eye",
              p: { a: 0, k: [15, 0] },
              s: { a: 0, k: [8, 8] }
            },
            {
              ty: "fl",
              c: { a: 0, k: [0.1, 0.1, 0.3, 1] },
              o: { a: 0, k: 100 }
            }
          ]
        }
      ]
    }
  ]
};

// Idle animation data
const idleAnimationData = {
  v: "5.7.4",
  fr: 30,
  ip: 0,
  op: 90,
  w: 200,
  h: 200,
  nm: "Idle Avatar",
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "Head",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { 
          a: 1, 
          k: [
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 0, s: [0] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 45, s: [1] },
            { t: 90, s: [0] }
          ]
        },
        p: { 
          a: 1,
          k: [
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 0, s: [100, 80, 0] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 45, s: [100, 78, 0] },
            { t: 90, s: [100, 80, 0] }
          ]
        },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] }
      },
      shapes: [
        {
          ty: "gr",
          it: [
            {
              d: 1,
              ty: "el",
              nm: "Head Circle",
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [80, 80] }
            },
            {
              ty: "fl",
              c: { a: 0, k: [0.9, 0.95, 1, 1] },
              o: { a: 0, k: 100 }
            },
            {
              ty: "st",
              c: { a: 0, k: [0.2, 0.4, 0.8, 1] },
              o: { a: 0, k: 100 },
              w: { a: 0, k: 2 }
            }
          ]
        }
      ]
    },
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: "Mouth",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [100, 110, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 20, 100] }
      },
      shapes: [
        {
          ty: "gr",
          it: [
            {
              d: 1,
              ty: "el",
              nm: "Mouth Ellipse",
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [15, 4] }
            },
            {
              ty: "fl",
              c: { a: 0, k: [0.1, 0.1, 0.2, 1] },
              o: { a: 0, k: 100 }
            }
          ]
        }
      ]
    },
    {
      ddd: 0,
      ind: 3,
      ty: 4,
      nm: "Eyes",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [100, 70, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { 
          a: 1,
          k: [
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 0, s: [100, 100, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 60, s: [100, 100, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 65, s: [100, 10, 100] },
            { t: 70, s: [100, 100, 100] }
          ]
        }
      },
      shapes: [
        {
          ty: "gr",
          it: [
            {
              d: 1,
              ty: "el",
              nm: "Left Eye",
              p: { a: 0, k: [-15, 0] },
              s: { a: 0, k: [8, 8] }
            },
            {
              d: 1,
              ty: "el",
              nm: "Right Eye",
              p: { a: 0, k: [15, 0] },
              s: { a: 0, k: [8, 8] }
            },
            {
              ty: "fl",
              c: { a: 0, k: [0.1, 0.1, 0.3, 1] },
              o: { a: 0, k: 100 }
            }
          ]
        }
      ]
    }
  ]
};

const MichaelAvatar: React.FC<MichaelAvatarProps> = ({ 
  text, 
  autoPlay = false,
  onSpeechStart,
  onSpeechEnd,
  isListening = false,
  onToggleListening
}) => {
  const [isTalking, setIsTalking] = useState(false);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(true);
  const [speechRate, setSpeechRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isPlayingRef = useRef(false);
  const lottieRef = useRef<any>(null);

  const speak = (textToSpeak: string) => {
    if (!isSpeechEnabled || !textToSpeak.trim()) {
      return;
    }
    
    if (!('speechSynthesis' in window)) {
      console.error('Speech Synthesis not supported');
      return;
    }

    stopSpeech();

    // Clean text for speech
    const cleanText = textToSpeak
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|TABLE|DATABASE)\b/gi, '')
      .replace(/😊|😀|😃|😄|😁|😆|😅|🤣|😂|🙂|🙃|😉|😇|🥰|😍|🤩|😘|😗|😚|😙|😋|😛|😜|🤪|😝|🤑|🤗|🤭|🤫|🤔|🤐|🤨|😐|😑|😶|😏|😒|🙄|😬|🤥|😌|😔|😪|🤤|😴|😷|🤒|🤕|🤢|🤮|🤧|🥵|🥶|🥴|😵|🤯|🤠|🥳|😎|🤓|🧐|🚀|⚡|💡|🎯|🎓|✨|👍|👎|👏|🔧|🛠️|📝|📊|💻|⭐|🎉|🔥|💪|🏆|📈|🎪/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    const finalText = cleanText || textToSpeak;

    // Detect language
    const hasHebrew = /[\u0590-\u05FF]/.test(finalText);
    const detectedLanguage = hasHebrew ? 'he-IL' : 'en-US';

    utteranceRef.current = new SpeechSynthesisUtterance(finalText);
    utteranceRef.current.rate = speechRate * 0.9;
    utteranceRef.current.pitch = 0.95;
    utteranceRef.current.volume = 0.85;
    utteranceRef.current.lang = detectedLanguage;
    
    // Voice selection
    const voices = speechSynthesis.getVoices();
    let selectedVoice = null;
    
    if (hasHebrew) {
      selectedVoice = voices.find(voice => 
        voice.lang.includes('he') || voice.lang.includes('iw') ||
        voice.name.toLowerCase().includes('carmit') || 
        voice.name.toLowerCase().includes('hebrew')
      );
    }
    
    if (!selectedVoice) {
      selectedVoice = voices.find(voice => {
        const name = voice.name.toLowerCase();
        return name.includes('grandpa') || name.includes('aaron') || name.includes('arthur') || 
            name.includes('gordon') || name.includes('martin') || name.includes('jacques') ||
            name.includes('eddy') || name.includes('reed') || name.includes('rocko') ||
            (name.includes('male') && !name.includes('female'));
      });
    }
    
    if (selectedVoice) {
      utteranceRef.current.voice = selectedVoice;
    }

    // Event handlers
    utteranceRef.current.onstart = () => {
      setIsTalking(true);
      setIsThinking(false);
      isPlayingRef.current = true;
      onSpeechStart?.();
    };

    utteranceRef.current.onend = () => {
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

    // Start thinking state before speaking
    setIsThinking(true);
    setTimeout(() => {
      try {
        speechSynthesis.speak(utteranceRef.current!);
        setTimeout(() => {
          if (!speechSynthesis.speaking && !isTalking) {
            speechSynthesis.speak(utteranceRef.current!);
          }
        }, 100);
      } catch (error) {
        console.error('Error starting speech:', error);
        setIsThinking(false);
      }
    }, 500); // Brief thinking delay
  };

  const stopSpeech = () => {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    setIsTalking(false);
    setIsThinking(false);
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
  }, [text, autoPlay, isSpeechEnabled]);

  // Load voices
  useEffect(() => {
    const loadVoices = () => {
      speechSynthesis.getVoices();
    };

    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      stopSpeech();
    };
  }, []);

  // Determine animation state
  const getAnimationState = () => {
    if (isTalking) return 'talking';
    if (isThinking) return 'thinking';
    if (isListening) return 'listening';
    return 'idle';
  };

  const animationState = getAnimationState();

  return (
    <div className={styles.michaelAvatar}>
      <div className={`${styles.avatarContainer} ${styles[animationState]}`}>
        <div className={styles.avatarWrapper}>
          {/* Fallback image for browsers that don't support advanced animations */}
          <div className={styles.fallbackAvatar}>
            <img 
              src="/bot.png" 
              alt="Michael - SQL Teaching Assistant" 
              className={styles.avatarImage}
            />
          </div>

          {/* Lottie Animation Overlay */}
          <div className={styles.lottieContainer}>
            <Lottie
              lottieRef={lottieRef}
              animationData={isTalking ? talkingAnimationData : idleAnimationData}
              loop={true}
              autoplay={true}
              className={styles.lottieAnimation}
              rendererSettings={{
                preserveAspectRatio: 'xMidYMid slice'
              }}
            />
          </div>
          
          {/* State indicators */}
          {isListening && (
            <div className={styles.listeningIndicator}>
              <div className={styles.micIcon}>
                <Mic size={12} />
              </div>
              <div className={styles.soundWaves}>
                <div className={styles.wave}></div>
                <div className={styles.wave}></div>
                <div className={styles.wave}></div>
                <div className={styles.wave}></div>
              </div>
            </div>
          )}

          {isThinking && (
            <div className={styles.thinkingIndicator}>
              <div className={styles.thinkingDots}>
                <div className={styles.dot}></div>
                <div className={styles.dot}></div>
                <div className={styles.dot}></div>
              </div>
            </div>
          )}

          {isTalking && (
            <div className={styles.talkingIndicator}>
              <div className={styles.speakerIcon}>
                <Volume2 size={12} />
              </div>
              <div className={styles.speechWaves}>
                <div className={styles.speechWave}></div>
                <div className={styles.speechWave}></div>
                <div className={styles.speechWave}></div>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Control Panel */}
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

          {/* Settings panel */}
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
                    {animationState.charAt(0).toUpperCase() + animationState.slice(1)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MichaelAvatar;