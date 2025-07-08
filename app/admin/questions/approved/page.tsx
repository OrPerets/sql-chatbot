"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, FileText, Filter, Download, RotateCcw } from 'lucide-react';
import styles from './page.module.css';
import config from '../../../config';

const SERVER_BASE = config.serverUrl;

interface ApprovedQuestion {
  id: number;
  question: string;
  expected_keywords: string[];
  difficulty: string;
  solution_example: string;
  points: number;
  approved: boolean;
  approvedAt: string;
  approvedBy?: string;
}

const ApprovedQuestionsPage: React.FC = () => {
  const [questions, setQuestions] = useState<ApprovedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem("currentUser");
    if (!storedUser) {
      router.push('/login');
      return;
    }

    const user = JSON.parse(storedUser);
    const adminEmails = ["liorbs89@gmail.com", "eyalh747@gmail.com", "orperets11@gmail.com", "roeizer@shenkar.ac.il", "r_admin@gmail.com"];
    const isAdmin = adminEmails.includes(user.email);
    
    if (!isAdmin) {
      setError('אין לך הרשאת גישה לעמוד זה');
      setTimeout(() => {
        router.push('/login');
      }, 3000);
      return;
    }

    fetchApprovedQuestions();
  }, [router]);

  const fetchApprovedQuestions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${SERVER_BASE}/api/questions/approved`);
      if (!response.ok) {
        throw new Error('Failed to fetch approved questions');
      }
      const data = await response.json();
      console.log('Fetched approved questions:', data);
      setQuestions(data);
    } catch (err) {
      console.error('Error fetching approved questions:', err);
      setError('שגיאה בטעינת השאלות המאושרות');
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return '#48bb78';
      case 'medium': return '#ed8936';
      case 'hard': return '#e53e3e';
      default: return '#718096';
    }
  };

  const getDifficultyText = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 'קל';
      case 'medium': return 'בינוני';
      case 'hard': return 'קשה';
      default: return difficulty;
    }
  };

  const formatSqlSolution = (solution: string) => {
    return solution
      .replace(/\bSELECT\b/gi, '\nSELECT')
      .replace(/\bFROM\b/gi, '\nFROM')
      .replace(/\bWHERE\b/gi, '\nWHERE')
      .replace(/\bJOIN\b/gi, '\nJOIN')
      .replace(/\bLEFT JOIN\b/gi, '\nLEFT JOIN')
      .replace(/\bRIGHT JOIN\b/gi, '\nRIGHT JOIN')
      .replace(/\bINNER JOIN\b/gi, '\nINNER JOIN')
      .replace(/\bON\b/gi, '\nON')
      .replace(/\bGROUP BY\b/gi, '\nGROUP BY')
      .replace(/\bHAVING\b/gi, '\nHAVING')
      .replace(/\bORDER BY\b/gi, '\nORDER BY')
      .replace(/\bAND\b/gi, '\n  AND')
      .replace(/\bOR\b/gi, '\n  OR')
      .trim();
  };

  const filteredQuestions = filter === 'all' 
    ? questions 
    : questions.filter(q => q.difficulty.toLowerCase() === filter);

  const exportToCSV = () => {
    const csvContent = [
      ['מספר שאלה', 'רמת קושי', 'השאלה', 'הפתרון', 'נקודות', 'תאריך אישור'],
      ...filteredQuestions.map(q => [
        q.id,
        getDifficultyText(q.difficulty),
        `"${q.question.replace(/"/g, '""')}"`,
        `"${q.solution_example.replace(/"/g, '""')}"`,
        q.points,
        new Date(q.approvedAt).toLocaleDateString('he-IL')
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `approved_questions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Add handler to unapprove a question
  const handleUnapprove = async (questionId: number) => {
    if (!window.confirm('האם אתה בטוח שברצונך להחזיר שאלה זו לסטטוס לא מאושר?')) return;
    try {
      setLoading(true);
      const response = await fetch(`${SERVER_BASE}/api/questions/${questionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: false, approvedAt: null })
      });
      if (!response.ok) throw new Error('Failed to unapprove question');
      await fetchApprovedQuestions();
    } catch (err) {
      alert('שגיאה בהחזרת השאלה לסטטוס לא מאושר');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>טוען שאלות מאושרות...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button 
          onClick={() => router.push('/admin/questions')}
          className={styles.backButton}
        >
          <ArrowLeft size={20} />
          חזרה לאישור שאלות
        </button>
        <div className={styles.headerTitle}>
          <CheckCircle size={24} />
          <h1>שאלות מאושרות לבחינה</h1>
        </div>
        <div className={styles.headerActions}>
          <button 
            onClick={exportToCSV}
            className={styles.exportButton}
            disabled={filteredQuestions.length === 0}
          >
            <Download size={20} />
            ייצא לאקסל
          </button>
          <div className={styles.headerInfo}>
            <span>
              {filteredQuestions.length} מתוך {questions.length} שאלות
            </span>
          </div>
        </div>
      </div>

      {/* Statistics - moved to top, KPI row style, no title */}
      {questions.length > 0 && (
        <div className={styles.statisticsContainer} style={{ marginTop: 0 }}>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>סה״כ שאלות מאושרות</span>
              <span className={styles.statValue}>{questions.length}</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>שאלות קלות</span>
              <span className={styles.statValue} style={{ color: getDifficultyColor('easy') }}>
                {questions.filter(q => q.difficulty === 'easy').length}
              </span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>שאלות בינוניות</span>
              <span className={styles.statValue} style={{ color: getDifficultyColor('medium') }}>
                {questions.filter(q => q.difficulty === 'medium').length}
              </span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>שאלות קשות</span>
              <span className={styles.statValue} style={{ color: getDifficultyColor('hard') }}>
                {questions.filter(q => q.difficulty === 'hard').length}
              </span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>סה״כ נקודות</span>
              <span className={styles.statValue} style={{ color: '#805ad5', fontWeight: 'bold' }}>
                {questions.reduce((total, q) => total + (q.points || 0), 0)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && <div className={styles.errorMessage}>{error}</div>}

      {/* Filters */}
      <div className={styles.filtersContainer}>
        <div className={styles.filterGroup}>
          <Filter size={20} />
          <span>סינון לפי רמת קושי:</span>
          <div className={styles.filterButtons}>
            <button 
              onClick={() => setFilter('all')}
              className={`${styles.filterButton} ${filter === 'all' ? styles.activeFilter : ''}`}
            >
              הכל
            </button>
            <button 
              onClick={() => setFilter('easy')}
              className={`${styles.filterButton} ${filter === 'easy' ? styles.activeFilter : ''}`}
              style={{ borderColor: getDifficultyColor('easy') }}
            >
              קל
            </button>
            <button 
              onClick={() => setFilter('medium')}
              className={`${styles.filterButton} ${filter === 'medium' ? styles.activeFilter : ''}`}
              style={{ borderColor: getDifficultyColor('medium') }}
            >
              בינוני
            </button>
            <button 
              onClick={() => setFilter('hard')}
              className={`${styles.filterButton} ${filter === 'hard' ? styles.activeFilter : ''}`}
              style={{ borderColor: getDifficultyColor('hard') }}
            >
              קשה
            </button>
          </div>
        </div>
      </div>

      {/* Questions Table */}
      <div className={styles.tableContainer}>
        {filteredQuestions.length === 0 ? (
          <div className={styles.noQuestions}>
            <FileText size={48} />
            <h2>אין שאלות מאושרות</h2>
            <p>לא נמצאו שאלות מאושרות{filter !== 'all' ? ` ברמת קושי "${getDifficultyText(filter)}"` : ''}</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.questionsTable}>
              <thead>
                <tr>
                  <th className={styles.columnId}>מס׳</th>
                  <th className={styles.columnDifficulty}>רמת קושי</th>
                  <th className={styles.columnQuestion}>השאלה</th>
                  <th className={styles.columnSolution}>הפתרון</th>
                  <th className={styles.columnPoints}>נקודות</th>
                  <th className={styles.columnDate}>תאריך אישור</th>
                  <th className={styles.columnUnapprove}>החזר לשאלות לא מאושרות</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuestions.map((question) => (
                  <tr key={question.id} className={styles.questionRow}>
                    <td className={styles.cellId}>
                      <span className={styles.questionNumber}>#{question.id}</span>
                    </td>
                    <td className={styles.cellDifficulty}>
                      <span 
                        className={styles.difficultyBadge}
                        style={{ backgroundColor: getDifficultyColor(question.difficulty) }}
                      >
                        {getDifficultyText(question.difficulty)}
                      </span>
                    </td>
                    <td className={styles.cellQuestion}>
                      <div className={styles.questionText}>
                        {question.question}
                      </div>
                    </td>
                    <td className={styles.cellSolution}>
                      <pre className={styles.solutionCode}>
                        {formatSqlSolution(question.solution_example)}
                      </pre>
                    </td>
                    <td className={styles.cellPoints}>
                      <span className={styles.pointsBadge}>{question.points}</span>
                    </td>
                    <td className={styles.cellDate}>
                      <span className={styles.dateText}>
                        {new Date(question.approvedAt).toLocaleDateString('he-IL')}
                      </span>
                    </td>
                    <td className={styles.cellUnapprove}>
                      <button
                        className={styles.unapproveButton}
                        title="החזר לשאלות לא מאושרות"
                        onClick={() => handleUnapprove(question.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <RotateCcw size={18} color="#e53e3e" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApprovedQuestionsPage; 