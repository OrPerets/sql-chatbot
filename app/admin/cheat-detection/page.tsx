"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Shield, 
  AlertTriangle, 
  Users, 
  RefreshCw, 
  Download,
  Eye,
  Clock
} from 'lucide-react';
import config from '../../config';
import styles from './page.module.css';

interface SimilarityMatch {
  student1: {
    id: string;
    name: string;
    email: string;
  };
  student2: {
    id: string;
    name: string;
    email: string;
  };
  questionIndex: number;
  questionText: string;
  similarityScore: number;
  student1Answer: string;
  student2Answer: string;
  suspicionLevel: 'low' | 'medium' | 'high';
}

interface CheatDetectionData {
  similarityMatches: SimilarityMatch[];
  stats: {
    totalExams: number;
    suspiciousSimilarities: number;
    averageSimilarityScore: number;
    highRiskPairs: number;
  };
  metadata?: {
    isStale: boolean;
    daysSinceAnalysis: number;
    timestamp: string;
  };
}

const CheatDetectionPage: React.FC = () => {
  const [data, setData] = useState<CheatDetectionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [similarityThreshold, setSimilarityThreshold] = useState(0.8);
  const [selectedMatch, setSelectedMatch] = useState<SimilarityMatch | null>(null);
  
  const router = useRouter();

  useEffect(() => {
    runAnalysis();
  }, []);

  const runAnalysis = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('📊 Fetching pre-computed cheat detection results...');
      
      // Fetch pre-computed results (much faster!)
      const response = await fetch(`${config.serverUrl}/admin/cheat-detection`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          const errorData = await response.json();
          if (errorData.needsAnalysis) {
            throw new Error('לא קיימים תוצאות ניתוח. יש להריץ ניתוח מקומי תחילה:\n\nnode run-cheat-detection-locally.js');
          }
        }
        throw new Error(`שגיאה בטעינת התוצאות: ${response.status}`);
      }

      const backendData = await response.json();
      
      // Check if results are stale and show warning
      if (backendData.metadata?.isStale) {
        console.warn(`⚠️ Results are ${backendData.metadata.daysSinceAnalysis} days old`);
      }

      // Use pre-computed results directly (no frontend processing needed!)
      console.log('✅ Pre-computed cheat detection results loaded');
      console.log(`📊 Loaded: ${backendData.stats?.suspiciousSimilarities || 0} similarity matches`);
      
      setData(backendData);
    } catch (err: any) {
      console.error('Error running cheat detection:', err);
      
      if (err.name === 'AbortError') {
        setError('התהליך בוטל עקב timeout. נסה שוב עם הגדרות מחמירות יותר.');
      } else if (err.message.includes('התהליך ארך יותר מדי זמן')) {
        setError(err.message);
      } else if (err.message.includes('Failed to fetch')) {
        setError('שגיאת רשת. בדוק את החיבור לאינטרנט ונסה שוב.');
      } else {
        setError('שגיאה בניתוח החשדות להעתקה. אנא נסה שוב עם הגדרות שונות.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getSuspicionIcon = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'high':
        return <AlertTriangle size={16} className={styles.highRisk} />;
      case 'medium':
        return <AlertTriangle size={16} className={styles.mediumRisk} />;
      case 'low':
        return <AlertTriangle size={16} className={styles.lowRisk} />;
      default:
        return <AlertTriangle size={16} />;
    }
  };

  const getSuspicionColor = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'high': return '#d32f2f';
      case 'medium': return '#f57c00';
      case 'low': return '#388e3c';
      default: return '#757575';
    }
  };

  const exportResults = async () => {
    if (!data) return;
    
    try {
      const response = await fetch('/api/admin/cheat-detection/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to export results');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `דוח_חשדות_העתקה_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting results:', err);
      alert('שגיאה בייצוא הדוח');
    }
  };



  const renderSimilarityTab = () => {
    if (!data) return null;

    return (
      <div className={styles.similarityContent}>
        {/* <div className={styles.similarityControls}>
          <div className={styles.controlGroup}>
            <label>סף דמיון מינימלי:</label>
            <input
              type="range"
              min="0.5"
              max="1"
              step="0.05"
              value={similarityThreshold}
              onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
              className={styles.thresholdSlider}
            />
            <span>{Math.round(similarityThreshold * 100)}%</span>
          </div>
          <button
            onClick={runAnalysis}
            className={styles.refreshButton}
            disabled={loading}
          >
            <RefreshCw size={16} />
            עדכן ניתוח
          </button>
        </div> */}

        <div className={styles.matchesList}>
          {data.similarityMatches.map((match, index) => (
            <div 
              key={index} 
              className={`${styles.matchCard} ${selectedMatch === match ? styles.selectedMatch : ''}`}
              onClick={() => setSelectedMatch(match)}
            >
              <div className={styles.matchHeader}>
                <div className={styles.matchStudents}>
                  <span className={styles.studentName}>{match.student1.name}</span>
                  <span className={styles.vs}>↔</span>
                  <span className={styles.studentName}>{match.student2.name}</span>
                </div>
                <div 
                  className={styles.similarityScore}
                  style={{ color: getSuspicionColor(match.suspicionLevel) }}
                >
                  {getSuspicionIcon(match.suspicionLevel)}
                  {Math.round(match.similarityScore * 100)}%
                </div>
              </div>
              <div className={styles.matchDetails}>
                <span>שאלה {match.questionIndex + 1}</span>
                <span>•</span>
                <span>{match.questionText.substring(0, 100)}...</span>
              </div>
            </div>
          ))}
        </div>

        {selectedMatch && (
          <div className={styles.matchDetail}>
            <h3>השוואת תשובות</h3>
            <div className={styles.questionText}>
              <strong>שאלה {selectedMatch.questionIndex + 1}:</strong> {selectedMatch.questionText}
            </div>
            <div className={styles.answersComparison}>
              <div className={styles.answerBox}>
                <div className={styles.answerHeader}>
                  <Users size={16} />
                  {selectedMatch.student1.name}
                </div>
                <div className={styles.answerContent}>
                  {selectedMatch.student1Answer}
                </div>
              </div>
              <div className={styles.answerBox}>
                <div className={styles.answerHeader}>
                  <Users size={16} />
                  {selectedMatch.student2.name}
                </div>
                <div className={styles.answerContent}>
                  {selectedMatch.student2Answer}
                </div>
              </div>
            </div>
            <div className={styles.similarityMeter}>
              <div className={styles.meterLabel}>
                דמיון: {Math.round(selectedMatch.similarityScore * 100)}%
              </div>
              <div className={styles.meterBar}>
                <div 
                  className={styles.meterFill}
                  style={{ 
                    width: `${selectedMatch.similarityScore * 100}%`,
                    backgroundColor: getSuspicionColor(selectedMatch.suspicionLevel)
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };



  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Clock size={24} />
          מריץ ניתוח חשדות העתקה...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button 
          onClick={() => router.push('/admin')}
          className={styles.backButton}
        >
          <ArrowLeft size={20} />
          חזרה לממשק ניהול
        </button>
        <h1 className={styles.title}>
          <Shield size={24} />
          זיהוי דמיון בין סטודנטים
        </h1>
        <div className={styles.subtitle}>
          זיהוי אוטומטי של חשדות להעתקה על בסיס דמיון תשובות
        </div>
      </div>

      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}

      {/* Controls */}
      <div className={styles.controls}>
        <button
          onClick={runAnalysis}
          className={styles.analyzeButton}
          disabled={loading}
        >
          <RefreshCw size={16} />
          {loading ? 'מנתח...' : 'הרץ ניתוח מחדש'}
        </button>
        
        {data && (
          <button
            onClick={exportResults}
            className={styles.exportButton}
          >
            <Download size={16} />
            ייצא דוח
          </button>
        )}
      </div>

      {data?.metadata?.isStale && (
        <div className={styles.staleWarning}>
          📅 תוצאות מלפני {data.metadata.daysSinceAnalysis} ימים
        </div>
      )}

      {/* Main Content */}
      <div className={styles.tabContent}>
        {renderSimilarityTab()}
      </div>
    </div>
  );
};

export default CheatDetectionPage;