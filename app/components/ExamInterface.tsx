"use client";

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import styles from './ExamInterface.module.css';
import config from '../config';
import Editor from '@monaco-editor/react';
import { generateBrowserFingerprint } from '../utils/browserFingerprint';
import { ExamSecurity } from '../utils/examSecurity';
import { ExamMetricsTracker, ComprehensiveMetrics } from '../utils/examMetricsTracker';

// NUCLEAR OPTION: Database schema outside component to prevent re-renders
const DATABASE_SCHEMA = [
  {
    name: 'Couriers',
    nameHe: 'שליחים',
    columns: [
      { name: 'courier_id', type: 'מזהה ייחודי' },
      { name: 'full_name', type: 'שם מלא' },
      { name: 'vehicle_type', type: 'סוג רכב (אופניים, קטנוע, רכב)' },
      { name: 'rating', type: 'דירוג ממוצע' },
      { name: 'employment_date', type: 'תאריך התחלת עבודה' }
    ]
  },
  {
    name: 'Customers',
    nameHe: 'לקוחות',
    columns: [
      { name: 'customer_id', type: 'מזהה ייחודי' },
      { name: 'full_name', type: 'שם מלא' },
      { name: 'city', type: 'עיר מגורים' },
      { name: 'registration_date', type: 'תאריך הרשמה' },
      { name: 'vip_status', type: 'סטטוס VIP (כן/לא)' }
    ]
  },
  {
    name: 'Restaurants',
    nameHe: 'מסעדות',
    columns: [
      { name: 'restaurant_id', type: 'מזהה ייחודי' },
      { name: 'name', type: 'שם המסעדה' },
      { name: 'location', type: 'כתובת מלאה' },
      { name: 'cuisine_type', type: 'סוג מטבח' },
      { name: 'open_hours', type: 'שעות פתיחה' }
    ]
  },
  {
    name: 'Orders',
    nameHe: 'הזמנות',
    columns: [
      { name: 'order_id', type: 'מזהה ייחודי' },
      { name: 'order_time', type: 'שעת ההזמנה' },
      { name: 'delivery_time', type: 'שעת המשלוח בפועל' },
      { name: 'delay_minutes', type: 'עיכוב בדקות' },
      { name: 'cost', type: 'עלות' },
      { name: 'courier_id', type: 'מפתח זר לCouriers' },
      { name: 'customer_id', type: 'מפתח זר לCustomers' },
      { name: 'restaurant_id', type: 'מפתח זר לRestaurants' }
    ]
  },
  {
    name: 'CourierShifts',
    nameHe: 'משמרות שליחים',
    columns: [
      { name: 'courier_id', type: 'מפתח זר ל־Couriers' },
      { name: 'shift_date', type: 'תאריך המשמרת' },
      { name: 'start_time', type: 'שעת התחלה' },
      { name: 'end_time', type: 'שעת סיום' },
      { name: 'dispatch_center_id', type: 'מפתח זר לDispatchCenters' }
    ]
  },
  {
    name: 'DispatchCenters',
    nameHe: 'מרכזי שילוח',
    columns: [
      { name: 'dispatch_center_id', type: 'מזהה ייחודי (מפתח ראשי)' },
      { name: 'region', type: 'אזור גאוגרפי' },
      { name: 'manager_name', type: 'שם מנהל' }
    ]
  },
  {
    name: 'Complaints',
    nameHe: 'תלונות לקוח',
    columns: [
      { name: 'complaint_id', type: 'מזהה ייחודי (מפתח ראשי)' },
      { name: 'order_id', type: 'מפתח זר לOrders' },
      { name: 'reason', type: 'סיבת התלונה' },
      { name: 'resolved_flag', type: 'האם נפתרה' },
      { name: 'compensation_amount', type: 'פיצוי כספי' }
    ]
  }
];

declare global {
  interface Window {
    html2pdf?: any;
  }
}

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
  isResuming?: boolean;
  resumeData?: {
    totalTimeSpent: number;
    answeredQuestions: number;
    answers: any[];
    currentQuestionData?: {
      currentAnswer: string;
      timeSpent: number;
    };
  };
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
  hard: { count: 3, timePerQuestion: 14 * 60 }, // 14 minutes in seconds
  algebra: { count: 1, timePerQuestion: 14 * 60 } // 12 minutes in seconds
};

