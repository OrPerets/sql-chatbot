"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from 'next/navigation';
import styles from "./page.module.css";
import ExamInterface from "../components/ExamInterface";
import config from "../config";

const SERVER_BASE = config.serverUrl;

// Test students list
const students = {
  304993082: { "name": "אור פרץ", "id": 304993082 },
  132111323: { "name": "רואי זרחיה", "id": 132111323 }
};

// Student ID verification component
const StudentIdVerification = ({ onStudentVerified }: { onStudentVerified: (student: any) => void }) => {
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState('');
  const [verifiedStudent, setVerifiedStudent] = useState(null);

  // Get current date in Hebrew format
  const getCurrentDate = () => {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleVerifyId = () => {
    const id = parseInt(studentId);
    if (!studentId.trim()) {
      setError('אנא הכנס מספר זהות');
      return;
    }
    
    if (isNaN(id) || !students[id]) {
      setError('מספר זהות לא נמצא במערכת');
      return;
    }

    setError('');
    setVerifiedStudent(students[id]);
  };

  const handleConfirmStudent = () => {
    if (verifiedStudent) {
      onStudentVerified(verifiedStudent);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (verifiedStudent) {
        handleConfirmStudent();
      } else {
        handleVerifyId();
      }
    }
  };

  if (verifiedStudent) {
    return (
      <div className={styles.studentVerificationContainer}>
        <div className={styles.verificationCard}>
          <div className={styles.examHeader}>
            <h1 className={styles.examTitle}>הערכה חלופית</h1>
            <h3>עבודה מקוונת</h3>
            <p className={styles.examDate}>{getCurrentDate()} - מועד א</p>
          </div>
          
          <h2 className={styles.pageTitle}>אימות פרטי סטודנט</h2>
          
          <div className={styles.studentInfo}>
            <div className={styles.studentAvatar}>
              👤
            </div>
            <div className={styles.studentDetails}>
              <p className={styles.studentId}>מספר זהות: {verifiedStudent.id}</p>
            </div>
          </div>

          <div className={styles.confirmationMessage}>
            <p>האם מספר הזהות נכון?</p>
            <p className={styles.warningText}>לאחר אישור, הבחינה תתחיל ולא תוכל לחזור אחורה</p>
          </div>

          <div className={styles.verificationActions}>
            <button 
              onClick={handleConfirmStudent}
              className={styles.confirmButton}
            >
              אישור והתחלת בחינה
            </button>
            <button 
              onClick={() => setVerifiedStudent(null)}
              className={styles.backButton}
            >
              חזרה לעריכת מספר זהות
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.studentVerificationContainer}>
      <div className={styles.verificationCard}>
        <div className={styles.examHeader}>
        <h1 className={styles.examTitle}>הערכה חלופית</h1>
        <h3>עבודה מקוונת</h3>
          <p className={styles.examDate}>{getCurrentDate()} - מועד א</p>
        </div>
        
        <h2 className={styles.pageTitle}>כניסה לבחינה</h2>
        
        <div className={styles.idInputSection}>
          <label className={styles.inputLabel}>
            הכנס את מספר הזהות שלך:
          </label>
          <input
            type="text"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            onKeyPress={handleKeyPress}
            className={styles.idInput}
            placeholder="מספר זהות (9 ספרות)"
            maxLength={9}
          />
          {error && (
            <div className={styles.errorMessage}>
              {error}
            </div>
          )}
        </div>

        <button 
          onClick={handleVerifyId}
          className={styles.verifyButton}
          disabled={!studentId.trim()}
        >
          אמת זהות
        </button>

        <div className={styles.helpText}>
          <p>* עליך להכניס את מספר הזהות הרשום במערכת</p>
          <p>* לאחר אימות הזהות, תתחיל הבחינה</p>
        </div>
      </div>
    </div>
  );
};

// Instructions component
const InstructionsPage = ({ onContinue }: { onContinue: () => void }) => {
  return (
    <div className={styles.instructionsContainer}>
      <h2 className={styles.pageTitle}>הוראות הבחינה</h2>
      
      <div className={styles.instructionsContent}>
        <div className={styles.examInfo}>
          <h3 className={styles.sectionTitle}>פרטי הבחינה</h3>
          <div className={styles.examDetails}>
            <div className={styles.detail}>
              <span className={styles.detailLabel}>משך זמן:</span>
              <span className={styles.detailValue}>10 דקות לכל שאלה</span>
            </div>
            <div className={styles.detail}>
              <span className={styles.detailLabel}>מספר שאלות:</span>
              <span className={styles.detailValue}>10 שאלות</span>
            </div>
            
          </div>
        </div>

        <div className={styles.rulesSection}>
          <h3 className={styles.sectionTitle}>כללי הבחינה</h3>
          <ul className={styles.rulesList}>
            <li>יש לך 10 דקות לענות על כל שאלה</li>
            <li>השאלות מתאימות עצמן בהתאם לביצועיך</li>
            <li>תשובות נכונות מעבירות אותך לשאלות קשות יותר</li>
            <li>כל התשובות נשמרות אוטומטית</li>
            <li>לאחר הגשה, לא ניתן לשנות את התשובה</li>
            <li>הבחינה מתחילה ברמת קושי קלה</li>
          </ul>
        </div>

      </div>

      <button onClick={onContinue} className={styles.continueButton}>
        המשך למבנה מסד הנתונים
      </button>
    </div>
  );
};

// Database schema description component
const DatabaseDescription = ({ onContinue }: { onContinue: () => void }) => {
  return (
    <div className={styles.databaseContainer}>
      <h2 className={styles.pageTitle}>מבנה מסד הנתונים</h2>
      
      <div className={styles.tablesGrid}>
        <div className={styles.tableCard}>
          <h3 className={styles.tableName}>טבלת employees (עובדים)</h3>
          <div className={styles.tableSchema}>
            <div className={styles.column}>
              <span className={styles.columnName}>id</span>
              <span className={styles.columnType}>מזהה ייחודי</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>name</span>
              <span className={styles.columnType}>שם העובד</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>salary</span>
              <span className={styles.columnType}>משכורת</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>department_id</span>
              <span className={styles.columnType}>מזהה מחלקה</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>manager_id</span>
              <span className={styles.columnType}>מזהה מנהל</span>
            </div>
          </div>
        </div>

        <div className={styles.tableCard}>
          <h3 className={styles.tableName}>טבלת customers (לקוחות)</h3>
          <div className={styles.tableSchema}>
            <div className={styles.column}>
              <span className={styles.columnName}>id</span>
              <span className={styles.columnType}>מזהה ייחודי</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>name</span>
              <span className={styles.columnType}>שם הלקוח</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>age</span>
              <span className={styles.columnType}>גיל</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>city</span>
              <span className={styles.columnType}>עיר מגורים</span>
            </div>
          </div>
        </div>

        <div className={styles.tableCard}>
          <h3 className={styles.tableName}>טבלת orders (הזמנות)</h3>
          <div className={styles.tableSchema}>
            <div className={styles.column}>
              <span className={styles.columnName}>id</span>
              <span className={styles.columnType}>מזהה ייחודי</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>customer_id</span>
              <span className={styles.columnType}>מזהה לקוח</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>city</span>
              <span className={styles.columnType}>עיר</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>order_date</span>
              <span className={styles.columnType}>תאריך הזמנה</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>total_amount</span>
              <span className={styles.columnType}>סכום כולל</span>
            </div>
          </div>
        </div>

        <div className={styles.tableCard}>
          <h3 className={styles.tableName}>טבלת products (מוצרים)</h3>
          <div className={styles.tableSchema}>
            <div className={styles.column}>
              <span className={styles.columnName}>id</span>
              <span className={styles.columnType}>מזהה ייחודי</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>name</span>
              <span className={styles.columnType}>שם המוצר</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>category</span>
              <span className={styles.columnType}>קטגוריה</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>price</span>
              <span className={styles.columnType}>מחיר</span>
            </div>
          </div>
        </div>

        <div className={styles.tableCard}>
          <h3 className={styles.tableName}>טבלת departments (מחלקות)</h3>
          <div className={styles.tableSchema}>
            <div className={styles.column}>
              <span className={styles.columnName}>id</span>
              <span className={styles.columnType}>מזהה ייחודי</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>department_name</span>
              <span className={styles.columnType}>שם המחלקה</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.dbNotes}>
        <h3 className={styles.sectionTitle}>הערות</h3>
        <ul className={styles.notesList}>
          <li>הערה 1</li>
          <li>הערה 2</li>
        </ul>
      </div>

      <button onClick={onContinue} className={styles.continueButton}>
        התחל בחינה
      </button>
    </div>
  );
};

