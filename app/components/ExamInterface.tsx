"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './ExamInterface.module.css';
import config from '../config';
import Editor from '@monaco-editor/react';
import { generateBrowserFingerprint } from '../utils/browserFingerprint';
import { ExamSecurity } from '../utils/examSecurity';

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
  id: string;
}

interface ExamInterfaceProps {
  examSession: ExamSession;
  user: User;
  onComplete: (results: any) => void;
}

// Updated exam structure configuration
const EXAM_STRUCTURE = {
  easy: { count: 6, timePerQuestion: 6 * 60 }, // 6 minutes in seconds
  medium: { count: 3, timePerQuestion: 9 * 60 }, // 9 minutes in seconds
  hard: { count: 4, timePerQuestion: 14 * 60 } // 14 minutes in seconds
};

const ALGEBRA_SYMBOLS = [
  { symbol: 'σ', label: 'Select' },
  { symbol: 'π', label: 'Project' },
  { symbol: '∪', label: 'Union' },
  { symbol: '−', label: 'Difference' },
  { symbol: '×', label: 'Cartesian Product' },
  { symbol: 'ρ', label: 'Rename' },
  { symbol: 'Ω', label: 'Intersection' },
  { symbol: '⨝', label: 'Join' },
  { symbol: '÷', label: 'Division' },
];

function containsAlgebraQuestion(text: string) {
  return text.includes('אלגברה') && text.includes('יחסית');
}

const AlgebraSymbolBar = ({ onInsert }: { onInsert: (symbol: string) => void }) => (
  <div className={styles.algebraBar}>
    {ALGEBRA_SYMBOLS.map((item) => (
      <button
        key={item.symbol}
        type="button"
        className={styles.algebraButton}
        title={item.label}
        onClick={() => onInsert(item.symbol)}
      >
        {item.symbol}
      </button>
    ))}
  </div>
);

