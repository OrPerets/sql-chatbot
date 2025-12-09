"use client";

import React, { useState, useEffect } from 'react';
import {
  Brain,
  Play,
  Pause,
  RefreshCw,
  BarChart3,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  Settings,
  Download,
  Filter,
  Search
} from 'lucide-react';
import styles from '../admin_page.module.css';

interface AnalysisResult {
  _id: string;
  studentId: string;
  analysisDate: string;
  analysisType: 'scheduled' | 'triggered' | 'manual';
  triggerReason: string;
  conversationSummary: {
    totalInteractions: number;
    sessionCount: number;
    repeatedTopics: string[];
    difficultyAreas: string[];
    helpRequestFrequency: number;
    comprehensionLevel: 'low' | 'medium' | 'high';
  };
  performanceSummary: {
    homeworkGrades: number[];
    averageGrade: number;
    gradeTrend: 'improving' | 'stable' | 'declining';
    errorPatterns: string[];
    improvementAreas: string[];
    strengths: string[];
    timeEfficiency: number;
  };
  challengeSummary: {
    primaryChallenges: string[];
    challengeSeverity: 'low' | 'medium' | 'high';
    riskFactors: string[];
    recommendations: string[];
    interventionNeeded: boolean;
  };
  knowledgeScoreUpdate: {
    previousScore: string;
    newScore: string;
    confidenceLevel: number;
    reasoning: string;
    supportingEvidence: string[];
    adminReviewRequired: boolean;
  };
  michaelAnalysis: {
    rawResponse: string;
    extractedInsights: string[];
    suggestedActions: string[];
    confidenceScore: number;
  };
}

interface SystemInsights {
  totalAnalyses: number;
  totalStudents: number;
  recentAnalyses: number;
  pendingReviews: number;
  analysisRate: number;
}

interface AnalysisManagementProps {
  onClose?: () => void;
}

