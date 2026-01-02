"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Play, ArrowRight } from "lucide-react";
import styles from "./student-entry.module.css";

interface HomeworkSet {
  id: string;
  title: string;
  courseId?: string;
  backgroundStory?: string;
  questionOrder: string[];
  dueAt?: string;
}

export function StudentEntryClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setId = searchParams.get("setId");

  const [step, setStep] = useState<"id" | "instructions" | "loading">("id");
  const [studentEmail, setStudentEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [error, setError] = useState("");
  const [homework, setHomework] = useState<HomeworkSet | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  
  const ADMIN_PASSWORD = "r123";

  // Transform background story for תרגיל 3
  const transformBackgroundStory = (story: string | undefined, title: string): string => {
    if (!story) return "";
    
    // Only transform if it's תרגיל 3
    if (title === "תרגיל 3" || title === "תרגיל בית 3") {
      // First, remove unwanted sections from the entire story (before processing)
      let cleanedStory = story;
      
      // Remove: "הנחייה חשובה" section - remove from entire story first
      cleanedStory = cleanedStory.replace(/הנחייה חשובה:[\s\S]*?וכד'\.?\s*/g, "").trim();
      cleanedStory = cleanedStory.replace(/הנחייה חשובה:[^\n]*(?:[^\n]*וכד'[^\n]*)?/g, "").trim();
      
      // Remove: "דוגמא: אם ת.ז.:321654987 (ABCDEFGHI), אז ABC= 321, DEF= 654, GHI= 987."
      cleanedStory = cleanedStory.replace(/דוגמא: אם ת\.ז\.:321654987 \(ABCDEFGHI\), אז ABC= 321, DEF= 654, GHI= 987\.\s*/g, "").trim();
      
      // Remove: "יש להיצמד להגדרות סוגי הנתונים בבואכם להגדיר את סכמת הטבלה לפי הפירוט המופיע בכל טבלה וטבלה."
      cleanedStory = cleanedStory.replace(/יש להיצמד להגדרות סוגי הנתונים בבואכם להגדיר את סכמת הטבלה לפי הפירוט המופיע בכל טבלה וטבלה\.\s*/g, "").trim();
      
      // Remove: "למרות שניתן לפתור את התרגיל רק ע"י הצגת הסכמות וללא רשומות בטבלאות עצמן כפי שלמדנו בתרגיל 2, נבנו בתרגיל זה לכל טבלה מספר רשומות לדוגמא בכדי לסייע בהבנת הסכמות. עם זאת במקרה ותשובה של אחת מהשאילתות יוצאת ריקה - יש להוסיף נתונים לטבלאות כך שע"י הפעלת כל אחת מהשאילתות בתרגיל תתקבל תשובה שאינה טבלה ריקה, ז"א עליכם למלא תוכן רלוונטי בטבלאות כך שבכל תוצאת שאילתא תחזור לפחות שורה אחת - שאילתות שיחזירו סכמות ריקות לא תקבלנה את מלאו הנקודות!"
      cleanedStory = cleanedStory.replace(/למרות שניתן לפתור את התרגיל רק ע"י הצגת הסכמות וללא רשומות בטבלאות עצמן כפי שלמדנו בתרגיל 2, נבנו בתרגיל זה לכל טבלה מספר רשומות לדוגמא בכדי לסייע בהבנת הסכמות\. עם זאת במקרה ותשובה של אחת מהשאילתות יוצאת ריקה - יש להוסיף נתונים לטבלאות כך שע"י הפעלת כל אחת מהשאילתות בתרגיל תתקבל תשובה שאינה טבלה ריקה, ז"א עליכם למלא תוכן רלוונטי בטבלאות כך שבכל תוצאת שאילתא תחזור לפחות שורה אחת - שאילתות שיחזירו סכמות ריקות לא תקבלנה את מלאו הנקודות!\s*/g, "").trim();
      
      // Remove any remaining lines that contain "הנחייה חשובה"
      const allLines = cleanedStory.split('\n');
      cleanedStory = allLines.filter(line => !line.includes('הנחייה חשובה')).join('\n').trim();
      
      // Remove existing credits note from the entire story (before processing)
      cleanedStory = cleanedStory.replace(/עמודת credits מייצגת[^\n]*/g, "").trim();
      cleanedStory = cleanedStory.replace(/עמודת credits מייצגת את כמות נקודות הזכות שהסטודנט יקבל בסיום הקורס\.?\s*/g, "").trim();
      
      // Now process the cleaned story
      // Find where the tables start
      const tablesStart = cleanedStory.indexOf("1) מידע על הסטודנטים:");
      if (tablesStart === -1) return cleanedStory;
      
      // Find where the tables end (after Enrollments table definition)
      const enrollmentsEnd = cleanedStory.indexOf("Enrollments (StudentID, CourseID, EnrollmentDate, Grade)");
      if (enrollmentsEnd === -1) return cleanedStory;
      
      // Find the newline after the Enrollments line
      let tablesEndIndex = cleanedStory.indexOf("\n", enrollmentsEnd + 60);
      if (tablesEndIndex === -1) tablesEndIndex = cleanedStory.length;
      
      // Extract the tables section
      const tablesText = cleanedStory.substring(tablesStart, tablesEndIndex).trim();
      
      // Get everything after the tables
      let afterTables = cleanedStory.substring(tablesEndIndex).trim();
      
      // Clean up multiple consecutive newlines
      afterTables = afterTables.replace(/\n{3,}/g, "\n\n").trim();
      
      // Build the new background story
      const newFirstParagraph = `בתרגיל זה, נתון מסד נתונים הקשור לניהול מערכת סטודנטים וקורסים במכללה. הנכם מגלמים תפקיד של מנהל/מנהלת מערכת קורסים במכללה האחראי/ת על ניהול קורסים, סטודנטים, מרצים ונרשמים לקורסים. מסד הנתונים כולל 4 טבלאות.`;
      const creditsNote = `עמודת credits מייצגת את כמות נקודות הזכות שהסטודנט יקבל בסיום הקורס`;
      
      // Combine: new first paragraph + tables + credits note + rest
      if (afterTables) {
        return `${newFirstParagraph}\n\n${tablesText}\n\n${creditsNote}\n\n${afterTables}`;
      } else {
        return `${newFirstParagraph}\n\n${tablesText}\n\n${creditsNote}`;
      }
    }
    
    return story;
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate admin password
    if (!adminPassword.trim()) {
      setError("נא להזין סיסמת מנהל");
      return;
    }

    if (adminPassword.trim() !== ADMIN_PASSWORD) {
      setError("סיסמת מנהל שגויה");
      return;
    }

    // Validate email
    if (!studentEmail.trim()) {
      setError("נא להזין כתובת אימייל");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(studentEmail.trim())) {
      setError("כתובת אימייל לא תקינה");
      return;
    }

    setStep("loading");

    try {
      // Look up user by email
      const lookupResponse = await fetch("/api/users/lookup-by-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: studentEmail.trim() }),
      });

      if (!lookupResponse.ok) {
        const errorData = await lookupResponse.json();
        setError(errorData.error || "משתמש לא נמצא במערכת");
        setStep("id");
        return;
      }

      const userData = await lookupResponse.json();
      setStudentId(userData.id);
      setStudentName(userData.name || userData.email);

      // Now load the homework set
      let homeworkSetId = setId;
      
      // If no setId provided, fetch the first available homework
      if (!homeworkSetId) {
        console.log("📚 No setId provided, fetching available homework sets...");
        const setsResponse = await fetch("/api/homework");
        if (!setsResponse.ok) {
          throw new Error("Failed to load homework sets");
        }
        const setsData = await setsResponse.json();
        
        // Find published homework sets
        const publishedSets = setsData.items?.filter((hw: any) => hw.published) || [];
        if (publishedSets.length === 0) {
          setError("אין שיעורי בית זמינים כרגע");
          setStep("id");
          return;
        }
        
        // Prioritize "תרגיל 3" if it exists, otherwise use the first published one
        const exercise3 = publishedSets.find((hw: any) => hw.title === "תרגיל 3" || hw.title === "תרגיל בית 3");
        homeworkSetId = exercise3 ? exercise3.id : publishedSets[0].id;
        console.log("✅ Using homework set:", homeworkSetId, exercise3 ? "(תרגיל 3)" : "");
      }

      // Fetch homework details
      const response = await fetch(`/api/homework/${homeworkSetId}`);
      if (!response.ok) {
        throw new Error("Failed to load homework");
      }
      const data = await response.json();
      setHomework(data);
      setStep("instructions");
    } catch (err) {
      console.error("Error loading homework:", err);
      setError("שגיאה בטעינת שיעור הבית");
      setStep("id");
    }
  };

  const handleStart = async () => {
    if (homework && studentId && !isStarting) {
      setIsStarting(true);
      try {
        // Small delay to show loading state
        await new Promise(resolve => setTimeout(resolve, 100));
        router.push(`/homework/runner/${homework.id}?studentId=${studentId}`);
      } catch (err) {
        console.error("Error navigating to runner:", err);
        setIsStarting(false);
      }
    }
  };

  const handleBack = () => {
    setStep("id");
    setStudentEmail("");
    setAdminPassword("");
    setStudentId("");
    setStudentName("");
  };

  if (step === "loading") {
    return (
      <div className={styles.container} dir="rtl">
        <div className={styles.card}>
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p style={{ color: "#64748b", fontSize: "15px" }}>טוען את שיעור הבית...</p>
          </div>
        </div>
      </div>
    );
  }

  if (step === "instructions" && homework) {
    return (
      <div className={styles.container} dir="rtl">
        <div className={styles.card}>
          <div className={styles.instructionsContent}>
            {studentName && (
              <div className={styles.welcomeMessage}>
                <span>👋</span>
                <span>שלום {studentName}!</span>
              </div>
            )}
            <div className={styles.homeworkInfo}>
              <h2 className={styles.homeworkTitle}>{homework.title}</h2>
              <div className={styles.homeworkMeta}>
                
                <div className={styles.metaItem}>
                  <span>📝</span>
                  <span>{homework.questionOrder.length} שאלות</span>
                </div>
                {homework.dueAt && (
                  <div className={styles.metaItem}>
                    <span>📅</span>
                    <span>תאריך הגשה: 13.01.2026 ב-23:59</span>
                  </div>
                )}
              </div>
            </div>

            {homework.backgroundStory && (
              <div className={styles.instructionsBox}>
                <h3 className={styles.instructionsTitle}>
                  <span>📖</span>
                  סיפור הרקע
                </h3>
                <div className={styles.instructionsText}>{transformBackgroundStory(homework.backgroundStory, homework.title)}</div>
              </div>
            )}

            <div className={styles.instructionsBox}>
              <h3 className={styles.instructionsTitle}>
                <span>💡</span>
                הנחיות כלליות
              </h3>
              <div className={styles.instructionsList}>
                <div className={styles.instructionItem}>
                  כל שאלה דורשת כתיבת שאילתת SQL
                </div>
                <div className={styles.instructionItem}>
                  השאילתות נשמרות אוטומטית במהלך העבודה
                </div>
                <div className={styles.instructionItem}>
                  לאחר סיום הפתרון, לחצו על &quot;הגש שיעור בית&quot;
                </div>
                <div className={styles.instructionItem}>
                  למעוניינים להשתמש בכלי AI, ניתן להשתמש במייקל אשר זמין לשימושכם במהלך התרגיל. במידה והשתמשתם בכלי חיצוני (לא מייקל), יש לצרף העתק מלא של השיחה עם מודל הבינה מלאכותית.
                </div>
                <div className={styles.instructionItem}>
                  אין להגיש תרגילים בכתב יד, אלא רק דרך ממשק זה.
                </div>
                <div className={styles.instructionItem}>
                  תרגיל זה מבוסס על החומר שנלמד בהרצאות ובתרגולים מתחילת הסמסטר.
                </div>
                <div className={styles.instructionItem}>
                  ההגשה תתבצע ביחידים בלבד
                </div>
                <div className={styles.instructionItem}>
                  במועד ההגשה, ישלח לכם מייל אישור שההגשה התקבלה.
                </div>
                <div className={styles.instructionItem}>
                  בסיס הנתונים נבנה ע&quot;י מייקל וזמין עבורכם (אינכם נדרשים לבנות את פקודות CREATE ופקודות INSERT עבור 4 הטבלאות בבסיס הנתונים של התרגיל).
                </div>
                <div className={styles.instructionItem}>
                  בהצלחה! 🎯
                </div>
              </div>
            </div>

            <div className={styles.buttonGroup}>
              <button className={styles.buttonSecondary} onClick={handleBack} disabled={isStarting}>
                חזרה
              </button>
              <button className={styles.buttonPrimary} onClick={handleStart} disabled={isStarting}>
                {isStarting ? (
                  <>
                    <div className={styles.buttonSpinner} />
                    טוען...
                  </>
                ) : (
                  <>
                    התחל את שיעור הבית
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} dir="rtl">
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.icon}>
            <Play size={40} />
          </div>
          <h1 className={styles.title}>שיעורי בית SQL</h1>
          <p className={styles.subtitle}>נא להזין את סיסמת המנהל וכתובת האימייל שלך להתחלה</p>
        </div>

        <form className={styles.form} onSubmit={handleEmailSubmit}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>סיסמת מנהל</label>
            <input
              type="password"
              className={styles.input}
              placeholder="הזן סיסמת מנהל"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              autoFocus
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>כתובת אימייל</label>
            <input
              type="email"
              className={styles.input}
              placeholder="your.email@example.com"
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
            />
          </div>

          {error && (
            <div className={styles.error}>
              <span>⚠️</span>
              {error}
            </div>
          )}

          <button type="submit" className={styles.button} disabled={!adminPassword.trim() || !studentEmail.trim()}>
            המשך
          </button>
        </form>
      </div>
    </div>
  );
}