const ExamInterface: React.FC<ExamInterfaceProps> = ({ examSession, user, onComplete }) => {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [studentAnswer, setStudentAnswer] = useState('');
  const [timeElapsed, setTimeElapsed] = useState(0); // elapsed seconds
  const [maxTime, setMaxTime] = useState(360); // Will be set based on difficulty
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [difficulty, setDifficulty] = useState('easy');
  const [questionStartTime, setQuestionStartTime] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [examCompleted, setExamCompleted] = useState(false);
  const [examResults, setExamResults] = useState(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [timerVisible, setTimerVisible] = useState(true);
  
  // Typing speed tracking
  const [typingStartTime, setTypingStartTime] = useState<Date | null>(null);
  const [lastTypingTime, setLastTypingTime] = useState<Date | null>(null);
  const [typingEvents, setTypingEvents] = useState<Array<{timestamp: Date, event: string}>>([]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const questionStartTimeRef = useRef<Date>(new Date());
  const firstQuestionLoadedRef = useRef(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Database schema data - Israeli Air Force Management System
  const databaseSchema = [
    {
      name: 'AirBases',
      nameHe: 'בסיסי חיל האוויר',
      columns: [
        { name: 'base_id', type: 'מזהה ייחודי של הבסיס' },
        { name: 'base_name', type: 'שם הבסיס (רמת דוד, חצרים)' },
        { name: 'base_code', type: 'קוד הבסיס (3 אותיות)' },
        { name: 'location', type: 'אזור גיאוגרפי' },
        { name: 'established_year', type: 'שנת הקמה' },
        { name: 'runways_count', type: 'מספר מסלולי נחיתה' },
        { name: 'personnel_capacity', type: 'מספר מקסימלי של אנשי צוות' }
      ]
    },
    {
      name: 'Squadrons',
      nameHe: 'טייסות',
      columns: [
        { name: 'squadron_id', type: 'מזהה ייחודי של הטייסת' },
        { name: 'squadron_name', type: 'שם הטייסת (טייסת הנץ)' },
        { name: 'squadron_number', type: 'מספר הטייסת ההיסטורי' },
        { name: 'base_id', type: 'הבסיס הבית (מפתח זר)' },
        { name: 'aircraft_type', type: 'סוג כלי הטיס העיקרי' },
        { name: 'mission_type', type: 'התמחות עיקרית' },
        { name: 'active_pilots', type: 'מספר הטייסים הפעילים' }
      ]
    },
    {
      name: 'Pilots',
      nameHe: 'טייסים',
      columns: [
        { name: 'pilot_id', type: 'מזהה ייחודי של הטייס' },
        { name: 'pilot_name', type: 'שם פרטי ומשפחה' },
        { name: 'rank', type: 'דרגה צבאית' },
        { name: 'squadron_id', type: 'הטייסת (מפתח זר)' },
        { name: 'experience_years', type: 'שנות ניסיון בטיסה' },
        { name: 'flight_hours', type: 'שעות טיסה מצטברות' },
        { name: 'salary', type: 'משכורת חודשית' }
      ]
    },
    {
      name: 'Aircraft',
      nameHe: 'כלי טיס',
      columns: [
        { name: 'aircraft_id', type: 'מזהה ייחודי של כלי הטיס' },
        { name: 'aircraft_type', type: 'סוג כלי הטיס (F-16I, F-35I)' },
        { name: 'tail_number', type: 'מספר זנב ייחודי' },
        { name: 'squadron_id', type: 'הטייסת (מפתח זר)' },
        { name: 'manufacture_year', type: 'שנת ייצור' },
        { name: 'flight_hours_total', type: 'שעות טיסה מצטברות' },
        { name: 'status', type: 'מצב תפעולי נוכחי' }
      ]
    },
    {
      name: 'Weapons',
      nameHe: 'כלי נשק ותחמושת',
      columns: [
        { name: 'weapon_id', type: 'מזהה ייחודי של כלי הנשק' },
        { name: 'weapon_name', type: 'שם כלי הנשק (פייתון 5, דרבי)' },
        { name: 'weapon_type', type: 'קטגוריית כלי הנשק' },
        { name: 'range_km', type: 'טווח יעיל מרבי בק"מ' },
        { name: 'cost_per_unit', type: 'עלות ליחידה באלפי ש"ח' },
        { name: 'stock_quantity', type: 'כמות יחידות במלאי' },
        { name: 'storage_base_id', type: 'הבסיס בו מאוחסן (מפתח זר)' }
      ]
    },
    {
      name: 'Missions',
      nameHe: 'משימות ותפעול',
      columns: [
        { name: 'mission_id', type: 'מזהה ייחודי של המשימה' },
        { name: 'mission_name', type: 'שם המשימה' },
        { name: 'mission_type', type: 'סוג המשימה' },
        { name: 'squadron_id', type: 'הטייסת המבצעת (מפתח זר)' },
        { name: 'pilot_id', type: 'הטייס הראשי (מפתח זר)' },
        { name: 'aircraft_id', type: 'כלי הטיס (מפתח זר)' },
        { name: 'start_date', type: 'תאריך ושעת תחילה' },
        { name: 'mission_status', type: 'סטטוס נוכחי' }
      ]
    },
    {
      name: 'Maintenance',
      nameHe: 'תחזוקה',
      columns: [
        { name: 'maintenance_id', type: 'מזהה ייחודי של התחזוקה' },
        { name: 'aircraft_id', type: 'כלי הטיס (מפתח זר)' },
        { name: 'maintenance_type', type: 'סוג התחזוקה' },
        { name: 'start_date', type: 'תאריך תחילת התחזוקה' },
        { name: 'end_date', type: 'תאריך סיום התחזוקה' },
        { name: 'cost', type: 'עלות התחזוקה באלפי ש"ח' }
      ]
    }
  ];

  // Schema Sidebar Component
  const SchemaSidebar = () => (
    <div className={styles.schemaSidebar}>
      <div className={styles.sidebarHeader}>
        <h3 className={styles.sidebarTitle}>מערכת ניהול חיל האוויר</h3>
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
            <h4 className={styles.notesTitle}>יחסים בין הטבלאות:</h4>
            <ul className={styles.notesList}>
              <li>כל בסיס מכיל מספר טייסות (יחס 1:N)</li>
              <li>כל טייס משרת בטייסת אחת ובבסיס אחד (יחסי N:1)</li>
              <li>כל כלי טיס משויך לטייסת אחת (יחס N:1)</li>
              <li>כלי נשק מאוחסנים בבסיסים שונים (יחס N:1)</li>
              <li>כל משימה כוללת טייסת, טייס וכלי טיס ספציפיים (יחסי N:1)</li>
              <li>כל כלי טיס עובר תחזוקות מרובות (יחס 1:N)</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );

  // Determine difficulty and time limit based on question index
  const getDifficultyForQuestion = (questionIndex: number) => {
    if (questionIndex < EXAM_STRUCTURE.easy.count) {
      return 'easy';
    } else if (questionIndex < EXAM_STRUCTURE.easy.count + EXAM_STRUCTURE.medium.count) {
      return 'medium';
    } else {
      return 'hard';
    }
  };

  // Auto-save function
  const autoSaveAnswer = useCallback(async () => {
    if (!currentQuestion || !studentAnswer.trim()) return;
    
    try {
      const endTime = new Date();
      const timeSpent = Math.floor((endTime.getTime() - questionStartTimeRef.current.getTime()) / 1000);
      
      // Calculate typing speed metrics
      const typingSpeed = typingEvents.length > 1 ? 
        (typingEvents.length - 1) / ((endTime.getTime() - (typingStartTime || endTime).getTime()) / 1000) : 0;
      
      await fetch(`${SERVER_BASE}/exam/${examSession.examId}/auto-save`, {
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
          timeSpent: timeSpent,
          typingSpeed: typingSpeed,
          typingEvents: typingEvents,
          startTime: questionStartTimeRef.current.toISOString(),
          endTime: endTime.toISOString(),
          isAutoSave: true
        }),
      });
    } catch (error) {
      console.error('Error auto-saving answer:', error);
    }
  }, [currentQuestion, currentQuestionIndex, examSession.examId, studentAnswer, difficulty, user, typingEvents, typingStartTime]);

  // Load the current question
  const loadQuestion = useCallback(async (questionIndex: number) => {
    console.log(`Loading question ${questionIndex}`);
    setIsLoading(true);
    setError('');
    
    try {
      const questionDifficulty = getDifficultyForQuestion(questionIndex);
      const timeLimit = EXAM_STRUCTURE[questionDifficulty].timePerQuestion;
      
      // Generate browser fingerprint for security validation
      const browserFingerprint = generateBrowserFingerprint();
      
      // Include student ID and browser fingerprint for security validation
      const response = await fetch(`${SERVER_BASE}/exam/${examSession.examId}/question/${questionIndex}?studentId=${user.id}&difficulty=${questionDifficulty}&browserFingerprint=${encodeURIComponent(JSON.stringify(browserFingerprint))}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle security-related errors
        if (response.status === 403) {
          setError(errorData.message || 'הגישה נחסמה מסיבות אבטחה');
          return;
        }
        
        throw new Error(errorData.error || 'Failed to load question');
      }

      const data = await response.json();
      console.log(`Question ${questionIndex} loaded:`, data.question);
      setCurrentQuestion(data.question);
      setDifficulty(questionDifficulty);
      setMaxTime(timeLimit);
      setQuestionStartTime(new Date());
      questionStartTimeRef.current = new Date();
      setTimeElapsed(0);
      setStudentAnswer('');
      
      // Reset typing tracking
      setTypingStartTime(null);
      setLastTypingTime(null);
      setTypingEvents([]);
    } catch (error) {
      console.error('Error loading question:', error);
      setError('Failed to load question. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [examSession.examId, user.id]);

  // Load first question on mount
  useEffect(() => {
    console.log('ExamInterface mounted, loading first question');
    if (!firstQuestionLoadedRef.current) {
      loadQuestion(0);
      firstQuestionLoadedRef.current = true;
    }
  }, []); // Only run once on mount

  // Handle typing events for speed tracking
  const handleTyping = useCallback((value: string) => {
    const now = new Date();
    setStudentAnswer(value);
    
    if (!typingStartTime) {
      setTypingStartTime(now);
    }
    
    setLastTypingTime(now);
    setTypingEvents(prev => [...prev, { timestamp: now, event: 'typing' }]);
    
    // Clear existing auto-save timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    // Set new auto-save timeout (save after 5 seconds of no typing)
    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveAnswer();
    }, 5000);
  }, [typingStartTime, autoSaveAnswer]);

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

      // Calculate typing speed metrics
      const typingSpeed = typingEvents.length > 1 ? 
        (typingEvents.length - 1) / ((endTime.getTime() - (typingStartTime || endTime).getTime()) / 1000) : 0;

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
          typingSpeed: typingSpeed,
          typingEvents: typingEvents,
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
  }, [currentQuestion, currentQuestionIndex, examSession.examId, examSession.totalQuestions, studentAnswer, difficulty, loadQuestion, onComplete, typingEvents, typingStartTime]);

  // Timer effect
  useEffect(() => {
    if (timeElapsed < maxTime && !examCompleted) {
      timerRef.current = setTimeout(() => {
        setTimeElapsed(timeElapsed + 1);
      }, 1000);
    } else if (timeElapsed >= maxTime && !examCompleted) {
      // Time's up - auto submit
      handleSubmitAnswer();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [timeElapsed, maxTime, examCompleted, handleSubmitAnswer]);

  // Cleanup auto-save timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

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

      // Clear security info from localStorage - exam is completed
      ExamSecurity.clearExamInfo();

      setExamCompleted(true);
      setExamResults(results);
      onComplete(results);
    } catch (error) {
      console.error('Error completing exam:', error);
      setError('שגיאה בסיום העבודה. אנא פנה לתמיכה.');
    }
  };

  if (examCompleted && examResults) {
    return (
      <div className={styles.resultsContainer}>
        <h2 className={styles.resultsTitle}>העבודה הושלמה! 🎉</h2>
        
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
              <div className={styles.timerSliderContainer}>
                <div className={styles.timerSlider}>
                  <div 
                    className={styles.timerSliderFill}
                    style={{ width: `${(timeElapsed / maxTime) * 100}%` }}
                  />
                </div>
                <div className={styles.timerText}>
                  {formatTime(timeElapsed)} / {formatTime(maxTime)}
                </div>
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
                <div className={styles.sqlEditorContainer}>
                  <Editor
                    height="200px"
                    defaultLanguage="sql"
                    value={studentAnswer}
                    onChange={handleTyping}
                    onMount={(editor, monaco) => {
                      // Try to increase the space between line numbers and code
                      editor.updateOptions({ lineNumbersMinChars: 5 });
                      // Additionally, inject custom CSS for more control
                      const style = document.createElement('style');
                      style.innerHTML = `.monaco-editor .margin { padding-left: 2.5em !important; }`;
                      document.head.appendChild(style);
                    }}
                    options={{
                      readOnly: isSubmitting,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 14,
                      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                      theme: 'vs-dark',
                      wordWrap: 'on',
                      lineNumbers: 'on',
                      folding: false,
                      lineDecorationsWidth: 0,
                      lineNumbersMinChars: 3,
                      renderLineHighlight: 'all',
                      selectOnLineNumbers: true,
                      roundedSelection: false,
                      scrollbar: {
                        vertical: 'visible',
                        horizontal: 'visible',
                        verticalScrollbarSize: 8,
                        horizontalScrollbarSize: 8,
                      },
                      contextmenu: false,
                      quickSuggestions: false,
                      suggestOnTriggerCharacters: false,
                      acceptSuggestionOnCommitCharacter: false,
                      acceptSuggestionOnEnter: 'off',
                      tabCompletion: 'off',
                      wordBasedSuggestions: false,
                      parameterHints: {
                        enabled: false,
                      },
                      hover: {
                        enabled: false,
                      },
                      links: false,
                      colorDecorators: false,
                      lightbulb: {
                        enabled: false,
                      },
                      codeActionsOnSave: {},
                      codeActions: {
                        enabled: false,
                      },
                    }}
                  />
                  {containsAlgebraQuestion(currentQuestion.question) && (
                    <AlgebraSymbolBar onInsert={(symbol) => {
                      // @ts-ignore
                      const monaco: any = window.monaco;
                      // Insert symbol at cursor position in Monaco editor
                      const editor = monaco && monaco.editor && monaco.editor.getEditors && monaco.editor.getEditors()[0];
                      if (editor) {
                        const selection = editor.getSelection();
                        editor.executeEdits('', [
                          {
                            range: selection,
                            text: symbol,
                            forceMoveMarkers: true,
                          },
                        ]);
                        editor.focus();
                      } else {
                        setStudentAnswer((prev) => prev + symbol);
                      }
                    }} />
                  )}
                </div>
                
                <div className={styles.actionButtons}>
                  <button
                    onClick={handleSubmitAnswer}
                    className={styles.submitButton}
                    disabled={isSubmitting || !studentAnswer.trim()}
                  >
                    {isSubmitting ? 'שולח...' : 'הגש תשובה'}
                  </button>
                  <div className={styles.studentGuidance}>
                    בהנחה ואינך יודע את התשובה, סמן את האות X
                  </div>
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