"use client";

import React, { memo, useCallback, useMemo, useState } from 'react';
import { FileText, Search, Eye, Users, CheckCircle, Filter, BarChart3, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useGradeByQuestion, Question } from '../contexts/GradeByQuestionContext';
import styles from '../page.module.css';

// Utility functions
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

// Question Card Component
const QuestionCard = memo(({ 
  question, 
  onQuestionClick 
}: {
  question: Question;
  onQuestionClick: (id: number) => void;
}) => {
  const [isClicked, setIsClicked] = useState(false);
  
  const handleClick = useCallback(() => {
    setIsClicked(true); // Immediate visual feedback
    onQuestionClick(question.id);
  }, [question.id, onQuestionClick]);

  const getCompletionStatus = () => {
    if (question.answerCount === 0) {
      return (
        <div className={styles.completionStatus}>
          <div className={styles.noAnswersStatus}>
            <AlertCircle size={16} />
            אין תשובות
          </div>
        </div>
      );
    }

    // Check if fully completed (all answers graded)
    const isFullyCompleted = question.isCompleted || 
      (question.gradedCount === question.answerCount && question.answerCount > 0);

    if (isFullyCompleted) {
      return (
        <div className={styles.completionStatus}>
          <div className={styles.completedStatus}>
            <CheckCircle size={16} />
            הושלם ✅
          </div>
        </div>
      );
    }
    
    if (question.gradedCount && question.gradedCount > 0) {
      return (
        <div className={styles.completionStatus}>
          <div className={styles.partialStatus}>
            נבדק חלקית ({question.gradedCount}/{question.answerCount})
          </div>
          <div className={styles.ungradedBadge}>
            {question.ungradedCount || (question.answerCount - question.gradedCount!)} נותרו
          </div>
        </div>
      );
    }

    return (
      <div className={styles.completionStatus}>
        <div className={styles.readyToGradeStatus}>
          <Eye size={16} />
          {question.answerCount} תשובות
        </div>
      </div>
    );
  };

  const isCompleted = question.isCompleted;
  const isPartial = question.gradedCount && question.gradedCount > 0 && !question.isCompleted;

  return (
    <div
      className={`${styles.questionCard} ${isCompleted ? styles.completedQuestion : ''} ${isPartial ? styles.partiallyGradedQuestion : ''} ${isClicked ? styles.clickedQuestion : ''}`}
      onClick={handleClick}
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

// Search and Filters Component
const SearchAndFilters = memo(() => {
  const { state, dispatch } = useGradeByQuestion();

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_SEARCH_TERM', payload: e.target.value });
  }, [dispatch]);

  const handleDifficultyChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch({ type: 'SET_DIFFICULTY_FILTER', payload: e.target.value as any });
  }, [dispatch]);

  const handleGradingStatusChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch({ type: 'SET_GRADING_STATUS_FILTER', payload: e.target.value as any });
  }, [dispatch]);

  return (
    <div className={styles.filters}>
      <div className={styles.searchContainer}>
        <Search size={20} />
        <input
          type="text"
          placeholder="חיפוש בתוכן השאלה..."
          value={state.searchTerm}
          onChange={handleSearchChange}
          className={styles.searchInput}
        />
      </div>
      
      <div className={styles.difficultyFilter}>
        <Filter size={16} />
        <select
          value={state.difficultyFilter}
          onChange={handleDifficultyChange}
          className={styles.difficultySelect}
        >
          <option value="all">כל הקשיים</option>
          <option value="easy">קל</option>
          <option value="medium">בינוני</option>
          <option value="hard">קשה</option>
          <option value="algebra">אלגברה</option>
        </select>
      </div>

      <div className={styles.gradingStatusFilter}>
        <CheckCircle size={16} />
        <select
          value={state.gradingStatusFilter}
          onChange={handleGradingStatusChange}
          className={styles.gradingStatusSelect}
        >
          <option value="all">כל הסטטוסים</option>
          <option value="ungraded">טרם נבדקו</option>
          <option value="partial">נבדקו חלקית</option>
          <option value="completed">הושלמו</option>
        </select>
      </div>
      
      <div className={styles.questionCount}>
        מציג {state.questions.length} שאלות (עמוד {state.pagination.currentPage}/{state.pagination.totalPages})
      </div>
    </div>
  );
});

SearchAndFilters.displayName = 'SearchAndFilters';

// Pagination Component
const Pagination = memo(() => {
  const { state, fetchQuestions } = useGradeByQuestion();

  const handlePreviousPage = useCallback(() => {
    if (state.pagination.currentPage > 1) {
      fetchQuestions(state.pagination.currentPage - 1);
    }
  }, [state.pagination.currentPage, fetchQuestions]);

  const handleNextPage = useCallback(() => {
    if (state.pagination.currentPage < state.pagination.totalPages) {
      fetchQuestions(state.pagination.currentPage + 1);
    }
  }, [state.pagination.currentPage, state.pagination.totalPages, fetchQuestions]);

  if (state.pagination.totalPages <= 1) {
    return null;
  }

  return (
    <div className={styles.pagination}>
      <button
        onClick={handlePreviousPage}
        disabled={state.pagination.currentPage === 1}
        className={styles.paginationButton}
      >
        <ChevronRight size={16} />
        הקודם
      </button>
      
      <div className={styles.paginationInfo}>
        עמוד {state.pagination.currentPage} מתוך {state.pagination.totalPages}
      </div>
      
      <button
        onClick={handleNextPage}
        disabled={state.pagination.currentPage >= state.pagination.totalPages}
        className={styles.paginationButton}
      >
        הבא
        <ChevronLeft size={16} />
      </button>
    </div>
  );
});

Pagination.displayName = 'Pagination';

// Main QuestionList Component
const QuestionList: React.FC = () => {
  const { state, fetchQuestionAnswers, dispatch } = useGradeByQuestion();

  const handleQuestionClick = useCallback((questionId: number) => {
    console.log(`🔄 Loading question ${questionId}...`);
    // Set loading state IMMEDIATELY when user clicks
    dispatch({ type: 'SET_QUESTIONS_LOADING', payload: true });
    fetchQuestionAnswers(questionId);
  }, [fetchQuestionAnswers, dispatch]);

  const questionsContent = useMemo(() => {
    if (state.questions.length === 0 && !state.loading) {
      return (
        <div className={styles.noQuestions}>
          <FileText size={48} />
          <h3>לא נמצאו שאלות</h3>
          <p>נסה לשנות את הפילטרים או המילות חיפוש</p>
        </div>
      );
    }

    return (
      <div className={styles.questionsGrid}>
        {state.questions.map((question) => (
          <QuestionCard 
            key={question.id}
            question={question}
            onQuestionClick={handleQuestionClick}
          />
        ))}
      </div>
    );
  }, [state.questions, state.loading, handleQuestionClick]);

  return (
    <div className={styles.questionsView}>
      <SearchAndFilters />
      {questionsContent}
      <Pagination />
    </div>
  );
};

export default QuestionList; 