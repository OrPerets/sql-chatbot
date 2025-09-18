"use client";

import React from 'react';
import styles from './SkeletonCard.module.css';

interface SkeletonCardProps {
  variant?: 'stat' | 'user' | 'setting';
  className?: string;
}

const SkeletonCard: React.FC<SkeletonCardProps> = ({ 
  variant = 'stat',
  className = '' 
}) => {
  return (
    <div className={`${styles.card} ${styles[variant]} ${className}`}>
      {variant === 'stat' && (
        <>
          <div className={styles.icon}></div>
          <div className={styles.content}>
            <div className={styles.number}></div>
            <div className={styles.label}></div>
          </div>
        </>
      )}
      
      {variant === 'user' && (
        <>
          <div className={styles.userInfo}>
            <div className={styles.name}></div>
            <div className={styles.email}></div>
          </div>
          <div className={styles.balance}></div>
          <div className={styles.checkbox}></div>
        </>
      )}
      
      {variant === 'setting' && (
        <>
          <div className={styles.settingHeader}>
            <div className={styles.settingIcon}></div>
            <div className={styles.settingTitle}></div>
          </div>
          <div className={styles.settingContent}>
            <div className={styles.settingLine}></div>
            <div className={styles.settingLine}></div>
          </div>
        </>
      )}
    </div>
  );
};

export default SkeletonCard;
