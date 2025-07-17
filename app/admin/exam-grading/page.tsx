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
  const router = useRouter();

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
              // Auto-run AI analysis for completed exams
              runBulkAIAnalysis(sessions);
              return;
            }
          }
        }
        throw new Error('Failed to fetch final exams');
      }
      const data = await response.json();
      const sessions = data.exams || data;
      setExamSessions(sessions);
      // Auto-run AI analysis for completed exams
      runBulkAIAnalysis(sessions);
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

  const runBulkAIAnalysis = async (sessions: ExamSession[]) => {
    // Analyze all completed exams (re-analyze existing ones with enhanced detector)
    const toAnalyze = sessions.filter(session => 
      session.status === 'completed'
    );

    if (toAnalyze.length === 0) return;

    setBulkAnalysisLoading(true);
    setAnalysisProgress({ current: 0, total: toAnalyze.length });

    console.log(`Starting AI analysis for ${toAnalyze.length} completed exams...`);

    // Process exams in parallel but limit concurrency to avoid overwhelming the API
    const BATCH_SIZE = 3;
    for (let i = 0; i < toAnalyze.length; i += BATCH_SIZE) {
      const batch = toAnalyze.slice(i, Math.min(i + BATCH_SIZE, toAnalyze.length));
      
      await Promise.all(
        batch.map(async (session, batchIndex) => {
          try {
            const response = await fetch(`/api/admin/exam/${session._id}/for-grading`);
            if (response.ok) {
              const examData = await response.json();
              if (examData.answers) {
                const analysis = analyzeExamForAI(examData.answers);
                
                // Update the exam session with AI analysis
                setExamSessions(prev => prev.map(s => 
                  s._id === session._id 
                    ? { ...s, aiAnalysis: analysis }
                    : s
                ));
              }
            }
          } catch (err) {
            console.error(`Error analyzing exam ${session._id}:`, err);
          }
          
          // Update progress
          setAnalysisProgress(prev => ({
            ...prev,
            current: i + batchIndex + 1
          }));
        })
      );

      // Small delay between batches to be nice to the API
      if (i + BATCH_SIZE < toAnalyze.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    setBulkAnalysisLoading(false);
    console.log('AI analysis completed for all exams');
  };

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
      <div className={styles.aiControls}>
        <div className={styles.aiControlsHeader}>
          <h3>🤖 מערכת זיהוי AI מתקדמת</h3>
          <button
            onClick={() => runBulkAIAnalysis(examSessions)}
            disabled={bulkAnalysisLoading}
            className={styles.reAnalyzeButton}
            title="הרץ מחדש ניתוח AI עם הגדרות מתקדמות"
          >
            <AlertTriangle size={16} />
            {bulkAnalysisLoading ? 'מנתח...' : 'נתח מחדש הכל'}
          </button>
        </div>
        <div className={styles.trapsList}>
          <span className={styles.trapsInfo}>
            🪤 מזהה 18 סוגי מלכודות: weapon_id בMissions, טבלת MissionAnalytics פיקטיבית, שדות duration_minutes/fuel_consumption, יחסים שגויים, והזרקת פרומפט התנהגותי
          </span>
        </div>
      </div>

      {/* Bulk AI Analysis Progress */}
      {bulkAnalysisLoading && (
        <div className={styles.bulkAnalysisProgress}>
          <div className={styles.progressHeader}>
            <AlertTriangle size={20} className={styles.progressIcon} />
            <span>מריץ ניתוח AI מתקדם עבור בחינות שהושלמו...</span>
          </div>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill}
              style={{ width: `${(analysisProgress.current / analysisProgress.total) * 100}%` }}
            />
          </div>
          <div className={styles.progressText}>
            {analysisProgress.current} מתוך {analysisProgress.total} בחינות
          </div>
        </div>
      )}

      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{examSessions.length}</div>
          <div className={styles.statLabel}>סה"כ בחינות</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>
            {examSessions.filter(s => s.status === 'completed').length}
          </div>
          <div className={styles.statLabel}>הושלמו</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>
            {examSessions.filter(s => s.graded).length}
          </div>
          <div className={styles.statLabel}>נבדקו</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>
            {examSessions.filter(s => s.aiAnalysis?.isExamSuspicious).length}
          </div>
          <div className={styles.statLabel}>חשודים ב-AI</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>
            {examSessions.filter(s => s.status === 'completed' && s.aiAnalysis).length}
          </div>
          <div className={styles.statLabel}>נותחו ל-AI</div>
        </div>
      </div>

      {/* Exam Sessions Table */}
      <div className={styles.tableContainer}>
        <table className={styles.examTable}>
          <thead>
            <tr>
              <th>סטודנט</th>
              <th>אימייל</th>
              <th>תאריך התחלה</th>
              <th>תאריך סיום</th>
              <th>סטטוס</th>
              <th>ציון</th>
              <th>AI חשד</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filteredSessions.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.noData}>
                  לא נמצאו בחינות
                </td>
              </tr>
            ) : (
              filteredSessions.map((session) => (
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
                  </td>
                  <td className={styles.emailCell}>
                    {session.studentEmail}
                  </td>
                  <td className={styles.dateCell}>
                    {formatDate(session.startTime)}
                  </td>
                  <td className={styles.dateCell}>
                    {session.endTime ? formatDate(session.endTime) : '-'}
                  </td>
                  <td className={styles.statusCell}>
                    <div className={styles.statusWrapper}>
                      {getStatusIcon(session.status)}
                      <span>{getStatusText(session.status)}</span>
                    </div>
                  </td>
                  <td className={styles.scoreCell}>
                    {session.score !== undefined ? (
                      <span className={styles.score}>
                        {session.score}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className={styles.aiCell}>
                    {session.status === 'completed' && (
                      <div className={styles.aiAnalysis}>
                        {session.aiAnalysis ? (
                          <div 
                            className={`${styles.aiIndicator} ${styles[getSuspicionColor(session.aiAnalysis.maxSuspicionScore)]}`}
                            title={session.aiAnalysis.summary}
                          >
                            {getAIIcon(session.aiAnalysis.maxSuspicionScore)}
                            <span className={styles.aiScore}>
                              {session.aiAnalysis.maxSuspicionScore}%
                            </span>
                          </div>
                        ) : (
                          <div className={styles.aiPending}>
                            {aiAnalysisLoading.has(session._id) || bulkAnalysisLoading ? (
                              <div className={styles.aiLoading} title="מנתח...">
                                <Clock size={14} className={styles.loadingSpinner} />
                                <span className={styles.loadingText}>מנתח...</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => analyzeExamForAIPatterns(session._id)}
                                className={styles.aiAnalyzeButton}
                                title="נתח לזיהוי AI"
                              >
                                <AlertCircle size={14} />
                                <span>נתח</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {session.status !== 'completed' && (
                      <span className={styles.aiNotAvailable}>-</span>
                    )}
                  </td>
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