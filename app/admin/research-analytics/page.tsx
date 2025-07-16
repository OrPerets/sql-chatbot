"use client";

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';

interface AnalyticsReport {
  summary: {
    totalAnswers: number;
    totalStudents: number;
    analysisTimestamp: string;
    metricsAvailable: number;
  };
  behaviorAnalysis: {
    overallStats: {
      averageWPM: number;
      medianWPM: number;
      averageRhythmConsistency: number;
      averageConfidenceScore: number;
      averageFocusScore: number;
      totalTabSwitches: number;
      suspiciousActivities: number;
    };
    anomalies: Array<{
      type: string;
      examId: string;
      questionIndex: number;
      severity: string;
      description: string;
      value?: number;
    }>;
    researchInsights: {
      correlations: {
        confidenceVsPerformance: number;
        typingSpeedVsPerformance: number;
        focusVsPerformance: number;
        thinkTimeVsPerformance: number;
      };
      patterns: any;
      recommendations: Array<{
        type: string;
        priority: string;
        message: string;
      }>;
    };
  };
  performanceAnalysis: {
    overall: {
      accuracy: number;
      averageTime: number;
    };
    byDifficulty: Record<string, {
      accuracy: number;
      averageTime: number;
      questionCount: number;
    }>;
  };
  integrityAnalysis: {
    suspiciousActivities: {
      copyPaste: number;
      devTools: number;
      unusualTyping: number;
      excessiveTabSwitching: number;
    };
    attentionMetrics: {
      averageFocusScore: number;
      lowFocusCount: number;
    };
  };
  recommendations: Array<{
    type: string;
    priority: string;
    message: string;
  }>;
}

