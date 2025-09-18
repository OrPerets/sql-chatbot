'use client';

import React from 'react';
import styles from './StaticLogoMode.module.css';

interface StaticLogoModeProps {
  size?: 'small' | 'medium' | 'large';
  state?: 'idle' | 'speaking' | 'listening' | 'thinking' | 'userWriting';
  userName?: string;
}

const StaticLogoMode: React.FC<StaticLogoModeProps> = ({ 
  size = 'medium', 
  state = 'idle',
  userName = ''
}) => {
  const getSizeClass = () => {
    switch (size) {
      case 'small': return styles.small;
      case 'large': return styles.large;
      default: return styles.medium;
    }
  };

  const getStateClass = () => {
    switch (state) {
      case 'speaking': return styles.speaking;
      case 'listening': return styles.listening;
      case 'thinking': return styles.thinking;
      case 'userWriting': return styles.userWriting;
      default: return styles.idle;
    }
  };

  const getStateLabel = () => {
    switch (state) {
      case 'speaking': return 'מדבר...';
      case 'listening': return 'מקשיב...';
      case 'thinking': return 'חושב...';
      case 'userWriting': return 'כותב...';
      default: return 'זמין';
    }
  };

  return (
    <div className={`${styles.container} ${getSizeClass()} ${getStateClass()}`}>
      <div className={styles.logoWrapper}>
        <div className={styles.logoContainer}>
          <img 
            src="/logo.png" 
            alt="Michael Logo" 
            className={styles.logo}
          />
          <div className={styles.statusIndicator}>
            <div className={styles.statusDot}></div>
          </div>
        </div>
        
        <div className={styles.brandSection}>
          <h2 className={styles.brandName}>MICHAEL</h2>
          <p className={styles.brandSubtitle}>SQL AI Assistant</p>
        </div>
      </div>

      <div className={styles.statusSection}>
        <div className={styles.statusLabel}>{getStateLabel()}</div>
        {userName && (
          <div className={styles.greeting}>
            שלום {userName}
          </div>
        )}
      </div>

      {/* Animated background elements */}
      <div className={styles.backgroundElements}>
        <div className={styles.circle1}></div>
        <div className={styles.circle2}></div>
        <div className={styles.circle3}></div>
      </div>
    </div>
  );
};

export default StaticLogoMode;