const ExamPage = () => {
  const [user, setUser] = useState(null);
  const [examSession, setExamSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState('studentId'); // 'studentId' | 'instructions' | 'database' | 'exam'
  const [verifiedStudent, setVerifiedStudent] = useState(null);
  const router = useRouter();

  useEffect(() => {
    // We no longer require prior login - students authenticate with their ID
    setIsLoading(false);
  }, []);

  const handleStudentVerified = useCallback((student) => {
    setVerifiedStudent(student);
    setCurrentStep('instructions');
  }, []);

  const startExam = useCallback(async () => {
    if (!verifiedStudent) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${SERVER_BASE}/exam/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId: verifiedStudent.id,
          studentName: verifiedStudent.name,
          studentEmail: user?.email || `student_${verifiedStudent.id}@exam.local`,
          examTitle: 'בחינת מיומנות SQL'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start exam');
      }

      const session = await response.json();
      setExamSession(session);
      setCurrentStep('exam');
    } catch (error) {
      console.error('Error starting exam:', error);
      setError('שגיאה בהתחלת הבחינה. אנא נסה שוב.');
    } finally {
      setIsLoading(false);
    }
  }, [verifiedStudent, user]);

  const handleExamComplete = useCallback((results) => {
    console.log('Exam completed with results:', results);
  }, []);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p className={styles.loadingText}>טוען...</p>
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

  return (
    <div className={styles.examContainer}>
      <main className={styles.mainContent}>
        {currentStep === 'studentId' && (
          <StudentIdVerification onStudentVerified={handleStudentVerified} />
        )}
        
        {currentStep === 'instructions' && (
          <InstructionsPage onContinue={() => setCurrentStep('database')} />
        )}
        
        {currentStep === 'database' && (
          <DatabaseDescription onContinue={startExam} />
        )}
        
        {currentStep === 'exam' && examSession && verifiedStudent && (
          <ExamInterface 
            examSession={examSession}
            user={verifiedStudent}
            onComplete={handleExamComplete}
          />
        )}
      </main>
    </div>
  );
};

export default ExamPage; 