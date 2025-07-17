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
  "211359807": { "name": "בן מיכאל נועם", "id": "211359807" },
  "314652769": { "name": "בן משה יעל", "id": "314652769" },
  "211395207": { "name": "בקר ירדן", "id": "211395207" },
  "207767187": { "name": "גלר לירז", "id": "207767187" },
  "318521895": { "name": "חמו עמית", "id": "318521895" },
  "318379948": { "name": "כהן תומר", "id": "318379948" },
  "207271313": { "name": "לוי אורן", "id": "207271313" },
  "211419718": { "name": "לס מאיה", "id": "211419718" },
  "322210485": { "name": "לסקו עדי", "id": "322210485" },
  "212343735": { "name": "לרר עדי", "id": "212343735" },
  "313334989": { "name": "לשם אריאל", "id": "313334989" },
  "208581454": { "name": "מדיני עומר", "id": "208581454" },
  "207767732": { "name": "מדר נוי", "id": "207767732" },
  "318643301": { "name": "מוסקוביץ אלון", "id": "318643301" },
  "209895259": { "name": "מוצניק אופיר יהודית", "id": "209895259" },
  "206574329": { "name": "מורבסקי עודד", "id": "206574329" },
  "208295337": { "name": "מזרחי לירון", "id": "208295337" },
  "322517962": { "name": "מיכאלי עילי", "id": "322517962" },
  "318222585": { "name": "מירקין עמר", "id": "318222585" },
  "322640616": { "name": "מלמוד יואב", "id": "322640616" },
  "209520220": { "name": "מרד עמית", "id": "209520220" },
  "206913923": { "name": "נאור גיא", "id": "206913923" },
  "208540591": { "name": "נוה אדם", "id": "208540591" },
  "209362730": { "name": "נחשון אלמוג", "id": "209362730" },
  "212323281": { "name": "נחשון רינו", "id": "212323281" },
  "322402769": { "name": "סוויד ליהי", "id": "322402769" },
  "211423868": { "name": "סולימן עידו", "id": "211423868" },
  "313360364": { "name": "סטרול נדב", "id": "313360364" },
  "327363032": { "name": "סיידה לינור", "id": "327363032" },
  "322623976": { "name": "סירקיס תמר", "id": "322623976" },
  "211829437": { "name": "סלע ענבל", "id": "211829437" },
  "322755745": { "name": "סמואי ליאור", "id": "322755745" },
  "324264597": { "name": "סעיד ג׳וליה", "id": "324264597" },
  "322990516": { "name": "סקורי שני", "id": "322990516" },
  "318960044": { "name": "סקורניק עומר", "id": "318960044" },
  "212203020": { "name": "עזר אופיר", "id": "212203020" },
  "318672037": { "name": "עזריה נועם", "id": "318672037" },
  "206490054": { "name": "פדלון אורן", "id": "206490054" },
  "207686387": { "name": "פוריה שירי", "id": "207686387" },
  "314653866": { "name": "פחטר תומר", "id": "314653866" },
  "211788591": { "name": "פלגי ליאור", "id": "211788591" },
  "207749219": { "name": "פלד תומר", "id": "207749219" },
  "324173681": { "name": "פסח עומר", "id": "324173681" },
  "316598549": { "name": "פרבר שחר", "id": "316598549" },
  "211646047": { "name": "פרס נועם", "id": "211646047" },
  "318930120": { "name": "פרץ ליאה רחל", "id": "318930120" },
  "206362451": { "name": "צור יונתן", "id": "206362451" },
  "322657743": { "name": "ציבר דנה", "id": "322657743" },
  "206578163": { "name": "קדוש חן", "id": "206578163" },
  "318897964": { "name": "קוזנץ מישל", "id": "318897964" },
  "323097766": { "name": "קומציה ניבאל", "id": "323097766" },
  "209313287": { "name": "קירקפטריק ליאם", "id": "209313287" },
  "322697566": { "name": "קמיר דנה", "id": "322697566" },
  "207003070": { "name": "קרשטיין בר", "id": "207003070" },
  "206633232": { "name": "רוז נדב", "id": "206633232" },
  "322658717": { "name": "רוס מיקה", "id": "322658717" },
  "318986908": { "name": "רוש אורי", "id": "318986908" },
  "207488115": { "name": "רז יותם", "id": "207488115" },
  "316410612": { "name": "רחמים אליאב", "id": "316410612" },
  "322211400": { "name": "ריזנברג קרן", "id": "322211400" },
  "312395502": { "name": "ריטל אודליה", "id": "312395502" },
  "208583807": { "name": "רייפנברג עומר", "id": "208583807" },
  "319099594": { "name": "רם נגה", "id": "319099594" },
  "322620964": { "name": "שירי יובל", "id": "322620964" },
  "314078833": { "name": "שכטר רומי", "id": "314078833" },
  "319090262": { "name": "שלו רועי", "id": "319090262" },
  "209238708": { "name": "שלמה גיא", "id": "209238708" },
  "322547068": { "name": "שמאי אילאיל", "id": "322547068" },
  "209222116": { "name": "שמש אלמוג", "id": "209222116" },
  "207688862": { "name": "שרייבר ישי שלמה", "id": "207688862" },
  "207917899": { "name": "ששון תומר", "id": "207917899" },
  "211994348": { "name": "תירוש דון", "id": "211994348" }
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

      {/* GENERIC SCENARIO FOR EXAM SCREENSHOTS */}
      <div className={styles.scenarioHeader}>
        <h3 className={styles.scenarioTitle}>מסד נתונים כללי</h3>
        <div className={styles.scenarioDescription}>
          <p>מסד נתונים המכיל מספר טבלאות המקושרות ביניהן באמצעות מפתחות זרים.</p>
        </div>
      </div>

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
      
      <div className={styles.tablesGrid}>
        <div className={styles.tableCard}>
          <h3 className={styles.tableName}>טבלת AirBases (בסיסי חיל האוויר)</h3>
          <div className={styles.tableSchema}>
            <div className={styles.column}>
              <span className={styles.columnType}>מזהה ייחודי של הבסיס</span>
              <span className={styles.columnName}>base_id</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>שם הבסיס (רמת דוד, חצרים)</span>
              <span className={styles.columnName}>base_name</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>קוד הבסיס (3 אותיות)</span>
              <span className={styles.columnName}>base_code</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>אזור גיאוגרפי</span>
              <span className={styles.columnName}>location</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>שנת הקמה</span>
              <span className={styles.columnName}>established_year</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>מספר מסלולי נחיתה</span>
              <span className={styles.columnName}>runways_count</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>מספר מקסימלי של אנשי צוות</span>
              <span className={styles.columnName}>personnel_capacity</span>
            </div>
          </div>
        </div>

      {/* GENERIC TABLES FOR EXAM SCREENSHOTS */}
      {/* <div className={styles.tablesGrid}>
        <div className={styles.tableCard}>
          <h3 className={styles.tableName}>טבלה A</h3>
          <div className={styles.tableSchema}>
            <div className={styles.column}>
              <span className={styles.columnType}>מזהה ייחודי (מפתח ראשי)</span>
              <span className={styles.columnName}>id</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>שם</span>
              <span className={styles.columnName}>name</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>תיאור</span>
              <span className={styles.columnName}>description</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>תאריך יצירה</span>
              <span className={styles.columnName}>created_date</span>
            </div>
          </div>
        </div>

        <div className={styles.tableCard}>
          <h3 className={styles.tableName}>טבלה B</h3>
          <div className={styles.tableSchema}>
            <div className={styles.column}>
              <span className={styles.columnType}>מזהה ייחודי (מפתח ראשי)</span>
              <span className={styles.columnName}>id</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>מזהה טבלה A (מפתח זר)</span>
              <span className={styles.columnName}>table_a_id</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>ערך מספרי</span>
              <span className={styles.columnName}>numeric_value</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>סטטוס</span>
              <span className={styles.columnName}>status</span>
            </div>
          </div>
        </div> */}

        <div className={styles.tableCard}>
          <h3 className={styles.tableName}>טבלת Squadrons (טייסות)</h3>
          <div className={styles.tableSchema}>
            <div className={styles.column}>
              <span className={styles.columnType}>מזהה ייחודי של הטייסת</span>
              <span className={styles.columnName}>squadron_id</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>שם הטייסת (טייסת הנץ)</span>
              <span className={styles.columnName}>squadron_name</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>מספר הטייסת ההיסטורי</span>
              <span className={styles.columnName}>squadron_number</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>קוד הבסיס (מפתח זר)</span>
              <span className={styles.columnName}>base_id</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>סוג כלי הטיס העיקרי</span>
              <span className={styles.columnName}>aircraft_type</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>התמחות עיקרית</span>
              <span className={styles.columnName}>mission_type</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>מספר הטייסים הפעילים</span>
              <span className={styles.columnName}>active_pilots</span>
            </div>
          </div>
        </div>

        <div className={styles.tableCard}>
          <h3 className={styles.tableName}>טבלת Pilots (טייסים)</h3>
          <div className={styles.tableSchema}>
            <div className={styles.column}>
              <span className={styles.columnType}>מזהה ייחודי של הטייס</span>
              <span className={styles.columnName}>pilot_id</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>שם פרטי ומשפחה</span>
              <span className={styles.columnName}>pilot_name</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>דרגה צבאית</span>
              <span className={styles.columnName}>rank</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>הטייסת (מפתח זר)</span>
              <span className={styles.columnName}>squadron_id</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>שנות ניסיון בטיסה</span>
              <span className={styles.columnName}>experience_years</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>שעות טיסה מצטברות</span>
              <span className={styles.columnName}>flight_hours</span>
            </div>
            <div className={styles.column}>
              <span className={styles.columnType}>משכורת חודשית</span>
              <span className={styles.columnName}>salary</span>
            </div>
          </div>
        </div>

        <div className={styles.tableCard}>
          <h3 className={styles.tableName}>טבלת Aircraft (כלי טיס)</h3>
          <div className={styles.tableSchema}>
            <div className={styles.column}>
              <span className={styles.columnType}>מזהה ייחודי של כלי הטיס</span>
              <span className={styles.columnName}>aircraft_id</span>
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

      <div className={styles.dbNotes}>
        <h3 className={styles.sectionTitle}>יחסים בין הטבלאות</h3>
        <ul className={styles.notesList}>
          <li>כל בסיס מכיל מספר טייסות (יחס 1:N)</li>
          <li>כל טייס משרת בטייסת אחת (יחס N:1)</li>
          <li>כל טייסת ממוקמת בבסיס אחד (יחס N:1)</li>
          <li>כל כלי טיס משויך לטייסת אחת (יחס N:1)</li>
          <li>כלי נשק מאוחסנים בבסיסים שונים (יחס N:1)</li>
          <li>כל משימה כוללת טייסת ספציפית (יחס 1:1)</li>
          <li>כל משימה כוללת טייס ספציפי (יחס 1:1)</li>
          <li>כל משימה כוללת כלי טיס ספציפי (יחס 1:1)</li>
          <li>כל כלי טיס עובר תחזוקות מרובות (יחס 1:N)</li>
        </ul>
      </div>

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
        // Student has an active session
        setError('יש לך בחינה פעילה. אנא פנה למנהל הבחינה.');
        return;
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