"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Volume2, VolumeX, Settings, Mic, MicOff } from 'lucide-react';
import Lottie from 'lottie-react';
import styles from './animated-michael.module.css';

interface AnimatedMichaelProps {
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

// Enhanced animation data for different states
const createIdleAnimation = () => ({
  v: "5.7.4",
  fr: 24,
  ip: 0,
  op: 120,
  w: 200,
  h: 200,
  nm: "Michael Idle",
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
            { i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] }, t: 0, s: [0] },
            { i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] }, t: 60, s: [2] },
            { t: 120, s: [0] }
          ]
        },
        p: { 
          a: 1,
          k: [
            { i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] }, t: 0, s: [100, 90] },
            { i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] }, t: 60, s: [100, 85] },
            { t: 120, s: [100, 90] }
          ]
        },
        s: { 
          a: 1,
          k: [
            { i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] }, t: 0, s: [100, 100] },
            { i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] }, t: 60, s: [101, 99] },
            { t: 120, s: [100, 100] }
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
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [85, 85] }
            },
            {
              ty: "fl",
              c: { a: 0, k: [0.95, 0.97, 1, 1] }
            },
            {
              ty: "st",
              c: { a: 0, k: [0.3, 0.5, 0.9, 1] },
              w: { a: 0, k: 3 }
            }
          ]
        }
      ]
    },
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: "Eyes",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        p: { a: 0, k: [100, 75] },
        s: { 
          a: 1,
          k: [
            { i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] }, t: 0, s: [100, 100] },
            { i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] }, t: 80, s: [100, 5] },
            { i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] }, t: 85, s: [100, 100] },
            { i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] }, t: 110, s: [100, 5] },
            { t: 115, s: [100, 100] }
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
              p: { a: 0, k: [-18, 0] },
              s: { a: 0, k: [12, 12] }
            },
            {
              d: 1,
              ty: "el",
              p: { a: 0, k: [18, 0] },
              s: { a: 0, k: [12, 12] }
            },
            {
              ty: "fl",
              c: { a: 0, k: [0.2, 0.3, 0.8, 1] }
            }
          ]
        }
      ]
    },
    {
      ddd: 0,
      ind: 3,
      ty: 4,
      nm: "Mouth",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        p: { a: 0, k: [100, 110] },
        s: { 
          a: 1,
          k: [
            { i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] }, t: 0, s: [100, 30] },
            { i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] }, t: 40, s: [120, 25] },
            { i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] }, t: 80, s: [100, 35] },
            { t: 120, s: [100, 30] }
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
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [25, 8] }
            },
            {
              ty: "fl",
              c: { a: 0, k: [0.8, 0.4, 0.4, 1] }
            }
          ]
        }
      ]
    }
  ]
});

