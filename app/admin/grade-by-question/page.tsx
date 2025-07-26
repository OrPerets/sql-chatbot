"use client";

import React, { useEffect, useState, useMemo, useCallback, memo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Search, Eye, Users, CheckCircle, XCircle, Clock, Edit3, Filter, BarChart3, AlertTriangle, AlertCircle, Info, Plus, Trash2, Tag, Save, MessageSquare, Database, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './page.module.css';
import { detectAITraps, getSuspicionColor, getSuspicionIcon, createHighlightedText } from '../../utils/trapDetector';

interface Question {
  id: number;
  question: string;
  difficulty: string;
  points: number;
  approved: boolean;
  answerCount: number;
  averageScore?: number;
  answers?: StudentAnswer[];
  gradedCount?: number;
  ungradedCount?: number;
  isCompleted?: boolean;
  completionPercentage?: number;
}

interface StudentAnswer {
  examId: string;
  studentEmail: string;
  studentName?: string;
  studentId?: string;
  questionIndex: number;
  studentAnswer: string;
  timeSpent: number;
  timestamp: string;
  isCorrect: boolean;
  grade?: number;
  feedback?: string;
  examStartTime: string;
  _id?: string; // For unique identification
}

interface QuestionWithAnswers {
  question: Question;
  answers: StudentAnswer[];
  totalAnswers: number;
  gradedAnswers: number;
  averageGrade: number;
}

interface CommentBankEntry {
  _id: string;
  questionId: number;
  questionText: string;
  difficulty: string;
  score: number;
  maxScore: number;
  feedback: string;
  gradedBy: string;
  gradedAt: string;
  usageCount: number;
  lastUsed?: string;
  reduced_points?: number; // Points to subtract when applying this comment
  tag?: 'positive' | 'negative'; // Tag for tracking effectiveness
  likes?: number; // Number of likes (approvals)
  dislikes?: number; // Number of dislikes (rejections)
  userRating?: 'like' | 'dislike' | null; // Current user's rating
}

interface SchemaValidation {
  hasInvalidTables: boolean;
  hasInvalidColumns: boolean;
  invalidItems: string[];
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalQuestions: number;
  hasMore: boolean;
  questionsPerPage: number;
}

// Enhanced Question Card Component with better completion status display
const QuestionCard = memo(({ 
  question, 
  onQuestionClick, 
  getDifficultyColor, 
  getDifficultyText,
  skipCompletionData 
}: {
  question: Question;
  onQuestionClick: (id: number) => void;
  getDifficultyColor: (difficulty: string) => string;
  getDifficultyText: (difficulty: string) => string;
  skipCompletionData: boolean;
}) => {
  // Calculate unique student count for this question with debug info
  const uniqueStudentCount = useMemo(() => {
    const count = question.answers
      ? question.answers.filter((answer: any, idx: number, arr: any[]) =>
          arr.findIndex(a => a.studentEmail === answer.studentEmail) === idx
        ).length
      : (question.answerCount || 0);
    
    // Debug info only for development
    if (process.env.NODE_ENV === 'development' && question.id <= 2) {
      console.log(`📊 Q${question.id}:`, {
        total: question.answerCount,
        graded: question.gradedCount,
        completed: question.isCompleted
      });
    }
    
    return count;
  }, [question.answers, question.answerCount, question.id, skipCompletionData]);
  
  // Get completion status from backend data with enhanced display
  const completionData = useMemo(() => {
    const gradedCount = question.gradedCount || 0;
    const ungradedCount = question.ungradedCount || (uniqueStudentCount - gradedCount);
    const isCompleted = question.isCompleted || (ungradedCount === 0 && uniqueStudentCount > 0);
    const completionPercentage = uniqueStudentCount > 0 ? Math.round((gradedCount / uniqueStudentCount) * 100) : 0;
    
    return {
      isCompleted,
      completionPercentage,
      gradedCount,
      ungradedCount,
      hasAnswers: uniqueStudentCount > 0
    };
  }, [question.isCompleted, question.gradedCount, question.ungradedCount, uniqueStudentCount]);

  const handleClick = useCallback(() => {
    onQuestionClick(question.id);
  }, [question.id, onQuestionClick]);

  const getCompletionStatus = () => {
    // SIMPLIFIED: Just show basic ready-for-grading status
    if (uniqueStudentCount === 0) {
      return (
        <div className={styles.completionStatus}>
          <div className={styles.noAnswersStatus}>
            <AlertCircle size={16} />
            אין תשובות
          </div>
        </div>
      );
    }

    // Check if we have completion data for this question
    const completion = completionData || { gradedCount: 0, ungradedCount: uniqueStudentCount, isCompleted: false };
    
    if (!skipCompletionData && completion.isCompleted) {
      return (
        <div className={styles.completionStatus}>
          <div className={styles.completedStatus}>
            <CheckCircle size={16} />
            הושלם ✅ ({completion.gradedCount}/{uniqueStudentCount})
          </div>
        </div>
      );
    }
    
    if (!skipCompletionData && completion.gradedCount > 0) {
      return (
        <div className={styles.completionStatus}>
          <div className={styles.partialStatus}>
            <Clock size={16} />
            בתהליך ({completion.gradedCount}/{uniqueStudentCount})
          </div>
          <div className={styles.ungradedBadge}>
            {completion.ungradedCount} נותרו
          </div>
        </div>
      );
    }

    // Show simple ready-to-grade status in fast mode with basic info
    const hasGradedAnswers = (question.gradedCount || 0) > 0;
    const gradedInfo = hasGradedAnswers ? ` | ${question.gradedCount} נבדקו` : '';
    
    // If no answers, show clear message
    if (uniqueStudentCount === 0) {
      return (
        <div className={styles.completionStatus}>
          <div className={styles.noAnswersStatus}>
            <AlertCircle size={16} />
            אין תשובות
          </div>
        </div>
      );
    }
    
    return (
      <div className={styles.completionStatus}>
        <div className={`${styles.readyToGradeStatus} ${hasGradedAnswers ? styles.hasGradedAnswers : ''}`}>
          <Eye size={16} />
          {uniqueStudentCount} תשובות{gradedInfo}
        </div>
      </div>
    );
  };

  // Determine card styling based on completion status
  const completion = completionData || { gradedCount: 0, ungradedCount: uniqueStudentCount, isCompleted: false };
  const isCompleted = !skipCompletionData && completion.isCompleted;
  const isPartial = !skipCompletionData && completion.gradedCount > 0 && !completion.isCompleted;
  
  // In fast mode, use basic question data for styling
  const hasGradedInFastMode = skipCompletionData && question.gradedCount > 0;
  const isFullyGradedInFastMode = skipCompletionData && question.gradedCount >= uniqueStudentCount && uniqueStudentCount > 0;

  return (
    <div
      className={`${styles.questionCard} ${isCompleted || isFullyGradedInFastMode ? styles.completedQuestion : ''} ${isPartial || hasGradedInFastMode ? styles.partiallyGradedQuestion : ''}`}
      onClick={handleClick}
    >
      <div className={styles.questionHeader}>
        <div className={styles.questionId}>
          שאלה #{question.id}
          {!completionData.hasAnswers && <span className={styles.noAnswersBadge}>אין תשובות</span>}
        </div>
        <div 
          className={styles.difficultyBadge}
          style={{ backgroundColor: getDifficultyColor(question.difficulty) }}
        >
          {getDifficultyText(question.difficulty)}
        </div>
      </div>
      
      <div className={styles.questionContent}>
        <p className={styles.questionText}>
          {question.question.length > 150 
            ? `${question.question.substring(0, 150)}...` 
            : question.question}
        </p>
      </div>
      
      <div className={styles.questionFooter}>
        <div className={styles.questionPoints}>
          {question.points} נקודות
        </div>
        <div className={`${styles.answerCount} ${uniqueStudentCount === 0 ? styles.noAnswers : ''}`}>
          <Users size={16} />
          {uniqueStudentCount} תשובות
        </div>
        
        {/* Enhanced completion status */}
        {getCompletionStatus()}
        
        {question.averageScore !== undefined && question.averageScore > 0 && (
          <div className={styles.averageScore}>
            <BarChart3 size={16} />
            ממוצע: {question.averageScore}
          </div>
        )}
        <div className={styles.viewAnswersButton}>
          <Eye size={16} />
          צפה בתשובות
        </div>
      </div>
    </div>
  );
});

QuestionCard.displayName = 'QuestionCard';

// Simple cache implementation with TTL
class SimpleCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private ttl = 3 * 60 * 1000; // 3 minutes TTL (reduced for fresher data)

  set(key: string, data: any) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  get(key: string) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  clear() {
    this.cache.clear();
  }

  clearByPattern(pattern: string) {
    for (const key of Array.from(this.cache.keys())) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

const completionCache = new SimpleCache();

const GradeByQuestionPage: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]); // Cache all questions
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionWithAnswers | null>(null);
  const [loading, setLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [completionLoading, setCompletionLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard' | 'algebra'>('all');
  const [gradingStatusFilter, setGradingStatusFilter] = useState<'all' | 'completed' | 'partial' | 'ungraded'>('all');
  
  // Enhanced pagination state
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalQuestions: 0,
    hasMore: false,
    questionsPerPage: 2 // REDUCED TO 2 for immediate grading
  });
  
  // Comment bank state
  const [commentBankEntries, setCommentBankEntries] = useState<CommentBankEntry[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState({ text: '', reduced_points: 0, tag: '' as 'positive' | 'negative' | '' });
  const [editingComment, setEditingComment] = useState<CommentBankEntry | null>(null);
  
  // Current grading state
  const [currentAnswerIndex, setCurrentAnswerIndex] = useState(0);
  const [currentGrade, setCurrentGrade] = useState<number>(0);
  const [currentFeedback, setCurrentFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [processedAnswers, setProcessedAnswers] = useState<Set<string>>(new Set());
  
  // Performance state
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  // FAST MODE by default for speed, switch to detailed for accurate counts
  const [skipCompletionData, setSkipCompletionData] = useState(true);
  
  const router = useRouter();

  // Utility functions for encoding/decoding points in feedback
  const encodePointsInFeedback = (feedback: string, reducedPoints: number): string => {
    if (reducedPoints > 0) {
      return `${feedback}\n[REDUCE_POINTS:${reducedPoints}]`;
    }
    return feedback;
  };

  const decodePointsFromFeedback = (feedback: string): { feedback: string, reducedPoints: number } => {
    const pointsMatch = feedback.match(/\[REDUCE_POINTS:(\d+(\.\d+)?)\]/);
    if (pointsMatch) {
      const reducedPoints = parseFloat(pointsMatch[1]);
      const cleanFeedback = feedback.replace(/\[REDUCE_POINTS:\d+(\.\d+)?\]/, '').trim();
      return { feedback: cleanFeedback, reducedPoints };
    }
    return { feedback, reducedPoints: 0 };
  };

  const getCommentReducedPoints = (comment: CommentBankEntry): number => {
    // First try the reduced_points field, then extract from feedback
    if (comment.reduced_points !== undefined) {
      return comment.reduced_points;
    }
    const { reducedPoints } = decodePointsFromFeedback(comment.feedback);
    return reducedPoints;
  };

  const getCommentDisplayFeedback = (comment: CommentBankEntry): string => {
    const { feedback } = decodePointsFromFeedback(comment.feedback);
    return feedback;
  };

  // Database schema for validation
  const DATABASE_SCHEMA = [
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
        { name: 'squadron_name', type: 'שם הטייסת' },
        { name: 'squadron_number', type: 'מספר הטייסת' },
        { name: 'base_id', type: 'בסיס הטייסת (מפתח זר)' },
        { name: 'aircraft_type', type: 'סוג המטוס העיקרי' },
        { name: 'established_date', type: 'תאריך הקמת הטייסת' },
        { name: 'active_status', type: 'האם הטייסת פעילה' }
      ]
    },
    {
      name: 'Pilots',
      nameHe: 'טייסים',
      columns: [
        { name: 'pilot_id', type: 'מזהה ייחודי של הטייס' },
        { name: 'first_name', type: 'שם פרטי' },
        { name: 'last_name', type: 'שם משפחה' },
        { name: 'rank', type: 'דרגה צבאית' },
        { name: 'squadron_id', type: 'הטייסת (מפתח זר)' },
        { name: 'flight_hours', type: 'שעות טיסה מצטברות' },
        { name: 'specialization', type: 'התמחות' },
        { name: 'service_start_date', type: 'תאריך תחילת שירות' }
      ]
    },
    {
      name: 'Aircraft',
      nameHe: 'כלי טיס',
      columns: [
        { name: 'aircraft_id', type: 'מזהה ייחודי של כלי הטיס' },
        { name: 'aircraft_type', type: 'סוג המטוס (F-16, F-35)' },
        { name: 'tail_number', type: 'מספר זנב' },
        { name: 'squadron_id', type: 'הטייסת (מפתח זר)' },
        { name: 'manufacture_year', type: 'שנת ייצור' },
        { name: 'last_maintenance', type: 'תאריך תחזוקה אחרונה' },
        { name: 'flight_hours_total', type: 'שעות טיסה מצטברות' },
        { name: 'operational_status', type: 'סטטוס תפעולי' }
      ]
    },
    {
      name: 'Weapons',
      nameHe: 'כלי נשק ותחמושת',
      columns: [
        { name: 'weapon_id', type: 'מזהה ייחודי של כלי הנשק' },
        { name: 'weapon_name', type: 'שם כלי הנשק' },
        { name: 'weapon_type', type: 'סוג (טיל, פצצה, תותח)' },
        { name: 'base_id', type: 'בסיס אחסון (מפתח זר)' },
        { name: 'quantity_available', type: 'כמות זמינה' },
        { name: 'unit_cost', type: 'עלות יחידה באלפי ש"ח' },
        { name: 'minimum_stock', type: 'מלאי מינימום' }
      ]
    },
    {
      name: 'Missions',
      nameHe: 'משימות ותפעול',
      columns: [
        { name: 'mission_id', type: 'מזהה ייחודי של המשימה' },
        { name: 'mission_name', type: 'שם המשימה' },
        { name: 'mission_date', type: 'תאריך המשימה' },
        { name: 'squadron_id', type: 'הטייסת (מפתח זר)' },
        { name: 'pilot_id', type: 'הטייס הראשי (מפתח זר)' },
        { name: 'aircraft_id', type: 'כלי הטיס (מפתח זר)' },
        { name: 'mission_duration', type: 'משך המשימה בשעות' },
        { name: 'mission_status', type: 'סטטוס (הושלמה, בביצוע, בוטלה)' }
      ]
    },
    {
      name: 'Maintenance',
      nameHe: 'תחזוקה',
      columns: [
        { name: 'maintenance_id', type: 'מזהה ייחודי של התחזוקה' },
        { name: 'aircraft_id', type: 'כלי הטיס (מפתח זר)' },
        { name: 'maintenance_type', type: 'סוג התחזוקה' },
        { name: 'start_date', type: 'תאריך התחלה' },
        { name: 'end_date', type: 'תאריך סיום התחזוקה' },
        { name: 'cost', type: 'עלות התחזוקה באלפי ש"ח' }
      ]
    }
  ];

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

    setAllQuestions([]); // Clear cache on initial load
    fetchQuestions();
  }, [router]);

  const fetchQuestions = async (page: number = 1, preserveSelectedQuestion: boolean = false) => {
    try {
      if (page === 1) {
        setLoading(true);
      }
      setError('');
      
      console.log(`🚀 Loading questions page ${page}...`);
      
      // Check if we need to fetch new data or just paginate existing data
      const needsNewData = allQuestions.length === 0 || page === 1;
      
      let questionsToUse = allQuestions;
      
      if (needsNewData) {
        console.log('📡 Fetching fresh data from server...');
        
        // Clear relevant cache when starting fresh
        completionCache.clearByPattern('completion-');
        
        const response = await fetch(`/api/admin/questions-basic?page=1&limit=999&search=${encodeURIComponent(searchTerm)}&difficulty=${difficultyFilter}&gradingStatus=${gradingStatusFilter}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch questions');
        }
        
        const data = await response.json();
        questionsToUse = data.questions || [];
        
        // Load completion data immediately for visible questions to get accurate counts
        if (!skipCompletionData && questionsToUse.length > 0) {
          console.log('🔄 Loading real completion data for accurate counts...');
          try {
            const questionIds = questionsToUse.slice(0, 2).map(q => q.id); // Only for current page
            const completionResponse = await fetch('/api/admin/questions-completion', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ questionIds }),
            });
            
            if (completionResponse.ok) {
              const completionData = await completionResponse.json();
              questionsToUse = questionsToUse.map(question => ({
                ...question,
                ...completionData[question.id] // Merge real completion data
              }));
              console.log('✅ Updated questions with real completion data');
            } else {
              console.log('⚠️ Failed to load completion data, using server defaults');
            }
          } catch (error) {
            console.log('⚠️ Error loading completion data:', error);
          }
        }
        
        setAllQuestions(questionsToUse);
        
              console.log('📊 Fresh data loaded:', { 
        questionsCount: questionsToUse.length,
        sampleQuestion: questionsToUse[0] ? {
          id: questionsToUse[0].id,
          answerCount: questionsToUse[0].answerCount,
          gradedCount: questionsToUse[0].gradedCount,
          ungradedCount: questionsToUse[0].ungradedCount
        } : null
      });
      } else {
        console.log('📚 Using cached questions for pagination');
      }
      
      // CLIENT-SIDE PAGINATION: Always paginate on the client
      const questionsPerPage = 2;
      const startIndex = (page - 1) * questionsPerPage;
      const endIndex = startIndex + questionsPerPage;
      const paginatedQuestions = questionsToUse.slice(startIndex, endIndex);
      
      console.log(`✂️ Client-side pagination: showing questions ${startIndex + 1}-${Math.min(endIndex, questionsToUse.length)} of ${questionsToUse.length}`);
      
      // Use our manually paginated questions
      setQuestions(paginatedQuestions);
      
      // Update pagination info based on client-side pagination
      const totalQuestions = questionsToUse.length;
      const questionsPerPageValue = 2;
      const totalPages = Math.ceil(totalQuestions / questionsPerPageValue);
      
      setPagination({
        currentPage: page,
        totalPages: totalPages,
        totalQuestions: totalQuestions,
        hasMore: page < totalPages,
        questionsPerPage: questionsPerPageValue
      });
      
      console.log(`📄 Pagination updated: page ${page}/${totalPages}, showing ${paginatedQuestions.length} questions`);
      
      setLoading(false);
      
      // Skip loading completion data - we already loaded it above when fetching questions
      if (skipCompletionData) {
        console.log('⚡ Fast mode - no completion data loading');
      } else {
        console.log('📊 Using completion data loaded with questions');
      }
      
      setLastRefreshTime(new Date());
    } catch (err) {
      console.error('Error fetching questions:', err);
      setError('Failed to load questions');
      setLoading(false);
    }
  };

  const fetchCompletionDataParallel = async (questionsToUpdate: Question[], isFirstPage: boolean = false) => {
    try {
      if (isFirstPage) {
        setCompletionLoading(true);
      }
      
      const questionIds = questionsToUpdate.map(q => q.id);
      
      console.log(`📊 Loading completion data for ${questionIds.length} questions...`);
      
      // Reduced chunk size to handle API limitations
      const chunkSize = 2; // Process 2 questions at once (our page size)
      const chunks: number[][] = [];
      
      for (let i = 0; i < questionIds.length; i += chunkSize) {
        chunks.push(questionIds.slice(i, i + chunkSize));
      }
      
      // Process chunks with increased delay and retry mechanism
      const promises = chunks.map(async (chunk, index) => {
        // Add progressive delay between requests to prevent rate limiting
        const baseDelay = Math.min(index * 200, 2000); // Cap at 2 seconds
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, baseDelay));
        }
        
        return await fetchChunkWithRetry(chunk, index + 1, chunks.length);
      });
      
      // Wait for all chunks to complete
      const results = await Promise.allSettled(promises);
      
      // Merge all completion data
      const allCompletionData = results.reduce((acc, result) => {
        if (result.status === 'fulfilled') {
          return { ...acc, ...result.value };
        } else {
          console.error('❌ Chunk failed:', result.reason);
          return acc;
        }
      }, {});
      
      // Count successful vs fallback data
      const successfulCount = Object.values(allCompletionData).filter((data: any) => !data.isFallback).length;
      const fallbackCount = Object.values(allCompletionData).filter((data: any) => data.isFallback).length;
      
      if (fallbackCount > 0) {
        console.warn(`⚠️ ${fallbackCount} questions using fallback data, ${successfulCount} loaded successfully`);
        showWarningMessage(`טוען נתוני השלמה: ${successfulCount} מוצלח, ${fallbackCount} עם נתונים בסיסיים`);
      }
      
      // Update questions with completion data
      setQuestions(prevQuestions => 
        prevQuestions.map(question => {
          const completion = allCompletionData[question.id];
          return completion ? { ...question, ...completion } : question;
        })
      );
      
      console.log('✅ Completion data loading finished');
    } catch (err) {
      console.error('💥 Critical error fetching completion data:', err);
      showErrorMessage('שגיאה בטעינת נתוני השלמה - המשך בנתונים בסיסיים');
    } finally {
      if (isFirstPage) {
        setCompletionLoading(false);
      }
    }
  };

  // Enhanced chunk fetching with retry mechanism
  const fetchChunkWithRetry = async (chunk: number[], chunkIndex: number, totalChunks: number, maxRetries: number = 2): Promise<Record<number, any>> => {
    const cacheKey = `completion-${chunk.join(',')}`;
    let completionData = completionCache.get(cacheKey);
    
    if (completionData) {
      console.log(`💾 Cache hit for chunk ${chunkIndex}/${totalChunks}`);
      return completionData;
    }
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Loading chunk ${chunkIndex}/${totalChunks}, attempt ${attempt}/${maxRetries}: ${chunk.length} questions`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 40000); // 40 second timeout
        
        const response = await fetch('/api/admin/questions-completion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionIds: chunk }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          if (response.status === 400) {
            // Handle chunk size limit error
            const errorData = await response.json();
            if (errorData.suggestedChunkSize && chunk.length > errorData.suggestedChunkSize) {
              console.warn(`⚠️ Chunk too large, splitting into smaller pieces`);
              // Split chunk into smaller pieces
              const smallerChunks: number[][] = [];
              for (let i = 0; i < chunk.length; i += errorData.suggestedChunkSize) {
                smallerChunks.push(chunk.slice(i, i + errorData.suggestedChunkSize));
              }
              
              // Process smaller chunks
              const smallerResults = await Promise.allSettled(
                smallerChunks.map(smallChunk => fetchChunkWithRetry(smallChunk, chunkIndex, totalChunks, 1))
              );
              
              // Merge results
              const mergedData = smallerResults.reduce((acc, result) => {
                if (result.status === 'fulfilled') {
                  return { ...acc, ...result.value };
                }
                return acc;
              }, {});
              
              completionCache.set(cacheKey, mergedData);
              return mergedData;
            }
          }
          
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        completionData = await response.json();
        
        // Validate we got data for all requested questions
        const missingQuestions = chunk.filter(id => !completionData[id]);
        if (missingQuestions.length > 0) {
          console.warn(`⚠️ Missing data for questions: ${missingQuestions.join(', ')}`);
          // Add fallback data for missing questions
          missingQuestions.forEach(id => {
            completionData[id] = {
              id,
              gradedCount: 0,
              ungradedCount: 0,
              isCompleted: false,
              completionPercentage: 0,
              averageScore: 0,
              totalAnswers: 0,
              isFallback: true
            };
          });
        }
        
        completionCache.set(cacheKey, completionData);
        console.log(`✅ Chunk ${chunkIndex}/${totalChunks} loaded successfully`);
        return completionData;
        
      } catch (error: any) {
        console.error(`❌ Chunk ${chunkIndex} attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          // Create fallback data for all questions in this chunk
          const fallbackData: Record<number, any> = {};
          chunk.forEach(id => {
            fallbackData[id] = {
              id,
              gradedCount: 0,
              ungradedCount: 0,
              isCompleted: false,
              completionPercentage: 0,
              averageScore: 0,
              totalAnswers: 0,
              isFallback: true
            };
          });
          
          console.warn(`🔄 Using fallback data for chunk ${chunkIndex}/${totalChunks}`);
          return fallbackData;
        }
        
        // Wait before retry with exponential backoff
        const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    // Fallback - should never reach here
    return {};
  };

  const refreshQuestionCompletion = async (questionId: number) => {
    try {
      console.log(`🔄 Refreshing completion data for question ${questionId}`);
      
      // Clear cache for this question
      completionCache.clearByPattern(`${questionId}`);
      
      const response = await fetch('/api/admin/questions-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionIds: [questionId] }),
      });
      
      if (!response.ok) {
        console.error(`Failed to refresh completion data for question ${questionId}`);
        return;
      }
      
      const completionData = await response.json();
      
      // Update the specific question with new completion data
      setQuestions(prevQuestions => 
        prevQuestions.map(question => {
          if (question.id === questionId) {
            const completion = completionData[questionId];
            return completion ? { ...question, ...completion } : question;
          }
          return question;
        })
      );
      
      console.log(`✅ Refreshed completion data for question ${questionId}`);
    } catch (error) {
      console.error(`Error refreshing completion data for question ${questionId}:`, error);
    }
  };

  // Utility functions
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Enhanced question click handler
  const handleQuestionClick = useCallback((questionId: number) => {
    console.log(`🔄 User clicked question ${questionId} - showing loading immediately`);
    setQuestionsLoading(true); // Show loading immediately
    setError(''); // Clear any errors
    fetchQuestionAnswers(questionId);
  }, []);

  const fetchQuestionAnswers = async (questionId: number) => {
    const startTime = Date.now();
    let progressInterval: NodeJS.Timeout;
    
    try {
      console.log(`🔄 fetchQuestionAnswers called for question ${questionId}...`);
      console.log(`📱 Setting questionsLoading to true`);
      setQuestionsLoading(true);
      setError(''); // Clear any previous errors
      
      // Progress update every 5 seconds during loading
      progressInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        console.log(`⏱️ Still loading question ${questionId}... ${elapsed}s elapsed`);
      }, 5000);
      
      const timestamp = Date.now();
      const response = await fetch(`/api/admin/question/${questionId}/answers?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch question answers');
      }
      const data = await response.json();
      setSelectedQuestion(data);
      setCurrentAnswerIndex(0);
      
      // Initialize processedAnswers with already graded answers
      const alreadyProcessed = new Set<string>();
      if (data.answers && data.answers.length > 0) {
        // Get unique answers
        const uniqueAnswers = data.answers.filter((answer, index, self) => {
          const firstOccurrence = self.findIndex(a => 
            a.studentEmail === answer.studentEmail
          );
          return index === firstOccurrence;
        });
        
        // Add graded answers to processedAnswers set
        uniqueAnswers.forEach(answer => {
          if (answer.grade !== undefined && answer.grade !== null) {
            const answerId = `${answer.examId}-${answer.questionIndex}`;
            alreadyProcessed.add(answerId);
          }
        });
        
        setProcessedAnswers(alreadyProcessed);
        
        if (uniqueAnswers.length > 0) {
          const firstAnswer = uniqueAnswers[0];
          setCurrentGrade(firstAnswer.grade || (firstAnswer.isCorrect ? data.question.points : 0));
          setCurrentFeedback(firstAnswer.feedback || '');
        }
      } else {
        setProcessedAnswers(new Set());
      }
      
      // Load comment bank for this question
      await fetchCommentBankEntries(questionId);
      
      if (progressInterval) clearInterval(progressInterval);
      const loadTime = Date.now() - startTime;
      console.log(`✅ Successfully loaded question ${questionId} with ${data.answers?.length || 0} answers in ${loadTime}ms`);
    } catch (err) {
      if (progressInterval) clearInterval(progressInterval);
      const loadTime = Date.now() - startTime;
      console.error(`❌ Error fetching question ${questionId} after ${loadTime}ms:`, err);
      setError(`שגיאה בטעינת שאלה ${questionId}. נסה שוב או רענן את הדף.`);
    } finally {
      setQuestionsLoading(false);
    }
  };

  const fetchCommentBankEntries = async (questionId: number) => {
    try {
      setLoadingComments(true);
      const response = await fetch(`/api/admin/comment-bank?questionId=${questionId}&limit=50`);
      if (!response.ok) throw new Error('Failed to fetch comments');
      const data = await response.json();
      setCommentBankEntries(data.comments || []);
    } catch (err) {
      console.error('Error fetching comment bank entries:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  // Validate SQL answer against database schema
  const validateSchema = (answer: string): SchemaValidation => {
    const upperAnswer = answer.toUpperCase();
    let hasInvalidTables = false;
    let hasInvalidColumns = false;
    const invalidItems: string[] = [];

    // Create lookup maps for faster validation
    const validTableNames = new Set(DATABASE_SCHEMA.map(table => table.name.toUpperCase()));
    const tableColumnMap = new Map<string, Set<string>>();
    
    DATABASE_SCHEMA.forEach(table => {
      const columns = new Set(table.columns.map(col => col.name.toUpperCase()));
      tableColumnMap.set(table.name.toUpperCase(), columns);
    });

    // Find all table references in the SQL query
    const tableMatches = upperAnswer.match(/FROM\s+(\w+)|JOIN\s+(\w+)|UPDATE\s+(\w+)|INSERT\s+INTO\s+(\w+)|DELETE\s+FROM\s+(\w+)/gi);
    const referencedTables = new Set<string>();
    
    if (tableMatches) {
      tableMatches.forEach(match => {
        const tableNameMatch = match.match(/(?:FROM|JOIN|UPDATE|INTO)\s+(\w+)/i);
        if (tableNameMatch) {
          referencedTables.add(tableNameMatch[1].toUpperCase());
        }
      });
    }

    // Check for invalid tables (tables that don't exist at all)
    referencedTables.forEach(tableName => {
      if (!validTableNames.has(tableName)) {
        hasInvalidTables = true;
        invalidItems.push(`טבלה לא קיימת: ${tableName}`);
      }
    });

    // Check for invalid columns in existing tables
    DATABASE_SCHEMA.forEach(table => {
      const upperTableName = table.name.toUpperCase();
      const validColumns = tableColumnMap.get(upperTableName)!;
      
      // Check if this table is referenced in the query
      if (referencedTables.has(upperTableName) || upperAnswer.includes(upperTableName)) {
        
        // Extract SELECT clause columns when this table is used
        const selectMatch = upperAnswer.match(/SELECT\s+(.*?)\s+FROM\s+\w*/i);
        if (selectMatch) {
          const selectColumns = selectMatch[1];
          // Split by comma and clean up each column name
          const columnNames = selectColumns.split(',').map(col => {
            // Remove table prefix, whitespace, and get just the column name
            return col.trim().replace(/.*\./, '').replace(/\s+AS\s+\w+/i, '').trim();
          });
          
          columnNames.forEach(columnName => {
            const upperColumnName = columnName.toUpperCase();
            
            // Skip SQL keywords and functions
            const sqlKeywords = ['SELECT', 'FROM', 'WHERE', 'ORDER', 'GROUP', 'HAVING', 'AS', 'AND', 'OR', 'NOT', 'NULL', 'DISTINCT'];
            const sqlFunctions = ['COUNT', 'SUM', 'AVG', 'MAX', 'MIN'];
            
            // Skip if it's a keyword, function, or contains parentheses (function call)
            if (!sqlKeywords.includes(upperColumnName) && 
                !sqlFunctions.includes(upperColumnName) && 
                !upperColumnName.includes('(') && 
                upperColumnName.length > 1) {
              
              if (!validColumns.has(upperColumnName)) {
                hasInvalidColumns = true;
                invalidItems.push(`עמודה לא קיימת: ${table.nameHe}.${columnName.toLowerCase()}`);
              }
            }
          });
        }
        
        // Also check for table.column syntax
        const tableColumnPattern = new RegExp(`${upperTableName}\\.([\\w_]+)`, 'gi');
        let match;
        while ((match = tableColumnPattern.exec(upperAnswer)) !== null) {
          const columnName = match[1].toUpperCase();
          if (!validColumns.has(columnName)) {
            hasInvalidColumns = true;
            invalidItems.push(`עמודה לא קיימת: ${table.nameHe}.${columnName.toLowerCase()}`);
          }
        }
        
        // Also check for common AI-generated column names that don't exist
        const commonAIColumns = ['MAX_SPEED', 'RANGE_KM', 'FUEL_CAPACITY', 'LAST_MISSION', 'TRAINING_HOURS', 'SALARY', 'HIRE_DATE', 'BUDGET', 'COMMANDER_ID', 'SUCCESS_RATE', 'COST', 'DURATION_MINUTES'];
        commonAIColumns.forEach(aiColumn => {
          if (upperAnswer.includes(aiColumn) && !validColumns.has(aiColumn)) {
            hasInvalidColumns = true;
            invalidItems.push(`עמודה לא קיימת: ${table.nameHe}.${aiColumn.toLowerCase()}`);
          }
        });
      }
    });

    return { hasInvalidTables, hasInvalidColumns, invalidItems };
  };

  // Apply comment from bank
  const applyComment = (comment: CommentBankEntry) => {
    const pointsToReduce = getCommentReducedPoints(comment);
    const displayFeedback = getCommentDisplayFeedback(comment);
    const newGrade = Math.max(0, currentGrade - pointsToReduce);
    
    setCurrentGrade(newGrade);
    setCurrentFeedback(prev => {
      const newFeedback = prev ? `${prev}\n${displayFeedback}` : displayFeedback;
      return newFeedback;
    });

    // Mark comment as used
    markCommentAsUsed(comment._id);
  };

  const markCommentAsUsed = async (commentId: string) => {
    try {
      await fetch(`/api/admin/comment-bank/${commentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'use' }),
      });
    } catch (err) {
      console.error('Error marking comment as used:', err);
    }
  };

  // Add new comment to bank
  const addCommentToBank = async () => {
    if (!newComment.text || !selectedQuestion) return;

    // Encode points in feedback for backend compatibility
    const encodedFeedback = encodePointsInFeedback(newComment.text, newComment.reduced_points);

    const commentData = {
      questionId: selectedQuestion.question.id,
      questionText: selectedQuestion.question.question,
      difficulty: selectedQuestion.question.difficulty,
      score: currentGrade,
      maxScore: selectedQuestion.question.points,
      feedback: encodedFeedback,
      reduced_points: newComment.reduced_points, // Still send this in case backend supports it
      tag: newComment.tag || undefined,
      gradedBy: 'admin'
    };

    try {
      const response = await fetch('/api/admin/comment-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commentData),
      });

      if (!response.ok) throw new Error('Failed to save comment');
      
      // Refresh comment bank
      fetchCommentBankEntries(selectedQuestion.question.id);
      setNewComment({ text: '', reduced_points: 0, tag: '' });
      
      showSuccessMessage('הערה נוספה לבנק ההערות');
    } catch (err) {
      console.error('Error adding comment:', err);
      showErrorMessage('שגיאה בהוספת הערה');
    }
  };

  // Edit comment
  const editComment = async (comment: CommentBankEntry) => {
    if (!editingComment) return;

    try {
      // Encode points in feedback for backend compatibility
      const encodedFeedback = encodePointsInFeedback(editingComment.feedback, editingComment.reduced_points || 0);

      const response = await fetch(`/api/admin/comment-bank/${comment._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback: encodedFeedback,
          reduced_points: editingComment.reduced_points,
          tag: editingComment.tag,
        }),
      });

      if (!response.ok) throw new Error('Failed to update comment');
      
      fetchCommentBankEntries(selectedQuestion?.question.id || 0);
      setEditingComment(null);
      showSuccessMessage('הערה עודכנה');
    } catch (err) {
      console.error('Error updating comment:', err);
      showErrorMessage('שגיאה בעדכון הערה');
    }
  };

  // Delete comment
  const deleteComment = async (commentId: string) => {
    try {
      const response = await fetch(`/api/admin/comment-bank/${commentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete comment');
      
      fetchCommentBankEntries(selectedQuestion?.question.id || 0);
      showSuccessMessage('הערה נמחקה');
    } catch (err) {
      console.error('Error deleting comment:', err);
      showErrorMessage('שגיאה במחיקת הערה');
    }
  };

  // Handle "Done" button - save current answer and move to next
  const handleDoneAnswer = async () => {
    if (!selectedQuestion || currentAnswerIndex >= selectedQuestion.answers.length) return;

    const currentAnswer = selectedQuestion.answers[currentAnswerIndex];
    
    try {
      setSaving(true);
      
      // Perform schema validation for AI-suspicious answers
      const aiAnalysis = detectAITraps(currentAnswer.studentAnswer);
      const schemaValidation = validateSchema(currentAnswer.studentAnswer);
      
      let finalGrade = currentGrade;
      let finalFeedback = currentFeedback;
      
      // Auto-apply schema validation penalties for AI-suspicious answers
      if (aiAnalysis.isAISuspicious && (schemaValidation.hasInvalidTables || schemaValidation.hasInvalidColumns)) {
        finalGrade = 0;
        const schemaMessage = "יש שימוש בתשובה בעמודות / טבלאות שלא קיימות בבסיס הנתונים.";
        finalFeedback = finalFeedback ? `${finalFeedback}\n${schemaMessage}` : schemaMessage;
      }

      const response = await fetch('/api/admin/grade-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId: currentAnswer.examId,
          questionIndex: currentAnswer.questionIndex,
          grade: finalGrade,
          feedback: finalFeedback,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save grade');
      }

      // Auto-save to comment bank if feedback is provided (check for duplicates first)
      if (finalFeedback && finalFeedback.trim()) {
        try {
          // Check if this exact comment already exists in the comment bank
          const existingComment = commentBankEntries.find(comment => 
            comment.feedback === finalFeedback && 
            comment.score === finalGrade &&
            comment.questionId === selectedQuestion.question.id
          );
          
          // Only save if this exact comment doesn't already exist
          if (!existingComment) {
            await fetch('/api/admin/comment-bank', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                questionId: selectedQuestion.question.id,
                questionText: selectedQuestion.question.question,
                difficulty: selectedQuestion.question.difficulty,
                score: finalGrade,
                maxScore: selectedQuestion.question.points,
                feedback: finalFeedback,
                gradedBy: 'admin'
              }),
            });
            
            // Refresh comment bank to include the new comment
            fetchCommentBankEntries(selectedQuestion.question.id);
          }
        } catch (commentErr) {
          console.error('Error saving to comment bank:', commentErr);
        }
      }

      // Mark as processed and remove from list
      const answerId = `${currentAnswer.examId}-${currentAnswer.questionIndex}`;
      setProcessedAnswers(prev => new Set([...Array.from(prev), answerId]));
      
      // Move to next unprocessed answer
      const nextIndex = findNextUnprocessedAnswer();
      if (nextIndex !== -1) {
        setCurrentAnswerIndex(nextIndex);
        const uniqueAnswers = getUniqueAnswers();
        const nextAnswer = uniqueAnswers[nextIndex];
        setCurrentGrade(nextAnswer.grade || (nextAnswer.isCorrect ? selectedQuestion.question.points : 0));
        setCurrentFeedback(nextAnswer.feedback || '');
      } else {
        // All answers processed
        showSuccessMessage('כל התשובות לשאלה זו נבדקו!');
        // Refresh completion data for the current question only (faster than full refresh)
        await refreshQuestionCompletion(selectedQuestion.question.id);
        setSelectedQuestion(null); // Return to questions list
      }

      showSuccessMessage(`התשובה נשמרה בהצלחה`);
    } catch (err) {
      console.error('Error saving answer:', err);
      showErrorMessage('שגיאה בשמירת התשובה');
    } finally {
      setSaving(false);
    }
  };

  // Get unique answers helper function
  const getUniqueAnswers = () => {
    if (!selectedQuestion) return [];
    
    const uniqueAnswers = selectedQuestion.answers.filter((answer, index, self) => {
      // Since we're viewing a specific question, only deduplicate by student email
      const firstOccurrence = self.findIndex(a => 
        a.studentEmail === answer.studentEmail
      );
      return index === firstOccurrence;
    });
    
    return uniqueAnswers;
  };

  const findNextUnprocessedAnswer = (): number => {
    const uniqueAnswers = getUniqueAnswers();
    if (uniqueAnswers.length === 0) return -1;
    
    for (let i = 0; i < uniqueAnswers.length; i++) {
      const answer = uniqueAnswers[i];
      const answerId = `${answer.examId}-${answer.questionIndex}`;
      if (!processedAnswers.has(answerId)) {
        return i;
      }
    }
    return -1;
  };

  // Like/Dislike functionality for comments
  const rateComment = async (commentId: string, rating: 'like' | 'dislike') => {
    try {
      const response = await fetch(`/api/admin/comment-bank/${commentId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      });

      const data = await response.json();
      
      // Always update locally for immediate feedback
      setCommentBankEntries(prev => prev.map(comment => {
        if (comment._id === commentId) {
          const newComment = { ...comment };
          
          // Reset previous rating
          if (comment.userRating === 'like') {
            newComment.likes = (newComment.likes || 0) - 1;
          } else if (comment.userRating === 'dislike') {
            newComment.dislikes = (newComment.dislikes || 0) - 1;
          }
          
          // Apply new rating
          if (rating === 'like') {
            newComment.likes = (newComment.likes || 0) + 1;
          } else {
            newComment.dislikes = (newComment.dislikes || 0) + 1;
          }
          
          newComment.userRating = rating;
          return newComment;
        }
        return comment;
      }));
      
      showSuccessMessage(rating === 'like' ? 'הערה אושרה' : 'הערה נדחתה');
    } catch (err) {
      console.error('Error rating comment:', err);
      showErrorMessage('שגיאה בדירוג ההערה');
    }
  };

  const showSuccessMessage = (message: string) => {
    const successDiv = document.createElement('div');
    successDiv.innerHTML = `✅ ${message}`;
    successDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #28a745;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(successDiv);
    setTimeout(() => {
      if (successDiv.parentNode) {
        successDiv.parentNode.removeChild(successDiv);
      }
    }, 4000);
  };

  const showWarningMessage = (message: string) => {
    const warningDiv = document.createElement('div');
    warningDiv.innerHTML = `⚠️ ${message}`;
    warningDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f59e0b;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(warningDiv);
    setTimeout(() => {
      if (warningDiv.parentNode) {
        warningDiv.parentNode.removeChild(warningDiv);
      }
    }, 6000);
  };

  const showErrorMessage = (message: string) => {
    const errorDiv = document.createElement('div');
    errorDiv.innerHTML = `❌ ${message}`;
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #dc3545;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(errorDiv);
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 4000);
  };

  // Enhanced utility functions
  const getDifficultyColor = useCallback((difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return '#48bb78';
      case 'medium': return '#ed8936';
      case 'hard': return '#e53e3e';
      case 'algebra': return '#8b5cf6';
      default: return '#718096';
    }
  }, []);

  const getDifficultyText = useCallback((difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 'קל';
      case 'medium': return 'בינוני';
      case 'hard': return 'קשה';
      case 'algebra': return 'אלגברה';
      default: return difficulty;
    }
  }, []);

  // Enhanced search and filtering
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      if (searchTerm !== debouncedSearchTerm) {
        setAllQuestions([]); // Clear cache to force reload when searching
        fetchQuestions(1); // Reset to first page when searching
      }
    }, 500); // Increased debounce time for better performance
    
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Handle filter changes
  useEffect(() => {
    setAllQuestions([]); // Clear cache to force reload when filters change
    fetchQuestions(1); // Reset to first page when filtering
  }, [difficultyFilter, gradingStatusFilter]);

  // Enhanced pagination controls
  const handlePreviousPage = () => {
    if (pagination.currentPage > 1) {
      fetchQuestions(pagination.currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (pagination.currentPage < pagination.totalPages) {
      fetchQuestions(pagination.currentPage + 1);
    }
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    completionCache.clear(); // Clear all cache
    setAllQuestions([]); // Clear questions cache to force reload
    await fetchQuestions(1);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Clock size={24} />
          טוען שאלות...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorMessage}>{error}</div>
      </div>
    );
  }

  const getCurrentAnswer = () => {
    const uniqueAnswers = getUniqueAnswers();
    if (uniqueAnswers.length === 0 || currentAnswerIndex >= uniqueAnswers.length) return null;
    return uniqueAnswers[currentAnswerIndex];
  };

  const currentAnswer = getCurrentAnswer();

  return (
    <div className={styles.container}>
      {/* Enhanced Header */}
      <div className={styles.header}>
        <button 
          onClick={() => router.push('/admin')}
          className={styles.backButton}
        >
          <ArrowLeft size={20} />
          חזרה לממשק ניהול
        </button>
        <div className={styles.headerTitle}>
          <BarChart3 size={24} />
          <h1>ציונים לפי שאלה</h1>
          {completionLoading && (
            <div className={styles.completionLoadingIndicator}>
              <Clock size={16} />
              טוען נתוני השלמה...
            </div>
          )}
        </div>
        <div className={styles.headerActions}>
          <button
            onClick={() => {
              setSkipCompletionData(!skipCompletionData);
              if (!skipCompletionData) {
                // If enabling completion data, refresh to load it
                handleRefresh();
              }
            }}
            className={`${styles.toggleButton} ${skipCompletionData ? styles.active : ''}`}
                        title={skipCompletionData ? 'מצב מהיר - מציג רק מידע בסיסי על בדיקות' : 'מצב מפורט - טוען סטטוס בדיקה מלא (עלול להיות איטי)'}
          >
            {skipCompletionData ? '⚡ מהיר' : '📊 מפורט'}
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={styles.refreshButton}
          >
            <RefreshCw size={16} className={refreshing ? styles.spinning : ''} />
            {refreshing ? 'מרענן...' : 'רענן'}
          </button>
          {lastRefreshTime && (
            <div className={styles.headerInfo}>
              <div>עודכן לאחרונה:</div>
              <div className={styles.cacheInfo}>
                {lastRefreshTime.toLocaleTimeString('he-IL')}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={styles.mainContent}>
        {!selectedQuestion ? (
          /* Questions List View */
          <div className={styles.questionsView}>
            {/* Enhanced Filters */}
            <div className={styles.filters}>
              <div className={styles.searchContainer}>
                <Search size={20} />
                <input
                  type="text"
                  placeholder="חיפוש בתוכן השאלה..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
              
              <div className={styles.difficultyFilter}>
                <Filter size={16} />
                <select
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value as any)}
                  className={styles.difficultySelect}
                >
                  <option value="all">כל הקשיים</option>
                  <option value="easy">קל</option>
                  <option value="medium">בינוני</option>
                  <option value="hard">קשה</option>
                  <option value="algebra">אלגברה</option>
                </select>
              </div>

              {/* New Grading Status Filter */}
              <div className={styles.gradingStatusFilter}>
                <CheckCircle size={16} />
                <select
                  value={gradingStatusFilter}
                  onChange={(e) => setGradingStatusFilter(e.target.value as any)}
                  className={styles.gradingStatusSelect}
                >
                  <option value="all">כל הסטטוסים</option>
                  <option value="ungraded">טרם נבדקו</option>
                  <option value="partial">נבדקו חלקית</option>
                  <option value="completed">הושלמו</option>
                </select>
              </div>
              
              <div className={styles.questionCount}>
                מציג {questions.length} שאלות (עמוד {pagination.currentPage}/{pagination.totalPages})
                {skipCompletionData && <span className={styles.fastModeIndicator}>⚡ מצב מהיר</span>}
                {!skipCompletionData && <span className={styles.detailedModeIndicator}>📊 מצב מפורט</span>}
              </div>
            </div>

            {/* Questions Grid */}
            <div className={styles.questionsGrid}>
              {questions.map((question) => (
                                  <QuestionCard 
                    key={question.id}
                    question={question}
                    onQuestionClick={handleQuestionClick}
                    getDifficultyColor={getDifficultyColor}
                    getDifficultyText={getDifficultyText}
                    skipCompletionData={skipCompletionData}
                  />
              ))}
            </div>

            {/* Enhanced Pagination */}
            {pagination.totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  onClick={handlePreviousPage}
                  disabled={pagination.currentPage === 1 || refreshing}
                  className={styles.paginationButton}
                >
                  <ChevronRight size={16} />
                  הקודם
                </button>
                
                <div className={styles.paginationInfo}>
                  עמוד {pagination.currentPage} מתוך {pagination.totalPages}
                </div>
                
                <button
                  onClick={handleNextPage}
                  disabled={pagination.currentPage >= pagination.totalPages || refreshing}
                  className={styles.paginationButton}
                >
                  הבא
                  <ChevronLeft size={16} />
                </button>
              </div>
            )}

            {questions.length === 0 && !loading && (
              <div className={styles.noQuestions}>
                <FileText size={48} />
                <h3>לא נמצאו שאלות</h3>
                <p>נסה לשנות את הפילטרים או המילות חיפוש</p>
              </div>
            )}
          </div>
        ) : (
          /* Question Grading View with Sidebar - Keep existing implementation */
          <div className={styles.gradingView}>
            {questionsLoading ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                width: '100%',
                background: 'white',
                position: 'fixed',
                top: 0,
                left: 0,
                zIndex: 9999
              }}>
                <div className={styles.loadingSpinner}></div>
                <div style={{fontSize: '1.5rem', fontWeight: 'bold', color: '#667eea', marginTop: '1rem'}}>
                  טוען תשובות השאלה...
                </div>
                <div style={{fontSize: '1.3rem', color: '#e53e3e', marginTop: '1rem', fontWeight: 'bold'}}>
                  ⏰ אנא המתן 30-40 שניות...
                </div>
                <div style={{fontSize: '1rem', color: '#4a5568', marginTop: '1rem', textAlign: 'center'}}>
                  השרת מעבד את הנתונים, זה לוקח זמן<br/>
                  אל תסגור את הדפדפן
                </div>
                <button 
                  onClick={() => {
                    console.log('🚫 User cancelled loading');
                    setSelectedQuestion(null);
                    setQuestionsLoading(false);
                  }}
                  style={{
                    marginTop: '2rem', 
                    padding: '1rem 2rem', 
                    backgroundColor: '#e53e3e', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                  }}
                >
                  🚫 ביטול וחזרה לרשימת שאלות
                </button>
              </div>
            ) : (
              <>
                {/* Left Sidebar - Student Navigation */}
                <div className={styles.navigationSidebar}>
                  <div className={styles.sidebarHeader}>
                    <Users size={20} />
                    <h3>ניווט תשובות</h3>
                  </div>
                  
                  <div className={styles.navigationList}>
                    {getUniqueAnswers().map((answer, index) => {
                      const answerId = `${answer.examId}-${answer.questionIndex}`;
                      const isProcessed = processedAnswers.has(answerId);
                      const isCurrent = index === currentAnswerIndex;
                      
                      return (
                        <div
                          key={answerId}
                          className={`${styles.navigationItem} ${isCurrent ? styles.currentItem : ''} ${isProcessed ? styles.processedItem : ''}`}
                          onClick={() => {
                            setCurrentAnswerIndex(index);
                            setCurrentGrade(answer.grade || (answer.isCorrect ? selectedQuestion.question.points : 0));
                            setCurrentFeedback(answer.feedback || '');
                          }}
                        >
                          <div className={styles.navigationItemHeader}>
                            <span className={styles.answerNumber}>#{index + 1}</span>
                            {isProcessed && <CheckCircle size={14} className={styles.processedIcon} />}
                          </div>
                          <div className={styles.navigationItemInfo}>
                            <div className={styles.studentNameNav}>
                              {answer.studentName || 'לא צוין'}
                            </div>
                            <div className={styles.studentEmailNav}>
                              {answer.studentEmail}
                            </div>
                            <div className={styles.answerTimeNav}>
                              {formatTime(answer.timeSpent)}
                            </div>
                          </div>
                          {answer.grade !== undefined && (
                            <div className={styles.gradeDisplay}>
                              {answer.grade}/{selectedQuestion.question.points}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className={styles.navigationFooter}>
                    <div className={styles.progressStats}>
                      <div className={styles.progressItem}>
                        <span>הושלמו:</span>
                        <span>{processedAnswers.size}</span>
                      </div>
                      <div className={styles.progressItem}>
                        <span>נותרו:</span>
                        <span>{getUniqueAnswers().length - processedAnswers.size}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Sidebar - Comment Bank */}
                <div className={styles.sidebar}>
                  <div className={styles.sidebarHeader}>
                    <MessageSquare size={20} />
                    <h3>בנק הערות</h3>
                  </div>

                  {/* Add New Comment */}
                  <div className={styles.addCommentSection}>
                    <h4>הוסף הערה חדשה</h4>
                    <textarea
                      value={newComment.text}
                      onChange={(e) => setNewComment({...newComment, text: e.target.value})}
                      placeholder="הקלד הערה..."
                      className={styles.newCommentInput}
                      rows={3}
                    />
                    <div className={styles.commentOptions}>
                      <div className={styles.pointsInput}>
                        <label>נקודות לקיזוז:</label>
                        <input
                          type="number"
                          min="0"
                          max={selectedQuestion?.question.points || 10}
                          value={newComment.reduced_points}
                          onChange={(e) => setNewComment({...newComment, reduced_points: Number(e.target.value)})}
                          className={styles.pointsField}
                        />
                      </div>
                      <div className={styles.tagSelect}>
                        <label>תג:</label>
                        <select
                          value={newComment.tag}
                          onChange={(e) => setNewComment({...newComment, tag: e.target.value as 'positive' | 'negative' | ''})}
                          className={styles.tagField}
                        >
                          <option value="">ללא תג</option>
                          <option value="positive">✅ חיובי</option>
                          <option value="negative">❌ שלילי</option>
                        </select>
                      </div>
                    </div>
                    <button 
                      onClick={addCommentToBank}
                      disabled={!newComment.text.trim()}
                      className={styles.addCommentBtn}
                    >
                      <Plus size={16} />
                      הוסף לבנק
                    </button>
                  </div>

                  {/* Existing Comments */}
                  <div className={styles.commentsSection}>
                    <h4>הערות קיימות ({commentBankEntries.length})</h4>
                    {loadingComments ? (
                      <div className={styles.loadingComments}>טוען הערות...</div>
                    ) : (
                      <div className={styles.commentsList}>
                        {commentBankEntries.map((comment) => (
                          <div key={comment._id} className={styles.commentItem}>
                            {editingComment?._id === comment._id ? (
                              <div className={styles.editingComment}>
                                <textarea
                                  value={editingComment.feedback}
                                  onChange={(e) => setEditingComment({...editingComment, feedback: e.target.value})}
                                  className={styles.editCommentInput}
                                  rows={2}
                                />
                                <div className={styles.editCommentOptions}>
                                  <input
                                    type="number"
                                    min="0"
                                    value={editingComment.reduced_points || 0}
                                    onChange={(e) => setEditingComment({...editingComment, reduced_points: Number(e.target.value)})}
                                    className={styles.editPointsField}
                                  />
                                  <select
                                    value={editingComment.tag || ''}
                                    onChange={(e) => setEditingComment({...editingComment, tag: e.target.value as 'positive' | 'negative' | undefined})}
                                    className={styles.editTagField}
                                  >
                                    <option value="">ללא תג</option>
                                    <option value="positive">✅ חיובי</option>
                                    <option value="negative">❌ שלילי</option>
                                  </select>
                                </div>
                                <div className={styles.editActions}>
                                  <button onClick={() => editComment(comment)} className={styles.saveEditBtn}>
                                    <Save size={14} />
                                    שמור
                                  </button>
                                  <button onClick={() => setEditingComment(null)} className={styles.cancelEditBtn}>
                                    ביטול
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className={styles.commentHeader}>
                                  <span className={styles.commentScore}>
                                    -{getCommentReducedPoints(comment)} נק'
                                  </span>
                                  {comment.tag && (
                                    <span className={`${styles.commentTag} ${styles[comment.tag]}`}>
                                      {comment.tag === 'positive' ? '✅' : '❌'}
                                    </span>
                                  )}
                                  <span className={styles.commentUsage}>
                                    שימושים: {comment.usageCount}
                                  </span>
                                </div>
                                <div className={styles.commentText}>
                                  {getCommentDisplayFeedback(comment)}
                                </div>
                                <div className={styles.commentActions}>
                                  <button
                                    onClick={() => applyComment(comment)}
                                    className={styles.useCommentBtn}
                                    title="החל הערה זו על התשובה הנוכחית"
                                  >
                                    השתמש
                                  </button>
                                  
                                  <div className={styles.ratingButtons}>
                                    <button
                                      onClick={() => rateComment(comment._id, 'like')}
                                      className={`${styles.ratingBtn} ${styles.likeBtn} ${comment.userRating === 'like' ? styles.active : ''}`}
                                      title="אשר הערה (מתאים לשימוש)"
                                    >
                                      👍 {comment.likes || 0}
                                    </button>
                                    <button
                                      onClick={() => rateComment(comment._id, 'dislike')}
                                      className={`${styles.ratingBtn} ${styles.dislikeBtn} ${comment.userRating === 'dislike' ? styles.active : ''}`}
                                      title="דחה הערה (לא מתאים לשימוש)"
                                    >
                                      👎 {comment.dislikes || 0}
                                    </button>
                                  </div>
                                  
                                  <button
                                    onClick={() => setEditingComment({
                                      ...comment,
                                      feedback: getCommentDisplayFeedback(comment),
                                      reduced_points: getCommentReducedPoints(comment)
                                    })}
                                    className={styles.editCommentBtn}
                                    title="ערוך הערה"
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                  <button
                                    onClick={() => deleteComment(comment._id)}
                                    className={styles.deleteCommentBtn}
                                    title="מחק הערה"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Main Content - Question and Current Answer */}
                <div className={styles.mainGradingContent}>
                  {/* Question Display Header */}
                  <div className={styles.questionDetailsHeader}>
                    <button
                      onClick={() => setSelectedQuestion(null)}
                      className={styles.backToQuestionsButton}
                    >
                      <ArrowLeft size={16} />
                      חזרה לרשימת שאלות
                    </button>
                    
                    <div className={styles.questionDetails}>
                      <div className={styles.questionTitle}>
                        <span className={styles.questionIdLarge}>שאלה #{selectedQuestion.question.id}</span>
                        <div 
                          className={styles.difficultyBadgeLarge}
                          style={{ backgroundColor: getDifficultyColor(selectedQuestion.question.difficulty) }}
                        >
                          {getDifficultyText(selectedQuestion.question.difficulty)} ({selectedQuestion.question.points} נקודות)
                        </div>
                      </div>
                      
                      <div className={styles.questionTextLarge}>
                        {selectedQuestion.question.question}
                      </div>
                      
                      <div className={styles.answerStats}>
                        <div className={styles.statItem}>
                          <Users size={16} />
                          <span>{getUniqueAnswers().length} תשובות</span>
                        </div>
                        <div className={styles.statItem}>
                          <CheckCircle size={16} />
                          <span>{selectedQuestion.gradedAnswers} בודקו</span>
                        </div>
                        <div className={styles.statItem}>
                          <span>נותרו: {getUniqueAnswers().filter((answer) => {
                            const answerId = `${answer.examId}-${answer.questionIndex}`;
                            return !processedAnswers.has(answerId);
                          }).length}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Current Answer Display */}
                  {currentAnswer && (
                    <div className={styles.currentAnswerSection}>
                      <div className={styles.answerHeader}>
                        <div className={styles.studentInfo}>
                          <h3>תשובה {currentAnswerIndex + 1} מתוך {getUniqueAnswers().length}</h3>
                          <div className={styles.studentDetails}>
                            <div className={styles.studentName}>
                              {currentAnswer.studentName || 'לא צוין'}
                            </div>
                            <div className={styles.studentMeta}>
                              <span>{currentAnswer.studentEmail}</span>
                              {currentAnswer.studentId && <span>• ID: {currentAnswer.studentId}</span>}
                              <span>• זמן: {formatTime(currentAnswer.timeSpent)}</span>
                              <span>• {formatDate(currentAnswer.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* AI Detection and Schema Validation */}
                      {(() => {
                        const aiAnalysis = detectAITraps(currentAnswer.studentAnswer);
                        const schemaValidation = validateSchema(currentAnswer.studentAnswer);
                        
                        return (
                          <>
                            {(aiAnalysis.isAISuspicious || schemaValidation.hasInvalidTables || schemaValidation.hasInvalidColumns) && (
                              <div className={styles.aiSuspicionBanner}>
                                <div className={styles.aiSuspicionHeader}>
                                  <AlertTriangle size={20} />
                                  <span>⚠️ חשוד בשימוש ב-AI 
                                    {aiAnalysis.isAISuspicious && ` (ציון חשד: ${aiAnalysis.suspicionScore})`}
                                    {(schemaValidation.hasInvalidTables || schemaValidation.hasInvalidColumns) && ' - שימוש בעמודות/טבלאות לא קיימות'}
                                  </span>
                                </div>
                                
                                {/* Show schema validation errors */}
                                {(schemaValidation.hasInvalidTables || schemaValidation.hasInvalidColumns) && (
                                  <div className={styles.aiSuspicionDetails}>
                                    <div className={styles.aiDetailsTitle}>שגיאות סכמה שנמצאו:</div>
                                    <ul className={styles.trapsList}>
                                      {schemaValidation.invalidItems.map((item, index) => (
                                        <li key={index} className={`${styles.trapItem} ${styles.trapHigh}`}>
                                          <div className={styles.trapDescription}>
                                            <strong>{item}</strong>
                                          </div>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                
                                {/* Show AI traps if any */}
                                {aiAnalysis.triggeredTraps.length > 0 && (
                                  <div className={styles.aiSuspicionDetails}>
                                    <div className={styles.aiDetailsTitle}>מלכודות AI שנתפסו:</div>
                                    <ul className={styles.trapsList}>
                                      {aiAnalysis.triggeredTraps.map((trap, trapIndex) => (
                                        <li key={trapIndex} className={`${styles.trapItem} ${styles[`trap${trap.severity.charAt(0).toUpperCase() + trap.severity.slice(1)}`]}`}>
                                          <div className={styles.trapDescription}>
                                            <strong>{trap.description}</strong>
                                          </div>
                                          <div className={styles.trapMatches}>
                                            נמצאו: {trap.matches.join(', ')}
                                          </div>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}

                            {(schemaValidation.hasInvalidTables || schemaValidation.hasInvalidColumns) && aiAnalysis.isAISuspicious && (
                              <div className={styles.schemaBanner}>
                                <div className={styles.schemaHeader}>
                                  <Database size={20} />
                                  <span>🚫 שימוש בטבלות/עמודות לא קיימות (ציון אוטומטי: 0)</span>
                                </div>
                                <div className={styles.schemaDetails}>
                                  <ul>
                                    {schemaValidation.invalidItems.map((item, index) => (
                                      <li key={index}>{item}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {/* Answer Content */}
                      <div className={styles.answerContent}>
                        <div className={styles.answerText}>
                          <strong>תשובת הסטודנט:</strong>
                          <pre className={styles.answerQuery}>
                            {(() => {
                              const aiAnalysis = detectAITraps(currentAnswer.studentAnswer);
                              if (aiAnalysis.isAISuspicious && aiAnalysis.highlightedText) {
                                return <div dangerouslySetInnerHTML={{ __html: aiAnalysis.highlightedText }} />;
                              }
                              return currentAnswer.studentAnswer;
                            })()}
                          </pre>
                        </div>
                      </div>

                      {/* Grading Section */}
                      <div className={styles.gradingSection}>
                        <div className={styles.gradeInputs}>
                          <div className={styles.gradeInput}>
                            <label>ציון:</label>
                            <input
                              type="number"
                              min="0"
                              max={selectedQuestion.question.points}
                              step="0.1"
                              value={currentGrade}
                              onChange={(e) => setCurrentGrade(Number(e.target.value))}
                              className={styles.gradeField}
                            />
                            <span>/ {selectedQuestion.question.points}</span>
                          </div>
                          
                          <div className={styles.feedbackInput}>
                            <label>הערות:</label>
                            <textarea
                              value={currentFeedback}
                              onChange={(e) => setCurrentFeedback(e.target.value)}
                              placeholder="הערות על התשובה..."
                              className={styles.feedbackField}
                              rows={3}
                            />
                          </div>
                          
                          <button
                            onClick={handleDoneAnswer}
                            disabled={saving}
                            className={styles.doneButton}
                          >
                            {saving ? 'שומר...' : 'סיים ושמור'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* No More Answers */}
                  {getUniqueAnswers().length === 0 && (
                    <div className={styles.noAnswers}>
                      <Users size={48} />
                      <h3>אין תשובות לשאלה זו</h3>
                      <p>לא נמצאו תשובות סטודנטים לשאלה זו</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GradeByQuestionPage; 