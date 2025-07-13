"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Clock, User, CheckCircle, XCircle } from 'lucide-react';
import styles from './page.module.css';

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
}

const ExamGradingPage: React.FC = () => {
  const [examSessions, setExamSessions] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'in_progress' | 'timeout'>('all');
  const router = useRouter();

  useEffect(() => {
    fetchExamSessions();
  }, []);

  const fetchExamSessions = async () => {
    try {
      setLoading(true);
      // Fetch directly from the deployed backend
      const response = await fetch('https://mentor-server-theta.vercel.app/admin/exam-sessions');
      if (!response.ok) {
        throw new Error('Failed to fetch exam sessions');
      }
      const data = await response.json();
      setExamSessions(data);
    } catch (err) {
      console.error('Error fetching exam sessions:', err);
      setError('Failed to load exam sessions');
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
      session.studentEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (session.studentName && session.studentName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (session.studentId && session.studentId.includes(searchTerm));
    
    const matchesStatus = statusFilter === 'all' || session.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Debug logging
  console.log('examSessions', examSessions);
  console.log('filteredSessions', filteredSessions);

  const handleGradeExam = (examId: string) => {
    router.push(`/admin/exam-grading/${examId}`);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>טוען בחינות...</div>
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
          בדיקה וציונים - בחינות
        </h1>
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
          </select>
        </div>
      </div>

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
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filteredSessions.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.noData}>
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
                        {session.score}/{session.totalQuestions}
                      </span>
                    ) : (
                      '-'
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