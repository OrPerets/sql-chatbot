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
  mergedAnswers?: ExamAnswer[]; // For final exams
  existingGrades?: QuestionGrade[];
}

interface QuestionGrade {
  uniqueKey: string; // Format: "answerId_questionIndex" to ensure uniqueness
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
  const [savingQuestions, setSavingQuestions] = useState<Set<string>>(new Set());
  const [savedQuestions, setSavedQuestions] = useState<Set<string>>(new Set());
  const [initializedExamId, setInitializedExamId] = useState<string | null>(null);
  
  // Helper function to create unique key
  const createUniqueKey = (answerId: string, questionIndex: number) => `${answerId}_${questionIndex}`;

  // Helper function to get answer by unique key
  const getAnswerByUniqueKey = (uniqueKey: string) => {
    const answerId = uniqueKey.split('_')[0];
    return examData?.answers.find(answer => answer._id === answerId);
  };

  // Helper function to get unique answers (filter duplicates based on question text)
  const getUniqueAnswers = (answers: ExamAnswer[]) => {
    if (!answers) return [];
    
    const uniqueAnswers = answers.filter((answer, index, arr) => {
      const firstOccurrence = arr.findIndex(a => a.questionText.trim() === answer.questionText.trim());
      const isUnique = index === firstOccurrence;
      
      // Debug logging for duplicates
      if (!isUnique) {
        console.log(`🔄 Filtering duplicate question: "${answer.questionText.substring(0, 50)}..." (index ${index}, first occurrence at ${firstOccurrence})`);
      }
      
      return isUnique;
    });
    
    console.log(`📊 Original answers: ${answers.length}, Unique answers: ${uniqueAnswers.length}, Filtered: ${answers.length - uniqueAnswers.length}`);
    return uniqueAnswers;
  };

