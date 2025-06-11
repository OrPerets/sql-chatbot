"use client";

import React, { useState } from 'react';
import MichaelAvatar from './michael-avatar';
import styles from './avatar-demo.module.css';

const AvatarDemo: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [demoText, setDemoText] = useState("Hello! I'm Michael, your SQL teaching assistant. I can help you learn SQL with interactive lessons and explanations.");

  const handleToggleListening = () => {
    setIsListening(!isListening);
  };

  const demoTexts = [
    "Hello! I'm Michael, your SQL teaching assistant.",
    "Let me explain how SELECT statements work in SQL.",
    "שלום! אני מיכאל, עוזר הוראה שלכם ל-SQL.",
    "SQL is a powerful language for managing databases.",
    "Would you like to practice some SQL queries together?",
  ];

  const changeDemoText = () => {
    const currentIndex = demoTexts.indexOf(demoText);
    const nextIndex = (currentIndex + 1) % demoTexts.length;
    setDemoText(demoTexts[nextIndex]);
  };

  return (
    <div className={styles.demoContainer}>
      <div className={styles.header}>
        <h2>Michael Avatar Demo</h2>
        <p>Experience the enhanced animated teaching assistant</p>
      </div>

      <div className={styles.avatarShowcase}>
        <MichaelAvatar
          text={demoText}
          autoPlay={false}
          isListening={isListening}
          onToggleListening={handleToggleListening}
        />
      </div>

      <div className={styles.controls}>
        <div className={styles.controlGroup}>
          <h3>Demo Controls</h3>
          
          <button 
            className={styles.demoButton}
            onClick={changeDemoText}
          >
            Change Text
          </button>
          
          <button 
            className={`${styles.demoButton} ${isListening ? styles.active : ''}`}
            onClick={handleToggleListening}
          >
            {isListening ? 'Stop Listening' : 'Start Listening'}
          </button>
        </div>

        <div className={styles.textPreview}>
          <h4>Current Text:</h4>
          <p>"{demoText}"</p>
        </div>
      </div>

      <div className={styles.features}>
        <h3>Avatar Features</h3>
        <div className={styles.featureGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🎭</div>
            <h4>Lottie Animations</h4>
            <p>Smooth, sophisticated animations with talking and idle states</p>
          </div>
          
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🗣️</div>
            <h4>Text-to-Speech</h4>
            <p>Advanced speech synthesis with Hebrew and English support</p>
          </div>
          
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🎧</div>
            <h4>Listening Mode</h4>
            <p>Visual feedback when the avatar is listening for audio input</p>
          </div>
          
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🧠</div>
            <h4>Thinking State</h4>
            <p>Shows when the AI is processing before responding</p>
          </div>
          
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>⚙️</div>
            <h4>Customizable</h4>
            <p>Adjustable speech rate and advanced animation controls</p>
          </div>
          
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>📱</div>
            <h4>Responsive</h4>
            <p>Works beautifully on desktop, tablet, and mobile devices</p>
          </div>
        </div>
      </div>

      <div className={styles.stateExamples}>
        <h3>Animation States</h3>
        <div className={styles.stateGrid}>
          <div className={styles.stateCard}>
            <span className={styles.stateDot} data-state="idle"></span>
            <strong>Idle</strong>
            <p>Gentle floating animation with soft blue glow</p>
          </div>
          
          <div className={styles.stateCard}>
            <span className={styles.stateDot} data-state="thinking"></span>
            <strong>Thinking</strong>
            <p>Purple pulsing effect with rotating indicator</p>
          </div>
          
          <div className={styles.stateCard}>
            <span className={styles.stateDot} data-state="listening"></span>
            <strong>Listening</strong>
            <p>Green glow with animated sound waves</p>
          </div>
          
          <div className={styles.stateCard}>
            <span className={styles.stateDot} data-state="talking"></span>
            <strong>Talking</strong>
            <p>Red glow with bouncing animation and speech waves</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvatarDemo; 