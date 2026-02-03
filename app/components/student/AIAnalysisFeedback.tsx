'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { AnalysisResult, FailedQuestionAnalysis, ErrorPattern, ImprovementRecommendation } from '@/lib/ai-analysis';

interface AIAnalysisFeedbackProps {
  submissionId: string;
  studentId: string;
  homeworkSetId?: string;
  showDetailed?: boolean;
}

interface AnalysisData {
  analyses: AnalysisResult[];
  progressSummary: {
    totalAnalyses: number;
    completedAnalyses: number;
    averageConfidence: number;
    commonErrorPatterns: Array<{ pattern: string; count: number }>;
    topRecommendations: Array<{ type: string; count: number }>;
  };
}

export default function AIAnalysisFeedback({ 
  submissionId, 
  studentId, 
  homeworkSetId,
  showDetailed = true 
}: AIAnalysisFeedbackProps) {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisResult | null>(null);

  const fetchAnalysisData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch analysis results for the submission
      const response = await fetch(`/api/submissions/${homeworkSetId}/analyze?submissionId=${submissionId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch analysis results');
      }

      const data = await response.json();
      const analyses = data.analyses || [];

      // Calculate progress summary
      const progressSummary = {
        totalAnalyses: analyses.length,
        completedAnalyses: analyses.filter((a: AnalysisResult) => a.status === 'completed').length,
        averageConfidence: analyses.length > 0 
          ? analyses.reduce((sum: number, a: AnalysisResult) => sum + a.confidence, 0) / analyses.length 
          : 0,
        commonErrorPatterns: [] as Array<{ pattern: string; count: number }>,
        topRecommendations: [] as Array<{ type: string; count: number }>,
      };

      // Extract common patterns and recommendations
      const errorPatterns: Record<string, number> = {};
      const recommendations: Record<string, number> = {};

      for (const analysis of analyses) {
        if (analysis.status === 'completed' && analysis.results) {
          if (analysis.results.errorPatterns) {
            for (const pattern of analysis.results.errorPatterns) {
              errorPatterns[pattern.pattern] = (errorPatterns[pattern.pattern] || 0) + 1;
            }
          }

          if (analysis.results.recommendations) {
            for (const rec of analysis.results.recommendations) {
              recommendations[rec.type] = (recommendations[rec.type] || 0) + 1;
            }
          }
        }
      }

      progressSummary.commonErrorPatterns = Object.entries(errorPatterns)
        .map(([pattern, count]) => ({ pattern, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      progressSummary.topRecommendations = Object.entries(recommendations)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setAnalysisData({ analyses, progressSummary });
      
      // Set the most recent completed analysis as selected
      const completedAnalyses = analyses.filter((a: AnalysisResult) => a.status === 'completed');
      if (completedAnalyses.length > 0) {
        setSelectedAnalysis(completedAnalyses[0]);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [homeworkSetId, submissionId]);

  useEffect(() => {
    fetchAnalysisData();
  }, [fetchAnalysisData]);

  const triggerAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/submissions/${homeworkSetId}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          submissionId: submissionId,
          analysisTypes: ['failure_analysis'],
          includeDetailedFeedback: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to trigger analysis');
      }

      // Refresh analysis data
      await fetchAnalysisData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="ai-analysis-feedback">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading AI analysis...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ai-analysis-feedback">
        <div className="error-state">
          <h3>Analysis Error</h3>
          <p>{error}</p>
          <button onClick={triggerAnalysis} className="retry-button">
            Retry Analysis
          </button>
        </div>
      </div>
    );
  }

  if (!analysisData || analysisData.analyses.length === 0) {
    return (
      <div className="ai-analysis-feedback">
        <div className="no-analysis-state">
          <h3>No Analysis Available</h3>
          <p>AI analysis has not been performed on this submission yet.</p>
          <button onClick={triggerAnalysis} className="analyze-button">
            Run AI Analysis
          </button>
        </div>
      </div>
    );
  }

  const { analyses, progressSummary } = analysisData;
  const completedAnalyses = analyses.filter(a => a.status === 'completed');

  return (
    <div className="ai-analysis-feedback">
      <div className="analysis-header">
        <h3>AI-Powered Feedback</h3>
        <div className="analysis-stats">
          <span className="stat">
            <strong>{progressSummary.completedAnalyses}</strong> analyses completed
          </span>
          <span className="stat">
            <strong>{(progressSummary.averageConfidence * 100).toFixed(0)}%</strong> confidence
          </span>
        </div>
      </div>

      {completedAnalyses.length > 0 && selectedAnalysis && (
        <div className="analysis-content">
          <div className="analysis-tabs">
            {completedAnalyses.map((analysis) => (
              <button
                key={analysis.id}
                className={`tab ${selectedAnalysis.id === analysis.id ? 'active' : ''}`}
                onClick={() => setSelectedAnalysis(analysis)}
              >
                Analysis {new Date(analysis.metadata.createdAt).toLocaleDateString()}
                <span className="confidence">
                  {(analysis.confidence * 100).toFixed(0)}%
                </span>
              </button>
            ))}
          </div>

          <div className="analysis-details">
            <AnalysisSummary analysis={selectedAnalysis} />
            
            {showDetailed && (
              <>
                <FailedQuestionsSection 
                  failedQuestions={selectedAnalysis.results.failedQuestions} 
                />
                <ErrorPatternsSection 
                  errorPatterns={selectedAnalysis.results.errorPatterns} 
                />
                <RecommendationsSection 
                  recommendations={selectedAnalysis.results.recommendations} 
                />
              </>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .ai-analysis-feedback {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }

        .loading-state, .error-state, .no-analysis-state {
          text-align: center;
          padding: 40px 20px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e3e3e3;
          border-top: 4px solid #007bff;
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

        .retry-button, .analyze-button {
          background: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 10px;
        }

        .retry-button:hover, .analyze-button:hover {
          background: #0056b3;
        }

        .analysis-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 1px solid #dee2e6;
        }

        .analysis-header h3 {
          margin: 0;
          color: #495057;
        }

        .analysis-stats {
          display: flex;
          gap: 20px;
        }

        .stat {
          font-size: 14px;
          color: #6c757d;
        }

        .analysis-tabs {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }

        .tab {
          background: white;
          border: 1px solid #dee2e6;
          padding: 10px 15px;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 120px;
        }

        .tab.active {
          background: #007bff;
          color: white;
          border-color: #007bff;
        }

        .confidence {
          font-size: 12px;
          opacity: 0.8;
          margin-top: 4px;
        }

        .analysis-details {
          background: white;
          border-radius: 8px;
          padding: 20px;
        }
      `}</style>
    </div>
  );
}

