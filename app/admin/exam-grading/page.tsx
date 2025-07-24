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
  const [sortBy, setSortBy] = useState<'grade' | 'totalPoints' | 'date' | 'name' | 'questionCount'>('questionCount');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // State for difficulty-based question counts
  const [difficultyCountData, setDifficultyCountData] = useState<{[examId: string]: {easy: number, medium: number, hard: number}}>({});
  
  // State for actual graded scores (final scores after manual grading)
  const [actualGradedScores, setActualGradedScores] = useState<{[examId: string]: number}>({});
  
  // State for batch loading
  const [batchLoading, setBatchLoading] = useState(false);
  
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

  // Calculate statistics for completed exams (removed since we don't have scaled scores anymore)
  const calculateStatistics = () => {
    const completedExams = examSessions.filter(session => 
      session.status === 'completed' && 
      session.score !== undefined
    );

    if (completedExams.length === 0) {
      setStatisticsData({
        averageGrade: 0,
        standardDeviation: 0,
        failurePercentage: 0
      });
      return;
    }

    // Use actual scores instead of scaled scores
    const scores = completedExams.map(session => session.score || 0);
    
    // Calculate average
    const averageGrade = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    // Calculate standard deviation
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - averageGrade, 2), 0) / scores.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Calculate failure percentage (this will need adjustment without normalized scores)
    const failedExams = scores.filter(score => score < 60).length; // This threshold may need adjustment
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
    let aValue, bValue;
    
    switch (sortBy) {
      case 'questionCount':
        aValue = questionCountData[a._id] || 0;
        bValue = questionCountData[b._id] || 0;
        break;
      case 'grade':
        aValue = actualGradedScores[a._id] !== undefined ? actualGradedScores[a._id] : (a.score || 0);
        bValue = actualGradedScores[b._id] !== undefined ? actualGradedScores[b._id] : (b.score || 0);
        break;
      case 'totalPoints':
        aValue = totalPointsData[a._id] || 0;
        bValue = totalPointsData[b._id] || 0;
        break;
      case 'date':
        aValue = new Date(a.startTime).getTime();
        bValue = new Date(b.startTime).getTime();
        break;
      case 'name':
        aValue = a.studentName?.toLowerCase() || '';
        bValue = b.studentName?.toLowerCase() || '';
        // Handle string comparison separately
        if (sortOrder === 'desc') {
          return bValue.localeCompare(aValue);
        } else {
          return aValue.localeCompare(bValue);
        }
      default:
        aValue = 0;
        bValue = 0;
    }

    // Handle numeric comparison
    return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
  });

  const handleSort = (column: 'grade' | 'totalPoints' | 'date' | 'name' | 'questionCount') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (column: 'grade' | 'totalPoints' | 'date' | 'name' | 'questionCount') => {
    if (sortBy !== column) return null;
    return sortOrder === 'desc' ? '↓' : '↑';
  };

  const handleGradeExam = (examId: string) => {
    router.push(`/admin/exam-grading/${examId}`);
  };

  // Force refresh all grades function
  const forceRefreshGrades = () => {
    setActualGradedScores({});
    setTotalPointsData({});
    setQuestionCountData({});
    setDifficultyCountData({});
    
    // Re-fetch all visible exams
    const visibleExams = examSessions.filter(session => session.status === 'completed');
    const examIds = visibleExams.map(session => session._id);
    
    if (examIds.length > 0) {
      const batchSize = 10;
      const batches = [];
      for (let i = 0; i < examIds.length; i += batchSize) {
        batches.push(examIds.slice(i, i + batchSize));
      }
      
      batches.forEach((batch, index) => {
        setTimeout(() => {
          fetchExamDataBatch(batch);
        }, index * 1000);
      });
    }
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

  // Optimized batch fetch function
  const fetchExamDataBatch = async (examIds: string[]) => {
    if (examIds.length === 0) return;
    
    setBatchLoading(true);
    const results = await Promise.allSettled(
      examIds.map(async (examId) => {
        try {
          // Try final exam first, then regular exam
          let response = await fetch(`/api/admin/final-exam/${examId}/for-grading`);
          let isFinalExam = true;
          
          if (!response.ok) {
            response = await fetch(`/api/admin/exam/${examId}/for-grading`);
            isFinalExam = false;
            if (!response.ok) return null;
          }
          
          const examData = await response.json();
          if (!examData.answers) return null;
          
          // Filter duplicates
          const uniqueAnswers = examData.answers.filter((answer, index, arr) => {
            const firstOccurrence = arr.findIndex(a => a.questionText.trim() === answer.questionText.trim());
            return index === firstOccurrence;
          });
          
          // Calculate data
          const totalPoints = uniqueAnswers.reduce((sum: number, answer: any) => 
            sum + (answer.questionDetails?.points || 1), 0
          );
          
          const questionCount = uniqueAnswers.length;
          
          const difficultyCounts = uniqueAnswers.reduce((counts, answer: any) => {
            const difficulty = answer.difficulty || 'medium';
            if (difficulty === 'easy') counts.easy++;
            else if (difficulty === 'medium') counts.medium++;
            else if (difficulty === 'hard') counts.hard++;
            else if (difficulty === 'algebra') counts.hard++;
            return counts;
          }, { easy: 0, medium: 0, hard: 0 });
          
          // Try to get grade data
          let gradedScore = undefined;
          try {
            const gradeResponse = await fetch(`/api/admin/${isFinalExam ? 'final-exam' : 'exam'}/${examId}/grade`, {
              cache: 'no-store',
              headers: { 'Cache-Control': 'no-cache' }
            });
            
            if (gradeResponse.ok) {
              const gradeData = await gradeResponse.json();
              if (gradeData && gradeData.totalScore !== undefined) {
                gradedScore = gradeData.totalScore;
              }
            }
          } catch (gradeErr) {
            // Ignore grade fetch errors
          }
          
          return {
            examId,
            totalPoints,
            questionCount,
            difficultyCounts,
            gradedScore
          };
        } catch (err) {
          console.error(`Error fetching data for exam ${examId}:`, err);
          return null;
        }
      })
    );
    
    // Process results
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        const { examId, totalPoints, questionCount, difficultyCounts, gradedScore } = result.value;
        
        setTotalPointsData(prev => ({ ...prev, [examId]: totalPoints }));
        setQuestionCountData(prev => ({ ...prev, [examId]: questionCount }));
        setDifficultyCountData(prev => ({ ...prev, [examId]: difficultyCounts }));
        
        if (gradedScore !== undefined) {
          setActualGradedScores(prev => ({ ...prev, [examId]: gradedScore }));
        }
      }
    });
    
    setBatchLoading(false);
  };

  // Fetch exam data in batches when sessions are loaded
  useEffect(() => {
    const visibleExams = examSessions.filter(session => session.status === 'completed');
    const examIds = visibleExams.map(session => session._id);
    
    if (examIds.length > 0) {
      // Process in batches of 10 to avoid overwhelming the server
      const batchSize = 10;
      const batches = [];
      for (let i = 0; i < examIds.length; i += batchSize) {
        batches.push(examIds.slice(i, i + batchSize));
      }
      
      // Process batches with delay
      batches.forEach((batch, index) => {
        setTimeout(() => {
          fetchExamDataBatch(batch);
        }, index * 1000); // 1 second delay between batches
      });
    }
  }, [examSessions]);

  // Recalculate statistics when exam sessions change
  useEffect(() => {
    calculateStatistics();
  }, [examSessions]);

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

      {/* Loading indicator for batch processing */}
      {batchLoading && (
        <div className={styles.batchLoadingIndicator}>
          <div className={styles.loadingSpinner}></div>
          <span>טוען נתוני בחינות...</span>
        </div>
      )}

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label>חיפוש:</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="שם סטודנט או מספר זהות"
            className={styles.searchInput}
          />
        </div>
        <div className={styles.filterGroup}>
          <label>סטטוס:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className={styles.statusFilter}
          >
            <option value="all">הכל</option>
            <option value="completed">הושלם</option>
            <option value="in_progress">בתהליך</option>
            <option value="timeout">נגמר הזמן</option>
          </select>
        </div>
        {/* Debug refresh button */}
        <button
          onClick={forceRefreshGrades}
          className={styles.gradeButton}
          style={{ background: '#28a745', color: 'white' }}
        >
          🔄 רענן נתונים
        </button>
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
              {/* <th onClick={() => handleSort('grade')} className={styles.sortableHeader}>
                ציון סטודנט {getSortIcon('grade')}
              </th> */}
              <th onClick={() => handleSort('questionCount')} className={styles.sortableHeader}>
                סך שאלות {getSortIcon('questionCount')}
              </th>
              <th onClick={() => handleSort('totalPoints')} className={styles.sortableHeader}>
                סך נקודות {getSortIcon('totalPoints')}
              </th>
              <th>סטטוס</th>
              {/* הסתרת עמודת AI חשד */}
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {sortedSessions.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.noData}>
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
                  {/* <td className={styles.scoreCell}>
                    {(actualGradedScores[session._id] !== undefined || session.score !== undefined) ? (
                      <span className={styles.score}>
                        {(() => {
                          const finalScore = actualGradedScores[session._id] ?? session.score;
                          // Special debug for problematic student
                          if (session.studentId === '207749219') {
                            console.log(`🔍 Student 207749219 DEBUG:`, {
                              examId: session._id,
                              actualGradedScore: actualGradedScores[session._id],
                              sessionScore: session.score,
                              finalDisplayed: finalScore,
                              hasActualGraded: actualGradedScores[session._id] !== undefined
                            });
                          }
                          return finalScore;
                        })()}
                      </span>
                    ) : (
                      loadingTotalPoints.has(session._id) ? (
                        <span className={styles.loading}>טוען...</span>
                      ) : (
                        '-'
                      )
                    )}
                  </td> */}
                  <td className={styles.questionCountCell}>
                    {questionCountData[session._id] !== undefined ? (
                      <span className={styles.questionCount}>
                        {questionCountData[session._id]} {questionCountData[session._id] > 13 ? '📚' : '📄'}
                      </span>
                    ) : (
                      loadingTotalPoints.has(session._id) ? (
                        <span className={styles.loading}>טוען...</span>
                      ) : (
                        '-'
                      )
                    )}
                  </td>
                  <td className={styles.totalPointsCell}>
                    {totalPointsData[session._id] !== undefined ? (
                      <span className={styles.totalPoints}>
                        {totalPointsData[session._id]} נקודות
                      </span>
                    ) : (
                      loadingTotalPoints.has(session._id) ? (
                        <span className={styles.loading}>טוען...</span>
                      ) : (
                        '-'
                      )
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
                    {/* Temporary debug button for specific student */}
                    {/* {session.studentId === '207749219' && (
                      <button
                        onClick={() => debugStudentGrade(session._id, session.studentId)}
                        className={styles.gradeButton}
                        style={{ marginLeft: '5px', background: '#ff6b6b' }}
                      >
                        🐛 Debug
                      </button>
                    )} */}
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