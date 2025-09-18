"use client";

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import styles from './StatsCard.module.css';

interface StatsCardProps {
  icon: React.ComponentType<any>;
  title: string;
  value: number | string;
  description?: string;
  trend?: {
    value: number;
    label: string;
    direction: 'up' | 'down' | 'neutral';
  };
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({
  icon: Icon,
  title,
  value,
  description,
  trend,
  loading = false,
  onClick,
  className = ''
}) => {
  const getTrendIcon = () => {
    switch (trend?.direction) {
      case 'up':
        return <TrendingUp size={14} />;
      case 'down':
        return <TrendingDown size={14} />;
      default:
        return <Minus size={14} />;
    }
  };

  const getTrendColor = () => {
    switch (trend?.direction) {
      case 'up':
        return styles.trendUp;
      case 'down':
        return styles.trendDown;
      default:
        return styles.trendNeutral;
    }
  };

  if (loading) {
    return (
      <div className={`${styles.card} ${styles.loading} ${className}`}>
        <div className={styles.iconSkeleton}></div>
        <div className={styles.content}>
          <div className={styles.valueSkeleton}></div>
          <div className={styles.titleSkeleton}></div>
          <div className={styles.trendSkeleton}></div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`${styles.card} ${onClick ? styles.clickable : ''} ${className}`}
      onClick={onClick}
    >
      <div className={styles.icon}>
        <Icon size={24} />
      </div>
      
      <div className={styles.content}>
        <div className={styles.value}>{value}</div>
        <div className={styles.title}>{title}</div>
        
        {description && (
          <div className={styles.description}>{description}</div>
        )}
        
        {trend && (
          <div className={`${styles.trend} ${getTrendColor()}`}>
            {getTrendIcon()}
            <span className={styles.trendValue}>
              {trend.value > 0 ? '+' : ''}{trend.value}
            </span>
            <span className={styles.trendLabel}>{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsCard;