function AnalysisSummary({ analysis }: { analysis: AnalysisResult }) {
  return (
    <div className="analysis-summary">
      <h4>Analysis Summary</h4>
      <p>{analysis.results.summary}</p>
      <div className="summary-stats">
        <div className="stat">
          <strong>{analysis.results.failedQuestions.length}</strong> failed questions
        </div>
        <div className="stat">
          <strong>{analysis.results.errorPatterns.length}</strong> error patterns
        </div>
        <div className="stat">
          <strong>{analysis.results.recommendations.length}</strong> recommendations
        </div>
      </div>
      
      <style jsx>{`
        .analysis-summary {
          margin-bottom: 30px;
        }

        .analysis-summary h4 {
          margin: 0 0 10px 0;
          color: #495057;
        }

        .summary-stats {
          display: flex;
          gap: 20px;
          margin-top: 15px;
        }

        .stat {
          font-size: 14px;
          color: #6c757d;
        }
      `}</style>
    </div>
  );
}

function FailedQuestionsSection({ failedQuestions }: { failedQuestions: FailedQuestionAnalysis[] }) {
  if (failedQuestions.length === 0) {
    return (
      <div className="section">
        <h4>Failed Questions</h4>
        <p className="no-items">No failed questions identified.</p>
      </div>
    );
  }

  return (
    <div className="section">
      <h4>Failed Questions ({failedQuestions.length})</h4>
      <div className="failed-questions">
        {failedQuestions.map((fq) => (
          <div key={fq.questionId} className="failed-question">
            <div className="question-header">
              <h5>Question: {fq.questionPrompt}</h5>
              <span className="confidence">
                {(fq.confidence * 100).toFixed(0)}% confidence
              </span>
            </div>
            
            <div className="failure-reasons">
              <h6>Failure Reasons:</h6>
              <ul>
                {fq.failureReasons.map((reason, index) => (
                  <li key={index}>{reason}</li>
                ))}
              </ul>
            </div>

            {fq.suggestedFix && (
              <div className="suggested-fix">
                <h6>Suggested Fix:</h6>
                <p>{fq.suggestedFix}</p>
              </div>
            )}

            <div className="topic-areas">
              <h6>Related Topics:</h6>
              <div className="topic-tags">
                {fq.topicAreas.map((topic) => (
                  <span key={topic} className="topic-tag">{topic}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <style jsx>{`
        .section {
          margin-bottom: 30px;
        }

        .section h4 {
          margin: 0 0 15px 0;
          color: #495057;
        }

        .no-items {
          color: #6c757d;
          font-style: italic;
        }

        .failed-question {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 6px;
          padding: 15px;
          margin-bottom: 15px;
        }

        .question-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 10px;
        }

        .question-header h5 {
          margin: 0;
          color: #856404;
          flex: 1;
        }

        .confidence {
          background: #f8d7da;
          color: #721c24;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          white-space: nowrap;
        }

        .failure-reasons h6, .suggested-fix h6, .topic-areas h6 {
          margin: 10px 0 5px 0;
          color: #495057;
          font-size: 14px;
        }

        .failure-reasons ul {
          margin: 0;
          padding-left: 20px;
        }

        .failure-reasons li {
          margin-bottom: 5px;
          color: #6c757d;
        }

        .suggested-fix p {
          margin: 0;
          color: #155724;
          background: #d4edda;
          padding: 10px;
          border-radius: 4px;
        }

        .topic-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }

        .topic-tag {
          background: #e9ecef;
          color: #495057;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}

function ErrorPatternsSection({ errorPatterns }: { errorPatterns: ErrorPattern[] }) {
  if (errorPatterns.length === 0) {
    return (
      <div className="section">
        <h4>Error Patterns</h4>
        <p className="no-items">No common error patterns identified.</p>
      </div>
    );
  }

  return (
    <div className="section">
      <h4>Common Error Patterns ({errorPatterns.length})</h4>
      <div className="error-patterns">
        {errorPatterns.map((pattern, index) => (
          <div key={index} className={`error-pattern severity-${pattern.severity}`}>
            <div className="pattern-header">
              <h5>{pattern.pattern}</h5>
              <span className="severity-badge">{pattern.severity}</span>
            </div>
            <p className="pattern-description">{pattern.description}</p>
            
            {pattern.examples.length > 0 && (
              <div className="pattern-examples">
                <h6>Examples:</h6>
                <ul>
                  {pattern.examples.map((example, i) => (
                    <li key={i}>{example}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="related-topics">
              <h6>Related Topics:</h6>
              <div className="topic-tags">
                {pattern.relatedTopics.map((topic) => (
                  <span key={topic} className="topic-tag">{topic}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <style jsx>{`
        .error-pattern {
          border-radius: 6px;
          padding: 15px;
          margin-bottom: 15px;
        }

        .severity-low {
          background: #d1ecf1;
          border: 1px solid #bee5eb;
        }

        .severity-medium {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
        }

        .severity-high {
          background: #f8d7da;
          border: 1px solid #f5c6cb;
        }

        .pattern-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .pattern-header h5 {
          margin: 0;
          color: #495057;
        }

        .severity-badge {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
        }

        .severity-low .severity-badge {
          background: #bee5eb;
          color: #0c5460;
        }

        .severity-medium .severity-badge {
          background: #ffeaa7;
          color: #856404;
        }

        .severity-high .severity-badge {
          background: #f5c6cb;
          color: #721c24;
        }

        .pattern-description {
          margin: 0 0 10px 0;
          color: #6c757d;
        }

        .pattern-examples h6, .related-topics h6 {
          margin: 10px 0 5px 0;
          color: #495057;
          font-size: 14px;
        }

        .pattern-examples ul {
          margin: 0;
          padding-left: 20px;
        }

        .pattern-examples li {
          margin-bottom: 5px;
          color: #6c757d;
          font-family: monospace;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}

function RecommendationsSection({ recommendations }: { recommendations: ImprovementRecommendation[] }) {
  if (recommendations.length === 0) {
    return (
      <div className="section">
        <h4>Improvement Recommendations</h4>
        <p className="no-items">No specific recommendations available.</p>
      </div>
    );
  }

  return (
    <div className="section">
      <h4>Improvement Recommendations ({recommendations.length})</h4>
      <div className="recommendations">
        {recommendations.map((rec, index) => (
          <div key={index} className={`recommendation priority-${rec.priority}`}>
            <div className="recommendation-header">
              <h5>{rec.title}</h5>
              <div className="recommendation-meta">
                <span className="type-badge">{rec.type.replace('_', ' ')}</span>
                <span className="priority-badge">{rec.priority}</span>
                <span className="time-estimate">{rec.estimatedTime}</span>
              </div>
            </div>
            <p className="recommendation-description">{rec.description}</p>
            
            {rec.resources && rec.resources.length > 0 && (
              <div className="recommendation-resources">
                <h6>Resources:</h6>
                <ul>
                  {rec.resources.map((resource, i) => (
                    <li key={i}>{resource}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
      
      <style jsx>{`
        .recommendation {
          border-radius: 6px;
          padding: 15px;
          margin-bottom: 15px;
        }

        .priority-low {
          background: #d1ecf1;
          border: 1px solid #bee5eb;
        }

        .priority-medium {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
        }

        .priority-high {
          background: #f8d7da;
          border: 1px solid #f5c6cb;
        }

        .recommendation-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 10px;
        }

        .recommendation-header h5 {
          margin: 0;
          color: #495057;
          flex: 1;
        }

        .recommendation-meta {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .type-badge, .priority-badge, .time-estimate {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
        }

        .type-badge {
          background: #e9ecef;
          color: #495057;
          text-transform: capitalize;
        }

        .priority-low .priority-badge {
          background: #bee5eb;
          color: #0c5460;
        }

        .priority-medium .priority-badge {
          background: #ffeaa7;
          color: #856404;
        }

        .priority-high .priority-badge {
          background: #f5c6cb;
          color: #721c24;
        }

        .time-estimate {
          background: #d4edda;
          color: #155724;
        }

        .recommendation-description {
          margin: 0 0 10px 0;
          color: #6c757d;
        }

        .recommendation-resources h6 {
          margin: 10px 0 5px 0;
          color: #495057;
          font-size: 14px;
        }

        .recommendation-resources ul {
          margin: 0;
          padding-left: 20px;
        }

        .recommendation-resources li {
          margin-bottom: 5px;
          color: #6c757d;
        }
      `}</style>
    </div>
  );
}
