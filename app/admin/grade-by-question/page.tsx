"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Search, Eye, Users, CheckCircle, XCircle, Clock, Edit3, Filter, BarChart3, AlertTriangle, AlertCircle, Info, Plus, Trash2, Tag, Save, MessageSquare, Database } from 'lucide-react';
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

const GradeByQuestionPage: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionWithAnswers | null>(null);
  const [loading, setLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard' | 'algebra'>('all');
  
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
  const DATABASE_SCHEMA = {
    tables: {
      'pilots': ['pilot_id', 'pilot_name', 'squadron_id'],
      'squadrons': ['squadron_id', 'squadron_name', 'base_location'],
      'aircraft': ['aircraft_id', 'aircraft_type', 'squadron_id'],
      'missions': ['mission_id', 'mission_date', 'pilot_id', 'aircraft_id', 'target_location'],
      'weapons': ['weapon_id', 'weapon_type', 'weapon_effectiveness'] // Note: no squadron_id here
    },
    invalidTables: ['missionanalytics', 'mission_analytics', 'aircraft_assignments', 'pilotschedule', 'weaponinventory', 'squadron_aircraft', 'mission_reports', 'aircraft_maintenance'],
    invalidColumns: {
      'pilots': ['salary', 'hire_date', 'last_mission', 'training_hours', 'weapon_id'],
      'squadrons': ['budget', 'commander_id', 'home_base', 'aircraft_count'],
      'aircraft': ['last_maintenance', 'flight_hours', 'fuel_capacity', 'max_speed'],
      'missions': ['weapon_id', 'pilot_count', 'aircraft_count', 'success_rate', 'cost', 'duration_minutes', 'fuel_consumption', 'weapon_effectiveness'],
      'weapons': ['squadron_id'] // This is a key trap - weapons don't have squadron_id
    }
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

    fetchQuestions();
  }, [router]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/questions-with-answers');
      if (!response.ok) {
        throw new Error('Failed to fetch questions');
      }
      const data = await response.json();
      setQuestions(data);
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
      const timestamp = Date.now();
      const response = await fetch(`/api/admin/question/${questionId}/answers?t=${timestamp}&bust=${Math.random()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch question answers');
      }
      const data = await response.json();
      setSelectedQuestion(data);
      setCurrentAnswerIndex(0);
      setProcessedAnswers(new Set());
      
      // Load first answer data if available
      if (data.answers && data.answers.length > 0) {
        // Get unique answers and load first one
        const uniqueAnswers = data.answers.filter((answer, index, self) => {
          const firstOccurrence = self.findIndex(a => 
            a.studentEmail === answer.studentEmail
          );
          return index === firstOccurrence;
        });
        
        if (uniqueAnswers.length > 0) {
          const firstAnswer = uniqueAnswers[0];
          setCurrentGrade(firstAnswer.grade || (firstAnswer.isCorrect ? data.question.points : 0));
          setCurrentFeedback(firstAnswer.feedback || '');
        }
      }
      
      // Load comment bank for this question
      fetchCommentBankEntries(questionId);
    } catch (err) {
      console.error('Error fetching question answers:', err);
      setError('Failed to load question answers');
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

    // Check for invalid tables
    DATABASE_SCHEMA.invalidTables.forEach(table => {
      const regex = new RegExp(`\\b${table.toUpperCase()}\\b`, 'gi');
      if (regex.test(upperAnswer)) {
        hasInvalidTables = true;
        invalidItems.push(`טבלה לא קיימת: ${table}`);
      }
    });

    // Check for invalid columns in each table
    Object.entries(DATABASE_SCHEMA.invalidColumns).forEach(([table, columns]) => {
      columns.forEach(column => {
        const regex = new RegExp(`${table}\\.${column}|${column}.*FROM.*${table}`, 'gi');
        if (regex.test(answer)) {
          hasInvalidColumns = true;
          invalidItems.push(`עמודה לא קיימת: ${table}.${column}`);
        }
      });
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

      // Auto-save to comment bank if feedback is provided
      if (finalFeedback && finalFeedback.trim()) {
        try {
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
    
    // Debug logging
    console.log(`🔍 Original answers count: ${selectedQuestion.answers.length}`);
    selectedQuestion.answers.forEach((answer, index) => {
      console.log(`  ${index}: ${answer.studentEmail} (QIndex: ${answer.questionIndex}, ExamId: ${answer.examId?.slice(-6)})`);
    });
    
    const uniqueAnswers = selectedQuestion.answers.filter((answer, index, self) => {
      // Since we're viewing a specific question, only deduplicate by student email
      // The same student might have different questionIndex values for the same question
      const firstOccurrence = self.findIndex(a => 
        a.studentEmail === answer.studentEmail
      );
      const isUnique = index === firstOccurrence;
      
      if (!isUnique) {
        console.log(`🔄 Filtering duplicate: ${answer.studentEmail} at index ${index}`);
      }
      
      return isUnique;
    });
    
    console.log(`✅ Unique answers count: ${uniqueAnswers.length}`);
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
      if (b.answerCount !== a.answerCount) {
        return b.answerCount - a.answerCount;
      }
      return a.id - b.id;
    });

  if (loading) {
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

  const getCurrentAnswer = () => {
    const uniqueAnswers = getUniqueAnswers();
    if (uniqueAnswers.length === 0 || currentAnswerIndex >= uniqueAnswers.length) return null;
    return uniqueAnswers[currentAnswerIndex];
  };

  const currentAnswer = getCurrentAnswer();

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
              {filteredQuestions.map((question) => {
                // Calculate unique student count for this question
                const uniqueStudentCount = question.answers
                  ? question.answers.filter((answer: any, idx: number, arr: any[]) =>
                      arr.findIndex(a => a.studentEmail === answer.studentEmail) === idx
                    ).length
                  : question.answerCount;
                return (
                  <div
                    key={question.id}
                    className={styles.questionCard}
                    onClick={() => fetchQuestionAnswers(question.id)}
                  >
                    <div className={styles.questionHeader}>
                      <div className={styles.questionId}>
                        שאלה #{question.id}
                        {uniqueStudentCount === 0 && <span className={styles.noAnswersBadge}>אין תשובות</span>}
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
              })}
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
          /* Question Grading View with Sidebar */
          <div className={styles.gradingView}>
            {questionsLoading ? (
              <div className={styles.loading}>טוען תשובות...</div>
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
                            {aiAnalysis.isAISuspicious && (
                              <div className={styles.aiSuspicionBanner}>
                                <div className={styles.aiSuspicionHeader}>
                                  <AlertTriangle size={20} />
                                  <span>⚠️ חשוד בשימוש ב-AI (ציון חשד: {aiAnalysis.suspicionScore})</span>
                                </div>
                                {aiAnalysis.triggeredTraps.length > 0 && (
                                  <div className={styles.aiSuspicionDetails}>
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