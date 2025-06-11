"use client";

import React, { useState, useEffect } from 'react';
import Michael3DSimple from '../../components/michael-3d-simple';
import styles from './demo.module.css';

const Michael3DDemo: React.FC = () => {
  const [currentMessage, setCurrentMessage] = useState("שלום! אני מיכאל, העוזר שלך בלימוד SQL. אני כאן כדי לעזור לך להבין ולכתוב שאילתות SQL בצורה הטובה ביותר!");
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [avatarSize, setAvatarSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [demoMode, setDemoMode] = useState<'idle' | 'interactive' | 'showcase'>('interactive');
  
  const sampleMessages = [
    "שלום! אני מיכאל, העוזר שלך בלימוד SQL. בואו נתחיל ללמוד יחד!",
    "SQL היא שפת תכנות מיוחדת לעבודה עם בסיסי נתונים. האם אתם מוכנים ללמוד?",
    "SELECT * FROM students WHERE grade > 90 - זוהי דוגמה לשאילתה בסיסית ב-SQL!",
    "CREATE TABLE users (id INT, name VARCHAR(50), email VARCHAR(100)) - כך יוצרים טבלה חדשה!",
    "INSERT INTO products VALUES (1, 'iPhone', 999.99) - כך מוסיפים נתונים לטבלה!",
    "JOIN הוא פעולה מאוד חשובה ב-SQL שמאפשרת לחבר נתונים מכמה טבלאות!",
    "אני כאן כדי לעזור לכם להבין כל היבט של SQL. אל תהססו לשאול שאלות!",
    "🎯 מוכנים לאתגר? נסו לכתוב שאילתה שמחזירה את החלק העליון של התוצאות!",
    "הצלחתם! אתם עושים התקדמות מעולה בלימוד SQL. המשיכו כך! 🌟",
    "זוכרים: תרגול הוא המפתח להצלחה ב-SQL. נמשיך ללמוד יחד!"
  ];

  const [currentSampleIndex, setCurrentSampleIndex] = useState(0);

  useEffect(() => {
    if (demoMode === 'showcase') {
      const interval = setInterval(() => {
        setCurrentSampleIndex((prev) => {
          const nextIndex = (prev + 1) % sampleMessages.length;
          setCurrentMessage(sampleMessages[nextIndex]);
          return nextIndex;
        });
      }, 8000);

      return () => clearInterval(interval);
    }
  }, [demoMode, sampleMessages]);

  const handleToggleListening = () => {
    setIsListening(!isListening);
    setTimeout(() => {
      setIsListening(false);
    }, 3000);
  };

  const handleMessageChange = (message: string) => {
    setCurrentMessage(message);
  };

  const handleSpeechStart = () => {
    console.log('Speech started');
  };

  const handleSpeechEnd = () => {
    console.log('Speech ended');
  };

  return (
    <div className={styles.demoContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}>🎪 Michael 3D Avatar Demo</h1>
        <p className={styles.subtitle}>
          Experience the next generation 3D animated SQL teaching assistant
        </p>
      </div>

      <div className={styles.mainContent}>
        {/* Avatar Display */}
        <div className={styles.avatarDisplay}>
          <Michael3DSimple
            text={currentMessage}
            autoPlay={isAutoPlay}
            isListening={isListening}
            onToggleListening={handleToggleListening}
            onSpeechStart={handleSpeechStart}
            onSpeechEnd={handleSpeechEnd}
            size={avatarSize}
            className={styles.demoAvatar}
          />
        </div>

        {/* Controls Panel */}
        <div className={styles.controlsPanel}>
          <div className={styles.controlSection}>
            <h3 className={styles.sectionTitle}>🎛️ Avatar Controls</h3>
            
            <div className={styles.controlGroup}>
              <label className={styles.controlLabel}>Size:</label>
              <div className={styles.buttonGroup}>
                {(['small', 'medium', 'large'] as const).map((size) => (
                  <button
                    key={size}
                    className={`${styles.controlButton} ${avatarSize === size ? styles.active : ''}`}
                    onClick={() => setAvatarSize(size)}
                  >
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.controlGroup}>
              <label className={styles.controlLabel}>Demo Mode:</label>
              <div className={styles.buttonGroup}>
                {(['idle', 'interactive', 'showcase'] as const).map((mode) => (
                  <button
                    key={mode}
                    className={`${styles.controlButton} ${demoMode === mode ? styles.active : ''}`}
                    onClick={() => setDemoMode(mode)}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.controlGroup}>
              <label className={styles.toggleContainer}>
                <input
                  type="checkbox"
                  checked={isAutoPlay}
                  onChange={(e) => setIsAutoPlay(e.target.checked)}
                  className={styles.toggleInput}
                />
                <span className={styles.toggleSlider}></span>
                <span className={styles.toggleLabel}>Auto-play Speech</span>
              </label>
            </div>

            <div className={styles.controlGroup}>
              <button
                className={`${styles.actionButton} ${styles.listeningButton} ${isListening ? styles.listening : ''}`}
                onClick={handleToggleListening}
              >
                {isListening ? '🎤 Listening...' : '🎤 Test Listening Mode'}
              </button>
            </div>
          </div>

          {/* Message Controls */}
          <div className={styles.controlSection}>
            <h3 className={styles.sectionTitle}>💬 Message Controls</h3>
            
            <div className={styles.controlGroup}>
              <label className={styles.controlLabel}>Custom Message:</label>
              <textarea
                className={styles.messageInput}
                value={currentMessage}
                onChange={(e) => handleMessageChange(e.target.value)}
                placeholder="Enter a message for Michael to speak..."
                rows={4}
              />
            </div>

            <div className={styles.controlGroup}>
              <label className={styles.controlLabel}>Quick Messages:</label>
              <div className={styles.quickMessages}>
                {sampleMessages.slice(0, 5).map((message, index) => (
                  <button
                    key={index}
                    className={styles.quickMessageButton}
                    onClick={() => handleMessageChange(message)}
                  >
                    {message.length > 50 ? message.substring(0, 50) + '...' : message}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Feature Showcase */}
          <div className={styles.controlSection}>
            <h3 className={styles.sectionTitle}>✨ Features</h3>
            <div className={styles.featuresList}>
              <div className={styles.feature}>
                <span className={styles.featureIcon}>🎭</span>
                <div className={styles.featureText}>
                  <strong>4 Emotional States</strong>
                  <p>Idle, Listening, Talking, Thinking</p>
                </div>
              </div>
              <div className={styles.feature}>
                <span className={styles.featureIcon}>🎨</span>
                <div className={styles.featureText}>
                  <strong>3D Animations</strong>
                  <p>Real-time character movements & expressions</p>
                </div>
              </div>
              <div className={styles.feature}>
                <span className={styles.featureIcon}>🗣️</span>
                <div className={styles.featureText}>
                  <strong>Speech Synthesis</strong>
                  <p>Hebrew & English with lip sync</p>
                </div>
              </div>
              <div className={styles.feature}>
                <span className={styles.featureIcon}>🎧</span>
                <div className={styles.featureText}>
                  <strong>Voice Recognition</strong>
                  <p>Interactive listening capabilities</p>
                </div>
              </div>
              <div className={styles.feature}>
                <span className={styles.featureIcon}>🌍</span>
                <div className={styles.featureText}>
                  <strong>Dynamic Environment</strong>
                  <p>Changing backgrounds based on state</p>
                </div>
              </div>
              <div className={styles.feature}>
                <span className={styles.featureIcon}>📱</span>
                <div className={styles.featureText}>
                  <strong>Responsive Design</strong>
                  <p>Works on all devices & screen sizes</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Info */}
      <div className={styles.techInfo}>
        <h3 className={styles.sectionTitle}>🔧 Technical Implementation</h3>
        <div className={styles.techGrid}>
          <div className={styles.techCard}>
            <h4>React Three Fiber</h4>
            <p>3D rendering with WebGL</p>
          </div>
          <div className={styles.techCard}>
            <h4>Three.js</h4>
            <p>3D graphics library</p>
          </div>
          <div className={styles.techCard}>
            <h4>Web Speech API</h4>
            <p>Speech synthesis & recognition</p>
          </div>
          <div className={styles.techCard}>
            <h4>CSS Animations</h4>
            <p>Smooth UI transitions</p>
          </div>
          <div className={styles.techCard}>
            <h4>TypeScript</h4>
            <p>Type-safe development</p>
          </div>
          <div className={styles.techCard}>
            <h4>Responsive Design</h4>
            <p>Mobile-first approach</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <p>
          🎯 <strong>Michael 3D Avatar</strong> - Transforming SQL education through immersive 3D interaction
        </p>
        <p>
          Built with ❤️ using React Three Fiber, Three.js, and modern web technologies
        </p>
      </div>
    </div>
  );
};

export default Michael3DDemo; 