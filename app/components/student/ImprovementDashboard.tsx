'use client';

import React, { useState, useEffect } from 'react';
import type { AnalysisResult } from '@/lib/ai-analysis';

interface ImprovementDashboardProps {
  studentId: string;
  homeworkSetId?: string;
}

interface StudentProgressData {
  studentId: string;
  homeworkSetId: string | 'all';
  progressSummary: {
    totalAnalyses: number;
    completedAnalyses: number;
    averageConfidence: number;
    commonErrorPatterns: Array<{ pattern: string; count: number }>;
    topRecommendations: Array<{ type: string; count: number }>;
  };
  analysesByHomeworkSet: Array<{
    homeworkSetId: string;
    analyses: Array<{
      id: string;
      submissionId: string;
      analysisType: string;
      status: string;
      confidence: number;
      results: any;
      metadata: any;
    }>;
  }>;
}

export default function ImprovementDashboard({ studentId, homeworkSetId }: ImprovementDashboardProps) {
  const [progressData, setProgressData] = useState<StudentProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedHomeworkSet, setSelectedHomeworkSet] = useState<string | null>(homeworkSetId || null);

  useEffect(() => {
    fetchProgressData();
  }, [studentId, homeworkSetId]);

  const fetchProgressData = async () => {
    try {
      setLoading(true);
      setError(null);

      const url = homeworkSetId 
        ? `/api/students/${studentId}/analysis?homeworkSetId=${homeworkSetId}`
        : `/api/students/${studentId}/analysis`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch progress data');
      }

      const data = await response.json();
      setProgressData(data);
      
      // Set default selected homework set
      if (!selectedHomeworkSet && data.analysesByHomeworkSet.length > 0) {
        setSelectedHomeworkSet(data.analysesByHomeworkSet[0].homeworkSetId);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="improvement-dashboard">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading your progress...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="improvement-dashboard">
        <div className="error-state">
          <h3>Error Loading Progress</h3>
          <p>{error}</p>
          <button onClick={fetchProgressData} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!progressData || progressData.progressSummary.totalAnalyses === 0) {
    return (
      <div className="improvement-dashboard">
        <div className="no-data-state">
          <h3>No Progress Data Available</h3>
          <p>Complete some homework assignments to see your AI-powered progress analysis.</p>
        </div>
      </div>
    );
  }

  const { progressSummary, analysesByHomeworkSet } = progressData;
  const selectedSetData = selectedHomeworkSet 
    ? analysesByHomeworkSet.find(set => set.homeworkSetId === selectedHomeworkSet)
    : null;

  return (
    <div className="improvement-dashboard">
      <div className="dashboard-header">
        <h2>Your Learning Progress</h2>
        <div className="overall-stats">
          <div className="stat-card">
            <div className="stat-value">{progressSummary.completedAnalyses}</div>
            <div className="stat-label">Analyses Completed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{(progressSummary.averageConfidence * 100).toFixed(0)}%</div>
            <div className="stat-label">Average Confidence</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{progressSummary.commonErrorPatterns.length}</div>
            <div className="stat-label">Error Patterns</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{progressSummary.topRecommendations.length}</div>
            <div className="stat-label">Recommendations</div>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="homework-sets-selector">
          <h3>Homework Sets</h3>
          <div className="set-tabs">
            {analysesByHomeworkSet.map((set) => (
              <button
                key={set.homeworkSetId}
                className={`set-tab ${selectedHomeworkSet === set.homeworkSetId ? 'active' : ''}`}
                onClick={() => setSelectedHomeworkSet(set.homeworkSetId)}
              >
                Set {set.homeworkSetId}
                <span className="analysis-count">{set.analyses.length} analyses</span>
              </button>
            ))}
          </div>
        </div>

        {selectedSetData && (
          <div className="selected-set-content">
            <div className="content-grid">
              <div className="grid-item">
                <ErrorPatternsChart 
                  patterns={progressSummary.commonErrorPatterns} 
                />
              </div>
              <div className="grid-item">
                <RecommendationsChart 
                  recommendations={progressSummary.topRecommendations} 
                />
              </div>
              <div className="grid-item full-width">
                <ProgressTimeline 
                  analyses={selectedSetData.analyses} 
                />
              </div>
              <div className="grid-item full-width">
                <StudyPlan 
                  recommendations={progressSummary.topRecommendations}
                  errorPatterns={progressSummary.commonErrorPatterns}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .improvement-dashboard {
          background: #f8f9fa;
          border-radius: 12px;
          padding: 24px;
          margin: 20px 0;
        }

        .loading-state, .error-state, .no-data-state {
          text-align: center;
          padding: 60px 20px;
        }

        .spinner {
          width: 50px;
          height: 50px;
          border: 5px solid #e3e3e3;
          border-top: 5px solid #007bff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .error-state {
          color: #dc3545;
        }

        .retry-button {
          background: #007bff;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          margin-top: 15px;
        }

        .retry-button:hover {
          background: #0056b3;
        }

        .no-data-state {
          color: #6c757d;
        }

        .dashboard-header {
          margin-bottom: 30px;
        }

        .dashboard-header h2 {
          margin: 0 0 20px 0;
          color: #495057;
        }

        .overall-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
        }

        .stat-card {
          background: white;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .stat-value {
          font-size: 2.5rem;
          font-weight: bold;
          color: #007bff;
          margin-bottom: 8px;
        }

        .stat-label {
          color: #6c757d;
          font-size: 14px;
        }

        .dashboard-content {
          background: white;
          border-radius: 8px;
          padding: 24px;
        }

        .homework-sets-selector {
          margin-bottom: 30px;
        }

        .homework-sets-selector h3 {
          margin: 0 0 15px 0;
          color: #495057;
        }

        .set-tabs {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .set-tab {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          padding: 12px 16px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 120px;
          transition: all 0.2s;
        }

        .set-tab:hover {
          background: #e9ecef;
        }

        .set-tab.active {
          background: #007bff;
          color: white;
          border-color: #007bff;
        }

        .analysis-count {
          font-size: 12px;
          opacity: 0.8;
          margin-top: 4px;
        }

        .content-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .grid-item {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 20px;
        }

        .grid-item.full-width {
          grid-column: 1 / -1;
        }

        @media (max-width: 768px) {
          .content-grid {
            grid-template-columns: 1fr;
          }
          
          .overall-stats {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
}

function ErrorPatternsChart({ patterns }: { patterns: Array<{ pattern: string; count: number }> }) {
  if (patterns.length === 0) {
    return (
      <div className="chart-container">
        <h4>Common Error Patterns</h4>
        <p className="no-data">No error patterns identified yet.</p>
      </div>
    );
  }

  const maxCount = Math.max(...patterns.map(p => p.count));

  return (
    <div className="chart-container">
      <h4>Common Error Patterns</h4>
      <div className="patterns-list">
        {patterns.map((pattern, index) => (
          <div key={index} className="pattern-item">
            <div className="pattern-info">
              <span className="pattern-name">{pattern.pattern}</span>
              <span className="pattern-count">{pattern.count}</span>
            </div>
            <div className="pattern-bar">
              <div 
                className="pattern-fill"
                style={{ width: `${(pattern.count / maxCount) * 100}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
      
      <style jsx>{`
        .chart-container h4 {
          margin: 0 0 15px 0;
          color: #495057;
        }

        .no-data {
          color: #6c757d;
          font-style: italic;
        }

        .patterns-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .pattern-item {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .pattern-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .pattern-name {
          font-weight: 500;
          color: #495057;
        }

        .pattern-count {
          background: #007bff;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
        }

        .pattern-bar {
          height: 6px;
          background: #e9ecef;
          border-radius: 3px;
          overflow: hidden;
        }

        .pattern-fill {
          height: 100%;
          background: #007bff;
          transition: width 0.3s ease;
        }
      `}</style>
    </div>
  );
}

function RecommendationsChart({ recommendations }: { recommendations: Array<{ type: string; count: number }> }) {
  if (recommendations.length === 0) {
    return (
      <div className="chart-container">
        <h4>Top Recommendations</h4>
        <p className="no-data">No recommendations available yet.</p>
      </div>
    );
  }

  const maxCount = Math.max(...recommendations.map(r => r.count));

  return (
    <div className="chart-container">
      <h4>Top Recommendations</h4>
      <div className="recommendations-list">
        {recommendations.map((rec, index) => (
          <div key={index} className="recommendation-item">
            <div className="recommendation-info">
              <span className="recommendation-type">{rec.type.replace('_', ' ')}</span>
              <span className="recommendation-count">{rec.count}</span>
            </div>
            <div className="recommendation-bar">
              <div 
                className="recommendation-fill"
                style={{ width: `${(rec.count / maxCount) * 100}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
      
      <style jsx>{`
        .recommendations-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .recommendation-item {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .recommendation-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .recommendation-type {
          font-weight: 500;
          color: #495057;
          text-transform: capitalize;
        }

        .recommendation-count {
          background: #28a745;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
        }

        .recommendation-bar {
          height: 6px;
          background: #e9ecef;
          border-radius: 3px;
          overflow: hidden;
        }

        .recommendation-fill {
          height: 100%;
          background: #28a745;
          transition: width 0.3s ease;
        }
      `}</style>
    </div>
  );
}

function ProgressTimeline({ analyses }: { analyses: any[] }) {
  const sortedAnalyses = analyses
    .filter(a => a.status === 'completed')
    .sort((a, b) => new Date(a.metadata.createdAt).getTime() - new Date(b.metadata.createdAt).getTime());

  if (sortedAnalyses.length === 0) {
    return (
      <div className="chart-container">
        <h4>Progress Timeline</h4>
        <p className="no-data">No completed analyses to show progress.</p>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <h4>Progress Timeline</h4>
      <div className="timeline">
        {sortedAnalyses.map((analysis, index) => (
          <div key={analysis.id} className="timeline-item">
            <div className="timeline-marker">
              <div className="marker-dot"></div>
              {index < sortedAnalyses.length - 1 && <div className="marker-line"></div>}
            </div>
            <div className="timeline-content">
              <div className="timeline-date">
                {new Date(analysis.metadata.createdAt).toLocaleDateString()}
              </div>
              <div className="timeline-stats">
                <span className="confidence">
                  {(analysis.confidence * 100).toFixed(0)}% confidence
                </span>
                <span className="failed-questions">
                  {analysis.results?.failedQuestions?.length || 0} failed questions
                </span>
                <span className="recommendations">
                  {analysis.results?.recommendations?.length || 0} recommendations
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <style jsx>{`
        .timeline {
          position: relative;
          padding-left: 30px;
        }

        .timeline-item {
          display: flex;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .timeline-marker {
          position: relative;
          margin-right: 15px;
        }

        .marker-dot {
          width: 12px;
          height: 12px;
          background: #007bff;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 0 0 2px #007bff;
        }

        .marker-line {
          position: absolute;
          top: 12px;
          left: 5px;
          width: 2px;
          height: 30px;
          background: #dee2e6;
        }

        .timeline-content {
          flex: 1;
        }

        .timeline-date {
          font-weight: 500;
          color: #495057;
          margin-bottom: 5px;
        }

        .timeline-stats {
          display: flex;
          gap: 15px;
          flex-wrap: wrap;
        }

        .timeline-stats span {
          background: #f8f9fa;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          color: #6c757d;
        }

        .confidence {
          background: #d1ecf1 !important;
          color: #0c5460 !important;
        }

        .failed-questions {
          background: #f8d7da !important;
          color: #721c24 !important;
        }

        .recommendations {
          background: #d4edda !important;
          color: #155724 !important;
        }
      `}</style>
    </div>
  );
}

function StudyPlan({ 
  recommendations, 
  errorPatterns 
}: { 
  recommendations: Array<{ type: string; count: number }>;
  errorPatterns: Array<{ pattern: string; count: number }>;
}) {
  const studyPlan = [
    {
      priority: 'high',
      title: 'Focus on Common Error Patterns',
      description: 'Address the most frequent errors to improve overall performance',
      items: errorPatterns.slice(0, 3).map(p => p.pattern),
    },
    {
      priority: 'medium',
      title: 'Practice Recommended Areas',
      description: 'Work on the most suggested improvement areas',
      items: recommendations.slice(0, 3).map(r => r.type.replace('_', ' ')),
    },
    {
      priority: 'low',
      title: 'Review and Consolidate',
      description: 'Review previous work and consolidate learning',
      items: ['Review past submissions', 'Practice similar problems', 'Ask for help when needed'],
    },
  ];

  return (
    <div className="chart-container">
      <h4>Personalized Study Plan</h4>
      <div className="study-plan">
        {studyPlan.map((plan, index) => (
          <div key={index} className={`plan-item priority-${plan.priority}`}>
            <div className="plan-header">
              <h5>{plan.title}</h5>
              <span className="priority-badge">{plan.priority}</span>
            </div>
            <p className="plan-description">{plan.description}</p>
            <ul className="plan-items">
              {plan.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      
      <style jsx>{`
        .study-plan {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .plan-item {
          border-radius: 8px;
          padding: 15px;
        }

        .priority-high {
          background: #f8d7da;
          border: 1px solid #f5c6cb;
        }

        .priority-medium {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
        }

        .priority-low {
          background: #d1ecf1;
          border: 1px solid #bee5eb;
        }

        .plan-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .plan-header h5 {
          margin: 0;
          color: #495057;
        }

        .priority-badge {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
        }

        .priority-high .priority-badge {
          background: #f5c6cb;
          color: #721c24;
        }

        .priority-medium .priority-badge {
          background: #ffeaa7;
          color: #856404;
        }

        .priority-low .priority-badge {
          background: #bee5eb;
          color: #0c5460;
        }

        .plan-description {
          margin: 0 0 10px 0;
          color: #6c757d;
          font-size: 14px;
        }

        .plan-items {
          margin: 0;
          padding-left: 20px;
        }

        .plan-items li {
          margin-bottom: 5px;
          color: #495057;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}
