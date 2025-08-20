'use client';

import React, { useState, useRef, useEffect } from 'react';
import MichaelAvatarDirect, { MichaelAvatarDirectRef } from '../../components/MichaelAvatarDirect';
import styles from './demo.module.css';

export default function AvatarStatesDemo() {
  const avatarRef = useRef<MichaelAvatarDirectRef>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentMood, setCurrentMood] = useState('neutral');
  const [currentGesture, setCurrentGesture] = useState('');

  // Available moods from TalkingHead library
  const moods = ['neutral', 'happy', 'angry', 'sad', 'fear', 'disgust', 'love', 'sleep'];
  
  // Available gestures from TalkingHead library
  const gestures = ['handup', 'index', 'ok', 'thumbup', 'thumbdown', 'side', 'shrug', 'namaste'];

  useEffect(() => {
    console.log('Avatar States Demo mounted');
  }, []);

  const handleMoodChange = (mood: string) => {
    console.log(`Setting mood to: ${mood}`);
    try {
      avatarRef.current?.setMood(mood);
      setCurrentMood(mood);
    } catch (error) {
      console.error('Error setting mood:', error);
    }
  };

  const handleGesturePlay = (gesture: string) => {
    console.log(`Playing gesture: ${gesture}`);
    try {
      avatarRef.current?.playGesture(gesture, 3, false, 1000);
      setCurrentGesture(gesture);
      // Clear gesture after a delay
      setTimeout(() => setCurrentGesture(''), 3000);
    } catch (error) {
      console.error('Error playing gesture:', error);
    }
  };

  const handleAvatarLoaded = () => {
    console.log('Avatar loaded successfully');
    setIsLoaded(true);
  };

  const testSequence = () => {
    if (!isLoaded) {
      console.log('Avatar not loaded yet');
      return;
    }

    console.log('Starting test sequence...');
    
    // Happy with wave
    setTimeout(() => {
      handleMoodChange('happy');
      setTimeout(() => handleGesturePlay('handup'), 500);
    }, 500);

    // Thinking gesture
    setTimeout(() => {
      handleMoodChange('neutral');
      setTimeout(() => handleGesturePlay('index'), 500);
    }, 4000);

    // Thumbs up
    setTimeout(() => {
      handleMoodChange('happy');
      setTimeout(() => handleGesturePlay('thumbup'), 500);
    }, 7000);

    // Shrug
    setTimeout(() => {
      handleMoodChange('neutral');
      setTimeout(() => handleGesturePlay('shrug'), 500);
    }, 10000);

    // OK gesture
    setTimeout(() => {
      handleMoodChange('happy');
      setTimeout(() => handleGesturePlay('ok'), 500);
    }, 13000);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Avatar States Demo</h1>
      <p className={styles.description}>
        Test different moods and gestures with the TalkingHead avatar.
        Available gestures: {gestures.join(', ')}
        Available moods: {moods.join(', ')}
      </p>

      <div className={styles.avatarContainer}>
        <MichaelAvatarDirect 
          ref={avatarRef}
          onAvatarLoaded={handleAvatarLoaded}
        />
      </div>

      <div className={styles.controls}>
        <div className={styles.section}>
          <h3>Avatar Status</h3>
          <p>Loaded: {isLoaded ? '✅' : '❌'}</p>
          <p>Current Mood: {currentMood}</p>
          <p>Current Gesture: {currentGesture || 'None'}</p>
        </div>

        <div className={styles.section}>
          <h3>Moods</h3>
          <div className={styles.buttonGrid}>
            {moods.map((mood) => (
              <button
                key={mood}
                onClick={() => handleMoodChange(mood)}
                className={`${styles.button} ${currentMood === mood ? styles.active : ''}`}
                disabled={!isLoaded}
              >
                {mood}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <h3>Gestures</h3>
          <div className={styles.buttonGrid}>
            {gestures.map((gesture) => (
              <button
                key={gesture}
                onClick={() => handleGesturePlay(gesture)}
                className={styles.button}
                disabled={!isLoaded}
              >
                {gesture}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <h3>Test Sequence</h3>
          <button
            onClick={testSequence}
            className={`${styles.button} ${styles.primaryButton}`}
            disabled={!isLoaded}
          >
            Run Test Sequence
          </button>
        </div>
      </div>
    </div>
  );
} 