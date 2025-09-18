"use client";

import React from 'react';
import styles from './LoadingSpinner.module.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium', 
  text,
  className = '' 
}) => {
  return (
    <div className={`${styles.container} ${className}`}>
      <div className={`${styles.spinner} ${styles[size]}`}>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
      {text && <div className={styles.text}>{text}</div>}
    </div>
  );
};

export default LoadingSpinner;
