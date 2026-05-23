"use client";

import { useHomeworkLocale } from "@/app/homework/context/HomeworkLocaleProvider";
import type { HomeworkType } from "@/app/homework/types";
import styles from "./Wizard.module.css";
import type { MetadataDraft, WizardStepId } from "./types";

interface MetadataStepProps {
  value: MetadataDraft;
  onChange: (value: MetadataDraft) => void;
  onNext: (nextStep: WizardStepId) => void;
  isInitializing: boolean;
}

const NEXT_STEP: WizardStepId = "dataset";

export function MetadataStep({ value, onChange, onNext, isInitializing }: MetadataStepProps) {
  const hasTitle = Boolean(value.title.trim());
  const hasCourse = Boolean(value.courseId.trim());
  const hasAvailabilityWindow = Boolean(value.availableFrom) && Boolean(value.availableUntil);
  const hasValidWindow =
    hasAvailabilityWindow && new Date(value.availableFrom).getTime() < new Date(value.availableUntil).getTime();
  const canContinue = hasTitle && hasCourse && hasValidWindow;
  const { t } = useHomeworkLocale();

  return (
    <div className={styles.stepContainer}>
      <section className={styles.section}>
        <h3>{t("builder.metadata.heading")}</h3>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="title">{t("builder.metadata.titleLabel")}</label>
            <input
              id="title"
              value={value.title}
              onChange={(event) => onChange({ ...value, title: event.target.value })}
              placeholder={t("builder.metadata.titlePlaceholder")}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="course">{t("builder.metadata.courseLabel")}</label>
            <input
              id="course"
              value={value.courseId}
              onChange={(event) => onChange({ ...value, courseId: event.target.value })}
              placeholder={t("builder.metadata.coursePlaceholder")}
            />
          </div>
        </div>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="homeworkType">סוג מטלה</label>
            <select
              id="homeworkType"
              value={value.homeworkType ?? "sql"}
              onChange={(event) => onChange({ ...value, homeworkType: event.target.value as HomeworkType })}
            >
              <option value="sql">SQL</option>
              <option value="relational_algebra">אלגברת יחסים</option>
            </select>
          </div>
        </div>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="availableFrom">זמן פתיחה</label>
            <input
              id="availableFrom"
              type="datetime-local"
              value={value.availableFrom}
              onChange={(event) => onChange({ ...value, availableFrom: event.target.value })}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="availableUntil">זמן סגירה</label>
            <input
              id="availableUntil"
              type="datetime-local"
              value={value.availableUntil}
              onChange={(event) => onChange({ ...value, availableUntil: event.target.value })}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="visibility">{t("builder.metadata.visibility")}</label>
            <select
              id="visibility"
              value={value.visibility}
              onChange={(event) => onChange({ ...value, visibility: event.target.value as MetadataDraft["visibility"] })}
            >
              <option value="draft">{t("builder.dashboard.filter.draft")}</option>
              <option value="published">{t("builder.dashboard.filter.published")}</option>
              <option value="archived">{t("builder.dashboard.filter.archived")}</option>
            </select>
          </div>
        </div>
        {hasAvailabilityWindow && !hasValidWindow && (
          <p className={styles.validationMessage}>זמן הפתיחה חייב להיות לפני זמן הסגירה כדי להמשיך.</p>
        )}
        <div className={styles.field}>
          <label htmlFor="overview">{t("builder.metadata.overviewLabel")}</label>
          <textarea
            id="overview"
            value={value.overview ?? ""}
            onChange={(event) => onChange({ ...value, overview: event.target.value })}
            placeholder={t("builder.metadata.overviewPlaceholder")}
            rows={4}
            className={styles.textarea}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="dataStructureNotes">הסבר מבנה הנתונים</label>
          <textarea
            id="dataStructureNotes"
            value={value.dataStructureNotes ?? ""}
            onChange={(event) => onChange({ ...value, dataStructureNotes: event.target.value })}
            placeholder="תארו לסטודנטים את הטבלאות, היחסים ביניהן, והשדות שכדאי לשים לב אליהם. מידע זה יוצג מעל רשימת הטבלאות ב-runner."
            rows={4}
            className={styles.textarea}
          />
        </div>
        <section className={styles.previewPanel} aria-label="תצוגה מקדימה לסטודנט">
          <div className={styles.previewColumn}>
            <span className={styles.badge}>פתיח לסטודנט</span>
            <h4>{value.title || "מטלה ללא כותרת"}</h4>
            <p className={styles.mutedText}>
              {value.overview?.trim() || "כאן יופיע התיאור הכללי של המטלה והתרחיש שהסטודנטים יקראו בתחילת העבודה."}
            </p>
          </div>
          <div className={styles.previewColumn}>
            <span className={styles.badge}>פאנל מבנה הנתונים</span>
            <h4>מבנה הנתונים</h4>
            <p className={styles.mutedText}>
              {value.dataStructureNotes?.trim() || "כאן יופיע הסבר נפרד על מבנה הנתונים מעל רשימת הטבלאות ב-runner."}
            </p>
          </div>
        </section>
      </section>


      <div className={styles.actions}>
        <span />
        <button
          type="button"
          className={`${styles.primaryButton} ${!canContinue || isInitializing ? styles.disabled : ""}`}
          disabled={!canContinue || isInitializing}
          onClick={() => onNext(NEXT_STEP)}
        >
          {isInitializing ? t("builder.metadata.button.loading") : t("builder.metadata.button.next")}
        </button>
      </div>
    </div>
  );
}