const createTalkingAnimation = () => ({
  v: "5.7.4",
  fr: 30,
  ip: 0,
  op: 60,
  w: 200,
  h: 200,
  nm: "Michael Talking",
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
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 15, s: [3] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 30, s: [-2] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 45, s: [1] },
            { t: 60, s: [0] }
          ]
        },
        p: { 
          a: 1,
          k: [
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 0, s: [100, 88] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 15, s: [102, 85] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 30, s: [98, 90] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 45, s: [101, 87] },
            { t: 60, s: [100, 88] }
          ]
        },
        s: { 
          a: 1,
          k: [
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 0, s: [100, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 15, s: [103, 98] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 30, s: [97, 102] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 45, s: [102, 99] },
            { t: 60, s: [100, 100] }
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
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [85, 85] }
            },
            {
              ty: "fl",
              c: { a: 0, k: [0.95, 0.97, 1, 1] }
            },
            {
              ty: "st",
              c: { a: 0, k: [0.9, 0.3, 0.3, 1] },
              w: { a: 0, k: 3 }
            }
          ]
        }
      ]
    },
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: "Eyes",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        p: { a: 0, k: [100, 75] },
        s: { 
          a: 1,
          k: [
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 0, s: [100, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 25, s: [105, 95] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 50, s: [95, 105] },
            { t: 60, s: [100, 100] }
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
              p: { a: 0, k: [-18, 0] },
              s: { a: 0, k: [12, 12] }
            },
            {
              d: 1,
              ty: "el",
              p: { a: 0, k: [18, 0] },
              s: { a: 0, k: [12, 12] }
            },
            {
              ty: "fl",
              c: { a: 0, k: [0.2, 0.3, 0.8, 1] }
            }
          ]
        }
      ]
    },
    {
      ddd: 0,
      ind: 3,
      ty: 4,
      nm: "Mouth",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        p: { a: 0, k: [100, 110] },
        s: { 
          a: 1,
          k: [
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 0, s: [100, 40] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 8, s: [140, 120] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 16, s: [80, 60] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 24, s: [120, 100] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 32, s: [90, 70] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 40, s: [110, 90] },
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 48, s: [95, 80] },
            { t: 60, s: [100, 40] }
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
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [25, 12] }
            },
            {
              ty: "fl",
              c: { a: 0, k: [0.1, 0.1, 0.2, 1] }
            }
          ]
        }
      ]
    }
  ]
});

const createListeningAnimation = () => ({
  v: "5.7.4",
  fr: 24,
  ip: 0,
  op: 48,
  w: 200,
  h: 200,
  nm: "Michael Listening",
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
            { i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] }, t: 0, s: [-1] },
            { i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] }, t: 24, s: [1] },
            { t: 48, s: [-1] }
          ]
        },
        p: { a: 0, k: [100, 85] },
        s: { 
          a: 1,
          k: [
            { i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] }, t: 0, s: [102, 102] },
            { i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] }, t: 24, s: [104, 104] },
            { t: 48, s: [102, 102] }
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
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [85, 85] }
            },
            {
              ty: "fl",
              c: { a: 0, k: [0.95, 0.97, 1, 1] }
            },
            {
              ty: "st",
              c: { a: 0, k: [0.2, 0.8, 0.4, 1] },
              w: { a: 0, k: 3 }
            }
          ]
        }
      ]
    },
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: "Eyes",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        p: { a: 0, k: [100, 70] },
        s: { 
          a: 1,
          k: [
            { i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] }, t: 0, s: [110, 100] },
            { i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] }, t: 24, s: [115, 105] },
            { t: 48, s: [110, 100] }
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
              p: { a: 0, k: [-18, 0] },
              s: { a: 0, k: [14, 14] }
            },
            {
              d: 1,
              ty: "el",
              p: { a: 0, k: [18, 0] },
              s: { a: 0, k: [14, 14] }
            },
            {
              ty: "fl",
              c: { a: 0, k: [0.2, 0.3, 0.8, 1] }
            }
          ]
        }
      ]
    }
  ]
});

