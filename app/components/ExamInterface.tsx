"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './ExamInterface.module.css';
import config from '../config';

const SERVER_BASE = config.serverUrl;

interface Question {
  id: number;
  question: string;
  difficulty: string;
  solution_example?: string;
  expected_keywords?: string[];
}

interface ExamSession {
  examId: string;
  studentEmail: string;
  examTitle: string;
  startTime: string;
  totalQuestions: number;
  currentQuestionIndex: number;
}

interface User {
  email?: string;
  name: string;
  id: number;
}

interface ExamInterfaceProps {
  examSession: ExamSession;
  user: User;
  onComplete: (results: any) => void;
}

const ExamInterface: React.FC<ExamInterfaceProps> = ({ examSession, user, onComplete }) => {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [studentAnswer, setStudentAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [difficulty, setDifficulty] = useState('easy');
  const [questionStartTime, setQuestionStartTime] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [examCompleted, setExamCompleted] = useState(false);
  const [examResults, setExamResults] = useState(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [timerVisible, setTimerVisible] = useState(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const questionStartTimeRef = useRef<Date>(new Date());

  // Database schema data
  const databaseSchema = [
    {
      name: 'employees',
      nameHe: 'עובדים',
      columns: [
        { name: 'id', type: 'מזהה ייחודי' },
        { name: 'name', type: 'שם העובד' },
        { name: 'salary', type: 'משכורת' },
        { name: 'department_id', type: 'מזהה מחלקה' },
        { name: 'manager_id', type: 'מזהה מנהל' }
      ]
    },
    {
      name: 'customers',
      nameHe: 'לקוחות',
      columns: [
        { name: 'id', type: 'מזהה ייחודי' },
        { name: 'name', type: 'שם הלקוח' },
        { name: 'age', type: 'גיל' },
        { name: 'city', type: 'עיר מגורים' }
      ]
    },
    {
      name: 'orders',
      nameHe: 'הזמנות',
      columns: [
        { name: 'id', type: 'מזהה ייחודי' },
        { name: 'customer_id', type: 'מזהה לקוח' },
        { name: 'city', type: 'עיר' },
        { name: 'order_date', type: 'תאריך הזמנה' },
        { name: 'total_amount', type: 'סכום כולל' }
      ]
    },
    {
      name: 'products',
      nameHe: 'מוצרים',
      columns: [
        { name: 'id', type: 'מזהה ייחודי' },
        { name: 'name', type: 'שם המוצר' },
        { name: 'category', type: 'קטגוריה' },
        { name: 'price', type: 'מחיר' }
      ]
    },
    {
      name: 'departments',
      nameHe: 'מחלקות',
      columns: [
        { name: 'id', type: 'מזהה ייחודי' },
        { name: 'department_name', type: 'שם המחלקה' }
      ]
    }
  ];

  // Schema Sidebar Component
  const SchemaSidebar = () => (
    <div className={styles.schemaSidebar}>
      <div className={styles.sidebarHeader}>
        <h3 className={styles.sidebarTitle}>מבנה מסד הנתונים</h3>
        <button 
          className={styles.toggleSidebarBtn}
          onClick={() => setSidebarVisible(!sidebarVisible)}
          title={sidebarVisible ? 'הסתר סרגל צד' : 'הצג סרגל צד'}
        >
          {sidebarVisible ? '←' : '→'}
        </button>
      </div>
      
      {sidebarVisible && (
        <div className={styles.sidebarContent}>
          {databaseSchema.map((table, index) => (
            <div key={index} className={styles.tableCard}>
              <div className={styles.tableHeader}>
                <span className={styles.tableName}>{table.name}</span>
                <span className={styles.tableNameHe}>({table.nameHe})</span>
              </div>
              <div className={styles.columnsList}>
                {table.columns.map((column, colIndex) => (
                  <div key={colIndex} className={styles.columnItem}>
                    <span className={styles.columnName}>{column.name}</span>
                    <span className={styles.columnType}>{column.type}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          <div className={styles.sidebarNotes}>
            <h4 className={styles.notesTitle}>הערות:</h4>
            <ul className={styles.notesList}>
              <li>שדות "_id" הם מפתחות זרים</li>
              <li>ניתן להשתמש בכל פונקציות SQL</li>
              <li>שימו לב לשמות הטבלאות והעמודות</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );

  // Load the current question
  const loadQuestion = useCallback(async (questionIndex: number) => {
    setIsLoading(true);
    setError('');
    
    try {
      // Include student ID to ensure different questions for different students
      const response = await fetch(`${SERVER_BASE}/exam/${examSession.examId}/question/${questionIndex}?studentId=${user.id}&difficulty=${difficulty}`);
      
      if (!response.ok) {
        throw new Error('Failed to load question');
      }

      const data = await response.json();
      setCurrentQuestion(data.question);
      setDifficulty(data.difficulty);
      setQuestionStartTime(new Date());
      questionStartTimeRef.current = new Date();
      setTimeLeft(600); // Reset timer to 10 minutes
      setStudentAnswer('');
    } catch (error) {
      console.error('Error loading question:', error);
      setError('Failed to load question. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [examSession.examId, user.id, difficulty]);

  // Load first question on mount
  useEffect(() => {
    loadQuestion(0);
  }, [loadQuestion]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'easy': return '#22c55e';
      case 'medium': return '#f59e0b';
      case 'hard': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const evaluateAnswer = (studentAnswer: string, correctAnswer: string, expectedKeywords: string[] = []) => {
    // Simple evaluation logic
    const studentLower = studentAnswer.toLowerCase().trim();
    const correctLower = correctAnswer.toLowerCase().trim();
    
    // Check if student answer contains expected keywords
    let keywordScore = 0;
    if (expectedKeywords && expectedKeywords.length > 0) {
      keywordScore = expectedKeywords.filter(keyword => 
        studentLower.includes(keyword.toLowerCase())
      ).length / expectedKeywords.length;
    }
    
    // Simple similarity check (you can enhance this with more sophisticated NLP)
    const similarityScore = studentLower.includes(correctLower.substring(0, Math.min(10, correctLower.length))) ? 0.5 : 0;
    
    return (keywordScore * 0.7 + similarityScore * 0.3) > 0.5;
  };

  const handleSubmitAnswer = useCallback(async () => {
    if (!currentQuestion) return;
    
    setIsSubmitting(true);
    
    try {
      const endTime = new Date();
      const timeSpent = Math.floor((endTime.getTime() - questionStartTimeRef.current.getTime()) / 1000);
      const isCorrect = evaluateAnswer(
        studentAnswer, 
        currentQuestion.solution_example || '', 
        currentQuestion.expected_keywords
      );

      // Save the answer
      const response = await fetch(`${SERVER_BASE}/exam/${examSession.examId}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId: user.id,
          studentName: user.name,
          questionIndex: currentQuestionIndex,
          questionId: currentQuestion.id,
          questionText: currentQuestion.question,
          difficulty: difficulty,
          studentAnswer: studentAnswer,
          correctAnswer: currentQuestion.solution_example || '',
          isCorrect: isCorrect,
          timeSpent: timeSpent,
          startTime: questionStartTimeRef.current.toISOString(),
          endTime: endTime.toISOString()
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save answer');
      }

      // Move to next question or complete exam
      const nextQuestionIndex = currentQuestionIndex + 1;
      if (nextQuestionIndex >= examSession.totalQuestions) {
        // Exam completed
        await completeExam();
      } else {
        setCurrentQuestionIndex(nextQuestionIndex);
        await loadQuestion(nextQuestionIndex);
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      setError('Failed to submit answer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [currentQuestion, currentQuestionIndex, examSession.examId, examSession.totalQuestions, studentAnswer, difficulty, onComplete]);

  // Timer effect
  useEffect(() => {
    if (timeLeft > 0 && !examCompleted) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
    } else if (timeLeft === 0 && !examCompleted) {
      // Time's up - auto submit
      handleSubmitAnswer();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [timeLeft, examCompleted, handleSubmitAnswer]);

  const completeExam = async () => {
    try {
      // Get final results
      const resultsResponse = await fetch(`${SERVER_BASE}/exam/${examSession.examId}/results`);
      const results = await resultsResponse.json();
      
      // Mark exam as completed
      await fetch(`${SERVER_BASE}/exam/${examSession.examId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          finalScore: results.statistics.accuracy
        }),
      });

      setExamCompleted(true);
      setExamResults(results);
      onComplete(results);
    } catch (error) {
      console.error('Error completing exam:', error);
      setError('שגיאה בסיום הבחינה. אנא פנה לתמיכה.');
    }
  };

  if (examCompleted && examResults) {
    return (
      <div className={styles.resultsContainer}>
        <h2 className={styles.resultsTitle}>הבחינה הושלמה! 🎉</h2>
        
        <div className={styles.scoreContainer}>
          <div className={styles.scoreCircle}>
            <span className={styles.scoreText}>
              {Math.round(examResults.statistics.accuracy)}%
            </span>
          </div>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>תשובות נכונות</span>
            <span className={styles.statValue}>{examResults.statistics.correctAnswers}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>סך הכל שאלות</span>
            <span className={styles.statValue}>{examResults.statistics.totalQuestions}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>זמן ממוצע</span>
            <span className={styles.statValue}>
              {Math.round(examResults.statistics.averageTimePerQuestion)} שניות
            </span>
          </div>
        </div>

        <div className={styles.difficultyBreakdown}>
          <h3>שאלות לפי רמת קושי</h3>
          <div className={styles.difficultyStats}>
            <div className={styles.difficultyItem}>
              <span className={styles.difficultyLabel} style={{ color: getDifficultyColor('easy') }}>
                קל
              </span>
              <span className={styles.difficultyCount}>
                {examResults.statistics.difficultyBreakdown.easy}
              </span>
            </div>
            <div className={styles.difficultyItem}>
              <span className={styles.difficultyLabel} style={{ color: getDifficultyColor('medium') }}>
                בינוני
              </span>
              <span className={styles.difficultyCount}>
                {examResults.statistics.difficultyBreakdown.medium}
              </span>
            </div>
            <div className={styles.difficultyItem}>
              <span className={styles.difficultyLabel} style={{ color: getDifficultyColor('hard') }}>
                קשה
              </span>
              <span className={styles.difficultyCount}>
                {examResults.statistics.difficultyBreakdown.hard}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>טוען שאלה...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorMessage}>{error}</div>
        <button onClick={() => setError('')} className={styles.retryButton}>
          נסה שוב
        </button>
      </div>
    );
  }

  const getDifficultyText = (diff: string) => {
    switch (diff) {
      case 'easy': return 'קל';
      case 'medium': return 'בינוני';
      case 'hard': return 'קשה';
      default: return diff;
    }
  };

  return (
    <div className={styles.examInterface}>
      {/* Header with progress and timer */}
      <div className={styles.examHeader}>
        <div className={styles.progressSection}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill}
              style={{ width: `${((currentQuestionIndex + 1) / examSession.totalQuestions) * 100}%` }}
            />
          </div>
          <span className={styles.progressText}>
            שאלה {currentQuestionIndex + 1} מתוך {examSession.totalQuestions}
          </span>
        </div>

        <div className={styles.timerSection}>
          <div className={styles.timerControls}>
            {timerVisible && (
              <div className={`${styles.timer} ${timeLeft <= 60 ? styles.timerWarning : ''}`}>
                ⏱️ {formatTime(timeLeft)}
              </div>
            )}
            <button 
              className={styles.timerToggle}
              onClick={() => setTimerVisible(!timerVisible)}
              title={timerVisible ? 'הסתר שעון' : 'הצג שעון'}
            >
              {timerVisible ? '👁️‍🗨️' : '👁️'}
            </button>
          </div>
        </div>
      </div>

      {/* Main content with sidebar and question */}
      <div className={styles.examContent}>
        <SchemaSidebar />
        
        <div className={styles.mainContent}>
          {/* Question Section */}
          {currentQuestion && (
            <div className={styles.questionSection}>
              <div className={styles.questionCard}>
                <h2 className={styles.questionTitle}>שאלה {currentQuestionIndex + 1}</h2>
                <div className={styles.questionText}>
                  {currentQuestion.question}
                </div>
              </div>

              {/* Answer Section */}
              <div className={styles.answerSection}>
                <label className={styles.answerLabel}>
                  התשובה שלך ב-SQL:
                </label>
                <textarea
                  className={styles.answerTextarea}
                  value={studentAnswer}
                  onChange={(e) => setStudentAnswer(e.target.value)}
                  placeholder="כתוב כאן את שאילתת SQL שלך..."
                  rows={8}
                  disabled={isSubmitting}
                />
                
                <div className={styles.actionButtons}>
                  <button
                    onClick={handleSubmitAnswer}
                    className={styles.submitButton}
                    disabled={isSubmitting || !studentAnswer.trim()}
                  >
                    {isSubmitting ? 'שולח...' : 'הגש תשובה'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExamInterface; 