const ResearchAnalyticsPage: React.FC = () => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/research/analytics');
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      const data = await response.json();
      setAnalyticsData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = async () => {
    try {
      const response = await fetch('/api/admin/research/export/csv');
      if (!response.ok) {
        throw new Error('Failed to download CSV');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'exam-research-data.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading CSV:', err);
      alert('Failed to download CSV file');
    }
  };

  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatNumber = (value: number) => value.toFixed(2);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading research analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Error: {error}</div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className={styles.container}>
        <div className={styles.noData}>No analytics data available</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Research Analytics Dashboard</h1>
        <div className={styles.headerActions}>
          <button onClick={downloadCSV} className={styles.exportButton}>
            📊 Export CSV Data
          </button>
          <button onClick={fetchAnalyticsData} className={styles.refreshButton}>
            🔄 Refresh Data
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <h3>Total Students</h3>
          <div className={styles.summaryValue}>{analyticsData.summary.totalStudents}</div>
        </div>
        <div className={styles.summaryCard}>
          <h3>Total Answers</h3>
          <div className={styles.summaryValue}>{analyticsData.summary.totalAnswers}</div>
        </div>
        <div className={styles.summaryCard}>
          <h3>Metrics Available</h3>
          <div className={styles.summaryValue}>{analyticsData.summary.metricsAvailable}</div>
        </div>
        <div className={styles.summaryCard}>
          <h3>Overall Accuracy</h3>
          <div className={styles.summaryValue}>
            {formatPercentage(analyticsData.performanceAnalysis.overall.accuracy)}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'behavior' ? styles.active : ''}`}
          onClick={() => setActiveTab('behavior')}
        >
          Behavior Analysis
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'performance' ? styles.active : ''}`}
          onClick={() => setActiveTab('performance')}
        >
          Performance
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'integrity' ? styles.active : ''}`}
          onClick={() => setActiveTab('integrity')}
        >
          Academic Integrity
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'insights' ? styles.active : ''}`}
          onClick={() => setActiveTab('insights')}
        >
          Research Insights
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {activeTab === 'overview' && (
          <div className={styles.overviewTab}>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}>
                <h4>Average Typing Speed</h4>
                <div className={styles.metricValue}>
                  {formatNumber(analyticsData.behaviorAnalysis.overallStats.averageWPM)} WPM
                </div>
              </div>
              <div className={styles.metricCard}>
                <h4>Average Confidence</h4>
                <div className={styles.metricValue}>
                  {formatPercentage(analyticsData.behaviorAnalysis.overallStats.averageConfidenceScore)}
                </div>
              </div>
              <div className={styles.metricCard}>
                <h4>Average Focus Score</h4>
                <div className={styles.metricValue}>
                  {formatPercentage(analyticsData.behaviorAnalysis.overallStats.averageFocusScore)}
                </div>
              </div>
              <div className={styles.metricCard}>
                <h4>Suspicious Activities</h4>
                <div className={styles.metricValue}>
                  {analyticsData.behaviorAnalysis.overallStats.suspiciousActivities}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'behavior' && (
          <div className={styles.behaviorTab}>
            <div className={styles.section}>
              <h3>Behavioral Statistics</h3>
              <div className={styles.statsGrid}>
                <div className={styles.statItem}>
                  <label>Average WPM:</label>
                  <span>{formatNumber(analyticsData.behaviorAnalysis.overallStats.averageWPM)}</span>
                </div>
                <div className={styles.statItem}>
                  <label>Median WPM:</label>
                  <span>{formatNumber(analyticsData.behaviorAnalysis.overallStats.medianWPM)}</span>
                </div>
                <div className={styles.statItem}>
                  <label>Rhythm Consistency:</label>
                  <span>{formatPercentage(analyticsData.behaviorAnalysis.overallStats.averageRhythmConsistency)}</span>
                </div>
                <div className={styles.statItem}>
                  <label>Total Tab Switches:</label>
                  <span>{analyticsData.behaviorAnalysis.overallStats.totalTabSwitches}</span>
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h3>Detected Anomalies</h3>
              {analyticsData.behaviorAnalysis.anomalies.length > 0 ? (
                <div className={styles.anomaliesList}>
                  {analyticsData.behaviorAnalysis.anomalies.map((anomaly, index) => (
                    <div key={index} className={`${styles.anomalyItem} ${styles[anomaly.severity]}`}>
                      <div className={styles.anomalyHeader}>
                        <span className={styles.anomalyType}>{anomaly.type.replace('_', ' ')}</span>
                        <span className={styles.anomalySeverity}>{anomaly.severity}</span>
                      </div>
                      <div className={styles.anomalyDescription}>{anomaly.description}</div>
                      <div className={styles.anomalyDetails}>
                        Exam: {anomaly.examId} | Question: {anomaly.questionIndex + 1}
                        {anomaly.value && ` | Value: ${anomaly.value}`}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.noAnomalies}>No anomalies detected</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className={styles.performanceTab}>
            <div className={styles.section}>
              <h3>Overall Performance</h3>
              <div className={styles.performanceStats}>
                <div className={styles.performanceStat}>
                  <label>Overall Accuracy:</label>
                  <span>{formatPercentage(analyticsData.performanceAnalysis.overall.accuracy)}</span>
                </div>
                <div className={styles.performanceStat}>
                  <label>Average Time per Question:</label>
                  <span>{formatNumber(analyticsData.performanceAnalysis.overall.averageTime)}s</span>
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h3>Performance by Difficulty</h3>
              <div className={styles.difficultyGrid}>
                {Object.entries(analyticsData.performanceAnalysis.byDifficulty).map(([difficulty, stats]) => (
                  <div key={difficulty} className={styles.difficultyCard}>
                    <h4>{difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</h4>
                    <div className={styles.difficultyStats}>
                      <div>Accuracy: {formatPercentage(stats.accuracy)}</div>
                      <div>Avg Time: {formatNumber(stats.averageTime)}s</div>
                      <div>Questions: {stats.questionCount}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'integrity' && (
          <div className={styles.integrityTab}>
            <div className={styles.section}>
              <h3>Suspicious Activities</h3>
              <div className={styles.suspiciousGrid}>
                <div className={styles.suspiciousCard}>
                  <h4>Copy/Paste Events</h4>
                  <div className={styles.suspiciousValue}>
                    {analyticsData.integrityAnalysis.suspiciousActivities.copyPaste}
                  </div>
                </div>
                <div className={styles.suspiciousCard}>
                  <h4>Dev Tools Detected</h4>
                  <div className={styles.suspiciousValue}>
                    {analyticsData.integrityAnalysis.suspiciousActivities.devTools}
                  </div>
                </div>
                <div className={styles.suspiciousCard}>
                  <h4>Unusual Typing</h4>
                  <div className={styles.suspiciousValue}>
                    {analyticsData.integrityAnalysis.suspiciousActivities.unusualTyping}
                  </div>
                </div>
                <div className={styles.suspiciousCard}>
                  <h4>Excessive Tab Switching</h4>
                  <div className={styles.suspiciousValue}>
                    {analyticsData.integrityAnalysis.suspiciousActivities.excessiveTabSwitching}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h3>Attention Metrics</h3>
              <div className={styles.attentionStats}>
                <div className={styles.attentionStat}>
                  <label>Average Focus Score:</label>
                  <span>{formatPercentage(analyticsData.integrityAnalysis.attentionMetrics.averageFocusScore)}</span>
                </div>
                <div className={styles.attentionStat}>
                  <label>Low Focus Count:</label>
                  <span>{analyticsData.integrityAnalysis.attentionMetrics.lowFocusCount}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'insights' && (
          <div className={styles.insightsTab}>
            <div className={styles.section}>
              <h3>Performance Correlations</h3>
              <div className={styles.correlationsGrid}>
                <div className={styles.correlationCard}>
                  <h4>Confidence vs Performance</h4>
                  <div className={styles.correlationValue}>
                    {formatNumber(analyticsData.behaviorAnalysis.researchInsights.correlations.confidenceVsPerformance)}
                  </div>
                </div>
                <div className={styles.correlationCard}>
                  <h4>Typing Speed vs Performance</h4>
                  <div className={styles.correlationValue}>
                    {formatNumber(analyticsData.behaviorAnalysis.researchInsights.correlations.typingSpeedVsPerformance)}
                  </div>
                </div>
                <div className={styles.correlationCard}>
                  <h4>Focus vs Performance</h4>
                  <div className={styles.correlationValue}>
                    {formatNumber(analyticsData.behaviorAnalysis.researchInsights.correlations.focusVsPerformance)}
                  </div>
                </div>
                <div className={styles.correlationCard}>
                  <h4>Think Time vs Performance</h4>
                  <div className={styles.correlationValue}>
                    {formatNumber(analyticsData.behaviorAnalysis.researchInsights.correlations.thinkTimeVsPerformance)}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h3>Recommendations</h3>
              <div className={styles.recommendationsList}>
                {analyticsData.recommendations.map((rec, index) => (
                  <div key={index} className={`${styles.recommendation} ${styles[rec.priority]}`}>
                    <div className={styles.recommendationHeader}>
                      <span className={styles.recommendationType}>{rec.type}</span>
                      <span className={styles.recommendationPriority}>{rec.priority} priority</span>
                    </div>
                    <div className={styles.recommendationMessage}>{rec.message}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResearchAnalyticsPage; 