  // Get unique answers for rendering
  const uniqueAnswers = examData?.answers ? getUniqueAnswers(examData.answers) : [];

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
    // Initialize question grades when exam data loads (only once per exam)
    // Check for both answers (regular exams) and mergedAnswers (final exams)
    if ((examData?.answers || examData?.mergedAnswers) && initializedExamId !== examId) {
      console.log('🔄 Initializing grades for exam:', examId);
      console.log('📊 Exam data has mergedAnswers:', !!examData.mergedAnswers);
      console.log('📊 Exam data has answers:', !!examData.answers);
      console.log('📊 Exam data has existingGrades:', !!examData.existingGrades);
      
      // Get unique answers (prioritize mergedAnswers for finalExams)
      const answersSource = examData.mergedAnswers || examData.answers;
      const uniqueAnswers = getUniqueAnswers(answersSource);
      console.log('📊 Found unique answers:', uniqueAnswers.length);
      
      // Create a map of existing grades by unique key from loaded data
      const existingGradesMap = new Map();
      if (examData.existingGrades && Array.isArray(examData.existingGrades)) {
        console.log('🔄 Found existing grades:', examData.existingGrades.length);
        console.log('📊 Existing grades preview:', examData.existingGrades.slice(0, 3));
        
        // NEW: Try to match by questionIndex first (more reliable)
        examData.existingGrades.forEach((grade) => {
          if (grade.questionIndex !== undefined) {
            // Find the answer with matching questionIndex
            const matchingAnswer = uniqueAnswers.find(answer => answer.questionIndex === grade.questionIndex);
            if (matchingAnswer) {
              const uniqueKey = createUniqueKey(matchingAnswer._id, matchingAnswer.questionIndex);
              existingGradesMap.set(uniqueKey, grade);
              console.log(`📊 Mapped grade for question ${grade.questionIndex}: score=${grade.score}, feedback="${grade.feedback?.substring(0, 50)}..."`);
            }
          }
        });
        
        // FALLBACK: If no questionIndex matching worked, try array index matching
        if (existingGradesMap.size === 0) {
          console.log('⚠️ No questionIndex matches found, falling back to array index matching...');
          examData.existingGrades.forEach((grade, index) => {
            const answer = uniqueAnswers[index];
            if (answer) {
              const uniqueKey = createUniqueKey(answer._id, answer.questionIndex);
              existingGradesMap.set(uniqueKey, grade);
              console.log(`📊 Fallback mapped grade for index ${index} (question ${answer.questionIndex}): score=${grade.score}`);
            }
          });
        }
        
        console.log(`✅ Total grades mapped: ${existingGradesMap.size} out of ${examData.existingGrades.length} available`);
      } else {
        console.log('⚠️ No existing grades found in exam data');
      }

      // Create grade objects for ALL questions with unique keys
      const allGrades = uniqueAnswers.map(answer => {
        const uniqueKey = createUniqueKey(answer._id, answer.questionIndex);
        const existing = existingGradesMap.get(uniqueKey);
        const questionPoints = answer.questionDetails?.points || 1;
        
        if (existing) {
          return {
            uniqueKey,
            questionIndex: answer.questionIndex,
            score: existing.score,
            maxScore: questionPoints,
            feedback: existing.feedback || ''
          };
        } else {
          return {
            uniqueKey,
            questionIndex: answer.questionIndex,
            score: answer.isCorrect ? questionPoints : 0,
            maxScore: questionPoints,
            feedback: ''
          };
        }
      });
      
      console.log('Setting question grades with unique keys:', allGrades);
      setQuestionGrades(allGrades);
      setInitializedExamId(examId);

      // Analyze answers for AI patterns (only once)
      const aiAnalysisResults: {[questionIndex: number]: TrapDetection} = {};
      uniqueAnswers.forEach(answer => {
        const analysis = detectAITraps(answer.studentAnswer);
        aiAnalysisResults[answer.questionIndex] = analysis;
      });
      setAiAnalyses(aiAnalysisResults);
    }
  }, [examData, examId]);

  // Separate effect for recalculating totals when deleted questions change
  useEffect(() => {
    if (examData?.answers) {
      // Calculate total max score based on actual question points (excluding deleted questions)
      const totalMaxScore = examData.answers
        .filter(answer => !deletedQuestions.has(answer.questionIndex))
        .reduce((sum, answer) => sum + (answer.questionDetails?.points || 1), 0);
      setMaxScore(totalMaxScore);
      
      // Calculate total score based on current grades (excluding deleted questions)
      const totalCurrentScore = questionGrades
        .filter(grade => !deletedQuestions.has(grade.questionIndex))
        .reduce((sum, grade) => sum + grade.score, 0);
      setTotalScore(totalCurrentScore);
    }
  }, [deletedQuestions, questionGrades, examData]);

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
      
      // Load any existing grade data BEFORE setting exam data
      try {
        console.log(`📊 Loading grade data for ${isFinalExam ? 'final exam' : 'regular exam'}: ${examId}`);
        
        let gradeResponse = await fetch(`/api/admin/${isFinalExam ? 'final-exam' : 'exam'}/${examId}/grade`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        
        // If primary source fails, try the other source (grades might be saved in either location)
        if (!gradeResponse.ok) {
          console.log(`⚠️ Primary grade source failed, trying alternate source...`);
          const alternateEndpoint = isFinalExam ? 'exam' : 'final-exam';
          gradeResponse = await fetch(`/api/admin/${alternateEndpoint}/${examId}/grade`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache'
            }
          });
          
          if (gradeResponse.ok) {
            console.log(`✅ Found grade data in alternate source (${alternateEndpoint})`);
          }
        }
        
        if (gradeResponse.ok) {
          const gradeData = await gradeResponse.json();
          console.log('✅ Successfully loaded grade data:', gradeData);
          console.log('📊 Grade data source:', gradeData.dataSource);
          console.log('📊 Question grades count:', gradeData.questionGrades?.length || 0);
          console.log('📊 Total score:', gradeData.totalScore);
          if (gradeData.questionGrades?.length > 0) {
            console.log('📊 First few question grades:', gradeData.questionGrades.slice(0, 3));
          }
          
          // Load existing deleted questions
          if (gradeData.deletedQuestions && Array.isArray(gradeData.deletedQuestions)) {
            // Merge with any existing deleted questions from exam data
            const allDeletedQuestions = new Set([
              ...(data.deletedQuestions || []),
              ...gradeData.deletedQuestions
            ]);
            setDeletedQuestions(allDeletedQuestions);
            console.log('📝 Loaded deleted questions:', allDeletedQuestions);
          } else if (data.deletedQuestions && Array.isArray(data.deletedQuestions)) {
            setDeletedQuestions(new Set(data.deletedQuestions));
          }
          
          // Attach existing grades to exam data
          if (gradeData.questionGrades && Array.isArray(gradeData.questionGrades)) {
            data.existingGrades = gradeData.questionGrades;
            const savedIndices = gradeData.questionGrades.map(g => g.questionIndex);
            setSavedQuestions(new Set(savedIndices));
            console.log('📊 Found and attached existing grades:', gradeData.questionGrades);
            console.log('💾 Marking questions as saved:', savedIndices);
          } else {
            console.log('⚠️ No existing question grades found in response');
          }
          
          // Load overall feedback and scores
          if (gradeData.overallFeedback) {
            setOverallFeedback(gradeData.overallFeedback);
          }
          if (gradeData.totalScore !== undefined) {
            setTotalScore(gradeData.totalScore);
          }
          if (gradeData.maxScore !== undefined) {
            setMaxScore(gradeData.maxScore);
          }
          if (gradeData.grade) {
            setGrade(gradeData.grade);
          }
        } else {
          console.log('No existing grade data found - response not ok');
          // Set deleted questions from exam data only
          if (data.deletedQuestions && Array.isArray(data.deletedQuestions)) {
            setDeletedQuestions(new Set(data.deletedQuestions));
          }
        }
      } catch (err) {
        console.log('No previous grade data found, using exam data deleted questions only');
        // Set deleted questions from exam data only
        if (data.deletedQuestions && Array.isArray(data.deletedQuestions)) {
          setDeletedQuestions(new Set(data.deletedQuestions));
        }
      }

      // Set exam data AFTER we've attached existing grades
      setExamData(data);
    } catch (err) {
      console.error('Error fetching exam data:', err);
      setError('Failed to load exam data');
    } finally {
      setLoading(false);
    }
  };



  const handleQuestionGradeChange = (uniqueKey: string, field: 'score' | 'feedback', value: string | number) => {
    const updatedGrades = questionGrades.map(grade => 
      grade.uniqueKey === uniqueKey 
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

    // Remove from saved questions when data changes
    setSavedQuestions(prev => {
      const newSet = new Set(prev);
      newSet.delete(uniqueKey);
      return newSet;
    });

    // Note: Auto-save to comment bank removed to reduce database calls
    // Users can manually save to comment bank via the save button
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
    
    // Recalculate totals after deletion using unique answers
    if (uniqueAnswers) {
      const totalMaxScore = uniqueAnswers
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

  // Comment Bank functions with caching
  const fetchCommentBankEntries = async (questionIndex: number, answer: ExamAnswer) => {
    // Check if we already have cached entries for this question
    if (commentBankEntries[questionIndex]) {
      return; // Use cached data
    }
    
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

  // Save individual question grade
  const saveQuestionGrade = async (uniqueKey: string) => {
    try {
      setSavingQuestions(prev => new Set([...Array.from(prev), uniqueKey]));
      
      const currentGrade = questionGrades.find(grade => grade.uniqueKey === uniqueKey);
      if (!currentGrade) {
        throw new Error('No grade found for this answer');
      }
      
      // Instead of individual question save, we'll save the entire current state
      // This ensures persistence and compatibility with existing backend
      const allGrades = questionGrades.filter(grade => !deletedQuestions.has(grade.questionIndex));
      
      const gradeData = {
        gradedBy: 'admin',
        totalScore,
        maxScore,
        percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
        grade: '',
        questionGrades: allGrades.map(grade => ({
          questionIndex: grade.questionIndex,
          score: grade.score,
          maxScore: grade.maxScore,
          feedback: grade.feedback
        })),
        overallFeedback,
        deletedQuestions: Array.from(deletedQuestions),
        partialSave: true,
        savedUniqueKey: uniqueKey,
        timestamp: new Date().toISOString()
      };

      console.log('Saving grade data:', gradeData);

      // Try final exam endpoint first, then regular exam
      let response = await fetch(`/api/admin/final-exam/${examId}/grade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gradeData),
      });

      if (!response.ok) {
        // Try regular exam endpoint
        response = await fetch(`/api/admin/exam/${examId}/grade`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(gradeData),
        });
      }

      if (!response.ok) {
        console.error('Save failed with status:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error('Failed to save question grade');
      }

      const result = await response.json();
      console.log('Save successful:', result);

      // Mark as saved
      setSavedQuestions(prev => new Set([...Array.from(prev), uniqueKey]));
      
      // Also save to comment bank if there's feedback
      const answer = getAnswerByUniqueKey(uniqueKey);
      if (currentGrade.feedback && currentGrade.feedback.trim() && answer) {
        try {
          await saveToCommentBank(answer.questionIndex, answer, currentGrade.score, currentGrade.feedback);
        } catch (err) {
          console.error('Failed to save to comment bank:', err);
          // Don't fail the whole operation if comment bank save fails
        }
      }
      
      // Show success message
      const successMessage = document.createElement('div');
      successMessage.innerHTML = `✅ תשובה לשאלה ${currentGrade.questionIndex + 1} נשמרה`;
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
      
      setTimeout(() => {
        if (successMessage.parentNode) {
          successMessage.parentNode.removeChild(successMessage);
        }
      }, 4000);
      
    } catch (err) {
      console.error('Error saving question grade:', err);
      
      const errorMessage = document.createElement('div');
      errorMessage.innerHTML = `❌ שגיאה בשמירת התשובה`;
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
      
      setTimeout(() => {
        if (errorMessage.parentNode) {
          errorMessage.parentNode.removeChild(errorMessage);
        }
      }, 3000);
    } finally {
      setSavingQuestions(prev => {
        const newSet = new Set(prev);
        newSet.delete(uniqueKey);
        return newSet;
      });
    }
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
              <span className={styles.score}>{uniqueAnswers ? uniqueAnswers.filter(answer => !deletedQuestions.has(answer.questionIndex)).length : 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className={styles.questionsSection}>
        <h2 className={styles.sectionTitle}>שאלות ותשובות</h2>
        
        {uniqueAnswers.filter(answer => !deletedQuestions.has(answer.questionIndex)).map((answer, index) => {
          const uniqueKey = createUniqueKey(answer._id, answer.questionIndex);
          const questionGrade = questionGrades.find(g => g.uniqueKey === uniqueKey);
          const questionPoints = answer.questionDetails?.points || 1;
          
          return (
            <div key={uniqueKey} className={styles.questionCard}>
              <div className={styles.questionHeader}>
                <div className={styles.questionNumber}>
                  שאלה {answer.questionIndex + 1} {answer._id !== uniqueAnswers.find(a => a.questionIndex === answer.questionIndex)?._id ? `(${answer._id.slice(-4)})` : ''}
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
                        onChange={(e) => handleQuestionGradeChange(uniqueKey, 'score', Number(e.target.value))}
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
                        onChange={(e) => handleQuestionGradeChange(uniqueKey, 'feedback', e.target.value)}
                        placeholder="הערות על התשובה..."
                        className={styles.feedbackField}
                        rows={2}
                      />
                      <div className={styles.autoSaveNote}>
                        💡 הערה: לשמירת הערות לבנק ההערות, השתמש בכפתור "שמור שאלה" למטה
                      </div>
                      
                      {/* Individual Save Button */}
                      <div className={styles.questionSaveContainer}>
                        <button
                          onClick={() => saveQuestionGrade(uniqueKey)}
                          disabled={savingQuestions.has(uniqueKey)}
                          className={`${styles.questionSaveButton} ${
                            savedQuestions.has(uniqueKey) ? styles.questionSaved : ''
                          }`}
                        >
                          {savingQuestions.has(uniqueKey) ? (
                            <>⏳ שומר...</>
                          ) : savedQuestions.has(uniqueKey) ? (
                            <>✅ נשמר</>
                          ) : (
                            <>💾 שמור תשובה</>
                          )}
                        </button>
                        {savedQuestions.has(uniqueKey) && (
                          <span className={styles.savedIndicator}>
                            התשובה נשמרה והערות יישמרו על רענון הדף
                          </span>
                        )}
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