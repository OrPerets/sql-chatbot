"use client";

import Link from "next/link";
import styles from "./Wizard.module.css";
import type { DatasetDraft, MetadataDraft, QuestionDraft, WizardStepId } from "./types";
import { useHomeworkLocale } from "@/app/homework/context/HomeworkLocaleProvider";
import type { DraftValidationSummary } from "./validation";

interface PublishStepProps {
  metadata: MetadataDraft;
  dataset: DatasetDraft;
  questions: QuestionDraft[];
  validationSummary: DraftValidationSummary;
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
  validationSummary,
  onBack,
  onPublish,
  publishDisabled,
  setId,
  autoSaveState,
  onRefresh,
}: PublishStepProps) {
  const { t, formatDateTime } = useHomeworkLocale();
  
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
            <label>פתיחה לסטודנטים</label>
            <span>{metadata.availableFrom ? formatDateTime(metadata.availableFrom) : "—"}</span>
          </div>
          <div className={styles.field}>
            <label>סגירה לסטודנטים</label>
            <span>{metadata.availableUntil ? formatDateTime(metadata.availableUntil) : "—"}</span>
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

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label>תיאור כללי לסטודנט</label>
            <span>{metadata.overview?.trim() || "—"}</span>
          </div>
          <div className={styles.field}>
            <label>מבנה הנתונים ב-runner</label>
            <span>{metadata.dataStructureNotes?.trim() || dataset.backgroundStory?.trim() || "—"}</span>
          </div>
        </div>

        <div className={styles.section}>
          <h4>בדיקות בטיחות לפני פרסום</h4>
          <ul className={styles.list}>
            {validationSummary.blockers.length === 0 ? (
              <li className={styles.card}>
                <strong>כל בדיקות החובה עברו.</strong>
                <p className={styles.mutedText}>אפשר לפרסם את המטלה לסטודנטים.</p>
              </li>
            ) : (
              validationSummary.blockers.map((issue) => (
                <li key={issue} className={styles.card}>
                  <strong>חסם פרסום</strong>
                  <p className={styles.mutedText}>{issue}</p>
                </li>
              ))
            )}
            {validationSummary.warnings.map((issue) => (
              <li key={issue} className={styles.card}>
                <strong>אזהרה</strong>
                <p className={styles.mutedText}>{issue}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.section}>
          <h4>כיסוי שאלות</h4>
          <p className={styles.mutedText}>ודאו שלכל שאלה יש ניסוח ברור, תיאור פלט צפוי, SQL התחלתי וקריטריוני רובריקה.</p>
          <ul className={styles.list}>
            {questions.map((question, index) => {
              const parameterized = (question.parameterMode ?? (question.parameters?.length ? "parameterized" : "static")) === "parameterized";
              const parameterCount = question.parameters?.length ?? 0;
              return (
                <li key={question.id} className={styles.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>שאלה {index + 1}</strong>
                  <span className={styles.badge}>
                    {parameterized ? `${parameterCount} פרמטרים` : `${question.rubric.length} פריטי רובריקה`}
                  </span>
                </div>
                <p className={styles.mutedText}>{question.prompt.slice(0, 160) || "לא סופק ניסוח משימה"}</p>
                <p className={styles.mutedText}>{question.expectedOutputDescription.slice(0, 160) || "לא סופק תיאור פלט צפוי"}</p>
                {question.instructions.trim() ? (
                  <p className={styles.mutedText}>{question.instructions.slice(0, 160)}</p>
                ) : null}
                <p className={styles.mutedText}>נקודות: {question.points} • ניסיונות מקסימליים: {question.maxAttempts}</p>
                <p className={styles.mutedText}>
                  מוכנות: {question.prompt.trim() ? "ניסוח" : "חסר ניסוח"} • {question.expectedOutputDescription.trim() ? "פלט צפוי" : "חסר פלט צפוי"} •
                  {" "}
                  {(validationSummary.questionSummaries.find((entry) => entry.id === question.id)?.hasValidParameters ?? true)
                    ? "פרמטרים תקינים"
                    : "הגדרות פרמטרים חסרות"}
                </p>
              </li>
              );
            })}
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
