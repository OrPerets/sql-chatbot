"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Clock, User, CheckCircle, XCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import styles from './page.module.css';
import { analyzeExamForAI, getSuspicionColor, getSuspicionIcon } from '../../utils/trapDetector';

interface ExamSession {
  _id: string;
  studentEmail: string;
  studentName?: string;
  studentId?: string;
  startTime: string;
  endTime?: string;
  status: 'in_progress' | 'completed' | 'timeout';
  score?: number;
  totalQuestions: number;
  totalPoints?: number;
  graded?: boolean;
  aiAnalysis?: {
    isExamSuspicious: boolean;
    totalSuspiciousAnswers: number;
    averageSuspicionScore: number;
    maxSuspicionScore: number;
    summary: string;
  };
}

const ExamGradingPage: React.FC = () => {
  const [examSessions, setExamSessions] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'in_progress' | 'timeout' | 'ai_suspicious'>('all');
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState<Set<string>>(new Set());
  const [bulkAnalysisLoading, setBulkAnalysisLoading] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });
  const [totalPointsData, setTotalPointsData] = useState<{[examId: string]: number}>({});
  const [loadingTotalPoints, setLoadingTotalPoints] = useState<Set<string>>(new Set());
  const [questionCountData, setQuestionCountData] = useState<{[examId: string]: number}>({});
  const [scaledScoreData, setScaledScoreData] = useState<{[examId: string]: number}>({});
  const [sortBy, setSortBy] = useState<'grade' | 'totalPoints' | 'date' | 'name'>('grade');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // State for new statistics
  const [statisticsData, setStatisticsData] = useState<{
    averageGrade: number;
    standardDeviation: number;
    failurePercentage: number;
  }>({
    averageGrade: 0,
    standardDeviation: 0,
    failurePercentage: 0
  });
  
  const router = useRouter();

  // Calculate statistics for completed exams
  const calculateStatistics = () => {
    const completedExams = examSessions.filter(session => 
      session.status === 'completed' && 
      session.score !== undefined &&
      scaledScoreData[session._id] !== undefined
    );

    if (completedExams.length === 0) {
      setStatisticsData({
        averageGrade: 0,
        standardDeviation: 0,
        failurePercentage: 0
      });
      return;
    }

    // Get all scaled scores
    const scores = completedExams.map(session => scaledScoreData[session._id]);
    
    // Calculate average
    const averageGrade = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    // Calculate standard deviation
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - averageGrade, 2), 0) / scores.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Calculate failure percentage (score < 60)
    const failedExams = scores.filter(score => score < 60).length;
    const failurePercentage = (failedExams / scores.length) * 100;
    
    setStatisticsData({
      averageGrade: Math.round(averageGrade * 10) / 10, // Round to 1 decimal place
      standardDeviation: Math.round(standardDeviation * 10) / 10,
      failurePercentage: Math.round(failurePercentage * 10) / 10
    });
  };

  useEffect(() => {
    fetchExamSessions();
  }, []);

  const fetchExamSessions = async () => {
    try {
      setLoading(true);
      // First try to fetch from FinalExams collection via local API
      const response = await fetch('/api/admin/final-exams');
      if (!response.ok) {
        // If FinalExams doesn't exist, initialize it first
        if (response.status === 500) {
          console.log('Initializing FinalExams collection...');
          const initResponse = await fetch('/api/admin/final-exams', {
            method: 'POST'
          });
          if (initResponse.ok) {
            // Try fetching again after initialization
            const retryResponse = await fetch('/api/admin/final-exams');
            if (retryResponse.ok) {
              const data = await retryResponse.json();
              const sessions = data.exams || data;
              setExamSessions(sessions);
              // Note: Bulk AI analysis removed to reduce database load
              return;
            }
          }
        }
        throw new Error('Failed to fetch final exams');
      }
      const data = await response.json();
      const sessions = data.exams || data;
      setExamSessions(sessions);
      // Note: Bulk AI analysis removed to reduce database load
      // AI analysis can be run manually if needed
    } catch (err) {
      console.error('Error fetching final exams:', err);
      setError('Failed to load final exams');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} className={styles.completedIcon} />;
      case 'in_progress':
        return <Clock size={16} className={styles.inProgressIcon} />;
      case 'timeout':
        return <XCircle size={16} className={styles.timeoutIcon} />;
      default:
        return <Clock size={16} />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'הושלם';
      case 'in_progress':
        return 'בתהליך';
      case 'timeout':
        return 'פג תוקף';
      default:
        return status;
    }
  };

  const filteredSessions = examSessions.filter(session => {
    const matchesSearch = 
      (session.studentEmail && session.studentEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (session.studentName && session.studentName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (session.studentId && session.studentId.includes(searchTerm));
    
    let matchesStatus = true;
    if (statusFilter === 'ai_suspicious') {
      matchesStatus = session.aiAnalysis?.isExamSuspicious === true;
    } else if (statusFilter !== 'all') {
      matchesStatus = session.status === statusFilter;
    }
    
    return matchesSearch && matchesStatus;
  });

  // Sort the filtered sessions
  const sortedSessions = [...filteredSessions].sort((a, b) => {
    if (sortBy === 'grade') {
      const aScore = scaledScoreData[a._id] ?? 0;
      const bScore = scaledScoreData[b._id] ?? 0;
      return sortOrder === 'desc' ? bScore - aScore : aScore - bScore;
    } else if (sortBy === 'totalPoints') {
      const aPoints = totalPointsData[a._id] || 0;
      const bPoints = totalPointsData[b._id] || 0;
      return sortOrder === 'desc' ? bPoints - aPoints : aPoints - bPoints;
    } else if (sortBy === 'date') {
      const aDate = new Date(a.startTime).getTime();
      const bDate = new Date(b.startTime).getTime();
      return sortOrder === 'desc' ? bDate - aDate : aDate - bDate;
    } else if (sortBy === 'name') {
      const aName = a.studentName || '';
      const bName = b.studentName || '';
      return sortOrder === 'desc' ? bName.localeCompare(aName) : aName.localeCompare(bName);
    }
    return 0;
  });

  const handleSort = (column: 'grade' | 'totalPoints' | 'date' | 'name') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (column: 'grade' | 'totalPoints' | 'date' | 'name') => {
    if (sortBy !== column) return null;
    return sortOrder === 'desc' ? '↓' : '↑';
  };

  // Debug logging
  console.log('examSessions', examSessions);
  console.log('filteredSessions', filteredSessions);

  const handleGradeExam = (examId: string) => {
    router.push(`/admin/exam-grading/${examId}`);
  };

  const analyzeExamForAIPatterns = async (examId: string) => {
    if (aiAnalysisLoading.has(examId)) return;

    setAiAnalysisLoading(prev => new Set(prev).add(examId));
    
    try {
      const response = await fetch(`/api/admin/exam/${examId}/for-grading`);
      if (!response.ok) {
        throw new Error('Failed to fetch exam data for AI analysis');
      }
      
      const examData = await response.json();
      if (examData.answers) {
        const analysis = analyzeExamForAI(examData.answers);
        
        // Update the exam session with AI analysis
        setExamSessions(prev => prev.map(session => 
          session._id === examId 
            ? { ...session, aiAnalysis: analysis }
            : session
        ));
      }
    } catch (err) {
      console.error('Error analyzing exam for AI:', err);
    } finally {
      setAiAnalysisLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(examId);
        return newSet;
      });
    }
  };

  // Note: Bulk AI analysis function removed to reduce database load
  // Individual AI analysis can still be triggered manually if needed

  const getAIIcon = (score: number) => {
    const iconName = getSuspicionIcon(score);
    switch (iconName) {
      case 'AlertTriangle':
        return <AlertTriangle size={16} className={styles.aiHighRisk} />;
      case 'AlertCircle':
        return <AlertCircle size={16} className={styles.aiMediumRisk} />;
      case 'Info':
        return <Info size={16} className={styles.aiLowRisk} />;
      default:
        return <CheckCircle size={16} className={styles.aiClean} />;
    }
  };

  const NORMALIZED_MAX = 13;
  const NORMALIZED_POINTS_PER_QUESTION = 6;
  const NORMALIZED_SCALE = 100;

  // Helper to get normalization scale for a given question count
  function getNormalizationScale(questionCount: number) {
    if (questionCount >= NORMALIZED_MAX) return NORMALIZED_SCALE;
    // Each question is 6 points, so 12 questions = 72, 11 = 66, etc.
    // The normalized max for 12 questions: (12/13)*100 = 92.3, but user wants 94 for 12, 88 for 11, etc.
    // We'll use a lookup for clarity:
    const scaleMap: Record<number, number> = {
      13: 100,
      12: 94,
      11: 88,
      10: 82,
      9: 76,
      8: 70,
      7: 64,
      6: 58,
      5: 52,
      4: 46,
      3: 40,
      2: 34,
      1: 28,
      0: 0,
    };
    return scaleMap[questionCount] ?? Math.round((questionCount / NORMALIZED_MAX) * 100);
  }

  const fetchTotalPointsForExam = async (examId: string) => {
    if (loadingTotalPoints.has(examId) || totalPointsData[examId] !== undefined) return;

    setLoadingTotalPoints(prev => new Set(prev).add(examId));
    
    try {
      // Try fetching from FinalExams first, fall back to regular exams
      let response = await fetch(`/api/admin/final-exam/${examId}/for-grading`);
      if (!response.ok) {
        response = await fetch(`/api/admin/exam/${examId}/for-grading`);
        if (!response.ok) {
          throw new Error('Failed to fetch exam data');
        }
      }
      
      const examData = await response.json();
      if (examData.answers) {
        const totalPoints = examData.answers.reduce((sum: number, answer: any) => 
          sum + (answer.questionDetails?.points || 1), 0
        );
        
        // Calculate question count
        const questionCount = examData.answers.length;

        setTotalPointsData(prev => ({
          ...prev,
          [examId]: totalPoints
        }));

        setQuestionCountData(prev => ({
          ...prev,
          [examId]: questionCount
        }));

        // --- Normalization logic ---
        let scaledScore = 0;
        if (examData.session?.score !== undefined && totalPoints > 0) {
          // Normalize to the correct scale based on question count
          const normalizationScale = getNormalizationScale(questionCount);
          const percentage = (examData.session.score / (questionCount * NORMALIZED_POINTS_PER_QUESTION)) * normalizationScale;
          scaledScore = Math.round(percentage);
        }

        setScaledScoreData(prev => ({
          ...prev,
          [examId]: scaledScore
        }));
      }
    } catch (err) {
      console.error(`Error fetching total points for exam ${examId}:`, err);
    } finally {
      setLoadingTotalPoints(prev => {
        const newSet = new Set(prev);
        newSet.delete(examId);
        return newSet;
      });
    }
  };

  // Fetch total points for all visible exams (throttled to reduce DB calls)
  useEffect(() => {
    const visibleExams = filteredSessions.filter(session => session.status === 'completed');
    // Only fetch for the first 10 exams to reduce database load
    const limitedExams = visibleExams.slice(0, 10);
    limitedExams.forEach(session => {
      fetchTotalPointsForExam(session._id);
    });
  }, [filteredSessions]);

  // Recalculate statistics when scaled score data changes
  useEffect(() => {
    calculateStatistics();
  }, [scaledScoreData, examSessions]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>טוען בחינות סופיות...</div>
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
          <FileText size={24} />
          בדיקה וציונים - בחינות סופיות
        </h1>
        <div className={styles.subtitle}>
          מציג בחינות מאוחדות - בחינה אחת לכל סטודנט (מעדיף מבחן מקורי על פני חזרה)
        </div>
      </div>

      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="חיפוש לפי אימייל, שם או מספר זהות..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        
        <div className={styles.statusFilter}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className={styles.statusSelect}
          >
            <option value="all">כל הסטטוסים</option>
            <option value="completed">הושלם</option>
            <option value="in_progress">בתהליך</option>
            <option value="timeout">פג תוקף</option>
            <option value="ai_suspicious">חשוד ב-AI</option>
          </select>
        </div>
      </div>

      {/* AI Analysis Controls */}
      {/* (הוסרו כפתורי ניתוח AI, טקסטים ואנימציות) */}
      {/* Bulk AI Analysis Progress */}
      {/* (הוסרו כל האנימציות והטעינות של ניתוח AI) */}

      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{statisticsData.averageGrade}</div>
          <div className={styles.statLabel}>ציון ממוצע</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{statisticsData.standardDeviation}</div>
          <div className={styles.statLabel}>סטיית תקן</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{statisticsData.failurePercentage}%</div>
          <div className={styles.statLabel}>אחוז נכשלים (מתחת ל60)</div>
        </div>
      </div>

      {/* Exam Sessions Table */}
      <div className={styles.tableContainer}>
        <table className={styles.examTable}>
          <thead>
            <tr>
              <th onClick={() => handleSort('name')} className={styles.sortableHeader}>
                סטודנט {getSortIcon('name')}
              </th>
              <th onClick={() => handleSort('date')} className={styles.sortableHeader}>
                תאריך התחלה {getSortIcon('date')}
              </th>
              <th onClick={() => handleSort('date')} className={styles.sortableHeader}>
                תאריך סיום {getSortIcon('date')}
              </th>
              <th onClick={() => handleSort('grade')} className={styles.sortableHeader}>
                ציון {getSortIcon('grade')}
              </th>
              <th>סטטוס</th>
              {/* הסתרת עמודת AI חשד */}
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {sortedSessions.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.noData}>
                  לא נמצאו בחינות
                </td>
              </tr>
            ) : (
              sortedSessions.map((session) => (
                <tr key={session._id} className={styles.tableRow}>
                  <td className={styles.studentCell}>
                    <div className={styles.studentInfo}>
                      <User size={16} />
                      <span>{session.studentName || 'לא צוין'}</span>
                    </div>
                    {session.studentId && (
                      <div className={styles.studentId}>
                        ID: {session.studentId}
                      </div>
                    )}
                    <div className={styles.studentEmail}>
                      {session.studentEmail}
                    </div>
                  </td>
                  <td className={styles.dateCell}>
                    {formatDate(session.startTime)}
                  </td>
                  <td className={styles.dateCell}>
                    {session.endTime ? formatDate(session.endTime) : '-'}
                  </td>
                  <td className={styles.scoreCell}>
                    {session.score !== undefined ? (
                      <span className={styles.score}>
                        {scaledScoreData[session._id] !== undefined ? scaledScoreData[session._id] : session.score}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className={styles.statusCell}>
                    <div className={styles.statusWrapper}>
                      {getStatusIcon(session.status)}
                      <span>{getStatusText(session.status)}</span>
                    </div>
                  </td>
                  {/* הסתרת עמודת AI חשד ופעולות ניתוח */}
                  <td className={styles.actionsCell}>
                    <button
                      onClick={() => handleGradeExam(session._id)}
                      className={styles.gradeButton}
                      disabled={session.status === 'in_progress'}
                    >
                      <FileText size={16} />
                      {session.graded ? 'ערוך ציון' : 'בדוק וציין'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExamGradingPage; 