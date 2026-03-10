"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, CalendarClock, ChevronLeft, Lock, Play } from "lucide-react";
import styles from "./student-entry.module.css";
import { isHomeworkAccessible } from "@/lib/deadline-utils";
import { EXAM_PREP_ANNOUNCEMENT, isExamPrepTitle } from "@/lib/exam-prep-content";
import type {
  HomeworkAvailabilityInfo,
  HomeworkAvailabilityState,
  HomeworkSet,
} from "@/app/homework/types";

type StudentVisibleHomework = Pick<
  HomeworkSet,
  | "id"
  | "title"
  | "courseId"
  | "questionOrder"
  | "dueAt"
  | "availableFrom"
  | "availableUntil"
  | "overview"
  | "backgroundStory"
> &
  Partial<HomeworkAvailabilityInfo>;

interface StudentEntryClientProps {
  forcedSetId?: string;
}

interface HomeworkStatusState {
  type: "not_found" | "blocked";
  message: string;
  availabilityState?: HomeworkAvailabilityState;
  availableFrom?: string;
  availableUntil?: string;
}

function formatDateTime(dateInput?: string): string {
  if (!dateInput) {
    return "לא צוין";
  }

  const parsed = new Date(dateInput);
  if (Number.isNaN(parsed.getTime())) {
    return "לא צוין";
  }

  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function formatAvailabilityWindow(homework: StudentVisibleHomework | HomeworkStatusState): string {
  if ("title" in homework && isExamPrepTitle(homework.title)) {
    return EXAM_PREP_ANNOUNCEMENT;
  }

  const from = homework.availableFrom ? formatDateTime(homework.availableFrom) : "פתיחה לא הוגדרה";
  const until = homework.availableUntil ? formatDateTime(homework.availableUntil) : "סגירה לא הוגדרה";
  return `${from} - ${until}`;
}

function getStatusLabel(state?: HomeworkAvailabilityState): string {
  switch (state) {
    case "upcoming":
      return "נפתח בקרוב";
    case "closed":
      return "נסגר";
    case "open":
    default:
      return "פתוח";
  }
}

function getStatusTone(state?: HomeworkAvailabilityState): string {
  switch (state) {
    case "upcoming":
      return styles.statusUpcoming;
    case "closed":
      return styles.statusClosed;
    case "open":
    default:
      return styles.statusOpen;
  }
}

function sortByAvailability(items: StudentVisibleHomework[]): StudentVisibleHomework[] {
  const order: Record<HomeworkAvailabilityState, number> = {
    open: 0,
    upcoming: 1,
    closed: 2,
  };

  return [...items].sort((left, right) => {
    const leftState = left.availabilityState ?? "open";
    const rightState = right.availabilityState ?? "open";

    if (order[leftState] !== order[rightState]) {
      return order[leftState] - order[rightState];
    }

    return left.title.localeCompare(right.title, "he");
  });
}

export function StudentEntryClient({ forcedSetId }: StudentEntryClientProps) {
  const router = useRouter();
  const isDirectEntry = Boolean(forcedSetId);

  const [step, setStep] = useState<"list" | "login" | "instructions" | "loading">(
    isDirectEntry ? "login" : "list"
  );
  const [publishedSets, setPublishedSets] = useState<StudentVisibleHomework[]>([]);
  const [publishedSetsLoading, setPublishedSetsLoading] = useState(!isDirectEntry);
  const [selectedHomework, setSelectedHomework] = useState<StudentVisibleHomework | HomeworkSet | null>(null);
  const [homeworkStatus, setHomeworkStatus] = useState<HomeworkStatusState | null>(null);
  const [studentEmail, setStudentEmail] = useState("");
  const [password, setPassword] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [error, setError] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

  useEffect(() => {
    if (isDirectEntry || forcedSetId) {
      return;
    }

    let cancelled = false;
    setPublishedSetsLoading(true);

    fetch("/api/homework")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Failed to load homework list");
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) {
          return;
        }
        setPublishedSets(sortByAvailability(data.items || []));
      })
      .catch(() => {
        if (!cancelled) {
          setPublishedSets([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPublishedSetsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [forcedSetId, isDirectEntry]);

  useEffect(() => {
    if (!forcedSetId) {
      return;
    }

    let cancelled = false;
    setSelectedHomework(null);
    setHomeworkStatus(null);
    setError("");

    fetch(`/api/homework/${forcedSetId}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));

        if (cancelled) {
          return;
        }

        if (res.status === 404) {
          setHomeworkStatus({
            type: "not_found",
            message: "שיעור הבית המבוקש לא נמצא.",
          });
          return;
        }

        if (!res.ok) {
          setHomeworkStatus({
            type: "blocked",
            message: data.error || "שיעור הבית אינו זמין כרגע.",
            availabilityState: data.availabilityState,
            availableFrom: data.availableFrom,
            availableUntil: data.availableUntil,
          });
          return;
        }

        setSelectedHomework(data);
      })
      .catch(() => {
        if (!cancelled) {
          setHomeworkStatus({
            type: "blocked",
            message: "לא ניתן לטעון את פרטי שיעור הבית כרגע.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [forcedSetId]);

  const loginHomework = useMemo(() => {
    if (!forcedSetId) {
      return null;
    }

    return selectedHomework;
  }, [forcedSetId, selectedHomework]);

  const transformBackgroundStory = (story: string | undefined, title: string): string => {
    if (!story) return "";

    if (title === "תרגיל 3" || title === "תרגיל בית 3") {
      let cleanedStory = story;

      cleanedStory = cleanedStory.replace(/הנחייה חשובה:[\s\S]*?וכד'\.?\s*/g, "").trim();
      cleanedStory = cleanedStory.replace(/הנחייה חשובה:[^\n]*(?:[^\n]*וכד'[^\n]*)?/g, "").trim();
      cleanedStory = cleanedStory.replace(/דוגמא: אם ת\.ז\.:321654987 \(ABCDEFGHI\), אז ABC= 321, DEF= 654, GHI= 987\.\s*/g, "").trim();
      cleanedStory = cleanedStory.replace(/יש להיצמד להגדרות סוגי הנתונים בבואכם להגדיר את סכמת הטבלה לפי הפירוט המופיע בכל טבלה וטבלה\.\s*/g, "").trim();
      cleanedStory = cleanedStory.replace(/למרות שניתן לפתור את התרגיל רק ע"י הצגת הסכמות וללא רשומות בטבלאות עצמן כפי שלמדנו בתרגיל 2, נבנו בתרגיל זה לכל טבלה מספר רשומות לדוגמא בכדי לסייע בהבנת הסכמות\. עם זאת במקרה ותשובה של אחת מהשאילתות יוצאת ריקה - יש להוסיף נתונים לטבלאות כך שע"י הפעלת כל אחת מהשאילתות בתרגיל תתקבל תשובה שאינה טבלה ריקה, ז"א עליכם למלא תוכן רלוונטי בטבלאות כך שבכל תוצאת שאילתא תחזור לפחות שורה אחת - שאילתות שיחזירו סכמות ריקות לא תקבלנה את מלאו הנקודות!\s*/g, "").trim();

      const allLines = cleanedStory.split("\n");
      cleanedStory = allLines.filter((line) => !line.includes("הנחייה חשובה")).join("\n").trim();
      cleanedStory = cleanedStory.replace(/עמודת credits מייצגת[^\n]*/g, "").trim();
      cleanedStory = cleanedStory.replace(/עמודת credits מייצגת את כמות נקודות הזכות שהסטודנט יקבל בסיום הקורס\.?\s*/g, "").trim();

      const tablesStart = cleanedStory.indexOf("1) מידע על הסטודנטים:");
      if (tablesStart === -1) return cleanedStory;

      const enrollmentsEnd = cleanedStory.indexOf("Enrollments (StudentID, CourseID, EnrollmentDate, Grade)");
      if (enrollmentsEnd === -1) return cleanedStory;

      let tablesEndIndex = cleanedStory.indexOf("\n", enrollmentsEnd + 60);
      if (tablesEndIndex === -1) tablesEndIndex = cleanedStory.length;

      const tablesText = cleanedStory.substring(tablesStart, tablesEndIndex).trim();
      let afterTables = cleanedStory.substring(tablesEndIndex).trim();
      afterTables = afterTables.replace(/\n{3,}/g, "\n\n").trim();

      const newFirstParagraph =
        "בתרגיל זה, נתון מסד נתונים הקשור לניהול מערכת סטודנטים וקורסים במכללה. הנכם מגלמים תפקיד של מנהל/מנהלת מערכת קורסים במכללה האחראי/ת על ניהול קורסים, סטודנטים, מרצים ונרשמים לקורסים. מסד הנתונים כולל 4 טבלאות.";
      const creditsNote = "עמודת credits מייצגת את כמות נקודות הזכות שהסטודנט יקבל בסיום הקורס";

      if (afterTables) {
        return `${newFirstParagraph}\n\n${tablesText}\n\n${creditsNote}\n\n${afterTables}`;
      }

      return `${newFirstParagraph}\n\n${tablesText}\n\n${creditsNote}`;
    }

    return story;
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!studentEmail.trim()) {
      setError("נא להזין כתובת אימייל");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(studentEmail.trim())) {
      setError("כתובת אימייל לא תקינה");
      return;
    }

    if (!password.trim()) {
      setError("נא להזין סיסמה");
      return;
    }

    if (!forcedSetId) {
      setError("יש לבחור שיעור בית לפני ההתחברות.");
      return;
    }

    setStep("loading");

    try {
      const loginResponse = await fetch("/api/users/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: studentEmail.trim(),
          password: password.trim(),
        }),
      });

      if (!loginResponse.ok) {
        const errorData = await loginResponse.json();
        setError(errorData.error || "שגיאה בהתחברות");
        setStep("login");
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
          })
        );
      }

      const emailParam = studentEmail.trim() ? `&email=${encodeURIComponent(studentEmail.trim())}` : "";
      const response = await fetch(`/api/homework/${forcedSetId}?studentId=${userData.id}${emailParam}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || "שיעור הבית אינו זמין כרגע.");
        setStep("login");
        return;
      }

      const data = await response.json();

      if (!isHomeworkAccessible(data, studentEmail)) {
        setError(data.availabilityMessage || "שיעור הבית אינו זמין כרגע.");
        setStep("login");
        return;
      }

      setSelectedHomework(data);
      const consentKey = `homeworkConsent_${userData.id}_${data.id}`;
      if (typeof window !== "undefined" && !localStorage.getItem(consentKey)) {
        setShowConsentModal(true);
      }
      setStep("instructions");
    } catch (err) {
      console.error("Error loading homework:", err);
      setError("שגיאה בטעינת שיעור הבית");
      setStep("login");
    }
  };

  const handleStart = async () => {
    if (!selectedHomework || !studentId || isStarting) {
      return;
    }

    if (!isHomeworkAccessible(selectedHomework, studentEmail)) {
      setError("חלון ההגשה אינו פתוח כרגע.");
      setStep("login");
      return;
    }

    setIsStarting(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      router.push(`/homework/runner/${selectedHomework.id}?studentId=${studentId}`);
    } catch (err) {
      console.error("Error navigating to runner:", err);
      setIsStarting(false);
    }
  };

  const handleBack = () => {
    setStep("login");
    setStudentEmail("");
    setPassword("");
    setStudentId("");
    setStudentName("");
    setError("");
  };

  const handleConsentApprove = () => {
    if (studentId && selectedHomework?.id && typeof window !== "undefined") {
      localStorage.setItem(`homeworkConsent_${studentId}_${selectedHomework.id}`, "true");
    }
    setShowConsentModal(false);
  };

  const handleConsentReject = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("currentUser");
    }
    setShowConsentModal(false);
    setStep("login");
    setStudentId("");
    setStudentName("");
    setPassword("");
    setSelectedHomework(loginHomework);
    setError("נדרשת הסכמה כדי להמשיך למערכת.");
  };

  if (!isDirectEntry) {
    return (
      <div className={styles.container} dir="rtl">
        <div className={styles.card}>
          <div className={styles.header}>
            <div className={styles.icon}>
              <BookOpen size={40} />
            </div>
            <h1 className={styles.title}>שיעורי בית פתוחים</h1>
            <p className={styles.subtitle}>בחרו מטלה מהרשימה כדי להיכנס לעמוד ההתחברות הייעודי שלה</p>
          </div>

          {publishedSetsLoading ? (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <p style={{ color: "#64748b", fontSize: "15px" }}>טוען מטלות...</p>
            </div>
          ) : publishedSets.length === 0 ? (
            <div className={styles.emptyState}>
              <Lock size={28} />
              <p>אין כרגע שיעורי בית גלויים לסטודנטים.</p>
            </div>
          ) : (
            <div className={styles.homeworkGrid}>
              {publishedSets.map((set) => {
                const isOpen = set.availabilityState === "open";

                return (
                  <article key={set.id} className={styles.homeworkCard}>
                    <div className={styles.homeworkCardHeader}>
                      <div>
                        <h2 className={styles.homeworkCardTitle}>{set.title}</h2>
                        {set.courseId ? <p className={styles.homeworkCardCourse}>{set.courseId}</p> : null}
                      </div>
                      <span className={`${styles.statusBadge} ${getStatusTone(set.availabilityState)}`}>
                        {getStatusLabel(set.availabilityState)}
                      </span>
                    </div>

                    <div className={styles.homeworkCardMeta}>
                      <div className={styles.homeworkMetaRow}>
                        <CalendarClock size={16} />
                        <span>{formatAvailabilityWindow(set)}</span>
                      </div>
                      <div className={styles.homeworkMetaRow}>
                        <BookOpen size={16} />
                        <span>{set.questionOrder.length} שאלות</span>
                      </div>
                    </div>

                    <p className={styles.homeworkCardMessage}>
                      {set.availabilityMessage || "לפרטי מטלה והתחברות, עברו לעמוד הייעודי."}
                    </p>

                    <button
                      type="button"
                      className={isOpen ? styles.button : styles.buttonSecondary}
                      onClick={() => router.push(`/homework/start/${set.id}`)}
                    >
                      {isOpen ? "כניסה למטלה" : "פרטי זמינות"}
                    </button>
                  </article>
                );
              })}
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

  if (step === "instructions" && selectedHomework) {
    const overviewParagraphs = (selectedHomework.overview ?? "")
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    const storyText = transformBackgroundStory(selectedHomework.backgroundStory, selectedHomework.title);
    const storyParagraphs = storyText
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    return (
      <div className={styles.container} dir="rtl">
        {showConsentModal && (
          <div className={styles.consentOverlay} role="dialog" aria-modal="true" aria-labelledby="consent-title">
            <div className={styles.consentModal}>
              <h2 id="consent-title" className={styles.consentTitle}>
                הסכמה לשימוש בנתונים לצורכי מחקר אקדמי
              </h2>
              <div className={styles.consentText}>
                <p>ידוע לי כי נתונים הנוגעים לשימוש באסיסטנט ה-SQL בקורס (לרבות הגשות, השתתפות ונתוני ביצוע) עשויים לשמש לצורכי מחקר אקדמי.</p>
                <p>אני מבין/ה כי:</p>
                <ul>
                  <li>הנתונים יעובדו באופן אנונימי וללא זיהוי אישי.</li>
                  <li>השימוש בנתונים ייעשה לצורכי מחקר בלבד.</li>
                  <li>השתתפותי היא וולונטרית, ואני רשאי/ת לבטל את הסכמתי בכל עת ללא כל השלכה אקדמית.</li>
                  <li>להסכמתי או לאי-הסכמתי לא תהיה השפעה על ציוניי או על מעמדי האקדמי.</li>
                </ul>
                <p>באישור מסמך זה אני מסכים/ה לשימוש בנתונים האנונימיים כאמור לעיל.</p>
              </div>
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
            {/* Top bar: welcome + homework title */}
            <div className={styles.instrTopBar}>
              <div className={styles.instrTopBarLeft}>
                <h2 className={styles.instrHwTitle}>{selectedHomework.title}</h2>
                {studentName ? (
                  <span className={styles.instrWelcome}>שלום, {studentName}</span>
                ) : null}
              </div>
              <div className={styles.instrTopBarRight}>
                <div className={styles.instrMetaChip}>
                  <BookOpen size={14} />
                  <span>{selectedHomework.questionOrder.length} שאלות</span>
                </div>
                <div className={styles.instrMetaChip}>
                  <CalendarClock size={14} />
                  <span>{formatAvailabilityWindow(selectedHomework)}</span>
                </div>
              </div>
            </div>

            {/* Instructions section */}
            {overviewParagraphs.length > 0 && (
              <div className={styles.instrSection}>
                <div className={styles.instrSectionHeader}>
                  <div className={styles.instrSectionIcon}>
                    <BookOpen size={18} />
                  </div>
                  <h3 className={styles.instrSectionTitle}>הנחיות לתרגיל</h3>
                </div>
                <div className={styles.instrSectionBody}>
                  <ol className={styles.instrList}>
                    {overviewParagraphs.map((paragraph, idx) => (
                      <li key={idx} className={styles.instrListItem}>
                        <span className={styles.instrListNum}>{idx + 1}</span>
                        <span className={styles.instrListText}>{paragraph}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}

            {/* Background story section */}
            {storyParagraphs.length > 0 && (
              <div className={styles.instrSection}>
                <div className={styles.instrSectionHeaderAlt}>
                  <div className={styles.instrSectionIconAlt}>
                    <Play size={18} />
                  </div>
                  <h3 className={styles.instrSectionTitle}>סיפור הרקע</h3>
                </div>
                <div className={styles.instrSectionBody}>
                  <div className={styles.storyContent}>
                    {storyParagraphs.map((paragraph, idx) => (
                      <p key={idx} className={styles.storyParagraph}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
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
                    התחל את התרגיל
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedHomework && !homeworkStatus) {
    return (
      <div className={styles.container} dir="rtl">
        <div className={styles.card}>
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p style={{ color: "#64748b", fontSize: "15px" }}>טוען פרטי מטלה...</p>
          </div>
        </div>
      </div>
    );
  }

  if (homeworkStatus) {
    return (
      <div className={styles.container} dir="rtl">
        <div className={styles.card}>
          <div className={styles.statusPanel}>
            <div className={styles.icon}>
              <Lock size={40} />
            </div>
            <h1 className={styles.title}>
              {homeworkStatus.type === "not_found" ? "שיעור הבית לא נמצא" : "שיעור הבית אינו פתוח כרגע"}
            </h1>
            <p className={styles.subtitle}>{homeworkStatus.message}</p>

            {homeworkStatus.availableFrom || homeworkStatus.availableUntil ? (
              <div className={styles.statusWindow}>
                <span className={`${styles.statusBadge} ${getStatusTone(homeworkStatus.availabilityState)}`}>
                  {getStatusLabel(homeworkStatus.availabilityState)}
                </span>
                <p>{formatAvailabilityWindow(homeworkStatus)}</p>
              </div>
            ) : null}

            <Link href="/homework/start" className={styles.backLink}>
              <ChevronLeft size={16} />
              חזרה לרשימת המטלות
            </Link>
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
          <h1 className={styles.title}>{selectedHomework?.title || "כניסה לשיעור בית"}</h1>
          <p className={styles.subtitle}>נא להזין את כתובת האימייל והסיסמה שלך להתחברות</p>
          {selectedHomework ? (
            <div className={styles.selectedHomeworkMeta}>
              {selectedHomework.courseId ? <p>{selectedHomework.courseId}</p> : null}
              <p>{formatAvailabilityWindow(selectedHomework)}</p>
              {"availabilityState" in selectedHomework ? (
                <span className={`${styles.statusBadge} ${getStatusTone(selectedHomework.availabilityState)}`}>
                  {getStatusLabel(selectedHomework.availabilityState)}
                </span>
              ) : null}
            </div>
          ) : null}
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

          {error ? (
            <div className={styles.error}>
              <span>⚠️</span>
              {error}
            </div>
          ) : null}

          <button type="submit" className={styles.button} disabled={!password.trim() || !studentEmail.trim()}>
            התחבר
          </button>

          <Link href="/homework/start" className={styles.backLink}>
            <ChevronLeft size={16} />
            חזרה לרשימת המטלות
          </Link>
        </form>
      </div>
    </div>
  );
}
