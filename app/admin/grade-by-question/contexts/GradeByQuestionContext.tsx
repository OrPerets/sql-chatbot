"use client";

import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';

// Types
interface Question {
  id: number;
  question: string;
  difficulty: string;
  points: number;
  approved: boolean;
  answerCount: number;
  averageScore?: number;
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
  _id?: string;
}

interface QuestionWithAnswers {
  question: Question;
  answers: StudentAnswer[];
  totalAnswers: number;
  gradedAnswers: number;
  averageGrade: number;
  pagination?: {
    currentPage: number;
    totalPages: number;
    hasMore: boolean;
    limit: number;
  };
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
  reduced_points?: number;
  tag?: 'positive' | 'negative';
  likes?: number;
  dislikes?: number;
  userRating?: 'like' | 'dislike' | null;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalQuestions: number;
  hasMore: boolean;
  questionsPerPage: number;
}

// State interface
interface GradeByQuestionState {
  // Questions state
  questions: Question[];
  selectedQuestion: QuestionWithAnswers | null;
  pagination: PaginationInfo;
  
  // Loading states
  loading: boolean;
  questionsLoading: boolean;
  savingGrade: boolean;
  
  // Filters and search
  searchTerm: string;
  difficultyFilter: 'all' | 'easy' | 'medium' | 'hard' | 'algebra';
  gradingStatusFilter: 'all' | 'completed' | 'partial' | 'ungraded';
  
  // Current grading session
  currentAnswerIndex: number;
  currentGrade: number;
  currentFeedback: string;
  processedAnswers: Set<string>;
  
  // Comment bank
  commentBankEntries: CommentBankEntry[];
  loadingComments: boolean;
  
  // UI state
  error: string;
  lastRefreshTime: Date | null;
}

// Action types
type GradeByQuestionAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_QUESTIONS_LOADING'; payload: boolean }
  | { type: 'SET_SAVING_GRADE'; payload: boolean }
  | { type: 'SET_QUESTIONS'; payload: Question[] }
  | { type: 'SET_SELECTED_QUESTION'; payload: QuestionWithAnswers | null }
  | { type: 'SET_PAGINATION'; payload: PaginationInfo }
  | { type: 'SET_SEARCH_TERM'; payload: string }
  | { type: 'SET_DIFFICULTY_FILTER'; payload: 'all' | 'easy' | 'medium' | 'hard' | 'algebra' }
  | { type: 'SET_GRADING_STATUS_FILTER'; payload: 'all' | 'completed' | 'partial' | 'ungraded' }
  | { type: 'SET_CURRENT_ANSWER_INDEX'; payload: number }
  | { type: 'SET_CURRENT_GRADE'; payload: number }
  | { type: 'SET_CURRENT_FEEDBACK'; payload: string }
  | { type: 'SET_PROCESSED_ANSWERS'; payload: Set<string> }
  | { type: 'ADD_PROCESSED_ANSWER'; payload: string }
  | { type: 'SET_COMMENT_BANK_ENTRIES'; payload: CommentBankEntry[] }
  | { type: 'SET_LOADING_COMMENTS'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_LAST_REFRESH_TIME'; payload: Date }
  | { type: 'RESET_GRADING_SESSION' };

// Initial state
const initialState: GradeByQuestionState = {
  questions: [],
  selectedQuestion: null,
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalQuestions: 0,
    hasMore: false,
    questionsPerPage: 10
  },
  loading: true,
  questionsLoading: false,
  savingGrade: false,
  searchTerm: '',
  difficultyFilter: 'all',
  gradingStatusFilter: 'all',
  currentAnswerIndex: 0,
  currentGrade: 0,
  currentFeedback: '',
  processedAnswers: new Set(),
  commentBankEntries: [],
  loadingComments: false,
  error: '',
  lastRefreshTime: null
};

// Reducer
function gradeByQuestionReducer(state: GradeByQuestionState, action: GradeByQuestionAction): GradeByQuestionState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_QUESTIONS_LOADING':
      return { ...state, questionsLoading: action.payload };
    case 'SET_SAVING_GRADE':
      return { ...state, savingGrade: action.payload };
    case 'SET_QUESTIONS':
      return { ...state, questions: action.payload };
    case 'SET_SELECTED_QUESTION':
      return { ...state, selectedQuestion: action.payload };
    case 'SET_PAGINATION':
      return { ...state, pagination: action.payload };
    case 'SET_SEARCH_TERM':
      return { ...state, searchTerm: action.payload };
    case 'SET_DIFFICULTY_FILTER':
      return { ...state, difficultyFilter: action.payload };
    case 'SET_GRADING_STATUS_FILTER':
      return { ...state, gradingStatusFilter: action.payload };
    case 'SET_CURRENT_ANSWER_INDEX':
      return { ...state, currentAnswerIndex: action.payload };
    case 'SET_CURRENT_GRADE':
      return { ...state, currentGrade: action.payload };
    case 'SET_CURRENT_FEEDBACK':
      return { ...state, currentFeedback: action.payload };
    case 'SET_PROCESSED_ANSWERS':
      return { ...state, processedAnswers: action.payload };
    case 'ADD_PROCESSED_ANSWER':
      return { 
        ...state, 
        processedAnswers: new Set([...Array.from(state.processedAnswers), action.payload])
      };
    case 'SET_COMMENT_BANK_ENTRIES':
      return { ...state, commentBankEntries: action.payload };
    case 'SET_LOADING_COMMENTS':
      return { ...state, loadingComments: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_LAST_REFRESH_TIME':
      return { ...state, lastRefreshTime: action.payload };
    case 'RESET_GRADING_SESSION':
      return {
        ...state,
        selectedQuestion: null,
        currentAnswerIndex: 0,
        currentGrade: 0,
        currentFeedback: '',
        processedAnswers: new Set(),
        commentBankEntries: []
      };
    default:
      return state;
  }
}

