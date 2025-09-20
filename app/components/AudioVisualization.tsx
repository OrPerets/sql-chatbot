'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import styles from './AudioVisualization.module.css';

interface AudioVisualizationProps {
  audioData?: Uint8Array;
  isActive?: boolean;
  type?: 'spectrum' | 'waveform' | 'bars' | 'circular';
  color?: 'blue' | 'green' | 'purple' | 'orange';
  size?: 'small' | 'medium' | 'large';
  sensitivity?: number; // 0.1 to 2.0
  showPeaks?: boolean;
  animationSpeed?: 'slow' | 'normal' | 'fast';
}

interface SpectrumAnalyzerProps extends AudioVisualizationProps {
  frequencyBands?: number;
  logScale?: boolean;
  showFrequencyLabels?: boolean;
}

interface VoiceLevelMeterProps {
  level?: number; // 0-100
  peak?: number; // 0-100
  orientation?: 'horizontal' | 'vertical';
  showNumbers?: boolean;
  warningThreshold?: number;
  dangerThreshold?: number;
}

// Spectrum Analyzer Component
export const SpectrumAnalyzer: React.FC<SpectrumAnalyzerProps> = ({
  audioData,
  isActive = false,
  color = 'blue',
  size = 'medium',
  sensitivity = 1.0,
  frequencyBands = 32,
  logScale = true,
  showFrequencyLabels = false,
  animationSpeed = 'normal'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<NodeJS.Timeout | number | undefined>();
  const [peaks, setPeaks] = useState<number[]>(new Array(frequencyBands).fill(0));

  const getCanvasSize = () => {
    switch (size) {
      case 'small': return { width: 200, height: 80 };
      case 'medium': return { width: 300, height: 120 };
      case 'large': return { width: 400, height: 160 };
      default: return { width: 300, height: 120 };
    }
  };

  const getColorScheme = () => {
    const schemes = {
      blue: {
        gradient: ['rgba(59, 130, 246, 0.8)', 'rgba(99, 102, 241, 1)', 'rgba(139, 92, 246, 0.8)'],
        peak: '#3b82f6'
      },
      green: {
        gradient: ['rgba(16, 185, 129, 0.8)', 'rgba(5, 150, 105, 1)', 'rgba(16, 185, 129, 0.8)'],
        peak: '#10b981'
      },
      purple: {
        gradient: ['rgba(168, 85, 247, 0.8)', 'rgba(139, 92, 246, 1)', 'rgba(168, 85, 247, 0.8)'],
        peak: '#a855f7'
      },
      orange: {
        gradient: ['rgba(245, 158, 11, 0.8)', 'rgba(217, 119, 6, 1)', 'rgba(245, 158, 11, 0.8)'],
        peak: '#f59e0b'
      }
    };
    return schemes[color];
  };

  const drawSpectrum = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = getCanvasSize();
    const colorScheme = getColorScheme();
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Process audio data into frequency bands
    const dataLength = Math.min(audioData.length, frequencyBands * 4);
    const bandWidth = width / frequencyBands;
    const newPeaks = [...peaks];
    
    for (let i = 0; i < frequencyBands; i++) {
      const start = Math.floor((i * dataLength) / frequencyBands);
      const end = Math.floor(((i + 1) * dataLength) / frequencyBands);
      
      // Calculate average for this frequency band
      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += audioData[j];
      }
      const average = sum / (end - start);
      
      // Apply sensitivity and logarithmic scaling if enabled
      let barHeight = (average / 255) * height * sensitivity;
      if (logScale) {
        barHeight = Math.log(barHeight + 1) * (height / Math.log(height + 1));
      }
      
      // Update peak values with decay
      newPeaks[i] = Math.max(barHeight, newPeaks[i] * 0.95);
      
      // Create gradient for this bar
      const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
      gradient.addColorStop(0, colorScheme.gradient[0]);
      gradient.addColorStop(0.5, colorScheme.gradient[1]);
      gradient.addColorStop(1, colorScheme.gradient[2]);
      
      // Draw frequency bar
      ctx.fillStyle = gradient;
      ctx.fillRect(
        i * bandWidth + 1,
        height - barHeight,
        bandWidth - 2,
        barHeight
      );
      
      // Draw peak indicator
      if (newPeaks[i] > barHeight + 2) {
        ctx.fillStyle = colorScheme.peak;
        ctx.fillRect(
          i * bandWidth + 1,
          height - newPeaks[i],
          bandWidth - 2,
          2
        );
      }
    }
    
    setPeaks(newPeaks);
    
    // Draw frequency labels if enabled
    if (showFrequencyLabels) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      
      const frequencies = ['60Hz', '250Hz', '1kHz', '4kHz', '16kHz'];
      const positions = [0, 0.25, 0.5, 0.75, 1];
      
      frequencies.forEach((freq, idx) => {
        const x = positions[idx] * width;
        ctx.fillText(freq, x, height - 2);
      });
    }
    
    // Continue animation if active
    if (isActive) {
      const speed = animationSpeed === 'fast' ? 60 : animationSpeed === 'slow' ? 30 : 45;
      animationRef.current = setTimeout(() => requestAnimationFrame(drawSpectrum), 1000 / speed);
    }
  }, [audioData, isActive, frequencyBands, logScale, showFrequencyLabels, sensitivity, color, size, peaks, animationSpeed]);

  useEffect(() => {
    if (isActive && audioData) {
      drawSpectrum();
    } else if (animationRef.current) {
      clearTimeout(animationRef.current);
    }

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [isActive, audioData, drawSpectrum]);

  const { width, height } = getCanvasSize();

  return (
    <div className={`${styles.spectrumAnalyzer} ${styles[size]}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={styles.canvas}
        aria-label="Audio spectrum analyzer"
        role="img"
      />
      {!isActive && (
        <div className={styles.inactiveOverlay}>
          <span>🎵 Spectrum Analyzer</span>
        </div>
      )}
    </div>
  );
};

// Voice Level Meter Component
export const VoiceLevelMeter: React.FC<VoiceLevelMeterProps> = ({
  level = 0,
  peak = 0,
  orientation = 'vertical',
  showNumbers = true,
  warningThreshold = 80,
  dangerThreshold = 95
}) => {
  const [displayLevel, setDisplayLevel] = useState(0);
  const [displayPeak, setDisplayPeak] = useState(0);

  // Smooth level transitions
  useEffect(() => {
    const targetLevel = Math.max(0, Math.min(100, level));
    const diff = targetLevel - displayLevel;
    
    if (Math.abs(diff) > 0.5) {
      const increment = diff * 0.2;
      setDisplayLevel(prev => prev + increment);
    }
  }, [level, displayLevel]);

  // Peak hold and decay
  useEffect(() => {
    const targetPeak = Math.max(0, Math.min(100, peak));
    if (targetPeak > displayPeak) {
      setDisplayPeak(targetPeak);
    } else {
      // Peak decay
      setDisplayPeak(prev => Math.max(targetPeak, prev * 0.98));
    }
  }, [peak, displayPeak]);

  const getLevelColor = (currentLevel: number) => {
    if (currentLevel >= dangerThreshold) return '#ef4444';
    if (currentLevel >= warningThreshold) return '#f59e0b';
    return '#10b981';
  };

  const renderVerticalMeter = () => (
    <div className={`${styles.levelMeter} ${styles.vertical}`}>
      <div className={styles.meterTrack}>
        <div 
          className={styles.meterFill}
          style={{
            height: `${displayLevel}%`,
            backgroundColor: getLevelColor(displayLevel)
          }}
        />
        <div 
          className={styles.peakIndicator}
          style={{
            bottom: `${displayPeak}%`,
            backgroundColor: getLevelColor(displayPeak)
          }}
        />
        
        {/* Level markings */}
        <div className={styles.levelMarkings}>
          {[0, 25, 50, 75, 100].map(mark => (
            <div 
              key={mark}
              className={styles.levelMark}
              style={{ bottom: `${mark}%` }}
            >
              <span className={styles.levelLabel}>{mark}</span>
            </div>
          ))}
        </div>
      </div>
      
      {showNumbers && (
        <div className={styles.levelNumbers}>
          <span className={styles.currentLevel}>{Math.round(displayLevel)}</span>
          <span className={styles.peakLevel}>Peak: {Math.round(displayPeak)}</span>
        </div>
      )}
    </div>
  );

  const renderHorizontalMeter = () => (
    <div className={`${styles.levelMeter} ${styles.horizontal}`}>
      <div className={styles.meterTrack}>
        <div 
          className={styles.meterFill}
          style={{
            width: `${displayLevel}%`,
            backgroundColor: getLevelColor(displayLevel)
          }}
        />
        <div 
          className={styles.peakIndicator}
          style={{
            left: `${displayPeak}%`,
            backgroundColor: getLevelColor(displayPeak)
          }}
        />
        
        {/* Level markings */}
        <div className={styles.levelMarkings}>
          {[0, 25, 50, 75, 100].map(mark => (
            <div 
              key={mark}
              className={styles.levelMark}
              style={{ left: `${mark}%` }}
            >
              <span className={styles.levelLabel}>{mark}</span>
            </div>
          ))}
        </div>
      </div>
      
      {showNumbers && (
        <div className={styles.levelNumbers}>
          <span className={styles.currentLevel}>{Math.round(displayLevel)}</span>
          <span className={styles.peakLevel}>Peak: {Math.round(displayPeak)}</span>
        </div>
      )}
    </div>
  );

  return orientation === 'vertical' ? renderVerticalMeter() : renderHorizontalMeter();
};

// Circular Audio Visualization Component
export const CircularAudioVisualization: React.FC<AudioVisualizationProps> = ({
  audioData,
  isActive = false,
  color = 'blue',
  size = 'medium',
  sensitivity = 1.0
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<NodeJS.Timeout | number | undefined>();

  const getCanvasSize = () => {
    switch (size) {
      case 'small': return 120;
      case 'medium': return 200;
      case 'large': return 300;
      default: return 200;
    }
  };

  const getColorScheme = () => {
    const schemes = {
      blue: ['rgba(59, 130, 246, 0.8)', 'rgba(99, 102, 241, 1)'],
      green: ['rgba(16, 185, 129, 0.8)', 'rgba(5, 150, 105, 1)'],
      purple: ['rgba(168, 85, 247, 0.8)', 'rgba(139, 92, 246, 1)'],
      orange: ['rgba(245, 158, 11, 0.8)', 'rgba(217, 119, 6, 1)']
    };
    return schemes[color];
  };

  const drawCircularVisualization = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasSize = getCanvasSize();
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    const radius = canvasSize * 0.3;
    const colorScheme = getColorScheme();
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    
    // Number of bars around the circle
    const bars = 64;
    const angleStep = (Math.PI * 2) / bars;
    
    // Create gradient
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, colorScheme[1]);
    gradient.addColorStop(1, colorScheme[0]);
    
    for (let i = 0; i < bars; i++) {
      const angle = i * angleStep - Math.PI / 2; // Start from top
      const dataIndex = Math.floor((i * audioData.length) / bars);
      const amplitude = (audioData[dataIndex] / 255) * sensitivity;
      
      const barLength = amplitude * radius * 0.8;
      const startX = centerX + Math.cos(angle) * radius;
      const startY = centerY + Math.sin(angle) * radius;
      const endX = centerX + Math.cos(angle) * (radius + barLength);
      const endY = centerY + Math.sin(angle) * (radius + barLength);
      
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
    
    // Draw center circle
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    if (isActive) {
      animationRef.current = requestAnimationFrame(drawCircularVisualization);
    }
  }, [audioData, isActive, sensitivity, color, size]);

  useEffect(() => {
    if (isActive && audioData) {
      drawCircularVisualization();
    } else if (animationRef.current && typeof animationRef.current === 'number') {
      cancelAnimationFrame(animationRef.current);
    }

    return () => {
      if (animationRef.current && typeof animationRef.current === 'number') {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, audioData, drawCircularVisualization]);

  const canvasSize = getCanvasSize();

  return (
    <div className={`${styles.circularVisualization} ${styles[size]}`}>
      <canvas
        ref={canvasRef}
        width={canvasSize}
        height={canvasSize}
        className={styles.canvas}
        aria-label="Circular audio visualization"
        role="img"
      />
      {!isActive && (
        <div className={styles.inactiveOverlay}>
          <span>🎤 Audio Visualizer</span>
        </div>
      )}
    </div>
  );
};

// Main Audio Visualization Component (combines all types)
const AudioVisualization: React.FC<AudioVisualizationProps> = (props) => {
  switch (props.type) {
    case 'spectrum':
      return <SpectrumAnalyzer {...props} />;
    case 'circular':
      return <CircularAudioVisualization {...props} />;
    case 'bars':
      return <SpectrumAnalyzer {...props} frequencyBands={16} />;
    default:
      return <SpectrumAnalyzer {...props} />;
  }
};

export default AudioVisualization;
