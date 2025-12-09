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

// Allowed students list
const ALLOWED_STUDENTS: { [id: string]: string } = {
  "304993082": "אור פרץ",
  "123456789": "סטודנט דמו",
};

export function StudentEntryClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setId = searchParams.get("setId");

  const [step, setStep] = useState<"id" | "instructions" | "loading">("id");
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [error, setError] = useState("");
  const [homework, setHomework] = useState<HomeworkSet | null>(null);

  const handleIdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate ID (Israeli ID should be 9 digits)
    if (!studentId.trim()) {
      setError("נא להזין תעודת זהות");
      return;
    }

    if (studentId.length < 6 || studentId.length > 9) {
      setError("תעודת זהות לא תקינה");
      return;
    }

    // Check if student is in the allowed list
    if (!ALLOWED_STUDENTS[studentId]) {
      setError("תעודת זהות לא מורשית לביצוע שיעור בית זה");
      return;
    }

    // Set the student name from the allowed list
    setStudentName(ALLOWED_STUDENTS[studentId]);

    setStep("loading");

    try {
      let homeworkSetId = setId;
      
      // If no setId provided, fetch the first available homework
      if (!homeworkSetId) {
        console.log("📚 No setId provided, fetching available homework sets...");
        const setsResponse = await fetch("/api/homework");
        if (!setsResponse.ok) {
          throw new Error("Failed to load homework sets");
        }
        const setsData = await setsResponse.json();
        
        // Find first published homework set
        const publishedSets = setsData.items?.filter((hw: any) => hw.published) || [];
        if (publishedSets.length === 0) {
          setError("אין שיעורי בית זמינים כרגע");
          setStep("id");
          return;
        }
        
        homeworkSetId = publishedSets[0].id;
        console.log("✅ Using homework set:", homeworkSetId);
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

  const handleStart = () => {
    if (homework && studentId) {
      router.push(`/homework/runner/${homework.id}?studentId=${studentId}`);
    }
  };

  const handleBack = () => {
    setStep("id");
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
          <div className={styles.header}>
            <div className={styles.icon}>
              <BookOpen size={40} />
            </div>
            <h1 className={styles.title}>הנחיות</h1>
          </div>

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
                    <span>תאריך הגשה: {new Date(homework.dueAt).toLocaleDateString("he-IL")}</span>
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
                <div className={styles.instructionsText}>{homework.backgroundStory}</div>
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
                  תוכלו להריץ כל שאילתה ולראות את התוצאות
                </div>
                <div className={styles.instructionItem}>
                  השאילתות נשמרות אוטומטית במהלך העבודה
                </div>
                <div className={styles.instructionItem}>
                  לאחר סיום הפתרון, לחצו על "הגש שיעור בית"
                </div>
                <div className={styles.instructionItem}>
                  בהצלחה! 🎯
                </div>
              </div>
            </div>

            <div className={styles.buttonGroup}>
              <button className={styles.buttonSecondary} onClick={handleBack}>
                חזרה
              </button>
              <button className={styles.buttonPrimary} onClick={handleStart}>
                התחל את שיעור הבית
                <ArrowRight size={20} />
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
          <p className={styles.subtitle}>נא להזין את תעודת הזהות שלך להתחלה</p>
        </div>

        <form className={styles.form} onSubmit={handleIdSubmit}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>תעודת זהות</label>
            <input
              type="text"
              className={styles.input}
              placeholder="123456789"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value.replace(/\D/g, ""))}
              maxLength={9}
              autoFocus
            />
          </div>

          {error && (
            <div className={styles.error}>
              <span>⚠️</span>
              {error}
            </div>
          )}

          <button type="submit" className={styles.button} disabled={!studentId.trim()}>
            המשך
          </button>
        </form>
      </div>
    </div>
  );
}

