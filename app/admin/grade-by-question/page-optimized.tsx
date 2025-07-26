"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BarChart3, RefreshCw, Clock } from 'lucide-react';
import { GradeByQuestionProvider, useGradeByQuestion } from './contexts/GradeByQuestionContext';
import QuestionList from './components/QuestionList';
import QuestionDetail from './components/QuestionDetail';
import GradeToolbar from './components/GradeToolbar';
import styles from './page.module.css';

// Header Component
const PageHeader: React.FC = () => {
  const router = useRouter();
  const { state, fetchQuestions } = useGradeByQuestion();

  const handleRefresh = async () => {
    await fetchQuestions(1, false);
  };

  return (
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
        <h1>ציונים לפי שאלה - מותאם ומקושר</h1>
        {state.loading && (
          <div className={styles.completionLoadingIndicator}>
            <Clock size={16} />
            טוען שאלות...
          </div>
        )}
      </div>
      <div className={styles.headerActions}>
        <button
          onClick={handleRefresh}
          disabled={state.loading}
          className={styles.refreshButton}
        >
          <RefreshCw size={16} className={state.loading ? styles.spinning : ''} />
          {state.loading ? 'טוען...' : 'רענן'}
        </button>
        {state.lastRefreshTime && (
          <div className={styles.headerInfo}>
            <div>עודכן לאחרונה:</div>
            <div className={styles.cacheInfo}>
              {state.lastRefreshTime.toLocaleTimeString('he-IL')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Main Content Component
const MainContent: React.FC = () => {
  const { state } = useGradeByQuestion();

  if (state.loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Clock size={24} />
          טוען שאלות...
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorMessage}>{state.error}</div>
      </div>
    );
  }

  return (
    <div className={styles.mainContent}>
      {!state.selectedQuestion ? (
        /* Questions List View */
        <QuestionList />
      ) : (
        /* Question Grading View */
        <div className={styles.gradingView}>
          <QuestionDetail />
          <GradeToolbar />
        </div>
      )}
    </div>
  );
};

// Inner component that uses the context
const GradeByQuestionPageContent: React.FC = () => {
  const router = useRouter();
  const { fetchQuestions, showMessage } = useGradeByQuestion();

  useEffect(() => {
    const initializePage = async () => {
      // Check authentication
      const storedUser = localStorage.getItem("currentUser");
      if (!storedUser) {
        router.push('/login');
        return;
      }

      const user = JSON.parse(storedUser);
      const adminEmails = [
        "liorbs89@gmail.com", 
        "eyalh747@gmail.com", 
        "orperets11@gmail.com", 
        "roeizer@shenkar.ac.il", 
        "r_admin@gmail.com"
      ];
      const isAdmin = adminEmails.includes(user.email);
      
      if (!isAdmin) {
        showMessage('אין לך הרשאת גישה לעמוד זה', 'error');
        setTimeout(() => {
          router.push('/login');
        }, 3000);
        return;
      }

      // Initialize data fetching
      try {
        await fetchQuestions(1, false);
      } catch (error) {
        console.error('Error initializing page:', error);
        showMessage('שגיאה בטעינת השאלות', 'error');
      }
    };

    initializePage();
  }, [router, fetchQuestions, showMessage]);

  return (
    <div className={styles.container}>
      <PageHeader />
      <MainContent />
    </div>
  );
};

// Main Page Component with Provider
const OptimizedGradeByQuestionPage: React.FC = () => {
  return (
    <GradeByQuestionProvider>
      <GradeByQuestionPageContent />
    </GradeByQuestionProvider>
  );
};

export default OptimizedGradeByQuestionPage; 