const createThinkingAnimation = () => ({
  v: "5.7.4",
  fr: 20,
  ip: 0,
  op: 80,
  w: 200,
  h: 200,
  nm: "Michael Thinking",
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
            { i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] }, t: 0, s: [2] },
            { i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] }, t: 40, s: [-2] },
            { t: 80, s: [2] }
          ]
        },
        p: { a: 0, k: [100, 88] },
        s: { 
          a: 1,
          k: [
            { i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] }, t: 0, s: [101, 101] },
            { i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] }, t: 40, s: [103, 99] },
            { t: 80, s: [101, 101] }
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
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [85, 85] }
            },
            {
              ty: "fl",
              c: { a: 0, k: [0.95, 0.97, 1, 1] }
            },
            {
              ty: "st",
              c: { a: 0, k: [0.7, 0.4, 0.9, 1] },
              w: { a: 0, k: 3 }
            }
          ]
        }
      ]
    },
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: "Eyebrows",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        p: { a: 0, k: [100, 58] },
        s: { 
          a: 1,
          k: [
            { i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] }, t: 0, s: [100, 100] },
            { i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] }, t: 40, s: [105, 110] },
            { t: 80, s: [100, 100] }
          ]
        }
      },
      shapes: [
        {
          ty: "gr",
          it: [
            {
              d: 1,
              ty: "rc",
              p: { a: 0, k: [-18, 0] },
              s: { a: 0, k: [20, 3] },
              r: { a: 0, k: 2 }
            },
            {
              d: 1,
              ty: "rc",
              p: { a: 0, k: [18, 0] },
              s: { a: 0, k: [20, 3] },
              r: { a: 0, k: 2 }
            },
            {
              ty: "fl",
              c: { a: 0, k: [0.4, 0.4, 0.6, 1] }
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
        p: { a: 0, k: [100, 75] },
        s: { a: 0, k: [95, 95] }
      },
      shapes: [
        {
          ty: "gr",
          it: [
            {
              d: 1,
              ty: "el",
              p: { a: 0, k: [-18, 0] },
              s: { a: 0, k: [11, 11] }
            },
            {
              d: 1,
              ty: "el",
              p: { a: 0, k: [18, 0] },
              s: { a: 0, k: [11, 11] }
            },
            {
              ty: "fl",
              c: { a: 0, k: [0.2, 0.3, 0.8, 1] }
            }
          ]
        }
      ]
    }
  ]
});

const AnimatedMichael: React.FC<AnimatedMichaelProps> = ({ 
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
  const [speechRate, setSpeechRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isPlayingRef = useRef(false);
  const lottieRef = useRef<any>(null);

  // Animation data cache
  const animations = useRef({
    idle: createIdleAnimation(),
    talking: createTalkingAnimation(),
    listening: createListeningAnimation(),
    thinking: createThinkingAnimation()
  });

  const speak = useCallback((textToSpeak: string) => {
    if (!isSpeechEnabled || !textToSpeak.trim()) {
      return;
    }
    
    if (!('speechSynthesis' in window)) {
      console.error('Speech Synthesis not supported');
      return;
    }

    // Stop any current speech
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }

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

    utteranceRef.current.onerror = (event) => {
      console.error('Speech error:', event);
      setIsTalking(false);
      setAvatarState('idle');
      isPlayingRef.current = false;
      onSpeechEnd?.();
    };

    // Start thinking state before speaking
    setIsThinking(true);
    setAvatarState('thinking');
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
        setAvatarState('idle');
      }
    }, 500);
  }, [isSpeechEnabled, speechRate, isTalking, onSpeechStart, onSpeechEnd]);

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

  // Load voices and cleanup
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
  }, [stopSpeech]);

  const getSizeClass = () => {
    switch (size) {
      case 'small': return styles.small;
      case 'large': return styles.large;
      default: return styles.medium;
    }
  };

  return (
    <div className={`${styles.animatedMichael} ${getSizeClass()} ${styles[avatarState]} ${className}`}>
      <div className={styles.avatarContainer}>
        <div className={styles.avatarWrapper}>
          {/* Background effects */}
          <div className={styles.backgroundEffects}>
            <div className={styles.breathingHalo}></div>
            <div className={styles.energyRing}></div>
          </div>

          {/* Fallback image */}
          <div className={styles.fallbackAvatar}>
            <img 
              src="/bot.png" 
              alt="Michael - SQL Teaching Assistant" 
              className={styles.avatarImage}
            />
          </div>

          {/* Lottie Animation */}
          <div className={styles.lottieContainer}>
            <Lottie
              lottieRef={lottieRef}
              animationData={animations.current[avatarState]}
              loop={true}
              autoplay={true}
              className={styles.lottieAnimation}
              rendererSettings={{
                preserveAspectRatio: 'xMidYMid slice',
                clearCanvas: true,
                progressiveLoad: true,
                hideOnTransparent: true
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
                    {avatarState.charAt(0).toUpperCase() + avatarState.slice(1)}
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

export default AnimatedMichael; 