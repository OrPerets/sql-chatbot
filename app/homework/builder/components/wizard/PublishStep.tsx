"use client";

import Link from "next/link";
import styles from "./Wizard.module.css";
import type { DatasetDraft, MetadataDraft, QuestionDraft, WizardStepId } from "./types";
import { useHomeworkLocale } from "@/app/homework/context/HomeworkLocaleProvider";

interface PublishStepProps {
  metadata: MetadataDraft;
  dataset: DatasetDraft;
  questions: QuestionDraft[];
  onBack: (step: WizardStepId) => void;
  onPublish: () => void;
  publishDisabled: boolean;
  setId?: string;
  autoSaveState: "idle" | "saving" | "saved" | "error";
  onRefresh?: () => void;
}

const PREV_STEP: WizardStepId = "rubric";

export function PublishStep({
  metadata,
  dataset,
  questions,
  onBack,
  onPublish,
  publishDisabled,
  setId,
  autoSaveState,
  onRefresh,
}: PublishStepProps) {
  const { t } = useHomeworkLocale();
  
  return (
    <div className={styles.stepContainer}>
      <section className={styles.section}>
        <h3>סקירת הגדרות</h3>
        <p className={styles.mutedText}>אשרו את הנתונים, בחירת המאגר, כיסוי השאלות ומוכנות הבדיקה לפני הפרסום.</p>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label>כותרת</label>
            <span>{metadata.title}</span>
          </div>
          <div className={styles.field}>
            <label>קורס</label>
            <span>{metadata.courseId || "—"}</span>
          </div>
          <div className={styles.field}>
            <label>תאריך הגשה</label>
            <span>{metadata.dueAt ? new Date(metadata.dueAt).toLocaleString('he-IL') : "—"}</span>
          </div>
          <div className={styles.field}>
            <label>מצב פרסום</label>
            <span className={styles.badge}>{t(`builder.dashboard.filter.${metadata.visibility}`)}</span>
          </div>
        </div>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label>אסטרטגיית מאגר</label>
            <span>{metadata.datasetPolicy === "shared" ? "שימוש במאגרי קורס משותפים" : "מאגר מותאם"}</span>
          </div>
          <div className={styles.field}>
            <label>מאגר נבחר</label>
            <span>{dataset.selectedDatasetId || dataset.newDatasetName || "ממתין"}</span>
          </div>
          <div className={styles.field}>
            <label>תגיות</label>
            <span>{dataset.tags && dataset.tags.length > 0 ? dataset.tags.join(", ") : "—"}</span>
          </div>
        </div>

        <div className={styles.section}>
          <h4>כיסוי שאלות</h4>
          <p className={styles.mutedText}>ודאו שלכל שאלה יש הנחיות, SQL התחלתי, תוצאות צפויות וקריטריוני רובריקה.</p>
          <ul className={styles.list}>
            {questions.map((question, index) => (
              <li key={question.id} className={styles.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>שאלה {index + 1}</strong>
                  <span className={styles.badge}>{question.rubric.length} פריטי רובריקה</span>
                </div>
                <p className={styles.mutedText}>{question.instructions.slice(0, 160) || "לא סופקו הנחיות"}</p>
                <p className={styles.mutedText}>נקודות: {question.points} • ניסיונות מקסימליים: {question.maxAttempts}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className={styles.actions}>
        <button type="button" className={styles.secondaryButton} onClick={() => onBack(PREV_STEP)}>
          חזרה
        </button>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <span className={styles.mutedText}>
            {autoSaveState === "saving" && "שומר טיוטה…"}
            {autoSaveState === "saved" && "טיוטה נשמרה"}
            {autoSaveState === "error" && (
              <>
                לא ניתן לשמור טיוטה. <button type="button" className={styles.smallButton} onClick={onRefresh}>נסה שוב</button>
              </>
            )}
          </span>
          {setId && (
            <Link href={`/homework/builder/${setId}/preview`} className={styles.secondaryButton}>
              תצוגה מקדימה
            </Link>
          )}
          <button
            type="button"
            className={`${styles.primaryButton} ${publishDisabled ? styles.disabled : ""}`}
            disabled={publishDisabled}
            onClick={onPublish}
          >
            פרסום שיעור בית
          </button>
        </div>
      </footer>
    </div>
  );
}
