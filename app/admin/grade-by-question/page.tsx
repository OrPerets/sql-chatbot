"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Search, Eye, Users, CheckCircle, XCircle, Clock, Edit3, Filter, BarChart3, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import styles from './page.module.css';
import { detectAITraps, getSuspicionColor, getSuspicionIcon } from '../../utils/trapDetector';

interface Question {
  id: number;
  question: string;
  difficulty: string;
  points: number;
  approved: boolean;
  answerCount: number;
  averageScore?: number; // הוספת ממוצע ניקוד
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
}

interface QuestionWithAnswers {
  question: Question;
  answers: StudentAnswer[];
  totalAnswers: number;
  gradedAnswers: number;
  averageGrade: number;
}

const GradeByQuestionPage: React.FC = () => {
  // Comment bank entry type
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
  }

  // Add comment bank state (must be inside the component)
  const [commentBankEntries, setCommentBankEntries] = useState<{[questionId: number]: CommentBankEntry[]}>({});
  const [activeCommentBank, setActiveCommentBank] = useState<{ answerId: string | null, questionId?: number, maxScore?: number }>({ answerId: null });
  const [loadingComments, setLoadingComments] = useState<{[questionId: number]: boolean}>({});

  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionWithAnswers | null>(null);
  const [loading, setLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard' | 'algebra'>('all');
  const [showGradedOnly, setShowGradedOnly] = useState(false);

  // Save filter state to localStorage
  const saveFiltersToStorage = (search: string, difficulty: string) => {
    localStorage.setItem('gradeByQuestion_filters', JSON.stringify({
      searchTerm: search,
      difficultyFilter: difficulty
    }));
  };

  // Load filter state from localStorage
  const loadFiltersFromStorage = () => {
    try {
      const saved = localStorage.getItem('gradeByQuestion_filters');
      if (saved) {
        const { searchTerm: savedSearch, difficultyFilter: savedDifficulty } = JSON.parse(saved);
        setSearchTerm(savedSearch || '');
        setDifficultyFilter(savedDifficulty || 'all');
      }
    } catch (err) {
      console.error('Error loading filters from storage:', err);
    }
  };
  const [grading, setGrading] = useState<{[answerId: string]: boolean}>({});
  
  // Cache for questions data
  const [questionsCache, setQuestionsCache] = useState<Question[] | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  const router = useRouter();

  // Fetch comments for a question
  const fetchCommentBankEntries = async (questionId: number) => {
    try {
      setLoadingComments(prev => ({ ...prev, [questionId]: true }));
      const response = await fetch(`/api/admin/comment-bank?questionId=${questionId}&limit=10`);
      if (!response.ok) throw new Error('Failed to fetch comments');
      const data = await response.json();
      setCommentBankEntries(prev => ({ ...prev, [questionId]: data.comments || [] }));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error fetching comment bank entries:', err);
    } finally {
      setLoadingComments(prev => ({ ...prev, [questionId]: false }));
    }
  };

  // Open comment bank modal for an answer
  const openCommentBank = (answerId: string, questionId: number, maxScore: number) => {
    fetchCommentBankEntries(questionId);
    setActiveCommentBank({ answerId, questionId, maxScore });
  };

  // Close modal
  const closeCommentBank = () => setActiveCommentBank({ answerId: null });

  // Use comment from bank
  const useCommentFromBank = (comment: CommentBankEntry) => {
    if (!activeCommentBank.answerId) return;
    const gradeInput = document.getElementById(`grade-${activeCommentBank.answerId}`) as HTMLInputElement;
    const feedbackInput = document.getElementById(`feedback-${activeCommentBank.answerId}`) as HTMLTextAreaElement;
    if (gradeInput) gradeInput.value = comment.score.toString();
    if (feedbackInput) feedbackInput.value = comment.feedback;
    closeCommentBank();
  };

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

    // Try to load from localStorage first
    const cachedQuestions = localStorage.getItem('gradeByQuestion_cache');
    const cachedTime = localStorage.getItem('gradeByQuestion_cache_time');
    
    if (cachedQuestions && cachedTime) {
      const cacheAge = Date.now() - parseInt(cachedTime);
      if (cacheAge < CACHE_DURATION) {
        try {
          const parsedQuestions = JSON.parse(cachedQuestions);
          setQuestionsCache(parsedQuestions);
          setQuestions(parsedQuestions);
          setLastFetchTime(parseInt(cachedTime));
          setLoading(false);
          console.log(`💾 Loaded questions from localStorage cache (${parsedQuestions.length} questions, age: ${Math.round(cacheAge / 60000)}min)`);
          return;
        } catch (err) {
          console.error('Error parsing cached questions:', err);
        }
      }
    }

    // Load saved filters
    loadFiltersFromStorage();
    
    fetchQuestions();
  }, [router]);

  // Save filters when they change
  useEffect(() => {
    if (searchTerm !== '' || difficultyFilter !== 'all') {
      saveFiltersToStorage(searchTerm, difficultyFilter);
    }
  }, [searchTerm, difficultyFilter]);

  const fetchQuestions = async (forceRefresh = false) => {
    try {
      const now = Date.now();
      
      // Check if we have cached data and it's still fresh
      if (!forceRefresh && questionsCache && (now - lastFetchTime) < CACHE_DURATION) {
        console.log(`🚀 Using cached questions data (${questionsCache.length} questions, age: ${Math.round((now - lastFetchTime) / 60000)}min)`);
        setQuestions(questionsCache);
        setLoading(false);
        return;
      }
      
      setLoading(true);
      console.log('📥 Fetching fresh questions data from API...');
      
      const response = await fetch('/api/admin/questions-with-answers');
      if (!response.ok) {
        throw new Error('Failed to fetch questions');
      }
      const data = await response.json();
      
      // חישוב ממוצע ניקוד לכל שאלה - עם batching לשיפור ביצועים
      const questionsWithAverage = await Promise.allSettled(
        data.map(async (question: Question) => {
          try {
            // קבלת כל התשובות לשאלה כדי לחשב ממוצע
            const answersResponse = await fetch(`/api/admin/question/${question.id}/answers`);
            if (answersResponse.ok) {
              const answersData = await answersResponse.json();
              const gradedAnswers = answersData.answers?.filter((answer: any) => 
                answer.grade !== undefined && answer.grade !== null
              ) || [];
              
              let averageScore = 0;
              if (gradedAnswers.length > 0) {
                const totalScore = gradedAnswers.reduce((sum: number, answer: any) => 
                  sum + (answer.grade || 0), 0
                );
                averageScore = totalScore / gradedAnswers.length;
              }
              
              return {
                ...question,
                averageScore: Math.round(averageScore * 10) / 10 // עיגול לעשירית
              };
            }
          } catch (err) {
            console.error(`Error calculating average for question ${question.id}:`, err);
          }
          
          return {
            ...question,
            averageScore: 0
          };
        })
      );
      
      // Process results from Promise.allSettled
      const processedQuestions = questionsWithAverage
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<Question>).value);
      
      // Update cache
      setQuestionsCache(processedQuestions);
      setLastFetchTime(now);
      setQuestions(processedQuestions);
      
      // Save to localStorage
      try {
        localStorage.setItem('gradeByQuestion_cache', JSON.stringify(processedQuestions));
        localStorage.setItem('gradeByQuestion_cache_time', now.toString());
        console.log(`💾 Saved ${processedQuestions.length} questions to cache`);
      } catch (err) {
        console.error('Error saving to localStorage:', err);
      }
      
    } catch (err) {
      console.error('Error fetching questions:', err);
      setError('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestionAnswers = async (questionId: number) => {
    try {
      setQuestionsLoading(true);
      // Add timestamp to break CDN caching
      const timestamp = Date.now();
      const response = await fetch(`/api/admin/question/${questionId}/answers?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch question answers');
      }
      const data = await response.json();
      setSelectedQuestion(data);
    } catch (err) {
      console.error('Error fetching question answers:', err);
      setError('Failed to load question answers');
    } finally {
      setQuestionsLoading(false);
    }
  };

  // Function to refresh data manually
  const handleRefreshQuestions = async () => {
    await fetchQuestions(true); // Force refresh
  };

  const handleGradeAnswer = async (examId: string, questionIndex: number, grade: number, feedback: string) => {
    const answerId = `${examId}-${questionIndex}`;
    try {
      setGrading(prev => ({ ...prev, [answerId]: true }));
      
      const response = await fetch('/api/admin/grade-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          examId,
          questionIndex,
          grade,
          feedback,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save grade');
      }

      // Auto-save to comment bank if feedback is provided
      if (feedback && feedback.trim() && selectedQuestion) {
        try {
          await fetch('/api/admin/comment-bank', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              questionId: selectedQuestion.question.id,
              questionText: selectedQuestion.question.question,
              difficulty: selectedQuestion.question.difficulty,
              score: grade,
              maxScore: selectedQuestion.question.points,
              feedback: feedback,
              gradedBy: 'admin'
            }),
          });
          
          // Show success message to user
          const successMessage = document.createElement('div');
          successMessage.innerHTML = '✅ ציון והערה נשמרו (כולל בבנק ההערות)';
          successMessage.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          `;
          document.body.appendChild(successMessage);
          
          // Remove message after 3 seconds
          setTimeout(() => {
            if (successMessage.parentNode) {
              successMessage.parentNode.removeChild(successMessage);
            }
          }, 3000);
          
        } catch (commentErr) {
          console.error('Error saving to comment bank:', commentErr);
          // Don't show error for comment bank save failure as the main grade was saved
        }
      }

      // Refresh the current question answers
      if (selectedQuestion) {
        fetchQuestionAnswers(selectedQuestion.question.id);
        
        // Invalidate cache to ensure fresh data on next load
        const questionId = selectedQuestion.question.id;
        if (questionsCache) {
          // Update the specific question's average in cache
          setTimeout(() => {
            fetchQuestions(true);
          }, 1000); // Small delay to allow grade to be processed
        }
      }
    } catch (err) {
      console.error('Error saving grade:', err);
      alert('שגיאה בשמירת הציון');
    } finally {
      setGrading(prev => ({ ...prev, [answerId]: false }));
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return '#48bb78';
      case 'medium': return '#ed8936';
      case 'hard': return '#e53e3e';
      case 'algebra': return '#8b5cf6';
      default: return '#718096';
    }
  };

  const getDifficultyText = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 'קל';
      case 'medium': return 'בינוני';
      case 'hard': return 'קשה';
      case 'algebra': return 'אלגברה';
      default: return difficulty;
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

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const filteredQuestions = questions
    .filter(question => {
      const matchesSearch = question.question.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDifficulty = difficultyFilter === 'all' || question.difficulty === difficultyFilter;
      return matchesSearch && matchesDifficulty;
    })
    .sort((a, b) => {
      // Sort by answer count (descending), then by question ID (ascending)
      if (b.answerCount !== a.answerCount) {
        return b.answerCount - a.answerCount;
      }
      return a.id - b.id;
    });

  if (loading && !questionsCache) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>טוען שאלות...</div>
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
        <div className={styles.headerTitle}>
          <BarChart3 size={24} />
          <h1>ציונים לפי שאלה</h1>
        </div>
        <div className={styles.headerActions}>
          <button 
            onClick={handleRefreshQuestions}
            disabled={loading}
            className={styles.refreshButton}
            title="רענן נתונים"
          >
            🔄 {loading ? 'טוען...' : 'רענן'}
          </button>
          <div className={styles.headerInfo}>
            <span>{filteredQuestions.length} שאלות זמינות</span>
            {questionsCache && !loading && (
              <span className={styles.cacheInfo}>
                • מטמון: {Math.round((Date.now() - lastFetchTime) / 60000)} דק' ({questionsCache === questions ? '🟢 פעיל' : '🔄 מתעדכן'})
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.mainContent}>
        {!selectedQuestion ? (
          /* Questions List View */
          <div className={styles.questionsView}>
            {/* Filters */}
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
            </div>

            {/* Questions Grid */}
            <div className={styles.questionsGrid}>
              {filteredQuestions.map((question) => (
                <div
                  key={question.id}
                  className={styles.questionCard}
                  onClick={() => fetchQuestionAnswers(question.id)}
                >
                  <div className={styles.questionHeader}>
                    <div className={styles.questionId}>
                      שאלה #{question.id}
                      {question.answerCount === 0 && <span className={styles.noAnswersBadge}>אין תשובות</span>}
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
                    <div className={`${styles.answerCount} ${question.answerCount === 0 ? styles.noAnswers : ''}`}>
                      <Users size={16} />
                      {question.answerCount} תשובות
                    </div>
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
              ))}
            </div>

            {filteredQuestions.length === 0 && (
              <div className={styles.noQuestions}>
                <FileText size={48} />
                <h3>לא נמצאו שאלות</h3>
                <p>נסה לשנות את הפילטרים או המילות חיפוש</p>
              </div>
            )}
          </div>
        ) : (
          /* Question Answers View */
          <div className={styles.answersView}>
            {questionsLoading ? (
              <div className={styles.loading}>טוען תשובות...</div>
            ) : (
              <>
                {/* Question Details Header */}
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
                        <span>{selectedQuestion.totalAnswers} תשובות</span>
                      </div>
                      <div className={styles.statItem}>
                        <CheckCircle size={16} />
                        <span>{selectedQuestion.gradedAnswers} בודקו</span>
                      </div>
                      {selectedQuestion.averageGrade > 0 && (
                        <div className={styles.statItem}>
                          <BarChart3 size={16} />
                          <span>ממוצע: {selectedQuestion.averageGrade.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Answers List */}
                <div className={styles.answersContainer}>
                  {selectedQuestion.answers.map((answer, index) => {
                    const answerId = `${answer.examId}-${answer.questionIndex}`;
                    const isGrading = grading[answerId] || false;
                    
                    // ניתוח AI עבור התשובה
                    const aiAnalysis = detectAITraps(answer.studentAnswer);
                    const suspicionLevel = getSuspicionColor(aiAnalysis.suspicionScore);
                    const iconName = getSuspicionIcon(aiAnalysis.suspicionScore);
                    
                    const getAIIcon = () => {
                      switch (iconName) {
                        case 'AlertTriangle':
                          return <AlertTriangle size={14} className={styles.aiHighRisk} />;
                        case 'AlertCircle':
                          return <AlertCircle size={14} className={styles.aiMediumRisk} />;
                        case 'Info':
                          return <Info size={14} className={styles.aiLowRisk} />;
                        default:
                          return <CheckCircle size={14} className={styles.aiClean} />;
                      }
                    };
                    
                    return (
                      <div key={answerId} className={styles.answerCard}>
                        <div className={styles.answerHeader}>
                          <div className={styles.studentInfo}>
                            <div className={styles.studentName}>
                              {answer.studentName || 'לא צוין'}
                            </div>
                            <div className={styles.studentDetails}>
                              <span>{answer.studentEmail}</span>
                              {answer.studentId && <span>• ID: {answer.studentId}</span>}
                            </div>
                          </div>
                          
                          <div className={styles.answerMeta}>
                            <div className={styles.timeInfo}>
                              <Clock size={14} />
                              <span>זמן: {formatTime(answer.timeSpent)}</span>
                            </div>
                            <div className={styles.dateInfo}>
                              {formatDate(answer.timestamp)}
                            </div>
                            {/* הסרת אינדיקטור נכון/שגוי */}
                          </div>
                        </div>
                        
                        {/* הצגת חשד AI בנפרד ובולט יותר */}
                        {aiAnalysis.isAISuspicious && (
                          <div className={styles.aiSuspicionBanner}>
                            <div className={styles.aiSuspicionHeader}>
                              <div className={styles.aiSuspicionTitle}>
                                <AlertTriangle size={20} />
                                <span>⚠️ חשוד בשימוש ב-AI (ציון חשד: {aiAnalysis.suspicionScore})</span>
                              </div>
                              <button 
                                className={styles.aiDetailsToggle}
                                onClick={() => {
                                  const details = document.getElementById(`ai-details-${answerId}`);
                                  if (details) {
                                    details.style.display = details.style.display === 'none' ? 'block' : 'none';
                                  }
                                }}
                              >
                                {aiAnalysis.triggeredTraps.length > 0 ? 'הצג פרטים' : 'אין פרטים זמינים'}
                              </button>
                            </div>
                            
                            {aiAnalysis.triggeredTraps.length > 0 && (
                              <div id={`ai-details-${answerId}`} className={styles.aiSuspicionDetails} style={{ display: 'none' }}>
                                <div className={styles.aiDetailsTitle}>מלכודות שנתפסו:</div>
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
                        
                        <div className={styles.answerContent}>
                          <div className={styles.answerText}>
                            <strong>תשובת הסטודנט:</strong>
                            <pre className={styles.answerQuery}>{answer.studentAnswer}</pre>
                            
                            {/* הוספת אינדיקטור נכון/שגוי כאן */}
                            {/* <div className={styles.correctnessSection}>
                              <div className={`${styles.correctnessIndicator} ${answer.isCorrect ? styles.correct : styles.incorrect}`}>
                                {answer.isCorrect ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                {answer.isCorrect ? 'נכון' : 'שגוי'}
                              </div>
                            </div> */}
                          </div>
                        </div>
                        
                        <div className={styles.gradingSection}>
                          <div className={styles.gradeInputs}>
                            <div className={styles.gradeInput}>
                              <label>ציון:</label>
                              <input
                                type="number"
                                min="0"
                                max={selectedQuestion.question.points}
                                step="0.1"
                                defaultValue={answer.grade || (answer.isCorrect ? selectedQuestion.question.points : 0)}
                                className={styles.gradeField}
                                id={`grade-${answerId}`}
                              />
                              <span>/ {selectedQuestion.question.points}</span>
                            </div>
                            
                            <div className={styles.feedbackInput}>
                              <label>הערות:</label>
                              <button
                                type="button"
                                onClick={() => openCommentBank(answerId, selectedQuestion.question.id, selectedQuestion.question.points)}
                                className={styles.commentBankToggle}
                                title="פתח בנק הערות - הערות נשמרות אוטומטית עם הציון"
                              >
                                <FileText size={14} />
                                בנק הערות
                              </button>
                              <textarea
                                defaultValue={answer.feedback || ''}
                                placeholder="הערות על התשובה..."
                                className={styles.feedbackField}
                                rows={2}
                                id={`feedback-${answerId}`}
                              />
                              <div className={styles.autoSaveNote}>
                                💡 הערה: הערות נשמרות אוטומטית בבנק ההערות עם הציון
                              </div>
                            </div>
                            
                            <button
                              onClick={() => {
                                const gradeInput = document.getElementById(`grade-${answerId}`) as HTMLInputElement;
                                const feedbackInput = document.getElementById(`feedback-${answerId}`) as HTMLTextAreaElement;
                                handleGradeAnswer(
                                  answer.examId,
                                  answer.questionIndex,
                                  parseFloat(gradeInput.value) || 0,
                                  feedbackInput.value
                                );
                              }}
                              disabled={isGrading}
                              className={styles.saveGradeButton}
                            >
                              {isGrading ? 'שומר...' : 'שמור ציון'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedQuestion.answers.length === 0 && (
                  <div className={styles.noAnswers}>
                    <Users size={48} />
                    <h3>אין תשובות לשאלה זו</h3>
                    <p>לא נמצאו תשובות סטודנטים לשאלה זו</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Global Comment Bank Modal */}
      {activeCommentBank.answerId !== null && (
        <div className={styles.commentBankOverlay}>
          <div className={styles.commentBankPopup}>
            <div className={styles.commentBankHeader}>
              <h4>בנק הערות</h4>
              <button onClick={closeCommentBank} className={styles.closeCommentBank}>
                <XCircle size={16} />
              </button>
            </div>
            <div className={styles.commentBankContent}>
              {loadingComments[activeCommentBank.questionId!] ? (
                <div className={styles.commentBankLoading}>טוען הערות...</div>
              ) : commentBankEntries[activeCommentBank.questionId!] && commentBankEntries[activeCommentBank.questionId!].length > 0 ? (
                <div className={styles.commentsList}>
                  {commentBankEntries[activeCommentBank.questionId!].map((comment) => (
                    <div key={comment._id} className={styles.commentItem}>
                      <div className={styles.commentMeta}>
                        <span className={styles.commentScore}>
                          {comment.score}/{comment.maxScore} נקודות
                        </span>
                        <span className={styles.commentDifficulty}>
                          {comment.difficulty}
                        </span>
                        <span className={styles.commentUsage}>
                          נוצר: {new Date(comment.gradedAt).toLocaleDateString('he-IL')}
                          {comment.usageCount > 0 && ` | שימושים: ${comment.usageCount}`}
                        </span>
                      </div>
                      <div className={styles.commentFeedback}>
                        {comment.feedback}
                      </div>
                      <button
                        onClick={() => useCommentFromBank(comment)}
                        className={styles.useCommentBtn}
                      >
                        השתמש בהערה
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.noComments}>
                  לא נמצאו הערות קודמות לשאלה זו
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GradeByQuestionPage; 