// Context interface
interface GradeByQuestionContextType {
  state: GradeByQuestionState;
  dispatch: React.Dispatch<GradeByQuestionAction>;
  
  // Action creators for complex operations
  fetchQuestions: (page?: number, preserveCurrentQuestion?: boolean) => Promise<void>;
  fetchQuestionAnswers: (questionId: number) => Promise<void>;
  saveGrade: (examId: string, questionIndex: number, grade: number, feedback: string) => Promise<void>;
  fetchCommentBank: (questionId: number) => Promise<void>;
  resetToQuestionsList: () => void;
  showMessage: (message: string, type: 'success' | 'error' | 'warning') => void;
}

// Create context
const GradeByQuestionContext = createContext<GradeByQuestionContextType | undefined>(undefined);

// Provider component
interface GradeByQuestionProviderProps {
  children: ReactNode;
}

export function GradeByQuestionProvider({ children }: GradeByQuestionProviderProps) {
  const [state, dispatch] = useReducer(gradeByQuestionReducer, initialState);

  // Fetch questions with pagination
  const fetchQuestions = useCallback(async (page: number = 1, preserveCurrentQuestion: boolean = false) => {
    try {
      if (!preserveCurrentQuestion) {
        dispatch({ type: 'SET_LOADING', payload: true });
      }
      dispatch({ type: 'SET_ERROR', payload: '' });

      console.log(`🚀 Fetching optimized questions page ${page}...`);

      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: state.pagination.questionsPerPage.toString(),
        includeGradingStatus: 'true'
      });

      if (state.searchTerm.trim()) {
        queryParams.append('search', state.searchTerm.trim());
      }

      if (state.difficultyFilter !== 'all') {
        queryParams.append('difficulty', state.difficultyFilter);
      }

      if (state.gradingStatusFilter !== 'all') {
        queryParams.append('gradingStatus', state.gradingStatusFilter);
      }

      const response = await fetch(`/api/admin/questions-optimized?${queryParams.toString()}`, {
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

      dispatch({ type: 'SET_QUESTIONS', payload: data.questions || [] });
      dispatch({ 
        type: 'SET_PAGINATION', 
        payload: {
          currentPage: data.currentPage || page,
          totalPages: data.totalPages || 1,
          totalQuestions: data.totalQuestions || 0,
          hasMore: data.hasMore || false,
          questionsPerPage: state.pagination.questionsPerPage
        }
      });

      dispatch({ type: 'SET_LAST_REFRESH_TIME', payload: new Date() });
      
      console.log(`✅ Fetched ${data.questions?.length || 0} questions successfully`);
    } catch (err) {
      console.error('Error fetching questions:', err);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load questions' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.searchTerm, state.difficultyFilter, state.gradingStatusFilter, state.pagination.questionsPerPage]);

  // Show message utility
  const showMessage = useCallback((message: string, type: 'success' | 'error' | 'warning') => {
    const messageDiv = document.createElement('div');
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️';
    const bgColor = type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#f59e0b';
    
    messageDiv.innerHTML = `${icon} ${message}`;
    messageDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${bgColor};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(messageDiv);
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.parentNode.removeChild(messageDiv);
      }
    }, 4000);
  }, []);

  // Fetch question answers with pagination
  const fetchQuestionAnswers = useCallback(async (questionId: number) => {
    try {
      // Loading state is now set immediately in the click handler
      dispatch({ type: 'SET_ERROR', payload: '' });

      console.log(`🔄 Fetching optimized answers for question ${questionId}...`);

      const response = await fetch(`/api/admin/question/${questionId}/answers-optimized?page=1&limit=50`, {
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch question answers');
      }

      const data = await response.json();
      
      dispatch({ type: 'SET_SELECTED_QUESTION', payload: data });
      dispatch({ type: 'SET_CURRENT_ANSWER_INDEX', payload: 0 });
      
      // Initialize grading session
      const alreadyProcessed = new Set<string>();
      if (data.answers && data.answers.length > 0) {
        data.answers.forEach((answer: StudentAnswer) => {
          if (answer.grade !== undefined && answer.grade !== null) {
            const answerId = `${answer.examId}-${answer.questionIndex}`;
            alreadyProcessed.add(answerId);
          }
        });
        
        dispatch({ type: 'SET_PROCESSED_ANSWERS', payload: alreadyProcessed });
        
        if (data.answers.length > 0) {
          const firstAnswer = data.answers[0];
          dispatch({ type: 'SET_CURRENT_GRADE', payload: firstAnswer.grade || (firstAnswer.isCorrect ? data.question.points : 0) });
          dispatch({ type: 'SET_CURRENT_FEEDBACK', payload: firstAnswer.feedback || '' });
        }
      } else {
        dispatch({ type: 'SET_PROCESSED_ANSWERS', payload: new Set() });
      }

      // Load comment bank
      await fetchCommentBank(questionId);
      
      console.log(`✅ Successfully loaded question ${questionId} with ${data.answers?.length || 0} answers`);
    } catch (err) {
      console.error(`Error fetching question ${questionId}:`, err);
      dispatch({ type: 'SET_ERROR', payload: `Error loading question ${questionId}. Please try again.` });
    } finally {
      dispatch({ type: 'SET_QUESTIONS_LOADING', payload: false });
    }
  }, []);

  // Save grade
  const saveGrade = useCallback(async (examId: string, questionIndex: number, grade: number, feedback: string) => {
    try {
      dispatch({ type: 'SET_SAVING_GRADE', payload: true });

      const response = await fetch('/api/admin/grade-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      const answerId = `${examId}-${questionIndex}`;
      dispatch({ type: 'ADD_PROCESSED_ANSWER', payload: answerId });
      
      // Update the question completion status in the background
      if (state.selectedQuestion) {
        refreshQuestionCompletion(state.selectedQuestion.question.id);
      }
      
      showMessage('Grade saved successfully', 'success');
    } catch (err) {
      console.error('Error saving grade:', err);
      showMessage('Error saving grade', 'error');
      throw err;
    } finally {
      dispatch({ type: 'SET_SAVING_GRADE', payload: false });
    }
  }, [state.selectedQuestion, showMessage]);

  // Refresh specific question completion status
  const refreshQuestionCompletion = useCallback(async (questionId: number) => {
    try {
      console.log(`🔄 Refreshing completion status for question ${questionId}...`);
      
      // Fetch updated completion data for this specific question
      const response = await fetch(`/api/admin/questions-optimized?page=1&limit=1&questionId=${questionId}&includeGradingStatus=true`, {
        cache: 'no-store'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.questions && data.questions.length > 0) {
          const updatedQuestion = data.questions[0];
          
          console.log(`✅ Updated question ${questionId} completion: ${updatedQuestion.gradedCount}/${updatedQuestion.answerCount}`);
          
          // Update the questions list with the new completion data
          dispatch({
            type: 'SET_QUESTIONS',
            payload: state.questions.map(q => 
              q.id === questionId 
                ? { ...q, gradedCount: updatedQuestion.gradedCount, ungradedCount: updatedQuestion.ungradedCount, isCompleted: updatedQuestion.isCompleted }
                : q
            )
          });
        }
      }
    } catch (error) {
      console.error('Error refreshing question completion:', error);
    }
  }, [state.questions, dispatch]);

  // Fetch comment bank
  const fetchCommentBank = useCallback(async (questionId: number) => {
    try {
      dispatch({ type: 'SET_LOADING_COMMENTS', payload: true });
      const response = await fetch(`/api/admin/comment-bank?questionId=${questionId}&limit=50`);
      if (!response.ok) throw new Error('Failed to fetch comments');
      const data = await response.json();
      dispatch({ type: 'SET_COMMENT_BANK_ENTRIES', payload: data.comments || [] });
    } catch (err) {
      console.error('Error fetching comment bank entries:', err);
    } finally {
      dispatch({ type: 'SET_LOADING_COMMENTS', payload: false });
    }
  }, []);

  // Reset to questions list
  const resetToQuestionsList = useCallback(() => {
    dispatch({ type: 'RESET_GRADING_SESSION' });
    // Refresh questions list to get updated completion status
    fetchQuestions(state.pagination.currentPage, true);
  }, [state.pagination.currentPage, fetchQuestions]);

  const contextValue: GradeByQuestionContextType = {
    state,
    dispatch,
    fetchQuestions,
    fetchQuestionAnswers,
    saveGrade,
    fetchCommentBank,
    resetToQuestionsList,
    showMessage
  };

  return (
    <GradeByQuestionContext.Provider value={contextValue}>
      {children}
    </GradeByQuestionContext.Provider>
  );
}

// Hook to use the context
export function useGradeByQuestion(): GradeByQuestionContextType {
  const context = useContext(GradeByQuestionContext);
  if (context === undefined) {
    throw new Error('useGradeByQuestion must be used within a GradeByQuestionProvider');
  }
  return context;
}

// Export types for use in components
export type { Question, StudentAnswer, QuestionWithAnswers, CommentBankEntry, PaginationInfo }; 