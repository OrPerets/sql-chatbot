"use client";

import React, { useState, useEffect } from 'react';
import AnimatedMichael from '../../components/animated-michael';
import styles from './demo.module.css';

const AnimatedAvatarDemo = () => {
  const [currentDemo, setCurrentDemo] = useState<'idle' | 'talking' | 'listening' | 'thinking'>('idle');
  const [demoText, setDemoText] = useState('Hello! I\'m Michael, your SQL teaching assistant. Let me show you what I can do!');
  const [isListening, setIsListening] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);

  const demoStates = [
    {
      state: 'idle' as const,
      title: 'Idle State',
      description: 'Michael in his calm, waiting state with gentle breathing and blinking animations.',
      text: 'I\'m here whenever you need help with SQL!',
      duration: 4000
    },
    {
      state: 'thinking' as const,
      title: 'Thinking State',
      description: 'When Michael is processing your question and thinking of the best response.',
      text: 'Let me think about that SQL query...',
      duration: 3000
    },
    {
      state: 'talking' as const,
      title: 'Talking State',
      description: 'Michael speaking with expressive mouth movements and animated gestures.',
      text: 'Great question! In SQL, you can use SELECT statements to retrieve data from your database. Let me explain the basic syntax and show you some examples.',
      duration: 8000
    },
    {
      state: 'listening' as const,
      title: 'Listening State',
      description: 'Michael actively listening to your voice input with attentive animations.',
      text: 'I\'m listening carefully to your question.',
      duration: 3000
    }
  ];

  const [currentStateIndex, setCurrentStateIndex] = useState(0);
  const [isAutoDemo, setIsAutoDemo] = useState(false);

  useEffect(() => {
    if (isAutoDemo) {
      const timer = setTimeout(() => {
        setCurrentStateIndex((prev) => (prev + 1) % demoStates.length);
      }, demoStates[currentStateIndex].duration);

      return () => clearTimeout(timer);
    }
  }, [currentStateIndex, isAutoDemo, demoStates]);

  useEffect(() => {
    const currentState = demoStates[currentStateIndex];
    setCurrentDemo(currentState.state);
    setDemoText(currentState.text);
    setIsListening(currentState.state === 'listening');
  }, [currentStateIndex, demoStates]);

  const handleStateChange = (stateIndex: number) => {
    setIsAutoDemo(false);
    setCurrentStateIndex(stateIndex);
  };

  const toggleAutoDemo = () => {
    setIsAutoDemo(!isAutoDemo);
  };

  const currentState = demoStates[currentStateIndex];

  return (
    <div className={styles.demoContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}>Michael's Animated Avatar Demo</h1>
        <p className={styles.subtitle}>
          Experience the new emotionally responsive animated character
        </p>
      </div>

      <div className={styles.mainDemo}>
        <div className={styles.avatarSection}>
          <div className={styles.avatarContainer}>
            <AnimatedMichael
              text={demoText}
              autoPlay={autoPlay}
              isListening={isListening}
              size="large"
              className={styles.demoAvatar}
            />
          </div>
          
          <div className={styles.stateInfo}>
            <h3 className={styles.stateName}>{currentState.title}</h3>
            <p className={styles.stateDescription}>{currentState.description}</p>
          </div>
        </div>

        <div className={styles.controls}>
          <div className={styles.stateControls}>
            <h4>Avatar States</h4>
            <div className={styles.stateButtons}>
              {demoStates.map((state, index) => (
                <button
                  key={state.state}
                  className={`${styles.stateButton} ${
                    index === currentStateIndex ? styles.active : ''
                  }`}
                  onClick={() => handleStateChange(index)}
                >
                  {state.title}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.demoControls}>
            <button
              className={`${styles.controlButton} ${isAutoDemo ? styles.active : ''}`}
              onClick={toggleAutoDemo}
            >
              {isAutoDemo ? 'Stop Auto Demo' : 'Start Auto Demo'}
            </button>
            
            <button
              className={styles.controlButton}
              onClick={() => setAutoPlay(!autoPlay)}
            >
              {autoPlay ? 'Disable Auto Speech' : 'Enable Auto Speech'}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.features}>
        <h2>Key Features</h2>
        <div className={styles.featureGrid}>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>🎭</div>
            <h3>Emotional Expressions</h3>
            <p>Dynamic animations that change based on Michael's current state - idle, thinking, talking, or listening.</p>
          </div>
          
          <div className={styles.feature}>
            <div className={styles.featureIcon}>✨</div>
            <h3>Visual Effects</h3>
            <p>Beautiful breathing halos, energy rings, and state indicators that enhance the interactive experience.</p>
          </div>
          
          <div className={styles.feature}>
            <div className={styles.featureIcon}>🎙️</div>
            <h3>Speech Integration</h3>
            <p>Synchronized mouth movements and expressions when speaking, with support for multiple languages.</p>
          </div>
          
          <div className={styles.feature}>
            <div className={styles.featureIcon}>👂</div>
            <h3>Listening Feedback</h3>
            <p>Attentive animations and visual feedback when Michael is actively listening to your input.</p>
          </div>
          
          <div className={styles.feature}>
            <div className={styles.featureIcon}>📱</div>
            <h3>Responsive Design</h3>
            <p>Adapts seamlessly to different screen sizes with three size variants: small, medium, and large.</p>
          </div>
          
          <div className={styles.feature}>
            <div className={styles.featureIcon}>⚡</div>
            <h3>Performance Optimized</h3>
            <p>Efficient Lottie animations with smooth transitions and minimal performance impact.</p>
          </div>
        </div>
      </div>

      <div className={styles.sizeDemos}>
        <h2>Size Variants</h2>
        <div className={styles.sizeContainer}>
          <div className={styles.sizeDemo}>
            <h4>Small</h4>
            <AnimatedMichael
              text="I'm small but mighty!"
              size="small"
              className={styles.smallDemo}
            />
          </div>
          
          <div className={styles.sizeDemo}>
            <h4>Medium</h4>
            <AnimatedMichael
              text="Perfect for most interfaces!"
              size="medium"
              className={styles.mediumDemo}
            />
          </div>
          
          <div className={styles.sizeDemo}>
            <h4>Large</h4>
            <AnimatedMichael
              text="Full-featured experience!"
              size="large"
              className={styles.largeDemo}
            />
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <p>Built with React, TypeScript, and Lottie animations</p>
        <p>Designed for the modern SQL learning experience</p>
      </div>
    </div>
  );
};

export default AnimatedAvatarDemo; 