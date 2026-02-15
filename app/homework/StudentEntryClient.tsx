"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Play, ArrowRight, ChevronLeft } from "lucide-react";
import styles from "./student-entry.module.css";
import { isHomeworkAccessible, getDeadlineMessage } from "@/lib/deadline-utils";

interface HomeworkSet {
  id: string;
  title: string;
  courseId?: string;
  backgroundStory?: string;
  questionOrder: string[];
  dueAt?: string;
}

interface PublishedSetSummary {
  id: string;
  title: string;
  courseId?: string;
  draftQuestionCount?: number;
}

export function StudentEntryClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setIdFromUrl = searchParams.get("setId");

  const [step, setStep] = useState<"choose" | "id" | "instructions" | "loading">("id");
  const [publishedSets, setPublishedSets] = useState<PublishedSetSummary[]>([]);
  const [publishedSetsLoading, setPublishedSetsLoading] = useState(true);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(setIdFromUrl);
  const [studentEmail, setStudentEmail] = useState("");
  const [password, setPassword] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [error, setError] = useState("");
  const [homework, setHomework] = useState<HomeworkSet | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

  // Sync URL setId into selected when URL changes
  useEffect(() => {
    if (setIdFromUrl) setSelectedSetId(setIdFromUrl);
  }, [setIdFromUrl]);

  // Fetch published sets on mount (for "choose homework" when multiple exist)
  useEffect(() => {
    let cancelled = false;
    setPublishedSetsLoading(true);
    fetch("/api/homework")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => {
        if (cancelled) return;
        const published = (data.items || []).filter(
          (hw: { published?: boolean; visibility?: string }) =>
            hw.published && hw.visibility !== "archived"
        );
        setPublishedSets(published);
        if (published.length === 1 && !setIdFromUrl) setSelectedSetId(published[0].id);
        if (published.length > 1 && !setIdFromUrl) setStep("choose");
      })
      .catch(() => {
        if (!cancelled) setPublishedSets([]);
      })
      .finally(() => {
        if (!cancelled) setPublishedSetsLoading(false);
      });
    return () => { cancelled = true; };
  }, [setIdFromUrl]);

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

    // Validate password
    if (!password.trim()) {
      setError("נא להזין סיסמה");
      return;
    }

    setStep("loading");

    try {
      // Login with email and password
      const loginResponse = await fetch("/api/users/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          email: studentEmail.trim(),
          password: password.trim()
        }),
      });

      if (!loginResponse.ok) {
        const errorData = await loginResponse.json();
        setError(errorData.error || "שגיאה בהתחברות");
        setStep("id");
        return;
      }

      const userData = await loginResponse.json();
      setStudentId(userData.id);
      setStudentName(userData.name || userData.email);
      if (typeof window !== "undefined") {
        localStorage.setItem(
          "currentUser",
          JSON.stringify({
            id: userData.id,
            email: userData.email ?? studentEmail.trim(),
            name: userData.name || userData.email || studentEmail.trim(),
          }),
        );
      }

      // Use selected set, URL setId, or first published
      let homeworkSetId = selectedSetId || setIdFromUrl;
      if (!homeworkSetId && publishedSets.length > 0) {
        homeworkSetId = publishedSets[0].id;
      }
      if (!homeworkSetId) {
        setError("אין שיעורי בית זמינים כרגע");
        setStep("id");
        return;
      }

      // Fetch homework details - pass email for accurate deadline extension check
      const emailParam = studentEmail.trim() ? `&email=${encodeURIComponent(studentEmail.trim())}` : '';
      const response = await fetch(`/api/homework/${homeworkSetId}?studentId=${studentId}${emailParam}`);
      if (!response.ok) {
        if (response.status === 403) {
          const errorData = await response.json();
          setError(errorData.error || "תאריך ההגשה חלף. שיעור הבית כבר לא זמין להגשה.");
          setStep("id");
          return;
        }
        throw new Error("Failed to load homework");
      }
      const data = await response.json();
      
      // Double-check deadline on client side as well
      if (!isHomeworkAccessible(data.dueAt, studentEmail)) {
        setError("תאריך ההגשה חלף. שיעור הבית כבר לא זמין להגשה.");
        setStep("id");
        return;
      }
      
      setHomework(data);
      const consentKey = `homeworkConsent_${userData.id}`;
      if (typeof window !== "undefined" && !localStorage.getItem(consentKey)) {
        setShowConsentModal(true);
      }
      setStep("instructions");
    } catch (err) {
      console.error("Error loading homework:", err);
      setError("שגיאה בטעינת שיעור הבית");
      setStep("id");
    }
  };

  const handleStart = async () => {
    if (homework && studentId && !isStarting) {
      // Double-check deadline before navigating
      if (!isHomeworkAccessible(homework.dueAt, studentEmail)) {
        setError("תאריך ההגשה חלף. שיעור הבית כבר לא זמין להגשה.");
        setStep("id");
        return;
      }
      
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
    setPassword("");
    setStudentId("");
    setStudentName("");
  };

  const handleBackToChoose = () => {
    setStep("choose");
    setError("");
  };

  if (step === "choose") {
    return (
      <div className={styles.container} dir="rtl">
        <div className={styles.card}>
          <div className={styles.header}>
            <div className={styles.icon}>
              <BookOpen size={40} />
            </div>
            <h1 className={styles.title}>בחר מטלה</h1>
            <p className={styles.subtitle}>בחר את שיעור הבית שברצונך להתחיל</p>
          </div>
          {publishedSetsLoading ? (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <p style={{ color: "#64748b", fontSize: "15px" }}>טוען מטלות...</p>
            </div>
          ) : (
            <div className={styles.setChooser}>
              {publishedSets.map((set) => (
                <button
                  key={set.id}
                  type="button"
                  className={styles.setCard}
                  onClick={() => {
                    setSelectedSetId(set.id);
                    setStep("id");
                    setError("");
                  }}
                >
                  <span className={styles.setCardTitle}>{set.title}</span>
                  {set.courseId && <span className={styles.setCardMeta}>{set.courseId}</span>}
                  {typeof set.draftQuestionCount === "number" && (
                    <span className={styles.setCardMeta}>{set.draftQuestionCount} שאלות</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === "loading") {
    return (
      <div className={styles.container} dir="rtl">
        <div className={styles.card}>
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p style={{ color: "#64748b", fontSize: "15px" }}>טוען...</p>
          </div>
        </div>
      </div>
    );
  }

  const handleConsentApprove = () => {
    if (studentId && typeof window !== "undefined") {
      localStorage.setItem(`homeworkConsent_${studentId}`, "true");
    }
    setShowConsentModal(false);
  };

  const handleConsentReject = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("currentUser");
    }
    setShowConsentModal(false);
    setStep("id");
    setStudentId("");
    setStudentName("");
    setPassword("");
    setHomework(null);
    setError("נדרשת הסכמה כדי להמשיך למערכת.");
  };

  if (step === "instructions" && homework) {
    return (
      <div className={styles.container} dir="rtl">
        {showConsentModal && (
          <div className={styles.consentOverlay} role="dialog" aria-modal="true" aria-labelledby="consent-title">
            <div className={styles.consentModal}>
              <h2 id="consent-title" className={styles.consentTitle}>הסכמה</h2>
              <p className={styles.consentText}>בשימוש במערכת זו אני מאשר כי המידע שמוזן נשמר במערכת, וכי והסכמתי לתנאי השימוש.</p>
              <div className={styles.consentButtons}>
                <button type="button" className={styles.consentButtonSecondary} onClick={handleConsentReject}>
                  לא מאשר
                </button>
                <button type="button" className={styles.consentButton} onClick={handleConsentApprove}>
                  אני מאשר
                </button>
              </div>
            </div>
          </div>
        )}
        <div className={styles.card}>
          <div className={styles.instructionsContent}>
            {studentName && (
              <div className={styles.welcomeMessage}>
                <span>👋</span>
                <span>שלום {studentName}!</span>
              </div>
            )}
            {/* <div className={styles.homeworkInfo}>
              <h2 className={styles.homeworkTitle}>{homework.title}</h2>
              <div className={styles.homeworkMeta}>
                
                <div className={styles.metaItem}>
                  <span>📝</span>
                  <span>{homework.questionOrder.length} שאלות</span>
                </div>
                {homework.dueAt && (
                  <div className={styles.metaItem}>
                    <span>📅</span>
                    <span>{getDeadlineMessage(homework.dueAt, studentEmail)}</span>
                  </div>
                )}
              </div>
            </div> */}

            {homework.backgroundStory && (
              <div className={styles.instructionsBox}>
                <h3 className={styles.instructionsTitle}>
                  <span>📖</span>
                  סיפור הרקע
                </h3>
                <div className={styles.instructionsText}>{transformBackgroundStory(homework.backgroundStory, homework.title)}</div>
              </div>
            )}

            {/* <div className={styles.instructionsBox}>
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
            </div> */}

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
                    התחל 
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

  const chosenSet = selectedSetId ? publishedSets.find((s) => s.id === selectedSetId) : null;

  return (
    <div className={styles.container} dir="rtl">
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.icon}>
            <Play size={40} />
          </div>
          <h1 className={styles.title}>הכנה למבחן</h1>
          <p className={styles.subtitle}>נא להזין את כתובת האימייל והסיסמה שלך להתחברות</p>
          {publishedSets.length > 1 && chosenSet && (
            <p className={styles.chosenSet}>
              מטלה נבחרת: <strong>{chosenSet.title}</strong>
              {" · "}
              <button type="button" className={styles.changeSetLink} onClick={handleBackToChoose}>
                <ChevronLeft size={14} /> החלף מטלה
              </button>
            </p>
          )}
        </div>

        <form className={styles.form} onSubmit={handleEmailSubmit}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>כתובת אימייל</label>
            <input
              type="email"
              className={styles.input}
              placeholder="your.email@example.com"
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
              autoFocus
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>סיסמה</label>
            <input
              type="password"
              className={styles.input}
              placeholder="הזן סיסמה"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className={styles.error}>
              <span>⚠️</span>
              {error}
            </div>
          )}

          <button type="submit" className={styles.button} disabled={!password.trim() || !studentEmail.trim()}>
            התחבר
          </button>
        </form>
      </div>
    </div>
  );
}
