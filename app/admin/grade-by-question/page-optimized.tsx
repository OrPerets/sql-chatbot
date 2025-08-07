"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BarChart3, RefreshCw, Clock, Download } from 'lucide-react';
import { GradeByQuestionProvider, useGradeByQuestion } from './contexts/GradeByQuestionContext';
import QuestionList from './components/QuestionList';
import QuestionDetail from './components/QuestionDetail';
import GradeToolbar from './components/GradeToolbar';
import styles from './page.module.css';

// Header Component
const PageHeader: React.FC = () => {
  const router = useRouter();
  const { state, fetchQuestions } = useGradeByQuestion();
  const [exporting, setExporting] = useState(false);

  const handleRefresh = async () => {
    await fetchQuestions(1, false);
  };

  const handleTestConnection = async () => {
    try {
      console.log('🔍 Testing database connection...');
      
      const response = await fetch('/api/admin/test-db-connection', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Database connection test successful:', result.data);
        alert(`✅ חיבור למסד הנתונים תקין!\n\nמבחנים: ${result.data.finalExamsCount}\nשאלות: ${result.data.questionsCount}`);
      } else {
        console.error('❌ Database connection test failed:', result.details);
        alert(`❌ בעיה בחיבור למסד הנתונים:\n${result.details.message}`);
      }
      
    } catch (err) {
      console.error('Connection test error:', err);
      alert('❌ שגיאה בבדיקת החיבור למסד הנתונים');
    }
  };

  const handleSimpleExport = async () => {
    try {
      setExporting(true);
      console.log('🚀 Starting SIMPLE export test...');
      
      const response = await fetch('/api/admin/export-simple', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Simple export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'simple-test.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      alert('✅ ייצוא פשוט הושלם! זה אומר שהחיבור עובד');
      
    } catch (err) {
      console.error('Simple export error:', err);
      alert('❌ גם הייצוא הפשוט נכשל');
    } finally {
      setExporting(false);
    }
  };

  const handleExportToExcel = async () => {
    try {
      setExporting(true);
      console.log('🚀 Starting DIRECT DATABASE Excel export...');
      
      // Show progress message
      const progressDiv = document.createElement('div');
      progressDiv.innerHTML = '⏳ מתחבר למסד נתונים (גרסה מחוזקת)... מקסימום דקה';
      progressDiv.style.cssText = `
        position: fixed; top: 20px; right: 20px; background: #007bff; color: white;
        padding: 15px 20px; border-radius: 8px; font-size: 16px; font-weight: 500;
        z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      `;
      document.body.appendChild(progressDiv);
      
      // Set timeout for direct database access 
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds for database connection
      
      const response = await fetch('/api/admin/export-all-grading', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      progressDiv.remove();

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      // Check if response is JSON (error) or blob (success)
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }

      // Get the blob and create download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      // Extract filename from response headers if available
      const disposition = response.headers.get('content-disposition');
      let filename = `all-student-grading-${new Date().toISOString().split('T')[0]}.xlsx`;
      if (disposition && disposition.includes('filename=')) {
        const filenameMatch = disposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log('✅ Excel export completed successfully');
      
      // Show success message with different text based on filename
      const isQuickExport = filename.includes('quick-export');
      const isNoData = filename.includes('no-data');
      const successDiv = document.createElement('div');
      
      if (isNoData) {
        successDiv.innerHTML = '⚠️ לא נמצאו נתונים לייצוא. בדוק שיש ציונים במערכת';
      } else if (isQuickExport) {
        successDiv.innerHTML = '⚡ ייצוא מהיר הושלם! בעיה במסד נתונים - נתונים חלקיים';
      } else {
        successDiv.innerHTML = '✅ הדוח יוצא בהצלחה ישירות ממסד הנתונים וירד למחשב שלך!';
      }
      successDiv.style.cssText = `
        position: fixed; top: 20px; right: 20px; background: #28a745; color: white;
        padding: 15px 20px; border-radius: 8px; font-size: 16px; font-weight: 500;
        z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      `;
      document.body.appendChild(successDiv);
      setTimeout(() => successDiv.remove(), 7000);
      
    } catch (err) {
      console.error('Export error:', err);
      
      // Remove progress message if still there
      const progressDiv = document.querySelector('div[style*="background: #007bff"]');
      if (progressDiv) progressDiv.remove();
      
      // Show error message with more specific guidance
      const errorDiv = document.createElement('div');
      const isTimeout = err.name === 'AbortError';
      errorDiv.innerHTML = isTimeout 
        ? '⏰ בעיה בחיבור למסד הנתונים. נסה שוב בעוד כמה דקות או פנה למנהל המערכת'
        : '❌ שגיאה ביצוא הנתונים ממסד הנתונים. נסה שוב בעוד כמה דקות';
      errorDiv.style.cssText = `
        position: fixed; top: 20px; right: 20px; background: #dc3545; color: white;
        padding: 15px 20px; border-radius: 8px; font-size: 16px; font-weight: 500;
        z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      `;
      document.body.appendChild(errorDiv);
      setTimeout(() => errorDiv.remove(), 8000);
    } finally {
      setExporting(false);
    }
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
          onClick={handleTestConnection}
          className={styles.refreshButton}
          title="בדוק חיבור למסד הנתונים"
        >
          🔍 בדוק חיבור
        </button>
        <button
          onClick={handleSimpleExport}
          disabled={exporting || state.loading}
          className={styles.refreshButton}
          title="ייצוא פשוט לבדיקה - רק 3 רשומות"
        >
          📋 ייצוא פשוט
        </button>
        <button
          onClick={handleExportToExcel}
          disabled={exporting || state.loading}
          className={styles.exportButton}
          title="יצא את כל הציונים והמשובים לאקסל - כולל כל הסטודנטים והשאלות"
        >
          <Download size={16} className={exporting ? styles.spinning : ''} />
          {exporting ? 'מייצא...' : 'יצא הכל לאקסל'}
        </button>
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
  const { state, setActiveTab, fetchQuestions, showMessage } = useGradeByQuestion();

  // Filter out lecturers and assistants (same as exam-grading page)
  const EXCLUDED_USERS = new Set([
    "304993082", // אור פרץ
    "315661033", // נעם ניר  
    "035678622"  // רואי זרחיה
  ]);

  // Restore active tab from session storage on load
  useEffect(() => {
    const savedTab = sessionStorage.getItem('gradeByQuestionActiveTab') as 'moed-a' | 'moed-b';
    if (savedTab && (savedTab === 'moed-a' || savedTab === 'moed-b')) {
      setActiveTab(savedTab);
    }
  }, [setActiveTab]);

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

      // Data fetching is now handled by setActiveTab automatically
      console.log('✅ Authentication successful, tab selection will trigger data fetch');
    };

    initializePage();
  }, [router, showMessage]);

  // Show initial interface without loading when no tab is selected
  if (!state.activeTab) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <button 
            onClick={() => router.push('/admin')}
            className={styles.backButton}
          >
            <ArrowLeft size={20} />
            חזרה לממשק ניהול
          </button>
          <h1 className={styles.title}>
            <BarChart3 size={24} />
            ציונים לפי שאלה
          </h1>
          <div className={styles.subtitle}>
            מערכת ציון מהירה ויעילה לפי שאלות - בחר מועד להתחלה
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className={styles.tabsContainer}>
          <div className={styles.tabs}>
            <button
              className={styles.tab}
              onClick={() => {
                setActiveTab('moed-a');
                sessionStorage.setItem('gradeByQuestionActiveTab', 'moed-a');
              }}
            >
              מועד א 2025
            </button>
            <button
              className={styles.tab}
              onClick={() => {
                setActiveTab('moed-b');
                sessionStorage.setItem('gradeByQuestionActiveTab', 'moed-b');
              }}
            >
              מועד ב 2025
            </button>
          </div>
          <div className={styles.tabDescription}>
            בחר מועד כדי לצפות ברשימת השאלות לציון
          </div>
        </div>

        {/* Initial State Message */}
        <div className={styles.initialStateContainer}>
          <div className={styles.initialStateContent}>
            <BarChart3 size={48} className={styles.initialStateIcon} />
            <h2>בחר מועד בחינה</h2>
            <p>כדי להתחיל בציון לפי שאלות, בחר את המועד הרצוי:</p>
            <div className={styles.moedOptions}>
              <button 
                className={styles.moedButton}
                onClick={() => {
                  setActiveTab('moed-a');
                  sessionStorage.setItem('gradeByQuestionActiveTab', 'moed-a');
                }}
              >
                <div className={styles.moedButtonTitle}>מועד א 2025</div>
                <div className={styles.moedButtonDesc}>שאלות מבחינות מאוחדות (FinalExams)</div>
              </button>
              <button 
                className={styles.moedButton}
                onClick={() => {
                  setActiveTab('moed-b');
                  sessionStorage.setItem('gradeByQuestionActiveTab', 'moed-b');
                }}
              >
                <div className={styles.moedButtonTitle}>מועד ב 2025</div>
                <div className={styles.moedButtonDesc}>שאלות מבחינות רגילות (Questions Collection)</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <PageHeader />
      {/* Tab Navigation for active state */}
      <div className={styles.tabsContainer}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${state.activeTab === 'moed-a' ? styles.activeTab : ''}`}
            onClick={() => {
              setActiveTab('moed-a');
              sessionStorage.setItem('gradeByQuestionActiveTab', 'moed-a');
            }}
          >
            מועד א 2025
          </button>
          <button
            className={`${styles.tab} ${state.activeTab === 'moed-b' ? styles.activeTab : ''}`}
            onClick={() => {
              setActiveTab('moed-b');
              sessionStorage.setItem('gradeByQuestionActiveTab', 'moed-b');
            }}
          >
            מועד ב 2025
          </button>
        </div>
        <div className={styles.tabDescription}>
          {state.activeTab === 'moed-a' 
            ? 'שאלות מבחינות מאוחדות (FinalExams) - מועד א' 
            : 'שאלות מבחינות רגילות (Questions Collection) - מועד ב'
          }
        </div>
      </div>
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