// CRITICAL: Correct exam question randomization structure
// BACKEND MUST IMPLEMENT THE FOLLOWING SEQUENCE:
// Question 1: ALWAYS easy (guaranteed)
// Questions 2-12: RANDOM shuffle of 5 easy + 3 medium + 3 hard (11 questions total)
// Question 13: ALWAYS algebra (guaranteed)
// 
// CURRENT ISSUE: Backend is giving questions in blocks instead of randomized:
// - Questions 1-6: all easy (WRONG - should be only question 1)
// - Questions 7-9: all medium (WRONG - should be randomized in positions 2-12) 
// - Questions 10-13: all hard (WRONG - should be randomized + algebra at position 13)
//
// TOTAL: 13 questions (1 easy + 11 randomized + 1 algebra)

// Configuration object to send to backend for proper randomization
const EXAM_RANDOMIZATION_CONFIG = {
  totalQuestions: 13,
  structure: {
    position1: { type: 'easy', fixed: true }, // Always easy
    positions2to12: { // 11 questions randomized
      easy: 5,
      medium: 3, 
      hard: 3,
      randomized: true
    },
    position13: { type: 'algebra', fixed: true } // Always algebra
  },
  preventDuplicates: true, // Ensure no duplicate questions in same exam
  difficultyDistribution: {
    easy: 6,    // 1 fixed + 5 randomized
    medium: 3,  // 3 randomized
    hard: 3,    // 3 randomized  
    algebra: 1  // 1 fixed
  }
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
  { symbol: '∧', label: 'And' },
  { symbol: '∨', label: 'Or' },
];



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
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [extraTimePercentage, setExtraTimePercentage] = useState(0);
  const [extraTimeLoaded, setExtraTimeLoaded] = useState(false);
  
  // Comprehensive metrics tracking
  const metricsTrackerRef = useRef<ExamMetricsTracker | null>(null);
  const [comprehensiveMetrics, setComprehensiveMetrics] = useState<ComprehensiveMetrics | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const questionStartTimeRef = useRef<Date>(new Date());
  const firstQuestionLoadedRef = useRef(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scenarioModalScrollRef = useRef<number>(0);
  const modalContentRef = useRef<HTMLDivElement>(null);




    // AGGRESSIVE FIX: Completely isolated sidebar component
  const SchemaSidebar = memo((props: { 
    visible: boolean; 
    onToggle: () => void; 
    onOpenModal: () => void; 
  }) => {
    const [scrollPos, setScrollPos] = useState(0);
    const contentRef = useRef<HTMLDivElement>(null);
    
    // Restore scroll position on re-render
    useEffect(() => {
      if (contentRef.current && props.visible) {
        contentRef.current.scrollTop = scrollPos;
      }
    });
    
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      setScrollPos(e.currentTarget.scrollTop);
    };

    const downloadScenarioPDF = () => {
      const link = document.createElement('a');
      link.href = '/DB.pdf';
      link.download = 'Wolt_Delivery_Database_Schema.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    return (
      <div className={styles.schemaSidebar}>
        <div className={styles.sidebarHeader}>
          <h3 className={styles.sidebarTitle}>מערכת ניהול משלוחים</h3>
          <button 
            className={styles.toggleSidebarBtn}
            onClick={props.onToggle}
            title={props.visible ? 'הסתר סרגל צד' : 'הצג סרגל צד'}
          >
            {props.visible ? '←' : '→'}
          </button>
        </div>
      
        {/* Database Button */}
        <div className={styles.sidebarButtons}>
          <button 
            className={styles.scenarioButton}
            onClick={props.onOpenModal}
            title="פתח / סגור בסיס נתונים"
          >
            בסיס נתונים
          </button>
          
          {/* PDF Download Button */}
          <button 
            className={styles.pdfDownloadButton}
            onClick={downloadScenarioPDF}
            title="הורדת קובץ PDF"
          >
            להורדת קובץ PDF
          </button>
        </div>
        
        {props.visible && (
          <div 
            ref={contentRef}
            className={styles.sidebarContent}
            onScroll={handleScroll}
                     >
            {DATABASE_SCHEMA.map((table, index) => (
              <div key={index} className={styles.tableCard} title={`לחץ לראות פרטי טבלה: ${table.nameHe}`}>
                <div className={styles.tableHeader}>
                  <span className={styles.tableName}>{table.name}</span>
                  <span className={styles.tableNameHe}>({table.nameHe})</span>
                  <span className={styles.expandIcon}>👁️</span>
                </div>
                
                {/* Tooltip with column details - shows on hover */}
                <div className={styles.tableTooltip}>
                  <div className={styles.tooltipContent}>
                    <h4>{table.name} - {table.nameHe}</h4>
                    <div className={styles.tooltipColumns}>
                      {table.columns.map((column, colIndex) => (
                        <div key={colIndex} className={styles.tooltipColumn}>
                          <span className={styles.tooltipColumnName}>{column.name}</span>
                          <span className={styles.tooltipColumnType}>{column.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {/* <div className={styles.sidebarNotes}>
              <h4 className={styles.notesTitle}>יחסים בין הטבלאות:</h4>
              <ul className={styles.notesList}>
                <li>כל בסיס מכיל מספר טייסות (יחס 1:N)</li>
                <li>כל טייס משרת בטייסת אחת (יחס N:1)</li>
                <li>כל טייסת ממוקמת בבסיס אחד (יחס N:1)</li>
                <li>כל כלי טיס משויך לטייסת אחת (יחס N:1)</li>
                <li>כלי נשק מאוחסנים בבסיסים שונים (יחס N:1)</li>
                <li>כל משימה כוללת טייסת ספציפית (יחס 1:1)</li>
                <li>כל משימה כוללת טייס ספציפי (יחס 1:1)</li>
                <li>כל משימה כוללת כלי טיס ספציפי (יחס 1:1)</li>
                <li>כל כלי טיס עובר תחזוקות מרובות (יחס 1:N)</li>
              </ul>
            </div> */}
          </div>
        )}
      </div>
    );
  });

  // Scenario Modal Component
  const ScenarioModal = () => {
    if (!showScenarioModal) return null;

    const handleClose = () => setShowScenarioModal(false);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    // Handle scroll position restoration and saving
    useEffect(() => {
      const modal = modalContentRef.current;
      if (modal && showScenarioModal) {
        // Restore scroll position when modal opens (single attempt)
        if (scenarioModalScrollRef.current > 0) {
          setTimeout(() => {
            if (modal) {
              modal.scrollTop = scenarioModalScrollRef.current;
            }
          }, 100);
        }
        
        // Save scroll position when modal closes
        return () => {
          if (modal) {
            scenarioModalScrollRef.current = modal.scrollTop;
          }
        };
      }
    }, [showScenarioModal]);



    return (
      <div className={styles.modalOverlay} onClick={handleClose}>
        <div 
          ref={modalContentRef}
          className={styles.modalContent} 
          onClick={(e) => e.stopPropagation()} 
          onKeyDown={handleKeyDown}
        >
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>תרחיש: מערכת ניהול משלוחים - Wolt</h2>
            <button className={styles.modalClose} onClick={handleClose}>
              ❌
            </button>
          </div>
          
          <div className={styles.modalBody}>
            <div className={styles.scenarioContent}>
              <div className={styles.scenarioDescription}>
                <div className={styles.scenarioColumns}>
                  <div className={styles.scenarioColumn}>
                    <p>
                      <strong>היסטוריה והקמה:</strong><br />
                      Wolt היא חברת שליחויות בינלאומית שהוקמה בהלסינקי, פינלנד, בשנת 2014, והחלה לפעול בישראל בשנת 2018. מאז כניסתה לשוק המקומי, Wolt פועלת בעשרות ערים בישראל.
                    </p>
                    
                    <p>
                      <strong>שירותי החברה:</strong><br />
                      החברה מציעה שירות משלוחים מהיר ממסעדות, סופרמרקטים וחנויות קמעונאיות באמצעות שליחים עצמאיים, ומתמחה במתן חוויית משתמש איכותית.
                    </p>
                    
                    <p>
                      <strong>פיתוח טכנולוגי:</strong><br />
                      כדי לשפר את התפעול ולהבטיח חוויית משתמש איכותית, Wolt פיתחה מערכת טכנולוגית לניהול הזמנות ומשלוחים בזמן אמת.
                    </p>
                    
                    <p>
                      <strong>מעקב ובקרה:</strong><br />
                      המערכת עוקבת אחר זמני הכנה, זמני משלוח, זמינות שליחים, משמרות, תלונות לקוח ופרמטרים לוגיסטיים נוספים.
                    </p>
                  </div>
                  
                  <div className={styles.scenarioColumn}>
                    <p>
                      <strong>אתגרים מרכזיים:</strong><br />
                      אחד האתגרים המרכזיים עמו מתמודדת החברה הוא ניהול עומסים בזמני שיא: עיכובים באיסוף ובהגעה, חוסר תיאום בין זמינות שליחים לשעות פעילות המסעדות.
                    </p>
                    
                    <p>
                      <strong>בעיות תפעוליות:</strong><br />
                      פערים בין הביקוש להזמנות לבין מספר השליחים הפעילים, ריבוי תלונות מצד לקוחות על עיכובים חוזרים, שירות לקוי או שליחים שלא השלימו את המשלוח.
                    </p>
                    
                    <p>
                      <strong>מערכת מסד הנתונים:</strong><br />
                      מערכת מסד הנתונים של Wolt פותחה בשנת 2018 ועברה שדרוגים משמעותיים בשנים 2020, 2022, ו-2024 להתמודדות עם הגידול בנפח ההזמנות.
                    </p>
                    
                    <p>
                      <strong>תחומי פעילות המערכת:</strong>
                    </p>
                    <ul>
                      <li>ניהול הזמנות ומעקב בזמן אמת</li>
                      <li>ניהול משמרות וזמינות שליחים</li>
                      <li>מעקב אחר ביצועים ודירוגי שליחים</li>
                      <li>ניהול תלונות לקוחות ופיצויים</li>
                      <li>תיאום בין מסעדות למרכזי שילוח</li>
                      <li>ניתוח נתונים לשיפור התפעול</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className={styles.modalTablesGrid}>
                {DATABASE_SCHEMA.map((table, index) => (
                  <div key={index} className={styles.modalTableCard}>
                    <h3 className={styles.modalTableName}>{table.name} ({table.nameHe})</h3>
                    <div className={styles.modalTableSchema}>
                      {table.columns.map((column, colIndex) => (
                        <div key={colIndex} className={styles.modalColumn}>
                          <span className={styles.modalColumnType}>{column.type}</span>
                          <span className={styles.modalColumnName}>{column.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className={styles.modalDbNotes}>
                <h3 className={styles.modalSectionTitle}>יחסים בין הטבלאות</h3>
                <ul className={styles.modalNotesList}>
                  <li>כל הזמנה משויכת לשליח אחד (יחס N:1)</li>
                  <li>כל הזמנה משויכת ללקוח אחד (יחס N:1)</li>
                  <li>כל הזמנה משויכת למסעדה אחת (יחס N:1)</li>
                  <li>שליח יכול לעבוד במשמרות מרובות (יחס 1:N)</li>
                  <li>כל משמרת מתבצעת במרכז שילוח אחד (יחס N:1)</li>
                  <li>מרכז שילוח מנהל מספר משמרות (יחס 1:N)</li>
                  <li>תלונה מתייחסת להזמנה ספציפית (יחס N:1)</li>
                  <li>לקוח יכול להגיש מספר תלונות (יחס 1:N)</li>
                  <li>מסעדה יכולה לקבל מספר הזמנות (יחס 1:N)</li>
                  <li>מפתח מורכב: CourierShifts (courier_id, shift_date)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Difficulty is now determined by the backend and received in the response

  // Auto-save function
  const autoSaveAnswer = useCallback(async () => {
    if (!currentQuestion || !studentAnswer.trim()) return;
    
    try {
      const endTime = new Date();
      const timeSpent = Math.floor((endTime.getTime() - questionStartTimeRef.current.getTime()) / 1000);
      
      // Get interim metrics for auto-save (not finalized)
      const interimMetrics = metricsTrackerRef.current?.finalizeMetrics(false, studentAnswer, difficulty);
      
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
          // Legacy fields for backward compatibility
          typingSpeed: interimMetrics?.typingPatterns.charactersPerSecond || 0,
          typingEvents: interimMetrics?.keystrokeEvents || [],
          startTime: questionStartTimeRef.current.toISOString(),
          endTime: endTime.toISOString(),
          isAutoSave: true,
          // Comprehensive metrics
          comprehensiveMetrics: interimMetrics
        }),
      });
    } catch (error) {
      console.error('Error auto-saving answer:', error);
    }
  }, [currentQuestion, currentQuestionIndex, examSession.examId, studentAnswer, difficulty, user]);

  // Load the current question
  const loadQuestion = useCallback(async (questionIndex: number, resumeData?: any) => {
    console.log(`Loading question ${questionIndex}`, resumeData ? 'with resume data' : '');
    setIsLoading(true);
    setError('');
    
    try {
      // Generate browser fingerprint for security validation
      const browserFingerprint = generateBrowserFingerprint();
      
      // Include student ID and browser fingerprint for security validation
      const response = await fetch(`${SERVER_BASE}/exam/${examSession.examId}/question/${questionIndex}?studentId=${user.id}&browserFingerprint=${encodeURIComponent(JSON.stringify(browserFingerprint))}`);
      
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
      console.log(`Question ${questionIndex} loaded:`, data.question, `difficulty: ${data.difficulty}`);
      setCurrentQuestion(data.question);
      
      // Safely handle difficulty value with fallback
      const validDifficulties = ['easy', 'medium', 'hard', 'algebra'];
      const safeDifficulty = validDifficulties.includes(data.difficulty) ? data.difficulty : 'easy';
      
      // Debug logging for difficulty issues
      if (data.difficulty !== safeDifficulty) {
        console.warn(`Invalid difficulty received from server: "${data.difficulty}", using fallback: "${safeDifficulty}"`);
      }
      
      console.log(`📊 Setting difficulty to: "${safeDifficulty}" for question ${questionIndex}`);
      setDifficulty(safeDifficulty); // Use the safe difficulty value
      
      // Debug logging for algebra questions
      if (safeDifficulty === 'algebra') {
        console.log('🧮 ALGEBRA QUESTION DETECTED - Algebra buttons should appear!');
        console.log('🧮 AlgebraSymbolBar should be rendered with these symbols:', ALGEBRA_SYMBOLS);
      }
      
      // Recalculate time limit with the safe difficulty
      const serverBaseTimeLimit = EXAM_STRUCTURE[safeDifficulty].timePerQuestion;
      const factor = 1 + (extraTimePercentage / 100);
      const serverTimeLimit = Math.round(serverBaseTimeLimit * factor);
      setMaxTime(serverTimeLimit);
      
      // Handle state restoration for resumed exams
      let restoredAnswer = '';
      let timeSpentOnQuestion = 0;
      
      if (examSession.isResuming || resumeData) {
        try {
          // First check if there's resume data provided
          if (resumeData && resumeData.currentAnswer) {
            restoredAnswer = resumeData.currentAnswer;
            timeSpentOnQuestion = resumeData.timeSpent || 0;
            console.log(`Restored state from resume data: answer="${restoredAnswer}", timeSpent=${timeSpentOnQuestion}s`);
          } else {
            // Check for auto-saved answer for this question
            const autoSaveResponse = await fetch(`${SERVER_BASE}/exam/${examSession.examId}/auto-save/${questionIndex}?studentId=${user.id}`);
            if (autoSaveResponse.ok) {
              const autoSaveData = await autoSaveResponse.json();
              if (autoSaveData.studentAnswer) {
                restoredAnswer = autoSaveData.studentAnswer;
                timeSpentOnQuestion = autoSaveData.timeSpent || 0;
                console.log(`Restored auto-saved answer for question ${questionIndex}: "${restoredAnswer}", timeSpent=${timeSpentOnQuestion}s`);
              }
            }
          }
        } catch (error) {
          console.log('No auto-save data found for this question, starting fresh');
        }
      }
      
      // Set the restored answer and time
      setStudentAnswer(restoredAnswer);
      setTimeElapsed(timeSpentOnQuestion);
      
      // Set start time accounting for already spent time
      const now = new Date();
      const adjustedStartTime = new Date(now.getTime() - (timeSpentOnQuestion * 1000));
      setQuestionStartTime(adjustedStartTime);
      questionStartTimeRef.current = adjustedStartTime;
      
      console.log(`Question ${questionIndex} state restored:`, {
        timeSpent: timeSpentOnQuestion,
        answerLength: restoredAnswer.length,
        maxTime: serverTimeLimit,
        timeElapsed: timeSpentOnQuestion,
        isResuming: examSession.isResuming,
        hasResumeData: !!resumeData
      });
      
      // Initialize comprehensive metrics tracker for new question
      if (metricsTrackerRef.current) {
        metricsTrackerRef.current.cleanup();
      }
      metricsTrackerRef.current = new ExamMetricsTracker(
        data.question.id.toString(),
        user.id.toString(),
        examSession.examId
      );
    } catch (error) {
      console.error('Error loading question:', error);
      setError('Failed to load question. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [examSession.examId, user.id, examSession.isResuming, extraTimePercentage]);

  // Fetch extra time for student
  useEffect(() => {
    const fetchExtraTime = async () => {
      try {
        const response = await fetch(`/api/exam/extraTime/${user.id}?t=${Date.now()}`, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        if (response.ok) {
          const data = await response.json();
          setExtraTimePercentage(data.percentage || 0);
        } else {
          // If request fails, use default 0%
          setExtraTimePercentage(0);
        }
      } catch (error) {
        console.error('Error fetching extra time:', error);
        // If fetch fails, use default 0%
        setExtraTimePercentage(0);
      } finally {
        setExtraTimeLoaded(true);
      }
    };
    fetchExtraTime();
  }, [user.id]);

  // Load first question only after extraTimePercentage is fetched and ready
  useEffect(() => {
    if (!firstQuestionLoadedRef.current && extraTimeLoaded) {
      // If this is a resumed exam, start from the current question index
      const startingQuestionIndex = examSession.isResuming ? examSession.currentQuestionIndex : 0;
      setCurrentQuestionIndex(startingQuestionIndex);
      
      // Pass resume data if available
      const resumeData = examSession.isResuming && examSession.resumeData?.currentQuestionData 
        ? examSession.resumeData.currentQuestionData 
        : undefined;
      
      loadQuestion(startingQuestionIndex, resumeData);
      firstQuestionLoadedRef.current = true;
    }
  }, [extraTimeLoaded, loadQuestion, examSession.isResuming, examSession.currentQuestionIndex, examSession.resumeData]);

  // Update maxTime only when currentQuestion, extraTimeLoaded, and extraTimePercentage are ready
  useEffect(() => {
    if (currentQuestion && extraTimeLoaded) {
      // Safely handle difficulty value with fallback
      const validDifficulties = ['easy', 'medium', 'hard', 'algebra'];
      const safeDifficulty = validDifficulties.includes(difficulty) ? difficulty : 'easy';
      
      // Debug logging to track difficulty issues
      if (difficulty !== safeDifficulty) {
        console.warn(`Invalid difficulty received: "${difficulty}", using fallback: "${safeDifficulty}"`);
      }
      
      const baseTimeLimit = EXAM_STRUCTURE[safeDifficulty].timePerQuestion;
      const factor = 1 + (extraTimePercentage / 100);
      const timeLimit = Math.round(baseTimeLimit * factor);
      setMaxTime(timeLimit);
      setTimeElapsed(0); // Reset timer only when question or extra time changes
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion, extraTimeLoaded, extraTimePercentage, difficulty]);

  // Handle typing events - now handled by comprehensive metrics tracker
  const handleTyping = useCallback((value: string) => {
    setStudentAnswer(value);
    
    // Clear existing auto-save timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    // Set new auto-save timeout (save after 5 seconds of no typing)
    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveAnswer();
    }, 5000);
  }, [autoSaveAnswer]);

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
      case 'algebra': return '#8b5cf6';
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

      // Finalize comprehensive metrics
      const finalMetrics = metricsTrackerRef.current?.finalizeMetrics(isCorrect, studentAnswer, difficulty);

      // Save the answer with comprehensive metrics
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
          // Legacy fields for backward compatibility
          typingSpeed: finalMetrics?.typingPatterns.charactersPerSecond || 0,
          typingEvents: finalMetrics?.keystrokeEvents || [],
          startTime: questionStartTimeRef.current.toISOString(),
          endTime: endTime.toISOString(),
          // Comprehensive metrics
          comprehensiveMetrics: finalMetrics
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
  }, [currentQuestion, currentQuestionIndex, examSession.examId, examSession.totalQuestions, studentAnswer, difficulty, loadQuestion, onComplete]);

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

  // Cleanup metrics tracker on unmount
  useEffect(() => {
    return () => {
      if (metricsTrackerRef.current) {
        metricsTrackerRef.current.cleanup();
      }
    };
  }, []);

  // Cleanup auto-save timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // EXAM SECURITY: Block copy/paste operations at document level
  useEffect(() => {
    const blockClipboardOperations = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      console.log(`${e.type} operation blocked for exam security`);
    };

    const blockKeyboardShortcuts = (e: KeyboardEvent) => {
      // Block common clipboard shortcuts
      if ((e.ctrlKey || e.metaKey) && (
        e.key === 'c' || e.key === 'C' ||  // Copy
        e.key === 'v' || e.key === 'V' ||  // Paste
        e.key === 'x' || e.key === 'X' ||  // Cut
        e.key === 'a' || e.key === 'A'     // Select All
      )) {
        e.preventDefault();
        e.stopPropagation();
        console.log(`Keyboard shortcut ${e.key} blocked for exam security`);
      }

      // Block Shift+Insert (another common paste shortcut)
      if (e.shiftKey && e.key === 'Insert') {
        e.preventDefault();
        e.stopPropagation();
        console.log('Shift+Insert paste blocked for exam security');
      }

      // Block Ctrl+Insert (copy) and Shift+Delete (cut) - less common but possible
      if ((e.ctrlKey && e.key === 'Insert') || (e.shiftKey && e.key === 'Delete')) {
        e.preventDefault();
        e.stopPropagation();
        console.log(`Insert/Delete clipboard operation blocked for exam security`);
      }
      
      // Block F12 (Developer Tools), Ctrl+Shift+I, Ctrl+U (View Source)
      if (e.key === 'F12' || 
          ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') ||
          ((e.ctrlKey || e.metaKey) && e.key === 'u')) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Developer tools access blocked for exam security');
      }
    };

    const blockContextMenu = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Context menu blocked for exam security');
    };

    const blockDragDrop = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Drag and drop blocked for exam security');
    };

    const blockMiddleClick = (e: MouseEvent) => {
      if (e.button === 1) { // Middle mouse button
        e.preventDefault();
        // Don't use stopPropagation to allow scrolling
        console.log('Middle-click paste blocked for exam security');
      }
    };

    // Add event listeners to document
    document.addEventListener('copy', blockClipboardOperations);
    document.addEventListener('paste', blockClipboardOperations);
    document.addEventListener('cut', blockClipboardOperations);
    document.addEventListener('keydown', blockKeyboardShortcuts);
    document.addEventListener('contextmenu', blockContextMenu);
    document.addEventListener('drop', blockDragDrop);
    document.addEventListener('dragover', blockDragDrop);
    document.addEventListener('dragenter', blockDragDrop);
    // Only block middle click on mouse down to prevent scroll interference
    document.addEventListener('mousedown', blockMiddleClick);

    // Cleanup function
    return () => {
      document.removeEventListener('copy', blockClipboardOperations);
      document.removeEventListener('paste', blockClipboardOperations);
      document.removeEventListener('cut', blockClipboardOperations);
      document.removeEventListener('keydown', blockKeyboardShortcuts);
      document.removeEventListener('contextmenu', blockContextMenu);
      document.removeEventListener('drop', blockDragDrop);
      document.removeEventListener('dragover', blockDragDrop);
      document.removeEventListener('dragenter', blockDragDrop);
      document.removeEventListener('mousedown', blockMiddleClick);
    };
  }, []); // Run once on mount

  const completeExam = async () => {
    try {
      // § final results
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
      <div className={styles.resultsContainer} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <h2 className={styles.resultsTitle} style={{ fontSize: '2.5rem', margin: '0', textAlign: 'center' }}>העבודה הוגשה ונשמרה בהצלחה</h2>
      </div>
    );
  }

  if (!extraTimeLoaded) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p className={styles.loadingText}>טוען זמן נוסף...</p>
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
      case 'algebra': return 'אלגברה יחסית';
      default: return diff;
    }
  };



  const downloadScenarioHTML = () => {
    const modal = modalContentRef.current;
    if (modal && showScenarioModal) {
      const html = `<!DOCTYPE html><html lang="he"><head><meta charset='utf-8'><title>תרחיש: מערכת ניהול משלוחים - Wolt</title><style>body{font-family:Arial,sans-serif;direction:rtl;background:#f8fafc;margin:0;padding:2em;}h2{color:#131137;}p,li{color:#374151;}ul{padding-right:1.5em;}div{box-sizing:border-box;}@media(max-width:600px){body{padding:0.5em;}}</style></head><body>${modal.innerHTML}</body></html>`;
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'תרחיש_מערכת_ניהול_משלוחים_Wolt.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      alert('יש לפתוח את התרחיש (בסיס נתונים) לפני הורדת HTML.');
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
            {examSession.isResuming && (
              <span className={styles.resumeIndicator}>
                {examSession.resumeData?.answeredQuestions > 0 
                  ? ` (המשך - ${examSession.resumeData.answeredQuestions} שאלות נענו)`
                  : ' (המשך)'}
              </span>
            )}
          </span>
        </div>

        <div className={styles.studentIdSection}>
          <div className={styles.studentIdDisplay}>
            <span className={styles.studentIdLabel}>ת.ז:</span>
            <span className={styles.studentIdValue}>{user.id}</span>
          </div>
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
                  {extraTimePercentage > 0 && (
                    <div className={styles.extraTimeIndicator}>
                      <div className={styles.originalTime}>
                        <span className={styles.originalTimeLabel}>זמן מקורי:</span>
                        <span className={styles.originalTimeValue}>
                          {formatTime(Math.round(EXAM_STRUCTURE[['easy', 'medium', 'hard', 'algebra'].includes(difficulty) ? difficulty : 'easy'].timePerQuestion))}
                        </span>
                      </div>
                      <div className={styles.extraTimeDisplay}>
                        <span className={styles.extraTimeLabel}>+{extraTimePercentage}%</span>
                        <span className={styles.newTimeLabel}>תוספת זמן</span>
                      </div>
                    </div>
                  )}
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
        <SchemaSidebar 
          visible={sidebarVisible}
          onToggle={() => {
            setSidebarVisible(!sidebarVisible);
            metricsTrackerRef.current?.trackSidebarToggle();
          }}
          onOpenModal={() => {
            setShowScenarioModal(true);
            metricsTrackerRef.current?.trackModalOpen();
          }}
        />
        
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
                {/* Security Notice */}
               
                <label className={styles.answerLabel}>
                  {difficulty === 'algebra' ? 'התשובה שלך באלגברת יחסים:' : 'התשובה שלך ב-SQL:'}
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

                      // EXAM SECURITY: Disable copy/paste functionality
                      // Override keyboard shortcuts for copy/paste/cut
                      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC, () => {
                        // Block Ctrl+C (copy)
                        console.log('Copy action blocked for exam security');
                      });
                      
                      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, () => {
                        // Block Ctrl+V (paste)
                        console.log('Paste action blocked for exam security');
                      });
                      
                      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX, () => {
                        // Block Ctrl+X (cut)
                        console.log('Cut action blocked for exam security');
                      });

                      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyA, () => {
                        // Block Ctrl+A (select all) to prevent mass copying
                        console.log('Select all action blocked for exam security');
                      });

                      // Block Shift+Insert (common paste shortcut)
                      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Insert, () => {
                        // Block Shift+Insert (paste)
                        console.log('Shift+Insert paste blocked for exam security');
                      });

                      // Block Ctrl+Insert (copy) and Shift+Delete (cut)
                      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Insert, () => {
                        // Block Ctrl+Insert (copy)
                        console.log('Ctrl+Insert copy blocked for exam security');
                      });

                      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Delete, () => {
                        // Block Shift+Delete (cut)
                        console.log('Shift+Delete cut blocked for exam security');
                      });

                      // Block right-click context menu with copy/paste options
                      const editorElement = editor.getDomNode();
                      if (editorElement) {
                        editorElement.addEventListener('contextmenu', (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        });

                        // Block clipboard events at the DOM level
                        editorElement.addEventListener('copy', (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('Copy event blocked for exam security');
                        });

                        editorElement.addEventListener('paste', (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('Paste event blocked for exam security');
                        });

                        editorElement.addEventListener('cut', (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('Cut event blocked for exam security');
                        });

                        // Add additional keydown listener for Insert/Delete key combinations
                        editorElement.addEventListener('keydown', (e) => {
                          // Block all Insert and Delete key combinations
                          if ((e.shiftKey && e.key === 'Insert') || 
                              (e.ctrlKey && e.key === 'Insert') || 
                              (e.shiftKey && e.key === 'Delete')) {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log(`${e.key} clipboard operation blocked in editor for exam security`);
                          }
                        });
                      }
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
                      // EXAM SECURITY: Additional clipboard restrictions
                      find: {
                        addExtraSpaceOnTop: false,
                        autoFindInSelection: 'never',
                        seedSearchStringFromSelection: 'never',
                      },
                      // Disable selections that could enable copying
                      selectionHighlight: false,
                      occurrencesHighlight: false,
                    }}
                  />
                  {difficulty === 'algebra' && (
                    <AlgebraSymbolBar onInsert={(symbol) => {
                      console.log('🧮 Algebra symbol inserted:', symbol);
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
      
      {/* Scenario Modal */}
      <ScenarioModal />
    </div>
  );
};

export default ExamInterface; 