"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from 'next/navigation';
import styles from "./page.module.css";
import ExamInterface from "../components/ExamInterface";
import config from "../config";
import { generateBrowserFingerprint } from "../utils/browserFingerprint";
import { ExamSecurity } from "../utils/examSecurity";

const SERVER_BASE = config.serverUrl;

// Test students list - updated structure with string keys
const students = {
  "304993082": { "name": "אור פרץ", "id": "304993082" },
  "035678622": { "name": "רואי זרחיה", "id": "035678622" },
};

// Student ID verification component
const StudentIdVerification = ({ onStudentVerified }: { onStudentVerified: (student: any) => void }) => {
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState('');
  const [verifiedStudent, setVerifiedStudent] = useState(null);

  // Get current date in Hebrew format - updated to 17.7.25
  const getCurrentDate = () => {
    return "17.7.25";
  };

  const handleVerifyId = () => {
    if (!studentId.trim()) {
      setError('אנא הכנס מספר זהות');
      return;
    }
    
    if (!students[studentId]) {
      setError('מספר זהות לא נמצא במערכת');
      return;
    }

    setError('');
    setVerifiedStudent(students[studentId]);
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
            <p className={styles.examDate}>{getCurrentDate()}</p>
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
            <p className={styles.warningText}>לאחר אישור, העבודה תתחיל ולא תוכל לחזור אחורה</p>
          </div>

          <div className={styles.verificationActions}>
            <button 
              onClick={handleConfirmStudent}
              className={styles.confirmButton}
            >
              אישור והתחלת עבודה
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
          <p className={styles.examDate}>{getCurrentDate()}</p>
        </div>
        
        <h2 className={styles.pageTitle}>כניסה לעבודה</h2>
        
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
          <p>* לאחר אימות הזהות, תתחיל העבודה</p>
        </div>
      </div>
    </div>
  );
};

