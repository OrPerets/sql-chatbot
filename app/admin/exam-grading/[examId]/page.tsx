"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, CheckCircle, XCircle, Clock, User, FileText, AlertTriangle, AlertCircle, Info, Eye, Trash2, Check, X } from 'lucide-react';
import styles from './page.module.css';
import { detectAITraps, getSuspicionColor, getSuspicionIcon, TrapDetection } from '../../../utils/trapDetector';

interface ExamAnswer {
  _id: string;
  questionIndex: number;
  questionId: string;
  questionText: string;
  difficulty: string;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  timeSpent: number;
  questionDetails?: any;
}

interface ExamSession {
  _id: string;
  studentEmail: string;
  studentName?: string;
  studentId?: string;
  startTime: string;
  endTime?: string;
  status: string;
  score?: number;
  totalQuestions: number;
}

interface ExamData {
  session: ExamSession;
  answers: ExamAnswer[];
}

interface QuestionGrade {
  questionIndex: number;
  score: number;
  maxScore: number;
  feedback: string;
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
}

const ExamGradingPage: React.FC = () => {
  const [examData, setExamData] = useState<ExamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [questionGrades, setQuestionGrades] = useState<QuestionGrade[]>([]);
  const [overallFeedback, setOverallFeedback] = useState('');
  const [totalScore, setTotalScore] = useState(0);
  const [maxScore, setMaxScore] = useState(0);
  const [grade, setGrade] = useState('');
  const [aiAnalyses, setAiAnalyses] = useState<{[questionIndex: number]: TrapDetection}>({});
  const [deletedQuestions, setDeletedQuestions] = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  
  // Comment Bank state
  const [commentBankEntries, setCommentBankEntries] = useState<{[questionIndex: number]: CommentBankEntry[]}>({});
  const [activeCommentBank, setActiveCommentBank] = useState<{ questionIndex: number | null, anchorRect?: DOMRect, answer?: ExamAnswer }>({ questionIndex: null });
  const [loadingComments, setLoadingComments] = useState<{[questionIndex: number]: boolean}>({});
  const router = useRouter();
  const params = useParams();
  const examId = params.examId as string;

  useEffect(() => {
    if (examId) {
      fetchExamData();
    }
  }, [examId]);

  useEffect(() => {
    // Initialize question grades when exam data loads
    if (examData?.answers) {
      const initialGrades = examData.answers.map(answer => {
        const questionPoints = answer.questionDetails?.points || 1; // Use actual points from database
        return {
          questionIndex: answer.questionIndex,
          score: answer.isCorrect ? questionPoints : 0,
          maxScore: questionPoints,
          feedback: ''
        };
      });
      setQuestionGrades(initialGrades);
      
      // Calculate total max score based on actual question points (excluding deleted questions)
      const totalMaxScore = examData.answers
        .filter(answer => !deletedQuestions.has(answer.questionIndex))
        .reduce((sum, answer) => sum + (answer.questionDetails?.points || 1), 0);
      setMaxScore(totalMaxScore);
      
      // Calculate total score based on correct answers and their points (excluding deleted questions)
      const totalCurrentScore = examData.answers
        .filter(answer => !deletedQuestions.has(answer.questionIndex))
        .reduce((sum, answer) => sum + (answer.isCorrect ? (answer.questionDetails?.points || 1) : 0), 0);
      setTotalScore(totalCurrentScore);

      // Analyze answers for AI patterns
      const aiAnalysisResults: {[questionIndex: number]: TrapDetection} = {};
      examData.answers.forEach(answer => {
        const analysis = detectAITraps(answer.studentAnswer);
        aiAnalysisResults[answer.questionIndex] = analysis;
      });
      setAiAnalyses(aiAnalysisResults);
    }
  }, [examData, deletedQuestions]);

  const fetchExamData = async () => {
    try {
      setLoading(true);
      // Try fetching from FinalExams first, fall back to regular exams
      let response = await fetch(`/api/admin/final-exam/${examId}/for-grading`);
      let isFinalExam = true;
      
      if (!response.ok) {
        // Fall back to original exam endpoint
        response = await fetch(`/api/admin/exam/${examId}/for-grading`);
        isFinalExam = false;
        if (!response.ok) {
          throw new Error('Failed to fetch exam data');
        }
      }
      
      const data = await response.json();
      setExamData(data);

      // Set deleted questions from the exam data (if available from server)
      if (data.deletedQuestions && Array.isArray(data.deletedQuestions)) {
        setDeletedQuestions(new Set(data.deletedQuestions));
      }

      // Also load any additional deleted questions from grade data (fallback)
      try {
        const gradeResponse = await fetch(`/api/admin/${isFinalExam ? 'final-exam' : 'exam'}/${examId}/grade`);
        if (gradeResponse.ok) {
          const gradeData = await gradeResponse.json();
          if (gradeData.deletedQuestions && Array.isArray(gradeData.deletedQuestions)) {
            // Merge with any existing deleted questions
            setDeletedQuestions(prev => new Set([...Array.from(prev), ...gradeData.deletedQuestions]));
          }
        }
      } catch (err) {
        console.log('No previous grade data found, using exam data deleted questions only');
      }
    } catch (err) {
      console.error('Error fetching exam data:', err);
      setError('Failed to load exam data');
    } finally {
      setLoading(false);
    }
  };



  const handleQuestionGradeChange = (questionIndex: number, field: 'score' | 'feedback', value: string | number) => {
    const updatedGrades = questionGrades.map(grade => 
      grade.questionIndex === questionIndex 
        ? { ...grade, [field]: value }
        : grade
    );
    
    setQuestionGrades(updatedGrades);

    // Update total score (excluding deleted questions)
    if (field === 'score') {
      const newTotal = updatedGrades
        .filter(grade => !deletedQuestions.has(grade.questionIndex))
        .reduce((sum, grade) => sum + grade.score, 0);
      setTotalScore(newTotal);
    }

    // Auto-save to comment bank when feedback is provided and not empty
    if (field === 'feedback' && value && typeof value === 'string' && value.trim()) {
      const currentGrade = updatedGrades.find(grade => grade.questionIndex === questionIndex);
      const answer = examData?.answers.find(answer => answer.questionIndex === questionIndex);
      
      if (currentGrade && answer) {
        // Debounce the save operation
        setTimeout(() => {
          // Use the current score or default to 1 if score is 0
          const scoreToSave = currentGrade.score > 0 ? currentGrade.score : 1;
          saveToCommentBank(questionIndex, answer, scoreToSave, value);
        }, 1000);
      }
    }

    // Also auto-save when score is updated if there's already feedback
    if (field === 'score' && typeof value === 'number' && value > 0) {
      const currentGrade = updatedGrades.find(grade => grade.questionIndex === questionIndex);
      const answer = examData?.answers.find(answer => answer.questionIndex === questionIndex);
      
      if (currentGrade && answer && currentGrade.feedback && currentGrade.feedback.trim()) {
        // Debounce the save operation
        setTimeout(() => {
          saveToCommentBank(questionIndex, answer, value, currentGrade.feedback);
        }, 1000);
      }
    }
  };

  const handleApproveAnswer = (questionIndex: number, answer: ExamAnswer) => {
    const questionPoints = answer.questionDetails?.points || 1;
    const suggestedScore = answer.isCorrect ? questionPoints : 0;
    const suggestedFeedback = answer.isCorrect 
      ? 'מאושר - תשובה נכונה' 
      : 'מאושר - תשובה שגויה';

    // Update both score and feedback
    setQuestionGrades(prev => prev.map(grade => 
      grade.questionIndex === questionIndex 
        ? { ...grade, score: suggestedScore, feedback: suggestedFeedback }
        : grade
    ));

    // Update total score
    const newGrades = questionGrades.map(grade => 
      grade.questionIndex === questionIndex 
        ? { ...grade, score: suggestedScore, feedback: suggestedFeedback }
        : grade
    );
    const newTotal = newGrades
      .filter(grade => !deletedQuestions.has(grade.questionIndex))
      .reduce((sum, grade) => sum + grade.score, 0);
    setTotalScore(newTotal);
  };

  const handleDeleteQuestion = (questionIndex: number) => {
    setShowDeleteConfirm(questionIndex);
  };

  const confirmDeleteQuestion = async (questionIndex: number) => {
    setDeletedQuestions(prev => new Set([...Array.from(prev), questionIndex]));
    setShowDeleteConfirm(null);
    
    // Recalculate totals after deletion
    if (examData?.answers) {
      const totalMaxScore = examData.answers
        .filter(answer => !deletedQuestions.has(answer.questionIndex) && answer.questionIndex !== questionIndex)
        .reduce((sum, answer) => sum + (answer.questionDetails?.points || 1), 0);
      setMaxScore(totalMaxScore);
      
      const totalCurrentScore = questionGrades
        .filter(grade => !deletedQuestions.has(grade.questionIndex) && grade.questionIndex !== questionIndex)
        .reduce((sum, grade) => sum + grade.score, 0);
      setTotalScore(totalCurrentScore);
    }

    // Immediately save the deletion to persist it
    try {
      const currentDeletedQuestions = new Set([...Array.from(deletedQuestions), questionIndex]);
      const deletionData = {
        examId,
        deletedQuestions: Array.from(currentDeletedQuestions),
        action: 'delete_question',
        questionIndex,
        timestamp: new Date().toISOString()
      };

      // Try to save to both regular exams and final exams
      let response = await fetch(`/api/admin/exam/${examId}/grade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deletionData),
      });

      if (!response.ok) {
        // Try final exam endpoint
        response = await fetch(`/api/admin/final-exam/${examId}/grade`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(deletionData),
        });
      }

      if (!response.ok) {
        console.error('Failed to persist question deletion');
      }
    } catch (err) {
      console.error('Error persisting question deletion:', err);
    }
  };

  const cancelDeleteQuestion = () => {
    setShowDeleteConfirm(null);
  };

  // Comment Bank functions
  const fetchCommentBankEntries = async (questionIndex: number, answer: ExamAnswer) => {
    try {
      setLoadingComments(prev => ({ ...prev, [questionIndex]: true }));
      
      const response = await fetch(
        `/api/admin/comment-bank?questionId=${answer.questionId}&difficulty=${answer.difficulty}&limit=10`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }
      
      const data = await response.json();
      setCommentBankEntries(prev => ({
        ...prev,
        [questionIndex]: data.comments || []
      }));
    } catch (err) {
      console.error('Error fetching comment bank entries:', err);
    } finally {
      setLoadingComments(prev => ({ ...prev, [questionIndex]: false }));
    }
  };

  const saveToCommentBank = async (questionIndex: number, answer: ExamAnswer, score: number, feedback: string) => {
    if (!feedback.trim()) return; // Don't save empty feedback
    
    try {
      const response = await fetch('/api/admin/comment-bank', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionId: answer.questionId,
          questionText: answer.questionText,
          difficulty: answer.difficulty,
          score: score,
          maxScore: answer.questionDetails?.points || 1,
          feedback: feedback,
          gradedBy: 'admin'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save to comment bank');
      }
      
      const data = await response.json();
      console.log('Comment saved to bank successfully:', data);
      
      // Show success message to user
      const successMessage = document.createElement('div');
      successMessage.innerHTML = '✅ הערה נשמרה בבנק ההערות';
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
      
    } catch (err) {
      console.error('Error saving to comment bank:', err);
      
      // Show error message to user
      const errorMessage = document.createElement('div');
      errorMessage.innerHTML = '❌ שגיאה בשמירת ההערה בבנק ההערות';
      errorMessage.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #dc3545;
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      `;
      document.body.appendChild(errorMessage);
      
      // Remove message after 3 seconds
      setTimeout(() => {
        if (errorMessage.parentNode) {
          errorMessage.parentNode.removeChild(errorMessage);
        }
      }, 3000);
    }
  };

  const useCommentFromBank = async (questionIndex: number, comment: CommentBankEntry) => {
    // Update the grade and feedback
    setQuestionGrades(prev => prev.map(grade => 
      grade.questionIndex === questionIndex 
        ? { ...grade, score: comment.score, feedback: comment.feedback }
        : grade
    ));

    // Update total score
    const newGrades = questionGrades.map(grade => 
      grade.questionIndex === questionIndex 
        ? { ...grade, score: comment.score, feedback: comment.feedback }
        : grade
    );
    const newTotal = newGrades
      .filter(grade => !deletedQuestions.has(grade.questionIndex))
      .reduce((sum, grade) => sum + grade.score, 0);
    setTotalScore(newTotal);

    // Mark comment as used in the bank
    try {
      await fetch(`/api/admin/comment-bank/${comment._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'use' }),
      });
    } catch (err) {
      console.error('Error marking comment as used:', err);
    }

    // Hide comment bank
    setActiveCommentBank({ questionIndex: null }); // Close the modal
  };

  // Open the comment bank modal for a question
  const openCommentBank = (questionIndex: number, answer: ExamAnswer) => {
    fetchCommentBankEntries(questionIndex, answer);
    setActiveCommentBank({ questionIndex, answer });
  };

  // Close the comment bank modal
  const closeCommentBank = () => {
    setActiveCommentBank({ questionIndex: null });
  };

  const calculatePercentage = () => {
    return maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  };

  const getGradeLetter = (percentage: number) => {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  };

  const handleSaveGrade = async () => {
    try {
      setSaving(true);
      
      const gradeData = {
        gradedBy: 'admin', // TODO: Get from current user
        totalScore,
        maxScore,
        percentage: calculatePercentage(),
        grade: grade || getGradeLetter(calculatePercentage()),
        questionGrades: questionGrades.filter(grade => !deletedQuestions.has(grade.questionIndex)),
        overallFeedback,
        deletedQuestions: Array.from(deletedQuestions),
        review: {
          totalScore,
          maxScore,
          percentage: calculatePercentage(),
          grade: grade || getGradeLetter(calculatePercentage()),
          feedback: overallFeedback
        }
      };

      const response = await fetch(`/api/admin/exam/${examId}/grade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gradeData),
      });

      if (!response.ok) {
        throw new Error('Failed to save grade');
      }

      // Show success message and redirect
      alert('הציון נשמר בהצלחה!');
      router.push('/admin/exam-grading');
    } catch (err) {
      console.error('Error saving grade:', err);
      setError('Failed to save grade');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('he-IL');
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>טוען פרטי בחינה...</div>
      </div>
    );
  }

  if (error || !examData) {
    return (
      <div className={styles.container}>
        <div className={styles.errorMessage}>
          {error || 'לא נמצאו נתוני בחינה'}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button 
          onClick={() => router.push('/admin/exam-grading')}
          className={styles.backButton}
        >
          <ArrowLeft size={20} />
          חזרה לרשימת בחינות
        </button>
        <h1 className={styles.title}>
          <FileText size={24} />
          בדיקה וציונים - בחינה
        </h1>
      </div>

      {/* Student Info */}
      <div className={styles.studentInfo}>
        <div className={styles.studentCard}>
          <div className={styles.studentHeader}>
            <User size={20} />
            <h3>פרטי סטודנט</h3>
          </div>
          <div className={styles.studentDetails}>
            <div className={styles.studentDetail}>
              <span className={styles.label}>שם:</span>
              <span>{examData.session.studentName || 'לא צוין'}</span>
            </div>
            <div className={styles.studentDetail}>
              <span className={styles.label}>אימייל:</span>
              <span>{examData.session.studentEmail}</span>
            </div>
            {examData.session.studentId && (
              <div className={styles.studentDetail}>
                <span className={styles.label}>מספר זהות:</span>
                <span>{examData.session.studentId}</span>
              </div>
            )}
            <div className={styles.studentDetail}>
              <span className={styles.label}>תאריך התחלה:</span>
              <span>{formatDate(examData.session.startTime)}</span>
            </div>
            {examData.session.endTime && (
              <div className={styles.studentDetail}>
                <span className={styles.label}>תאריך סיום:</span>
                <span>{formatDate(examData.session.endTime)}</span>
              </div>
            )}
            <div className={styles.studentDetail}>
              <span className={styles.label}>סטטוס:</span>
              <span className={styles.status}>{examData.session.status}</span>
            </div>
          </div>
        </div>

        {/* Grade Summary */}
        <div className={styles.gradeSummary}>
          <div className={styles.gradeHeader}>
            <h3>סיכום ציון</h3>
          </div>
          <div className={styles.gradeDetails}>
            <div className={styles.gradeRow}>
              <span className={styles.label}>ציון:</span>
              <span className={styles.percentage}>{calculatePercentage()}</span>
            </div>
            <div className={styles.gradeRow}>
              <span className={styles.label}>כמות שאלות:</span>
              <span className={styles.score}>{examData?.answers ? examData.answers.filter(answer => !deletedQuestions.has(answer.questionIndex)).length : 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className={styles.questionsSection}>
        <h2 className={styles.sectionTitle}>שאלות ותשובות</h2>
        
        {examData.answers.filter(answer => !deletedQuestions.has(answer.questionIndex)).map((answer, index) => {
          const questionGrade = questionGrades.find(g => g.questionIndex === answer.questionIndex);
          const questionPoints = answer.questionDetails?.points || 1;
          
          return (
            <div key={answer._id} className={styles.questionCard}>
              <div className={styles.questionHeader}>
                <div className={styles.questionNumber}>
                  שאלה {answer.questionIndex + 1}
                </div>
                <div className={styles.questionMeta}>
                  <span className={`${styles.difficulty} ${styles[answer.difficulty]}`}>
                    {answer.difficulty === 'easy' ? 'קל' : 
                     answer.difficulty === 'medium' ? 'בינוני' : 
                     answer.difficulty === 'hard' ? 'קשה' : 
                     answer.difficulty === 'algebra' ? 'אלגברה' : answer.difficulty}
                  </span>
                  <span className={styles.points}>
                    {questionPoints} נקודות
                  </span>
                  <span className={styles.timeSpent}>
                    <Clock size={14} />
                    {formatTime(answer.timeSpent)}
                  </span>
                  <span className={`${styles.correctness} ${answer.isCorrect ? styles.correct : styles.incorrect}`}>
                    {answer.isCorrect ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    {answer.isCorrect ? 'נכון' : 'שגוי'}
                  </span>
                  <button
                    onClick={() => handleDeleteQuestion(answer.questionIndex)}
                    className={styles.deleteButton}
                    title="מחק שאלה מהבחינה"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* AI Suspicion Warning Banner */}
              {aiAnalyses[answer.questionIndex]?.isAISuspicious && (
                <div className={styles.aiSuspiciousBanner}>
                  <div className={styles.aiWarningContent}>
                    <AlertTriangle size={16} className={styles.aiWarningIcon} />
                    <span className={styles.aiWarningText}>
                      חשד לתשובה שנוצרה על ידי AI - ציון חשדנות: {aiAnalyses[answer.questionIndex].suspicionScore}%
                    </span>
                                         {aiAnalyses[answer.questionIndex].triggeredTraps.length > 0 && (
                       <div className={styles.aiTrapsList}>
                         <strong>מלכודות שהתגלו:</strong> {aiAnalyses[answer.questionIndex].triggeredTraps.map(trap => trap.description).join(', ')}
                       </div>
                     )}
                  </div>
                </div>
              )}

              <div className={styles.questionContent}>
                <div className={styles.questionText}>
                  <strong>שאלה:</strong>
                  <p>{answer.questionText}</p>
                </div>

                <div className={styles.answerSection}>
                                  <div className={styles.studentAnswer}>
                  <strong>תשובת הסטודנט:</strong>
                  {aiAnalyses[answer.questionIndex]?.highlightedText && aiAnalyses[answer.questionIndex].isAISuspicious ? (
                    <div className={styles.highlightedAnswerContainer}>
                      <div className={styles.highlightedAnswerHeader}>
                        <AlertTriangle size={14} />
                        זוהו איזורים חשודים
                      </div>
                      <div className={styles.highlightedAnswerContent}>
                        <pre 
                          className={styles.sqlCodeHighlighted}
                          dangerouslySetInnerHTML={{ __html: aiAnalyses[answer.questionIndex].highlightedText || '' }}
                        />
                      </div>
                    </div>
                  ) : (
                    <pre className={styles.sqlCode}>{answer.studentAnswer}</pre>
                  )}
                </div>

                  <div className={styles.correctAnswer}>
                    <strong>תשובה נכונה:</strong>
                    <pre className={styles.sqlCode}>{answer.correctAnswer}</pre>
                  </div>
                </div>

                <div className={styles.gradingSection}>
                  <div className={styles.gradeInputs}>
                    <div className={styles.scoreInput}>
                      <label>ציון:</label>
                      <input
                        type="number"
                        min="0"
                        max={questionPoints}
                        step="0.1"
                        value={questionGrade?.score || 0}
                        onChange={(e) => handleQuestionGradeChange(answer.questionIndex, 'score', Number(e.target.value))}
                        className={styles.scoreField}
                      />
                      <span>/ {questionPoints}</span>
                      <div className={styles.quickApprovalButtons}>
                        <button
                          onClick={() => handleApproveAnswer(answer.questionIndex, { ...answer, isCorrect: true })}
                          className={`${styles.quickApproveBtn} ${styles.approveCorrectQuick}`}
                          title={`אשר ${questionPoints} נקודות - תשובה נכונה`}
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={() => handleApproveAnswer(answer.questionIndex, { ...answer, isCorrect: false })}
                          className={`${styles.quickApproveBtn} ${styles.approveIncorrectQuick}`}
                          title="אשר 0 נקודות - תשובה שגויה"
                        >
                          <X size={12} />
                        </button>
                        <span className={styles.michaelIndicator}>
                          <span className={styles.michaelSuggestion}>
                            מייקל: {answer.isCorrect ? (
                              <span className={styles.michaelCorrect}>✓</span>
                            ) : (
                              <span className={styles.michaelIncorrect}>✗</span>
                            )}
                          </span>
                        </span>
                      </div>
                    </div>
                    <div className={styles.feedbackInput}>
                      <div className={styles.feedbackHeader}>
                        <label>הערות:</label>
                        <button
                          type="button"
                          onClick={() => openCommentBank(answer.questionIndex, answer)}
                          className={styles.commentBankToggle}
                          title="פתח בנק הערות - הערות נשמרות אוטומטית בכתיבה"
                        >
                          <FileText size={14} />
                          בנק הערות
                        </button>
                      </div>
                      <textarea
                        value={questionGrade?.feedback || ''}
                        onChange={(e) => handleQuestionGradeChange(answer.questionIndex, 'feedback', e.target.value)}
                        placeholder="הערות על התשובה..."
                        className={styles.feedbackField}
                        rows={2}
                      />
                      <div className={styles.autoSaveNote}>
                        💡 הערה: הערות נשמרות אוטומטית בבנק ההערות אחרי שנייה מכתיבה
                      </div>
                      
                      {/* Comment Bank Modal (global, not per-question) */}
                      {activeCommentBank.questionIndex !== null && (
                        <div className={styles.commentBankOverlay}>
                          <div className={styles.commentBankPopup}>
                            <div className={styles.commentBankHeader}>
                              <h4>בנק הערות - שאלה {activeCommentBank.questionIndex! + 1}</h4>
                              <button
                                onClick={closeCommentBank}
                                className={styles.closeCommentBank}
                              >
                                <X size={16} />
                              </button>
                            </div>
                            <div className={styles.commentBankContent}>
                              {loadingComments[activeCommentBank.questionIndex!] ? (
                                <div className={styles.commentBankLoading}>טוען הערות...</div>
                              ) : commentBankEntries[activeCommentBank.questionIndex!] && commentBankEntries[activeCommentBank.questionIndex!].length > 0 ? (
                                <div className={styles.commentsList}>
                                  {commentBankEntries[activeCommentBank.questionIndex!].map((comment) => (
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
                                        onClick={() => {
                                          useCommentFromBank(activeCommentBank.questionIndex!, comment);
                                          closeCommentBank();
                                        }}
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
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall Feedback */}
      <div className={styles.overallFeedback}>
        <h3>הערות כלליות</h3>
        <textarea
          value={overallFeedback}
          onChange={(e) => setOverallFeedback(e.target.value)}
          placeholder="הערות כלליות על הבחינה..."
          className={styles.overallFeedbackField}
          rows={4}
        />
      </div>

      {/* Save Button */}
      <div className={styles.saveSection}>
        <button
          onClick={handleSaveGrade}
          disabled={saving}
          className={styles.saveButton}
        >
          <Save size={20} />
          {saving ? 'שומר...' : 'שמור ציון'}
        </button>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm !== null && (
        <div className={styles.deleteConfirmOverlay}>
          <div className={styles.deleteConfirmDialog}>
            <div className={styles.deleteConfirmHeader}>
              <AlertTriangle size={24} className={styles.warningIcon} />
              <h3>אישור מחיקת שאלה</h3>
            </div>
            <div className={styles.deleteConfirmContent}>
              <p>האם אתה בטוח שברצונך למחוק את שאלה {showDeleteConfirm + 1} מהבחינה?</p>
              <p className={styles.warningText}>פעולה זו לא ניתנת לביטול ותשפיע על הציון הסופי.</p>
            </div>
            <div className={styles.deleteConfirmActions}>
              <button
                onClick={() => confirmDeleteQuestion(showDeleteConfirm)}
                className={styles.confirmDeleteButton}
              >
                מחק שאלה
              </button>
              <button
                onClick={cancelDeleteQuestion}
                className={styles.cancelDeleteButton}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamGradingPage; 