const AnalysisManagement: React.FC<AnalysisManagementProps> = ({ onClose }) => {
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [systemInsights, setSystemInsights] = useState<SystemInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisResult | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterSeverity, setFilterSeverity] = useState<string>('');

  const fetchSystemInsights = async () => {
    try {
      const response = await fetch('/api/analysis/insights?timeframe=7d&metric=all');
      const data = await response.json();
      
      if (data.success) {
        setSystemInsights(data.data.systemInsights);
      }
    } catch (err) {
      console.error('Error fetching system insights:', err);
    }
  };

  const fetchAnalyses = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch real analysis data from the database
      const response = await fetch('/api/analysis/insights?timeframe=30d&metric=all');
      const data = await response.json();
      
      if (data.success) {
        // For now, we'll show empty state since we don't have real analysis data yet
        // In production, this would fetch from the analysis_results collection
        setAnalyses([]);
      } else {
        setError('שגיאה בטעינת נתוני הניתוח');
      }
    } catch (err) {
      setError('שגיאת רשת בטעינת הניתוחים');
      console.error('Error fetching analyses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemInsights();
    fetchAnalyses();
  }, []);

  const handleTriggerAnalysis = async (studentId: string) => {
    try {
      const response = await fetch(`/api/analysis/trigger/${studentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Manual trigger from admin panel' })
      });

      const data = await response.json();
      if (data.success) {
        alert('Analysis triggered successfully');
        fetchAnalyses();
      } else {
        alert('Failed to trigger analysis: ' + data.error);
      }
    } catch (err) {
      console.error('Error triggering analysis:', err);
      alert('Failed to trigger analysis');
    }
  };

  const handleBatchAnalysis = async () => {
    try {
      const response = await fetch('/api/analysis/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          studentIds: ['student-1', 'student-2', 'student-3'],
          analysisType: 'scheduled_batch'
        })
      });

      const data = await response.json();
      if (data.success) {
        alert(`Batch analysis completed: ${data.data.successful}/${data.data.totalRequested} successful`);
        fetchAnalyses();
      } else {
        alert('Batch analysis failed: ' + data.error);
      }
    } catch (err) {
      console.error('Error in batch analysis:', err);
      alert('Batch analysis failed');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <AlertTriangle size={16} />;
      case 'medium': return <Clock size={16} />;
      case 'low': return <CheckCircle size={16} />;
      default: return <Clock size={16} />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <CheckCircle className="text-green-600" size={16} />;
      case 'declining': return <AlertTriangle className="text-red-600" size={16} />;
      case 'stable': return <Clock className="text-blue-600" size={16} />;
      default: return <Clock size={16} />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredAnalyses = analyses.filter(analysis => {
    const matchesSearch = !searchTerm || 
      analysis.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      analysis.triggerReason.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = !filterType || analysis.analysisType === filterType;
    const matchesSeverity = !filterSeverity || analysis.challengeSummary.challengeSeverity === filterSeverity;
    
    return matchesSearch && matchesType && matchesSeverity;
  });

  if (loading && analyses.length === 0) {
    return (
      <div className={styles.adminContainer}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="mr-2 text-gray-600">טוען ניתוחי AI...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboardSection}>
      {/* Updated styling - force refresh */}
      {/* Header */}
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>ניהול ניתוחי AI</h2>
        <p className={styles.sectionDescription}>ניתוח אוטומטי של התנהגות תלמידים עם Michael</p>
      </div>

      {/* Action Buttons */}
      <div className={styles.quickActions}>
        <div className={styles.actionButtons}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={styles.quickActionButton}
          >
            <Settings size={20} />
            <div className={styles.buttonContent}>
              <div className={styles.buttonTitle}>הגדרות</div>
              <div className={styles.buttonDescription}>הגדרות מערכת הניתוח</div>
            </div>
          </button>
          <button
            onClick={handleBatchAnalysis}
            className={styles.quickActionButton}
          >
            <Brain size={20} />
            <div className={styles.buttonContent}>
              <div className={styles.buttonTitle}>ניתוח קבוצתי</div>
              <div className={styles.buttonDescription}>הפעל ניתוח על מספר תלמידים</div>
            </div>
          </button>
          <button
            onClick={fetchAnalyses}
            className={styles.quickActionButton}
          >
            <RefreshCw size={20} />
            <div className={styles.buttonContent}>
              <div className={styles.buttonTitle}>רענן</div>
              <div className={styles.buttonDescription}>רענן נתוני הניתוח</div>
            </div>
          </button>
        </div>
      </div>

      {/* System Insights */}
      {systemInsights && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <Brain className="h-6 w-6" />
            </div>
            <div className={styles.statContent}>
              <div className={styles.statNumber}>{systemInsights.totalAnalyses}</div>
              <div className={styles.statLabel}>סה"כ ניתוחים</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <Users className="h-6 w-6" />
            </div>
            <div className={styles.statContent}>
              <div className={styles.statNumber}>{systemInsights.totalStudents}</div>
              <div className={styles.statLabel}>תלמידים מנותחים</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <BarChart3 className="h-6 w-6" />
            </div>
            <div className={styles.statContent}>
              <div className={styles.statNumber}>{systemInsights.recentAnalyses}</div>
              <div className={styles.statLabel}>ניתוחים השבוע</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className={styles.statContent}>
              <div className={styles.statNumber}>{systemInsights.pendingReviews}</div>
              <div className={styles.statLabel}>ממתינים לבדיקה</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={styles.searchContainer}>
        <div className={styles.searchHeader}>
          <Search size={20} />
          <span>סינון וחיפוש ניתוחים</span>
        </div>
        {/* Force horizontal layout - search bar should be side by side */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="חיפוש לפי תלמיד או סיבה..."
                className={styles.searchInput}
              />
            </div>
          </div>

          <div className="min-w-[150px]">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className={styles.classSelect}
              style={{width: '100%'}}
            >
              <option value="">כל הסוגים</option>
              <option value="scheduled">מתוזמן</option>
              <option value="triggered">מופעל</option>
              <option value="manual">ידני</option>
            </select>
          </div>

          <div className="min-w-[150px]">
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className={styles.classSelect}
              style={{width: '100%'}}
            >
              <option value="">כל הרמות</option>
              <option value="high">גבוהה</option>
              <option value="medium">בינונית</option>
              <option value="low">נמוכה</option>
            </select>
          </div>

          <div>
            <button
              onClick={fetchAnalyses}
              className={styles.actionButton}
            >
              <RefreshCw size={16} className="ml-2" />
              רענן
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className={styles.errorMessage}>
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-400 ml-2" />
            <div>
              <h3 className="text-sm font-medium text-red-800">שגיאה</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Analyses Table */}
      <div className={styles.usersContainer}>
        <div className={styles.usersHeader}>
          <h3 className="text-lg font-medium text-gray-900">
            ניתוחי AI ({filteredAnalyses.length})
          </h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="mr-2 text-gray-600">טוען...</span>
          </div>
        ) : filteredAnalyses.length === 0 ? (
          <div className={styles.noResults}>
            <Brain className={styles.noResultsIcon} />
            <div className={styles.noResultsText}>אין ניתוחים</div>
            <div className={styles.noResultsSubtext}>לא נמצאו ניתוחי AI התואמים לקריטריונים שלך.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                    תלמיד
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                    סוג ניתוח
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                    אתגרים
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                    ביצועים
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                    ציון ידע
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                    תאריך
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredAnalyses.map((analysis) => (
                  <tr key={analysis._id} className="hover:bg-blue-50 transition-colors duration-200 border-b border-gray-100">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center">
                            <Users className="h-5 w-5 text-white" />
                          </div>
                        </div>
                        <div className="mr-4">
                          <div className="text-sm font-semibold text-gray-900">
                            {analysis.studentId}
                          </div>
                          <div className="text-sm text-gray-500">
                            {analysis.triggerReason}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        analysis.analysisType === 'manual' ? 'bg-blue-100 text-blue-800' :
                        analysis.analysisType === 'triggered' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {analysis.analysisType === 'manual' ? 'ידני' :
                         analysis.analysisType === 'triggered' ? 'מופעל' : 'מתוזמן'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(analysis.challengeSummary.challengeSeverity)}`}>
                        {getSeverityIcon(analysis.challengeSummary.challengeSeverity)}
                        <span className="mr-1">
                          {analysis.challengeSummary.challengeSeverity === 'high' ? 'גבוהה' :
                           analysis.challengeSummary.challengeSeverity === 'medium' ? 'בינונית' : 'נמוכה'}
                        </span>
                      </span>
                      {analysis.challengeSummary.interventionNeeded && (
                        <div className="mt-1">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <AlertTriangle size={12} className="ml-1" />
                            נדרשת התערבות
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        {getTrendIcon(analysis.performanceSummary.gradeTrend)}
                        <span className="mr-2">
                          {analysis.performanceSummary.gradeTrend === 'improving' ? 'משתפר' :
                           analysis.performanceSummary.gradeTrend === 'declining' ? 'יורד' : 'יציב'}
                        </span>
                      </div>
                      <div>ציון ממוצע: {analysis.performanceSummary.averageGrade.toFixed(1)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="font-medium">
                          {analysis.knowledgeScoreUpdate.previousScore === 'empty' ? 'ריק' :
                         analysis.knowledgeScoreUpdate.previousScore === 'good' ? 'טוב' :
                         analysis.knowledgeScoreUpdate.previousScore === 'needs_attention' ? 'זקוק לתשומת לב' : 'מתקשה'} → {
                         analysis.knowledgeScoreUpdate.newScore === 'empty' ? 'ריק' :
                         analysis.knowledgeScoreUpdate.newScore === 'good' ? 'טוב' :
                         analysis.knowledgeScoreUpdate.newScore === 'needs_attention' ? 'זקוק לתשומת לב' : 'מתקשה'}
                        </div>
                        <div className="text-gray-500">
                          ביטחון: {analysis.knowledgeScoreUpdate.confidenceLevel}%
                        </div>
                        {analysis.knowledgeScoreUpdate.adminReviewRequired && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            <Eye size={12} className="ml-1" />
                            נדרשת בדיקה
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(analysis.analysisDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2 space-x-reverse">
                        <button 
                          onClick={() => setSelectedAnalysis(analysis)}
                          className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded-lg transition-colors duration-200"
                          title="צפה בפרטים"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={() => handleTriggerAnalysis(analysis.studentId)}
                          className="p-2 text-green-600 hover:text-green-900 hover:bg-green-100 rounded-lg transition-colors duration-200"
                          title="הפעל ניתוח"
                        >
                          <Play size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Analysis Detail Modal */}
      {selectedAnalysis && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  פרטי ניתוח AI - {selectedAnalysis.studentId}
                </h3>
                <button
                  onClick={() => setSelectedAnalysis(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">סגור</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* Michael's Analysis */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-2">ניתוח Michael</h4>
                  <div className="bg-blue-50 p-4 rounded-md">
                    <p className="text-sm text-gray-700">{selectedAnalysis.michaelAnalysis.rawResponse}</p>
                  </div>
                </div>

                {/* Insights */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-2">תובנות</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedAnalysis.michaelAnalysis.extractedInsights.map((insight, index) => (
                      <li key={index} className="text-sm text-gray-700">{insight}</li>
                    ))}
                  </ul>
                </div>

                {/* Recommendations */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-2">המלצות</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedAnalysis.challengeSummary.recommendations.map((recommendation, index) => (
                      <li key={index} className="text-sm text-gray-700">{recommendation}</li>
                    ))}
                  </ul>
                </div>

                {/* Knowledge Score Update */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-2">עדכון ציון ידע</h4>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-700">
                      <strong>סיבה:</strong> {selectedAnalysis.knowledgeScoreUpdate.reasoning}
                    </p>
                    <p className="text-sm text-gray-700 mt-2">
                      <strong>ביטחון:</strong> {selectedAnalysis.knowledgeScoreUpdate.confidenceLevel}%
                    </p>
                    <div className="mt-2">
                      <strong className="text-sm text-gray-700">ראיות תומכות:</strong>
                      <ul className="list-disc list-inside mt-1">
                        {selectedAnalysis.knowledgeScoreUpdate.supportingEvidence.map((evidence, index) => (
                          <li key={index} className="text-sm text-gray-700">{evidence}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3 space-x-reverse">
                <button
                  onClick={() => setSelectedAnalysis(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  סגור
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisManagement;
