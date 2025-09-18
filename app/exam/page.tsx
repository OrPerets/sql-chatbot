"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from 'next/navigation';
import styles from "./page.module.css";
import ExamInterface from "../components/ExamInterface";
import config from "../config";
import { generateBrowserFingerprint } from "../utils/browserFingerprint";
// 1. Remove ExamSecurity import
// import { ExamSecurity } from "../utils/examSecurity";

const SERVER_BASE = config.serverUrl;

// Test students list - updated structure with string keys
const students = {
  "304993082": {"name": "אור פרץ", "id": "304993082"},
  "315661033": {"name": "נעם ניר", "id": "315661033"},
  "035678622": {"name": "רואי זרחיה", "id": "035678622"},
  "207917899": {"name": "תומר ששון", "id": "207917899"},
  "324264597": {"name": "ג׳וליה סעיד", "id": "324264597"},
  "319090262": {"name": "רועי שלו", "id": "319090262"},
  "209222116": {"name": "אלמוג שמש", "id": "209222116"},
  "207688862": {"name": "ישי שלמה שרייבר", "id": "207688862"},
  "208295337": {"name": "לירון מזרחי", "id": "208295337"},
};

// Student ID verification component
const StudentIdVerification = ({ onStudentVerified }: { onStudentVerified: (student: any) => void }) => {
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState('');
  const [verifiedStudent, setVerifiedStudent] = useState(null);

  // Get current date in Hebrew format - updated to 17.7.25
  const getCurrentDate = () => {
    return "10.8.25";
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
const InstructionsPage = ({ onContinue, user }: { onContinue: () => void, user: any }) => {
  const [extraTimePercentage, setExtraTimePercentage] = useState<number | null>(null);
  const [totalExamTime, setTotalExamTime] = useState<string>('');

  useEffect(() => {
    const fetchExtraTime = async () => {
      try {
        const response = await fetch(`/api/exam/extraTime/${user.id}?t=${Date.now()}`, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        if (response.ok) {
          const data = await response.json();
          const percentage = data.percentage || 0;
          setExtraTimePercentage(percentage);
          
          // Calculate total exam time: 2 hours base + extra time
          const baseTimeMinutes = 120; // 2 hours
          const extraTimeMinutes = Math.round((baseTimeMinutes * percentage) / 100);
          const totalMinutes = baseTimeMinutes + extraTimeMinutes;
          const hours = Math.floor(totalMinutes / 60);
          const minutes = totalMinutes % 60;
          
          if (hours > 0) {
            setTotalExamTime(`${hours} שעות${minutes > 0 ? ` ו${minutes} דקות` : ''}`);
          } else {
            setTotalExamTime(`${minutes} דקות`);
          }
        } else {
          setExtraTimePercentage(0);
          setTotalExamTime('שעתיים');
        }
      } catch (error) {
        setExtraTimePercentage(0);
        setTotalExamTime('שעתיים');
      }
    };
    
    if (user?.id) {
      fetchExtraTime();
    }
  }, [user?.id]);

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
           
            {user?.id && (
              <>
                <div className={styles.detail}>
                  <span className={styles.detailLabel}>ת.ז. סטודנט:</span>
                  <span className={styles.detailValue}>{user.id}</span>
                </div>
                <div className={styles.detail}>
                  <span className={styles.detailLabel}>אחוז תוספת זמן:</span>
                  <span className={styles.detailValue}>
                    {extraTimePercentage !== null ? `${extraTimePercentage}%` : 'טוען...'}
                  </span>
                </div>
                <div className={styles.detail}>
                  <span className={styles.detailLabel}>זמן עבודה כולל:</span>
                  <span className={styles.detailValue}>
                    {totalExamTime || 'טוען...'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className={styles.rulesSection}>
          <h3 className={styles.sectionTitle}>כללי העבודה</h3>
          <ul className={styles.rulesList}>
            <li>העבודה מכילה שילוב של שאלות קלות, שאלות בינוניות שאלות קשות</li>
            <li>כל התשובות נשמרות אוטומטית</li>
            <li>במידה ונגמר הזמן או קרתה תקלת תקשורת, התשובה נשמרת אוטומטית</li>
            <li>לאחר הגשה, לא ניתן לשנות את התשובה</li>
            <li>במסך הבא יוצג "סיפור המעשה" ובסיס הנתונים הכולל 7 סכמות - למעוניינים, ניתן להוריד את בסיס הנתונים לקובץ PDF ולהדפיסו במהלך העבודה</li>
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
const DatabaseDescription = ({ onContinue, user }: { onContinue: () => void, user: any }) => {
  const [extraTimePercentage, setExtraTimePercentage] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [timerActive, setTimerActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [totalExtraTime, setTotalExtraTime] = useState<string>('');

  useEffect(() => {
    const fetchExtraTime = async () => {
      try {
        const response = await fetch(`/api/exam/extraTime/${user.id}?t=${Date.now()}`, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        if (response.ok) {
          const data = await response.json();
          const percentage = data.percentage || 0;
          setExtraTimePercentage(percentage);
          
          // Calculate total extra time for display
          const baseTimeMinutes = 120; // 2 hours
          const extraTimeMinutes = Math.round((baseTimeMinutes * percentage) / 100);
          if (extraTimeMinutes > 0) {
            const hours = Math.floor(extraTimeMinutes / 60);
            const minutes = extraTimeMinutes % 60;
            if (hours > 0) {
              setTotalExtraTime(`${hours} שעות${minutes > 0 ? ` ו${minutes} דקות` : ''}`);
            } else {
              setTotalExtraTime(`${minutes} דקות`);
            }
          } else {
            setTotalExtraTime('אין');
          }
          
          const scenarioTime = Math.round(300 * (1 + percentage / 100));
          setTimeLeft(scenarioTime);
        } else {
          setExtraTimePercentage(0);
          setTotalExtraTime('אין');
          setTimeLeft(300);
        }
      } catch (error) {
        setExtraTimePercentage(0);
        setTotalExtraTime('אין');
        setTimeLeft(300);
      } finally {
        setLoading(false);
      }
    };
    fetchExtraTime();
  }, [user.id]);

  useEffect(() => {
    if (!timerActive || loading || timeLeft === null) return;
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime === null) return null;
        if (prevTime <= 1) {
          setTimerActive(false);
          onContinue(); // Automatically proceed to exam
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timerActive, onContinue, loading, timeLeft]);

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const downloadScenarioPDF = () => {
    // Create a link to download the existing DB.pdf file
    const link = document.createElement('a');
    link.href = '/DB.pdf'; // Path to the PDF in public folder
    link.download = 'DB.pdf'; // Name for the downloaded file
    link.target = '_blank'; // Open in new tab as fallback
    
    // Trigger the download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleStartExam = () => {
    // Set the global timer in localStorage if not already set
    const GLOBAL_TIMER_KEY = 'shenkar_exam_global_timer';
    if (!localStorage.getItem(GLOBAL_TIMER_KEY)) {
      const baseMinutes = 120;
      const percentage = extraTimePercentage || 0;
      const extraMinutes = Math.round((baseMinutes * percentage) / 100);
      const totalSeconds = (baseMinutes + extraMinutes) * 60;
      const startTime = Date.now();
      localStorage.setItem(GLOBAL_TIMER_KEY, JSON.stringify({ startTime, totalSeconds }));
    }
    setTimerActive(false);
    onContinue();
  };

  if (loading || timeLeft === null) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p className={styles.loadingText}>טוען זמן נוסף...</p>
      </div>
    );
  }

  return (
    <div className={styles.databaseContainer}>
      <div className={styles.scenarioHeader}>
        <h2 className={styles.scenarioTitle}>מבנה מסד הנתונים</h2>
        {user?.id && (
          <div className={styles.studentInfoSubtitle}>
            <span className={styles.studentIdSubtitle}>ת.ז. סטודנט: {user.id}</span>
            {extraTimePercentage !== null && extraTimePercentage > 0 && (
              <>
                <span className={styles.extraTimeSubtitle}>זמן בסיס: שעתיים</span>
                <span className={styles.extraTimeSubtitle}>זמן נוסף: {totalExtraTime}</span>
              </>
            )}
          </div>
        )}
        <div className={styles.timerSection}>
          <div className={styles.timerContainer}>
            <div className={styles.timerMinutes}>{formatTime(timeLeft)}</div>
            <div className={styles.timerLabel}>דקות</div>
            <div className={styles.timerSubtext}>זמן לקריאת בסיס הנתונים</div>
          </div>
        </div>
      </div>

      <h2 className={styles.pageTitle}>מסד נתונים לעבודה</h2>
      
      {/* PDF Download Button */}
      <div className={styles.pdfButtonContainer}>
        <button 
          className={styles.pdfDownloadButton}
          onClick={() => downloadScenarioPDF()}
          title="הורדת קובץ PDF"
        >
          הורד PDF
        </button>
      </div>
      
      {/* ORIGINAL SCENARIO - COMMENTED OUT FOR EXAM SCREENSHOTS */}
      {/* <div className={styles.scenarioHeader}>
        <h3 className={styles.scenarioTitle}>תרחיש: מערכת ניהול חיל האוויר הישראלי</h3> */}

      {/* WOLT DELIVERY SCENARIO */}
      <div className={styles.scenarioHeader}>
        <h3 className={styles.scenarioTitle}>מערכת ניהול משלוחים - Wolt</h3>
        <div className={styles.scenarioDescription}>
          <p>מסד נתונים של Wolt לניהול הזמנות, שליחים, מסעדות ותלונות לקוחות.</p>
        </div>
      </div>

      <div className={styles.scenarioDescription}>
        <div className={styles.scenarioColumns}>
          <div className={styles.scenarioColumn}>
            <p>
              <strong>היסטוריה והקמה:</strong><br />
              Wolt היא חברת שליחויות בינלאומית שהוקמה בהלסינקי, פינלנד, בשנת 2014, והחלה לפעול בישראל בשנת 2018. מאז כניסתה לשוק המקומי, Wolt פועלת בעשרות ערים בישראל.
            </p>
            
            <p>
              <strong>שירותי החברה:</strong><br />
              החברה מציעה שירות משלוחים מהיר ממסעדות, סופרמרקטים וחנויות קמעונאיות באמצעות שליחים עצמאיים, ומתמחה במתן חוויית משתמש איכותית.
            </p>
            
            <p>
              <strong>פיתוח טכנולוגי:</strong><br />
              כדי לשפר את התפעול ולהבטיח חוויית משתמש איכותית, Wolt פיתחה מערכת טכנולוגית לניהול הזמנות ומשלוחים בזמן אמת.
            </p>
            
            <p>
              <strong>מעקב ובקרה:</strong><br />
              המערכת עוקבת אחר זמני הכנה, זמני משלוח, זמינות שליחים, משמרות, תלונות לקוח ופרמטרים לוגיסטיים נוספים.
            </p>
          </div>
          
          <div className={styles.scenarioColumn}>
            <p>
              <strong>אתגרים מרכזיים:</strong><br />
              אחד האתגרים המרכזיים עמו מתמודדת החברה הוא ניהול עומסים בזמני שיא: עיכובים באיסוף ובהגעה, חוסר תיאום בין זמינות שליחים לשעות פעילות המסעדות.
            </p>
            
            <p>
              <strong>בעיות תפעוליות:</strong><br />
              פערים בין הביקוש להזמנות לבין מספר השליחים הפעילים, ריבוי תלונות מצד לקוחות על עיכובים חוזרים, שירות לקוי או שליחים שלא השלימו את המשלוח.
            </p>
            
            <p>
              <strong>מערכת מסד הנתונים:</strong><br />
              מערכת מסד הנתונים של Wolt פותחה בשנת 2018 ועברה שדרוגים משמעותיים בשנים 2020, 2022, ו-2024 להתמודדות עם הגידול בנפח ההזמנות.
            </p>
            
            <p>
              <strong>תחומי פעילות המערכת:</strong>
            </p>
            <ul>
              <li>ניהול הזמנות ומעקב בזמן אמת</li>
              
              <li>ניהול משמרות וזמינות שליחים</li>
              
              <li>מעקב אחר ביצועים ודירוגי שליחים</li>
              
              <li>ניהול תלונות לקוחות ופיצויים</li>
              
              <li>תיאום בין מסעדות למרכזי שילוח</li>
              
              <li>ניתוח נתונים לשיפור התפעול</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div className={styles.tableNote}>
        <p><strong>הערה:</strong> הטבלאות המלאות של מערכת Wolt יופיעו בצד ימין במהלך הבחינה עם כל הפרטים הטכניים.</p>
      </div>
      
      <div className={styles.tablesGrid}>
        <div className={styles.tableCard}>
          <h3 className={styles.tableName}>טבלת Couriers (שליחים)</h3>
          <div className={styles.tableSchema}>
            <div className={styles.column}>
              <span className={styles.columnType}>מזהה ייחודי</span>
              <span className={styles.columnName}>courier_id</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>שם מלא</span>
              <span className={styles.columnName}>full_name</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>סוג רכב (אופניים, קטנוע, רכב)</span>
              <span className={styles.columnName}>vehicle_type</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>דירוג ממוצע</span>
              <span className={styles.columnName}>rating</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>תאריך התחלת עבודה</span>
              <span className={styles.columnName}>employment_date</span>
            </div>
          </div>
        </div>

        <div className={styles.tableCard}>
          <h3 className={styles.tableName}>טבלת Customers (לקוחות)</h3>
          <div className={styles.tableSchema}>
            <div className={styles.column}>
              <span className={styles.columnType}>מזהה ייחודי</span>
              <span className={styles.columnName}>customer_id</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>שם מלא</span>
              <span className={styles.columnName}>full_name</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>עיר מגורים</span>
              <span className={styles.columnName}>city</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>תאריך הרשמה</span>
              <span className={styles.columnName}>registration_date</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>סטטוס VIP (כן/לא)</span>
              <span className={styles.columnName}>vip_status</span>
            </div>
          </div>
        </div>

        <div className={styles.tableCard}>
          <h3 className={styles.tableName}>טבלת Restaurants (מסעדות)</h3>
          <div className={styles.tableSchema}>
            <div className={styles.column}>
              <span className={styles.columnType}>מזהה ייחודי</span>
              <span className={styles.columnName}>restaurant_id</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>שם המסעדה</span>
              <span className={styles.columnName}>name</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>כתובת מלאה</span>
              <span className={styles.columnName}>location</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>סוג מטבח</span>
              <span className={styles.columnName}>cuisine_type</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>שעות פתיחה</span>
              <span className={styles.columnName}>open_hours</span>
            </div>
          </div>
        </div>

        <div className={styles.tableCard}>
          <h3 className={styles.tableName}>טבלת Orders (הזמנות)</h3>
          <div className={styles.tableSchema}>
            <div className={styles.column}>
              <span className={styles.columnType}>מזהה ייחודי</span>
              <span className={styles.columnName}>order_id</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>סוג כלי הטיס (F-16I, F-35I)</span>
              <span className={styles.columnName}>aircraft_type</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>מספר זנב ייחודי</span>
              <span className={styles.columnName}>tail_number</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>הטייסת (מפתח זר)</span>
              <span className={styles.columnName}>squadron_id</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>שנת ייצור</span>
              <span className={styles.columnName}>manufacture_year</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>שעות טיסה מצטברות</span>
              <span className={styles.columnName}>flight_hours_total</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>מצב תפעולי נוכחי</span>
              <span className={styles.columnName}>status</span>
            </div>
          </div>
        </div>

        <div className={styles.tableCard}>
          <h3 className={styles.tableName}>טבלת Weapons (כלי נשק ותחמושת)</h3>
          <div className={styles.tableSchema}>
            <div className={styles.column}>
              <span className={styles.columnType}>מזהה ייחודי של כלי הנשק</span>
              <span className={styles.columnName}>weapon_id</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>שם כלי הנשק (פייתון 5, דרבי)</span>
              <span className={styles.columnName}>weapon_name</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>קטגוריית כלי הנשק</span>
              <span className={styles.columnName}>weapon_type</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>טווח יעיל מרבי בק"מ</span>
              <span className={styles.columnName}>range_km</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>עלות ליחידה באלפי ש"ח</span>
              <span className={styles.columnName}>cost_per_unit</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>כמות יחידות במלאי</span>
              <span className={styles.columnName}>stock_quantity</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>הבסיס בו מאוחסן (מפתח זר)</span>
              <span className={styles.columnName}>storage_base_id</span>
            </div>
          </div>
        </div>

        <div className={styles.tableCard}>
          <h3 className={styles.tableName}>טבלת Missions (משימות ותפעול)</h3>
          <div className={styles.tableSchema}>
            <div className={styles.column}>
              <span className={styles.columnType}>מזהה ייחודי של המשימה</span>
              <span className={styles.columnName}>mission_id</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>שם המשימה</span>
              <span className={styles.columnName}>mission_name</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>סוג המשימה</span>
              <span className={styles.columnName}>mission_type</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>הטייסת המבצעת (מפתח זר)</span>
              <span className={styles.columnName}>squadron_id</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>הטייס הראשי (מפתח זר)</span>
              <span className={styles.columnName}>pilot_id</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>כלי הטיס (מפתח זר)</span>
              <span className={styles.columnName}>aircraft_id</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>תאריך התחלה</span>
              <span className={styles.columnName}>start_date</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>סטטוס נוכחי</span>
              <span className={styles.columnName}>mission_status</span>
            </div>
          </div>
        </div>

        <div className={styles.tableCard}>
          <h3 className={styles.tableName}>טבלת Maintenance (תחזוקה)</h3>
          <div className={styles.tableSchema}>
            <div className={styles.column}>
              <span className={styles.columnType}>מזהה ייחודי של התחזוקה</span>
              <span className={styles.columnName}>maintenance_id</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>כלי הטיס (מפתח זר)</span>
              <span className={styles.columnName}>aircraft_id</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>סוג התחזוקה</span>
              <span className={styles.columnName}>maintenance_type</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>תאריך התחלה</span>
              <span className={styles.columnName}>start_date</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>תאריך סיום התחזוקה</span>
              <span className={styles.columnName}>end_date</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>עלות התחזוקה באלפי ש"ח</span>
              <span className={styles.columnName}>cost</span>
            </div>
          </div>
        </div>
      </div>
{/* 
      <div className={styles.dbNotes}>
        <h3 className={styles.sectionTitle}>יחסים בין הטבלאות</h3>
        <ul className={styles.notesList}>
          <li>כל הזמנה משויכת לשליח אחד (יחס N:1)</li>
          <li>כל הזמנה משויכת ללקוח אחד (יחס N:1)</li>
          <li>כל הזמנה משויכת למסעדה אחת (יחס N:1)</li>
          <li>שליח יכול לעבוד במשמרות מרובות (יחס 1:N)</li>
          <li>כל משמרת מתבצעת במרכז שילוח אחד (יחס N:1)</li>
          <li>מרכז שילוח מנהל מספר משמרות (יחס 1:N)</li>
          <li>תלונה מתייחסת להזמנה ספציפית (יחס N:1)</li>
          <li>לקוח יכול להגיש מספר תלונות (יחס 1:N)</li>
          <li>מסעדה יכולה לקבל מספר הזמנות (יחס 1:N)</li>
          <li>מפתח מורכב: CourierShifts (courier_id, shift_date)</li>
        </ul>
      </div> */}

      <button onClick={handleStartExam} className={styles.continueButton}>
        התחל עבודה
      </button>
    </div>
  );
};

const GLOBAL_TIMER_KEY = 'shenkar_exam_global_timer';

const GlobalExamTimer = ({ userId, onTimeUp }: { userId: string, onTimeUp: () => void }) => {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Try to load timer from localStorage
    const timerData = localStorage.getItem(GLOBAL_TIMER_KEY);
    let startTime: number, totalSeconds: number;
    if (timerData) {
      const parsed = JSON.parse(timerData);
      startTime = parsed.startTime;
      totalSeconds = parsed.totalSeconds;
    } else {
      // If not found, fetch extra time and set
      const fetchExtraTime = async () => {
        try {
          const response = await fetch(`/api/exam/extraTime/${userId}?t=${Date.now()}`, {
            method: 'GET',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          });
          let percentage = 0;
          if (response.ok) {
            const data = await response.json();
            percentage = data.percentage || 0;
          }
          const baseMinutes = 120;
          const extraMinutes = Math.round((baseMinutes * percentage) / 100);
          totalSeconds = (baseMinutes + extraMinutes) * 60;
          startTime = Date.now();
          localStorage.setItem(GLOBAL_TIMER_KEY, JSON.stringify({ startTime, totalSeconds }));
        } catch {
          totalSeconds = 120 * 60;
          startTime = Date.now();
          localStorage.setItem(GLOBAL_TIMER_KEY, JSON.stringify({ startTime, totalSeconds }));
        }
        setTimeLeft(totalSeconds);
      };
      fetchExtraTime();
      return;
    }
    // Calculate remaining time
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    setTimeLeft(Math.max(totalSeconds - elapsed, 0));
  }, [userId]);

  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      onTimeUp();
      return;
    }
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft, onTimeUp]);

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return '--:--:--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 16,
      right: 24,
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    }}>
      {/* Timer Display */}
      {isVisible && (
        <div style={{
          background: 'linear-gradient(135deg, #131137 0%, #2c5aa0 100%)',
          color: 'white',
          padding: '0.6rem 1.2rem',
          borderRadius: 16,
          fontWeight: 700,
          fontSize: '1rem',
          boxShadow: '0 3px 15px rgba(19, 17, 55, 0.2)',
          border: '1px solid #2c5aa0',
          minWidth: 100,
          textAlign: 'center',
          letterSpacing: 0.5,
        }}>
          ⏰ {formatTime(timeLeft)}
        </div>
      )}
      
      {/* Hide/Show Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        style={{
          background: 'rgba(19, 17, 55, 0.8)',
          color: 'white',
          border: '1px solid #2c5aa0',
          borderRadius: '50%',
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: '0.8rem',
          transition: 'all 0.3s ease',
          boxShadow: '0 2px 8px rgba(19, 17, 55, 0.2)',
        }}
        title={isVisible ? 'הסתר שעון' : 'הצג שעון'}
      >
        {isVisible ? '👁️‍🗨️' : '👁️'}
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

  // Add a ref to track if global timer should be shown
  const showGlobalTimer = ["database", "exam"].includes(currentStep);

  useEffect(() => {
    // We no longer require prior login - students authenticate with their ID
    setIsLoading(false);
  }, []);

  // 2. In handleStudentVerified, check if student has already completed or started an exam
  const handleStudentVerified = useCallback(async (student) => {
    setVerifiedStudent(student);
    setIsLoading(true);
    try {
      // Check if student has already completed an exam (temporarily disabled for testing)
      try {
        const completedResponse = await fetch(`/api/exam/check-completed/${student.id}`);
        const completedData = await completedResponse.json();
        
        if (completedResponse.ok && completedData.hasCompletedExam) {
          // Student has already completed an exam
          setError('ניתן להיבחן פעם אחת בלבד');
          return;
        }
      } catch (error) {
        console.log('Completed exam check not available, continuing...', error);
        // Continue to active session check if completed check fails
      }
      
      // Check if student has an active (in-progress) exam session
      const activeResponse = await fetch(`${SERVER_BASE}/exam/check-session/${student.id}`);
      const activeData = await activeResponse.json();
      
      if (activeResponse.ok && activeData.hasActiveSession) {
        // Student has an active session - show resume option instead of error
        const session = activeData.session;
        if (session.canResume) {
          // Can resume the exam
          let resumeMessage = `יש לך בחינה פעילה. שאלה ${session.currentQuestionIndex + 1} מתוך ${session.totalQuestions}.`;
          if (session.answeredQuestions > 0) {
            resumeMessage += ` ${session.answeredQuestions} שאלות כבר נענו.`;
          }
          if (session.hasAutoSaveForCurrent) {
            resumeMessage += ' נמצאה תשובה שמורה עבור השאלה הנוכחית.';
          }
          resumeMessage += ' לחץ "המשך בחינה" כדי להמשיך מהמקום בו עצרת.';
          setError(resumeMessage);
          // Store session info for resumption
          sessionStorage.setItem('resumeExamSession', JSON.stringify(session));
          return;
        } else {
          // Exam is completed or cannot be resumed
          setError('יש לך בחינה שהושלמה. אנא פנה למנהל הבחינה.');
          return;
        }
      }
      
      // Reset the global timer when a new exam session starts
      const GLOBAL_TIMER_KEY = 'shenkar_exam_global_timer';
      localStorage.removeItem(GLOBAL_TIMER_KEY);
      // Proceed to instructions if student hasn't completed or started an exam
      setCurrentStep('instructions');
    } catch (error) {
      console.error('Error checking exam status:', error);
      setError('שגיאה בבדיקת מצב הבחינה. אנא נסה שוב.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 3. In startExam, remove browserFingerprint and ExamSecurity.initializeExamSecurity
  const startExam = useCallback(async () => {
    if (!verifiedStudent) return;
    setIsLoading(true);
    try {
      // Configuration for proper exam randomization
      const examRandomizationConfig = {
        totalQuestions: 13,
        structure: {
          position1: { type: 'easy', fixed: true }, // Always easy
          positions2to13: { // 12 questions randomized
            easy: 5,
            medium: 3, 
            hard: 3,
            algebra: 1,
            randomized: true
          }
        },
        preventDuplicates: true, // Ensure no duplicate questions in same exam
        difficultyDistribution: {
          easy: 6,    // 1 fixed + 5 randomized
          medium: 3,  // 3 randomized
          hard: 3,    // 3 randomized  
          algebra: 1  // 1 randomized
        }
      };

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
          randomizationConfig: examRandomizationConfig, // Send randomization config to backend
          // browserFingerprint: browserFingerprint // DISABLED
        }),
      });
      const sessionData = await response.json();
      if (!response.ok) {
        if (response.status === 403) {
          setError(sessionData.message || 'הגישה לבחינה נחסמה');
          return;
        }
        throw new Error(sessionData.error || 'Failed to start exam');
      }
      setExamSession(sessionData);
      setCurrentStep('exam');
    } catch (error) {
      setError('שגיאה בהתחלת העבודה. אנא נסה שוב.');
    } finally {
      setIsLoading(false);
    }
  }, [verifiedStudent, user]);

  const handleExamComplete = useCallback((results) => {
    console.log('Exam completed with results:', results);
  }, []);

  const handleResumeExam = useCallback(async () => {
    const resumeSessionData = sessionStorage.getItem('resumeExamSession');
    if (!resumeSessionData || !verifiedStudent) return;
    
    try {
      setIsLoading(true);
      const sessionInfo = JSON.parse(resumeSessionData);
      
      // Get detailed progress information from the server
      const progressResponse = await fetch(`${SERVER_BASE}/exam/${sessionInfo.examId}/progress?studentId=${verifiedStudent.id}`);
      if (!progressResponse.ok) {
        throw new Error('Failed to get exam progress');
      }
      
      const progressData = await progressResponse.json();
      console.log('Resume exam with progress data:', progressData);
      
      // Check if there's an auto-saved answer for the current question
      let currentQuestionData = null;
      try {
        const autoSaveResponse = await fetch(`${SERVER_BASE}/exam/${sessionInfo.examId}/auto-save/${progressData.currentQuestionIndex}?studentId=${verifiedStudent.id}`);
        if (autoSaveResponse.ok) {
          const autoSaveData = await autoSaveResponse.json();
          currentQuestionData = {
            currentAnswer: autoSaveData.studentAnswer || '',
            timeSpent: autoSaveData.timeSpent || 0
          };
          console.log('Found auto-saved data for current question:', currentQuestionData);
        }
      } catch (error) {
        console.log('No auto-save data for current question');
      }
      
      // Create comprehensive exam session object with resume data
      const examSession = {
        examId: sessionInfo.examId,
        studentEmail: verifiedStudent.email || `student_${verifiedStudent.id}@exam.local`,
        examTitle: 'בחינת מיומנות SQL',
        startTime: progressData.startTime,
        totalQuestions: progressData.totalQuestions,
        currentQuestionIndex: progressData.currentQuestionIndex,
        studentId: verifiedStudent.id,
        studentName: verifiedStudent.name,
        isResuming: true,
        resumeData: {
          totalTimeSpent: progressData.totalTimeSpent,
          answeredQuestions: progressData.answeredQuestions,
          answers: progressData.answers,
          currentQuestionData: currentQuestionData
        }
      };
      
      console.log(`Resuming exam: Question ${progressData.currentQuestionIndex + 1}/${progressData.totalQuestions}, ${progressData.answeredQuestions} questions completed`);
      
      // Adjust global timer to account for time already spent
      const GLOBAL_TIMER_KEY = 'shenkar_exam_global_timer';
      const existingTimer = localStorage.getItem(GLOBAL_TIMER_KEY);
      if (existingTimer) {
        const timerData = JSON.parse(existingTimer);
        // Adjust start time to account for time already spent
        const adjustedStartTime = Date.now() - (progressData.totalTimeSpent * 1000);
        timerData.startTime = adjustedStartTime;
        localStorage.setItem(GLOBAL_TIMER_KEY, JSON.stringify(timerData));
        console.log(`Global timer adjusted for resume: ${progressData.totalTimeSpent}s already spent`);
      }
      
      setExamSession(examSession);
      setCurrentStep('exam');
      setError('');
      sessionStorage.removeItem('resumeExamSession');
      
    } catch (error) {
      console.error('Error resuming exam:', error);
      setError('שגיאה בחידוש העבודה. אנא נסה שוב.');
    } finally {
      setIsLoading(false);
    }
  }, [verifiedStudent]);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p className={styles.loadingText}>טוען...</p>
      </div>
    );
  }

  if (error) {
    // Check if this is a resumable exam error
    const resumeSessionData = sessionStorage.getItem('resumeExamSession');
    const canResume = resumeSessionData && error.includes('המשך בחינה');
    
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorMessage}>{error}</div>
        <div className={styles.errorButtons}>
          {canResume ? (
            <>
              <button onClick={handleResumeExam} className={styles.resumeButton}>
                המשך בחינה
              </button>
              <button onClick={() => {
                setError('');
                sessionStorage.removeItem('resumeExamSession');
              }} className={styles.retryButton}>
                ביטול
              </button>
            </>
          ) : (
            <button onClick={() => setError('')} className={styles.retryButton}>
              נסה שוב
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.examContainer}>
      {showGlobalTimer && verifiedStudent && (
        <GlobalExamTimer userId={verifiedStudent.id} onTimeUp={() => setCurrentStep('exam')} />
      )}
      <main className={styles.mainContent}>
        {currentStep === 'studentId' && (
          <StudentIdVerification onStudentVerified={handleStudentVerified} />
        )}
        
        {currentStep === 'instructions' && (
          <InstructionsPage onContinue={() => setCurrentStep('database')} user={verifiedStudent} />
        )}
        
        {currentStep === 'database' && verifiedStudent && (
          <DatabaseDescription onContinue={startExam} user={verifiedStudent} />
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