// Instructions component
const InstructionsPage = ({ onContinue }: { onContinue: () => void }) => {
  return (
    <div className={styles.instructionsContainer}>
      <h2 className={styles.pageTitle}>הוראות העבודה</h2>
      
      <div className={styles.instructionsContent}>
        <div className={styles.examInfo}>
          <h3 className={styles.sectionTitle}>פרטי העבודה</h3>
          <div className={styles.examDetails}>
            <div className={styles.detail}>
              <span className={styles.detailLabel}>זמן כולל:</span>
              <span className={styles.detailValue}>שעתיים</span>
            </div>
            <div className={styles.detail}>
              <span className={styles.detailLabel}>מספר שאלות:</span>
              <span className={styles.detailValue}>13 שאלות</span>
            </div>
            
          </div>
        </div>

        <div className={styles.rulesSection}>
          <h3 className={styles.sectionTitle}>כללי העבודה</h3>
          <ul className={styles.rulesList}>
            <li>יש לך 10 דקות לענות על כל שאלה</li>
            <li>כל התשובות נשמרות אוטומטית</li>
            <li>במידה ונגמר הזמן או קרתה תקלת תקשורת, התשובה נשמרת אוטומטית</li>
            <li>לאחר הגשה, לא ניתן לשנות את התשובה</li>
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
      <h2 className={styles.pageTitle}>מסד נתונים לעבודה</h2>
      
      <div className={styles.scenarioHeader}>
        <h3 className={styles.scenarioTitle}>תרחיש: מערכת ניהול חיל האוויר הישראלי</h3>
        <div className={styles.scenarioDescription}>
          <div className={styles.scenarioColumns}>
            <div className={styles.scenarioColumn}>
              <p>
                <strong>היסטוריה והקמה:</strong><br />
                חיל האוויר הישראלי הוקם ביום 28 במאי 1948, יום לאחר הכרזת העצמאות, כאשר הטייסת הראשונה הורכבה מ-9 מטוסי אביה צ'כיים.
              </p>
              
              <p>
                <strong>התפתחות לאורך השנים:</strong><br />
                מאז ועד היום, חיל האוויר התפתח להיות אחד הכוחות האוויריים המתקדמים והיעילים בעולם.
              </p>
              
              <p>
                <strong>השתתפות במלחמות:</strong><br />
                במשך עשרות השנים, חיל האוויר השתתף במלחמות ישראל:
                <br />• מלחמת העצמאות (1948)
                <br />• מלחמת ששת הימים (1967)
                <br />• מלחמת יום הכיפורים (1973)
                <br />• מלחמת לבנון הראשונה (1982)
                <br />• מבצעים מודרניים: "חומת מגן" (2002), "עמוד ענן" (2012)
              </p>
              
              <p>
                <strong>פיתוח טכנולוגי:</strong><br />
                החל משנת 1976, חיל האוויר החל לקלוט את מטוסי ה-F-16 הראשונים, מה שהפך אותו לחיל האוויר הראשון מחוץ לארה"ב שהפעיל מטוס זה.
              </p>
              
              <p>
                בשנת 2016, ישראל הפכה למדינה הראשונה מחוץ לארה"ב שקיבלה את מטוסי ה-F-35 המתקדמים.
              </p>
            </div>
            
            <div className={styles.scenarioColumn}>
              <p>
                <strong>מצב נוכחי:</strong><br />
                כיום, חיל האוויר מונה כ-34,000 איש, המפעילים מעל 460 כלי טיס מסוגים שונים, הפרוסים על פני 8 בסיסים עיקריים ברחבי הארץ.
              </p>
              
              <p>
                <strong>תחומי אחריות:</strong><br />
                החיל אחראי על הגנה אווירית, תקיפות אסטרטגיות, סיוע קרוב, חילוץ והצלה, ומשימות מודיעין אוויריות.
              </p>
              
              <p>
                <strong>מערכת מסד הנתונים:</strong><br />
                מערכת מסד הנתונים של חיל האוויר פותחה בשנת 1995 ועברה שדרוגים משמעותיים בשנים 2005, 2012, ו-2020.
              </p>
              
              <p>
                <strong>תחומי פעילות המערכת:</strong>
              </p>
              <ul>
                <li>תכנון משימות ותפעול מבצעי</li>
                
                <li>ניהול משאבי אנוש (טייסים, טכנאים, קצינים)</li>
                
                <li>מעקב אחר מצב כלי הטיס ותחזוקתם</li>
                
                <li>ניהול מלאי כלי נשק ותחמושת</li>
                
                <li>תכנון אימונים וקורסים</li>
                
                <li>ניתוח ביצועים ויעילות תפעולית</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      <div className={styles.tablesGrid}>
        <div className={styles.tableCard}>
          <h3 className={styles.tableName}>טבלת AirBases (בסיסי חיל האוויר)</h3>
          <div className={styles.tableSchema}>
            <div className={styles.column}>
              <span className={styles.columnName}>base_id</span>
              <span className={styles.columnType}>מזהה ייחודי של הבסיס</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>base_name</span>
              <span className={styles.columnType}>שם הבסיס (רמת דוד, חצרים)</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>base_code</span>
              <span className={styles.columnType}>קוד הבסיס (3 אותיות)</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>location</span>
              <span className={styles.columnType}>אזור גיאוגרפי</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>established_year</span>
              <span className={styles.columnType}>שנת הקמה</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>runways_count</span>
              <span className={styles.columnType}>מספר מסלולי נחיתה</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>personnel_capacity</span>
              <span className={styles.columnType}>מספר מקסימלי של אנשי צוות</span>
            </div>
          </div>
        </div>

        <div className={styles.tableCard}>
          <h3 className={styles.tableName}>טבלת Squadrons (טייסות)</h3>
          <div className={styles.tableSchema}>
            <div className={styles.column}>
              <span className={styles.columnName}>squadron_id</span>
              <span className={styles.columnType}>מזהה ייחודי של הטייסת</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>squadron_name</span>
              <span className={styles.columnType}>שם הטייסת (טייסת הנץ)</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>squadron_number</span>
              <span className={styles.columnType}>מספר הטייסת ההיסטורי</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>base_id</span>
              <span className={styles.columnType}>הבסיס הבית (מפתח זר)</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>aircraft_type</span>
              <span className={styles.columnType}>סוג כלי הטיס העיקרי</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>mission_type</span>
              <span className={styles.columnType}>התמחות עיקרית</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>active_pilots</span>
              <span className={styles.columnType}>מספר הטייסים הפעילים</span>
            </div>
          </div>
        </div>

        <div className={styles.tableCard}>
          <h3 className={styles.tableName}>טבלת Pilots (טייסים)</h3>
          <div className={styles.tableSchema}>
            <div className={styles.column}>
              <span className={styles.columnName}>pilot_id</span>
              <span className={styles.columnType}>מזהה ייחודי של הטייס</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>pilot_name</span>
              <span className={styles.columnType}>שם פרטי ומשפחה</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>rank</span>
              <span className={styles.columnType}>דרגה צבאית</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>squadron_id</span>
              <span className={styles.columnType}>הטייסת (מפתח זר)</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>experience_years</span>
              <span className={styles.columnType}>שנות ניסיון בטיסה</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>flight_hours</span>
              <span className={styles.columnType}>שעות טיסה מצטברות</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>salary</span>
              <span className={styles.columnType}>משכורת חודשית</span>
            </div>
          </div>
        </div>

        <div className={styles.tableCard}>
          <h3 className={styles.tableName}>טבלת Aircraft (כלי טיס)</h3>
          <div className={styles.tableSchema}>
            <div className={styles.column}>
              <span className={styles.columnName}>aircraft_id</span>
              <span className={styles.columnType}>מזהה ייחודי של כלי הטיס</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>aircraft_type</span>
              <span className={styles.columnType}>סוג כלי הטיס (F-16I, F-35I)</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>tail_number</span>
              <span className={styles.columnType}>מספר זנב ייחודי</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>squadron_id</span>
              <span className={styles.columnType}>הטייסת (מפתח זר)</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>manufacture_year</span>
              <span className={styles.columnType}>שנת ייצור</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>flight_hours_total</span>
              <span className={styles.columnType}>שעות טיסה מצטברות</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>status</span>
              <span className={styles.columnType}>מצב תפעולי נוכחי</span>
            </div>
          </div>
        </div>

        <div className={styles.tableCard}>
          <h3 className={styles.tableName}>טבלת Weapons (כלי נשק ותחמושת)</h3>
          <div className={styles.tableSchema}>
            <div className={styles.column}>
              <span className={styles.columnName}>weapon_id</span>
              <span className={styles.columnType}>מזהה ייחודי של כלי הנשק</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>weapon_name</span>
              <span className={styles.columnType}>שם כלי הנשק (פייתון 5, דרבי)</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>weapon_type</span>
              <span className={styles.columnType}>קטגוריית כלי הנשק</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>range_km</span>
              <span className={styles.columnType}>טווח יעיל מרבי בק"מ</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>cost_per_unit</span>
              <span className={styles.columnType}>עלות ליחידה באלפי ש"ח</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>stock_quantity</span>
              <span className={styles.columnType}>כמות יחידות במלאי</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>storage_base_id</span>
              <span className={styles.columnType}>הבסיס בו מאוחסן (מפתח זר)</span>
            </div>
          </div>
        </div>

        <div className={styles.tableCard}>
          <h3 className={styles.tableName}>טבלת Missions (משימות ותפעול)</h3>
          <div className={styles.tableSchema}>
            <div className={styles.column}>
              <span className={styles.columnName}>mission_id</span>
              <span className={styles.columnType}>מזהה ייחודי של המשימה</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>mission_name</span>
              <span className={styles.columnType}>שם המשימה</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>mission_type</span>
              <span className={styles.columnType}>סוג המשימה</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>squadron_id</span>
              <span className={styles.columnType}>הטייסת המבצעת (מפתח זר)</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>pilot_id</span>
              <span className={styles.columnType}>הטייס הראשי (מפתח זר)</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>aircraft_id</span>
              <span className={styles.columnType}>כלי הטיס (מפתח זר)</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>start_date</span>
              <span className={styles.columnType}>תאריך ושעת תחילה</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>mission_status</span>
              <span className={styles.columnType}>סטטוס נוכחי</span>
            </div>
          </div>
        </div>

        <div className={styles.tableCard}>
          <h3 className={styles.tableName}>טבלת Maintenance (תחזוקה)</h3>
          <div className={styles.tableSchema}>
            <div className={styles.column}>
              <span className={styles.columnName}>maintenance_id</span>
              <span className={styles.columnType}>מזהה ייחודי של התחזוקה</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>aircraft_id</span>
              <span className={styles.columnType}>כלי הטיס (מפתח זר)</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>maintenance_type</span>
              <span className={styles.columnType}>סוג התחזוקה</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>start_date</span>
              <span className={styles.columnType}>תאריך תחילת התחזוקה</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>end_date</span>
              <span className={styles.columnType}>תאריך סיום התחזוקה</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnName}>cost</span>
              <span className={styles.columnType}>עלות התחזוקה באלפי ש"ח</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.dbNotes}>
        <h3 className={styles.sectionTitle}>יחסים בין הטבלאות</h3>
        <ul className={styles.notesList}>
          <li>כל בסיס מכיל מספר טייסות (יחס 1:N)</li>
          <li>כל טייס משרת בטייסת אחת ובבסיס אחד (יחסי N:1)</li>
          <li>כל כלי טיס משויך לטייסת אחת (יחס N:1)</li>
          <li>כלי נשק מאוחסנים בבסיסים שונים (יחס N:1)</li>
          <li>כל משימה כוללת טייסת, טייס וכלי טיס ספציפיים (יחסי N:1)</li>
          <li>כל כלי טיס עובר תחזוקות מרובות (יחס 1:N)</li>
        </ul>
      </div>

      <button onClick={onContinue} className={styles.continueButton}>
        התחל עבודה
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

  const handleStudentVerified = useCallback(async (student) => {
    setVerifiedStudent(student);
    setIsLoading(true);
    
    try {
      // Check if student has an active session
      const sessionCheck = await ExamSecurity.checkForActiveSession(student.id);
      
      if (!sessionCheck.allowed && sessionCheck.reason === 'active_session_detected') {
        // Student has an active session - offer to continue
        const shouldContinue = window.confirm(
          `${sessionCheck.message}\n\nלחץ אישור להמשיך את הבחינה הקיימת או ביטול להתחיל מחדש.`
        );
        
        if (shouldContinue && sessionCheck.existingSession) {
          // Validate access to the existing session
          const accessValidation = await ExamSecurity.validateExamAccess(student.id);
          
          if (accessValidation.allowed) {
            // Continue existing session
            setExamSession({
              examId: sessionCheck.existingSession.examId,
              ...sessionCheck.existingSession
            });
            ExamSecurity.initializeExamSecurity(student.id, sessionCheck.existingSession.examId);
            setCurrentStep('exam');
            return;
          } else {
            // Access denied - show error and don't allow continuation
            setError(accessValidation.message || 'הגישה לבחינה הקיימת נחסמה');
            return;
          }
        }
      }
      
      // Check if environment is secure
      const securityCheck = ExamSecurity.isSecureEnvironment();
      if (!securityCheck.secure && securityCheck.warnings.length > 0) {
        const continueAnyway = window.confirm(
          `אזהרת אבטחה:\n${securityCheck.warnings.join('\n')}\n\nהאם תרצה להמשיך בכל זאת?`
        );
        
        if (!continueAnyway) {
          setError('הבחינה בוטלה מסיבות אבטחה');
          return;
        }
      }
      
      // Proceed to instructions
      setCurrentStep('instructions');
    } catch (error) {
      console.error('Error during student verification:', error);
      setError('שגיאה בבדיקת מצב הבחינה. אנא נסה שוב.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startExam = useCallback(async () => {
    if (!verifiedStudent) return;
    
    setIsLoading(true);
    try {
      // Generate browser fingerprint for security
      const browserFingerprint = generateBrowserFingerprint();
      
      const response = await fetch(`${SERVER_BASE}/exam/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId: verifiedStudent.id,
          studentName: verifiedStudent.name,
          studentEmail: user?.email || `student_${verifiedStudent.id}@exam.local`,
          examTitle: 'בחינת מיומנות SQL',
          browserFingerprint: browserFingerprint
        }),
      });

      const sessionData = await response.json();

      if (!response.ok) {
        // Handle security-related errors specifically
        if (response.status === 403) {
          setError(sessionData.message || 'הגישה לבחינה נחסמה');
          return;
        }
        throw new Error(sessionData.error || 'Failed to start exam');
      }

      // Check if this is a reconnection to existing session
      if (sessionData.reconnection) {
        console.log('Reconnecting to existing exam session');
      } else {
        // Initialize security for new session
        ExamSecurity.initializeExamSecurity(verifiedStudent.id, sessionData.examId);
      }

      setExamSession(sessionData);
      setCurrentStep('exam');
    } catch (error) {
      console.error('Error starting exam:', error);
      setError('שגיאה בהתחלת העבודה. אנא נסה שוב.');
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