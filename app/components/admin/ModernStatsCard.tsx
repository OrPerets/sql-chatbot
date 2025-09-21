"use client";

import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import styles from './ModernStatsCard.module.css';

interface TrendData {
  value: number;
  label: string;
  direction: 'up' | 'down' | 'neutral';
}

interface ModernStatsCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  description: string;
  trend?: TrendData;
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info';
  onClick?: () => void;
  loading?: boolean;
  suffix?: string;
  prefix?: string;
  sparklineData?: number[];
  badge?: string;
}

const ModernStatsCard: React.FC<ModernStatsCardProps> = ({
  icon: Icon,
  title,
  value,
  description,
  trend,
  color = 'primary',
  onClick,
  loading = false,
  suffix = '',
  prefix = '',
  sparklineData = [],
  badge
}) => {
  const formatValue = (val: string | number): string => {
    if (typeof val === 'number') {
      if (val >= 1000000) {
        return `${(val / 1000000).toFixed(1)}M`;
      } else if (val >= 1000) {
        return `${(val / 1000).toFixed(1)}K`;
      }
      return val.toLocaleString('he-IL');
    }
    return val;
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up':
        return <TrendingUp size={14} />;
      case 'down':
        return <TrendingDown size={14} />;
      default:
        return null;
    }
  };

  const getTrendColor = (direction: string) => {
    switch (direction) {
      case 'up':
        return 'success';
      case 'down':
        return 'error';
      default:
        return 'neutral';
    }
  };

  // Simple sparkline SVG generation
  const generateSparkline = (data: number[]) => {
    if (data.length < 2) return null;

    const width = 60;
    const height = 20;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min;

    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / (range || 1)) * height;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={width} height={height} className={styles.sparkline}>
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className={`${styles.card} ${styles.cardLoading}`}>
        <div className={styles.cardContent}>
          <div className={styles.cardHeader}>
            <div className={`${styles.iconContainer} ${styles.iconLoading}`}>
              <div className={styles.skeletonIcon}></div>
            </div>
            <div className={styles.cardInfo}>
              <div className={`${styles.skeletonTitle} ${styles.skeleton}`}></div>
              <div className={`${styles.skeletonValue} ${styles.skeleton}`}></div>
            </div>
          </div>
          <div className={`${styles.skeletonDescription} ${styles.skeleton}`}></div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`
        ${styles.card} 
        ${styles[`card${color.charAt(0).toUpperCase() + color.slice(1)}`]}
        ${onClick ? styles.clickable : ''}
      `}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {badge && (
        <div className={styles.badge}>
          {badge}
        </div>
      )}

      <div className={styles.cardContent}>
        <div className={styles.cardHeader}>
          <div className={styles.iconContainer}>
            <Icon size={24} />
          </div>
          
          <div className={styles.cardInfo}>
            <div className={styles.titleRow}>
              <h3 className={styles.title}>{title}</h3>
              {sparklineData.length > 0 && (
                <div className={styles.sparklineContainer}>
                  {generateSparkline(sparklineData)}
                </div>
              )}
            </div>
            
            <div className={styles.valueRow}>
              <span className={styles.value}>
                {prefix}{formatValue(value)}{suffix}
              </span>
              
              {trend && (
                <div className={`${styles.trend} ${styles[`trend${getTrendColor(trend.direction).charAt(0).toUpperCase() + getTrendColor(trend.direction).slice(1)}`]}`}>
                  {getTrendIcon(trend.direction)}
                  <span className={styles.trendValue}>
                    {trend.value}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.cardFooter}>
          <p className={styles.description}>{description}</p>
          {trend && (
            <span className={styles.trendLabel}>
              {trend.label}
            </span>
          )}
        </div>
      </div>

      {onClick && (
        <div className={styles.clickIndicator}>
          <div className={styles.clickRipple}></div>
        </div>
      )}
    </div>
  );
};

export default ModernStatsCard;
