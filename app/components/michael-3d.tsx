"use client";

import React, { useRef, useState, useEffect, Suspense, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Volume2, VolumeX, Settings, Mic, MicOff } from 'lucide-react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Float, Sphere, Cylinder, RoundedBox, Text3D } from '@react-three/drei';
import styles from './michael-3d.module.css';

interface Michael3DProps {
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

// 3D Michael Character Component
const MichaelCharacter: React.FC<{ 
  state: AvatarState;
  animationTime: number;
}> = ({ state, animationTime }) => {
  const characterRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const eyesRef = useRef<THREE.Group>(null);
  const mouthRef = useRef<THREE.Mesh>(null);

  useFrame((frameState, delta) => {
    if (!characterRef.current) return;

    const time = frameState.clock.elapsedTime;
    
    // Base floating animation
    characterRef.current.position.y = Math.sin(time * 1.5) * 0.1;
    characterRef.current.rotation.y = Math.sin(time * 0.5) * 0.05;

    // Head animations based on state
    if (headRef.current) {
      switch (state) {
        case 'idle':
          headRef.current.rotation.x = Math.sin(time * 2) * 0.02;
          headRef.current.rotation.y = Math.sin(time * 1.5) * 0.03;
          break;
        case 'thinking':
          headRef.current.rotation.x = Math.sin(time * 3) * 0.05 + 0.1;
          headRef.current.rotation.y = Math.sin(time * 2) * 0.08;
          break;
        case 'listening':
          headRef.current.rotation.x = -0.05;
          headRef.current.rotation.y = Math.sin(time * 4) * 0.02;
          break;
        case 'talking':
          headRef.current.rotation.x = Math.sin(time * 6) * 0.03;
          headRef.current.rotation.y = Math.sin(time * 4) * 0.04;
          break;
      }
    }

    // Arm animations
    if (leftArmRef.current && rightArmRef.current) {
      switch (state) {
        case 'talking':
          leftArmRef.current.rotation.z = Math.sin(time * 5) * 0.2 + 0.1;
          rightArmRef.current.rotation.z = Math.sin(time * 5 + Math.PI) * 0.2 - 0.1;
          break;
        case 'thinking':
          leftArmRef.current.rotation.z = 0.3;
          rightArmRef.current.rotation.z = -0.5;
          rightArmRef.current.rotation.x = -0.8;
          break;
        default:
          leftArmRef.current.rotation.z = Math.sin(time * 2) * 0.05;
          rightArmRef.current.rotation.z = Math.sin(time * 2 + Math.PI) * 0.05;
      }
    }

    // Eye blinking
    if (eyesRef.current) {
      const blinkTime = time * 0.5;
      if (Math.sin(blinkTime * 20) > 0.98) {
        eyesRef.current.scale.y = 0.1;
      } else {
        eyesRef.current.scale.y = 1;
      }
    }

    // Mouth animations for talking
    if (mouthRef.current && state === 'talking') {
      const mouthScale = 1 + Math.sin(time * 15) * 0.3;
      mouthRef.current.scale.setScalar(mouthScale);
    }
  });

  // Color schemes based on state
  const getStateColors = () => {
    switch (state) {
      case 'thinking':
        return { primary: '#8B5CF6', secondary: '#A78BFA', accent: '#C4B5FD' };
      case 'listening':
        return { primary: '#10B981', secondary: '#34D399', accent: '#6EE7B7' };
      case 'talking':
        return { primary: '#EF4444', secondary: '#F87171', accent: '#FCA5A5' };
      default:
        return { primary: '#3B82F6', secondary: '#60A5FA', accent: '#93C5FD' };
    }
  };

  const colors = getStateColors();

  return (
    <group ref={characterRef} position={[0, 0, 0]}>
      {/* Body */}
      <group position={[0, -0.5, 0]}>
        {/* Torso */}
        <RoundedBox args={[0.8, 1.2, 0.4]} radius={0.1}>
          <meshStandardMaterial color={colors.primary} />
        </RoundedBox>
        
        {/* Head */}
        <group ref={headRef} position={[0, 1, 0]}>
          {/* Head sphere */}
          <Sphere args={[0.5, 32, 32]} position={[0, 0, 0]}>
            <meshStandardMaterial color="#FDBCB4" />
          </Sphere>
          
          {/* Hair */}
          <Sphere args={[0.52, 32, 32]} position={[0, 0.1, 0]}>
            <meshStandardMaterial color="#8B4513" />
          </Sphere>
          
          {/* Eyes */}
          <group ref={eyesRef}>
            <Sphere args={[0.08, 16, 16]} position={[-0.15, 0.1, 0.4]}>
              <meshStandardMaterial color="#000" />
            </Sphere>
            <Sphere args={[0.08, 16, 16]} position={[0.15, 0.1, 0.4]}>
              <meshStandardMaterial color="#000" />
            </Sphere>
            {/* Eye whites */}
            <Sphere args={[0.12, 16, 16]} position={[-0.15, 0.1, 0.38]}>
              <meshStandardMaterial color="#FFF" />
            </Sphere>
            <Sphere args={[0.12, 16, 16]} position={[0.15, 0.1, 0.38]}>
              <meshStandardMaterial color="#FFF" />
            </Sphere>
          </group>
          
          {/* Mouth */}
          <Sphere ref={mouthRef} args={[0.06, 16, 16]} position={[0, -0.15, 0.4]}>
            <meshStandardMaterial color="#FF6B6B" />
          </Sphere>
          
          {/* Nose */}
          <Sphere args={[0.03, 8, 8]} position={[0, 0, 0.48]}>
            <meshStandardMaterial color="#FDBCB4" />
          </Sphere>
        </group>

        {/* Left Arm */}
        <group ref={leftArmRef} position={[-0.5, 0.3, 0]}>
          <Cylinder args={[0.08, 0.08, 0.8]} rotation={[0, 0, 0]}>
            <meshStandardMaterial color="#FDBCB4" />
          </Cylinder>
          {/* Hand */}
          <Sphere args={[0.1, 16, 16]} position={[0, -0.5, 0]}>
            <meshStandardMaterial color="#FDBCB4" />
          </Sphere>
        </group>

        {/* Right Arm */}
        <group ref={rightArmRef} position={[0.5, 0.3, 0]}>
          <Cylinder args={[0.08, 0.08, 0.8]} rotation={[0, 0, 0]}>
            <meshStandardMaterial color="#FDBCB4" />
          </Cylinder>
          {/* Hand */}
          <Sphere args={[0.1, 16, 16]} position={[0, -0.5, 0]}>
            <meshStandardMaterial color="#FDBCB4" />
          </Sphere>
        </group>

        {/* Legs */}
        <group position={[0, -0.8, 0]}>
          {/* Left Leg */}
          <Cylinder args={[0.1, 0.1, 0.8]} position={[-0.2, -0.4, 0]}>
            <meshStandardMaterial color={colors.secondary} />
          </Cylinder>
          {/* Right Leg */}
          <Cylinder args={[0.1, 0.1, 0.8]} position={[0.2, -0.4, 0]}>
            <meshStandardMaterial color={colors.secondary} />
          </Cylinder>
          
          {/* Feet */}
          <RoundedBox args={[0.15, 0.08, 0.25]} position={[-0.2, -0.9, 0.1]}>
            <meshStandardMaterial color="#2D3748" />
          </RoundedBox>
          <RoundedBox args={[0.15, 0.08, 0.25]} position={[0.2, -0.9, 0.1]}>
            <meshStandardMaterial color="#2D3748" />
          </RoundedBox>
        </group>
      </group>

      {/* State-specific effects */}
      {state === 'thinking' && (
        <Float speed={2} rotationIntensity={0.5} floatIntensity={0.2}>
          <Text3D
            font="/fonts/helvetiker_regular.typeface.json"
            size={0.1}
            height={0.02}
            position={[0.8, 1.2, 0]}
            rotation={[0, -Math.PI / 4, 0]}
          >
            🤔
            <meshStandardMaterial color={colors.accent} />
          </Text3D>
        </Float>
      )}

      {state === 'listening' && (
        <Float speed={3} rotationIntensity={0.3} floatIntensity={0.3}>
          <Sphere args={[0.05, 16, 16]} position={[0.7, 1.5, 0]}>
            <meshStandardMaterial color={colors.primary} transparent opacity={0.7} />
          </Sphere>
          <Sphere args={[0.04, 16, 16]} position={[0.8, 1.6, 0]}>
            <meshStandardMaterial color={colors.secondary} transparent opacity={0.5} />
          </Sphere>
          <Sphere args={[0.03, 16, 16]} position={[0.9, 1.7, 0]}>
            <meshStandardMaterial color={colors.accent} transparent opacity={0.3} />
          </Sphere>
        </Float>
      )}

      {state === 'talking' && (
        <Float speed={4} rotationIntensity={0.8} floatIntensity={0.4}>
          <group position={[0.8, 0.5, 0]}>
            <Sphere args={[0.03, 8, 8]} position={[0, 0, 0]}>
              <meshStandardMaterial color={colors.primary} transparent opacity={0.8} />
            </Sphere>
            <Sphere args={[0.04, 8, 8]} position={[0.1, 0.1, 0]}>
              <meshStandardMaterial color={colors.secondary} transparent opacity={0.6} />
            </Sphere>
            <Sphere args={[0.05, 8, 8]} position={[0.2, 0.2, 0]}>
              <meshStandardMaterial color={colors.accent} transparent opacity={0.4} />
            </Sphere>
          </group>
        </Float>
      )}
    </group>
  );
};

// Scene environment component
const SceneEnvironment: React.FC<{ state: AvatarState }> = ({ state }) => {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  
  useFrame((frameState) => {
    if (lightRef.current) {
      const time = frameState.clock.elapsedTime;
      lightRef.current.position.x = Math.sin(time * 0.5) * 3;
      lightRef.current.position.z = Math.cos(time * 0.5) * 3;
    }
  });

  const getEnvironmentSettings = () => {
    switch (state) {
      case 'thinking':
        return { preset: 'sunset' as const, intensity: 0.4 };
      case 'listening':
        return { preset: 'forest' as const, intensity: 0.6 };
      case 'talking':
        return { preset: 'studio' as const, intensity: 0.8 };
      default:
        return { preset: 'city' as const, intensity: 0.5 };
    }
  };

  const env = getEnvironmentSettings();

  return (
    <>
      <Environment preset={env.preset} />
      <ambientLight intensity={env.intensity} />
      <directionalLight 
        ref={lightRef}
        position={[2, 5, 2]} 
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <ContactShadows 
        position={[0, -2, 0]} 
        opacity={0.3} 
        scale={5} 
        blur={2} 
        far={3} 
      />
    </>
  );
};

// Loading fallback component
const LoadingFallback: React.FC = () => (
  <div className={styles.loadingContainer}>
    <div className={styles.loadingSpinner}></div>
    <p>Loading Michael...</p>
  </div>
);

// Main 3D Michael component
const Michael3D: React.FC<Michael3DProps> = ({ 
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
  const [speechRate, setSpeechRate] = useState(1.5); // Ultra-fast default speed for instant response
  const [showSettings, setShowSettings] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [animationTime, setAnimationTime] = useState(0);
  
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isPlayingRef = useRef(false);

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

    // Clean text for speech - optimized for faster, smoother speech
    const cleanText = textToSpeak
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
      .replace(/```[\s\S]*?```/g, 'code block') // Replace code blocks with readable text
      .replace(/`([^`]+)`/g, '$1') // Remove inline code backticks
      .replace(/\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|TABLE|DATABASE)\b/gi, '') // Remove SQL keywords
      .replace(/[😊😀😃😄😁😆😅🤣😂🙂🙃😉😇🥰😍🤩😘😗😚😙😋😛😜🤪😝🤑🤗🤭🤫🤔🤐🤨😐😑😶😏😒🙄😬🤥😌😔😪🤤😴😷🤒🤕🤢🤮🤧🥵🥶🥴😵🤯🤠🥳😎🤓🧐🚀⚡💡🎯🎓✨👍👎👏🔧🛠️📝📊💻⭐🎉🔥💪🏆📈🎪]/g, '') // Remove emojis
      .replace(/[\.]{2,}/g, '.') // Replace multiple dots with single dot
      .replace(/[,]{2,}/g, ',') // Replace multiple commas with single comma  
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\s*[,]\s*/g, ', ') // Ensure proper comma spacing
      .replace(/\s*[.]\s*/g, '. ') // Ensure proper period spacing
      .trim();
    
    const finalText = cleanText || textToSpeak;

    // Detect language
    const hasHebrew = /[\u0590-\u05FF]/.test(finalText);
    const detectedLanguage = hasHebrew ? 'he-IL' : 'en-US';

    utteranceRef.current = new SpeechSynthesisUtterance(finalText);
    utteranceRef.current.rate = Math.min(speechRate * 1.6, 2.5); // Maximum speed! 1.5 * 1.6 = 2.4x (ultra-fast)
    utteranceRef.current.pitch = 1.0; // Normal pitch for clearer speech
    utteranceRef.current.volume = 0.9; // Slightly louder
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
      // Talking state already set below for instant feedback
      console.log('Speech synthesis started');
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

    // Set talking state IMMEDIATELY for instant visual feedback
    setIsTalking(true);
    setAvatarState('talking');
    isPlayingRef.current = true;
    onSpeechStart?.();
    
    try {
      speechSynthesis.speak(utteranceRef.current!);
    } catch (error) {
      console.error('Error starting speech:', error);
      setIsTalking(false);
      setAvatarState('idle');
      isPlayingRef.current = false;
    }
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

  // Auto-play effect - start speech immediately when text is ready
  useEffect(() => {
    if (autoPlay && text && isSpeechEnabled && !isPlayingRef.current) {
      const timer = setTimeout(() => {
        if (text && !isPlayingRef.current) {
          speak(text);
        }
      }, 0); // INSTANT response - 0ms delay for perfect text-audio synchronization
      
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

  // Animation timer
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationTime(prev => prev + 0.016);
    }, 16);
    return () => clearInterval(interval);
  }, []);

  const getSizeClass = () => {
    switch (size) {
      case 'small': return styles.small;
      case 'large': return styles.large;
      default: return styles.medium;
    }
  };

  const getCanvasSize = () => {
    switch (size) {
      case 'small': return { width: 300, height: 300 };
      case 'large': return { width: 600, height: 600 };
      default: return { width: 450, height: 450 };
    }
  };

  const canvasSize = getCanvasSize();

  return (
    <div className={`${styles.michael3D} ${getSizeClass()} ${styles[avatarState]} ${className}`}>
      <div className={styles.canvasContainer}>
        <Suspense fallback={<LoadingFallback />}>
          <Canvas
            style={{ width: canvasSize.width, height: canvasSize.height }}
            camera={{ position: [0, 0, 5], fov: 50 }}
            shadows
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: true }}
          >
            <SceneEnvironment state={avatarState} />
            <MichaelCharacter state={avatarState} animationTime={animationTime} />
            <OrbitControls
              enablePan={false}
              enableZoom={false}
              enableRotate={false}
              target={[0, 0, 0]}
            />
          </Canvas>
        </Suspense>
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
                  max="2.5"
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

export default Michael3D; 