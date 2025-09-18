"use client";

import React from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import styles from './ErrorBanner.module.css';

interface ErrorBannerProps {
  message: string;
  details?: string;
  type?: 'error' | 'warning' | 'info';
  dismissible?: boolean;
  retryable?: boolean;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

const ErrorBanner: React.FC<ErrorBannerProps> = ({
  message,
  details,
  type = 'error',
  dismissible = false,
  retryable = false,
  onRetry,
  onDismiss,
  className = ''
}) => {
  const getIcon = () => {
    switch (type) {
      case 'warning':
        return <AlertCircle size={20} />;
      case 'info':
        return <AlertCircle size={20} />;
      default:
        return <AlertCircle size={20} />;
    }
  };

  return (
    <div className={`${styles.banner} ${styles[type]} ${className}`}>
      <div className={styles.content}>
        <div className={styles.icon}>
          {getIcon()}
        </div>
        <div className={styles.text}>
          <div className={styles.message}>{message}</div>
          {details && <div className={styles.details}>{details}</div>}
        </div>
      </div>
      
      <div className={styles.actions}>
        {retryable && onRetry && (
          <button
            onClick={onRetry}
            className={styles.retryButton}
            title="נסה שוב"
          >
            <RefreshCw size={16} />
            נסה שוב
          </button>
        )}
        
        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className={styles.dismissButton}
            title="סגור"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorBanner;
