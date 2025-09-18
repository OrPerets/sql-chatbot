"use client";

import { useHomeworkLocale } from "@/app/homework/context/HomeworkLocaleProvider";
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
  const canContinue = Boolean(value.title.trim()) && Boolean(value.courseId.trim());
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
            <label htmlFor="dueAt">{t("builder.metadata.dueDate")}</label>
            <input
              id="dueAt"
              type="datetime-local"
              value={value.dueAt}
              onChange={(event) => onChange({ ...value, dueAt: event.target.value })}
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
      </section>

      <section className={styles.section}>
        <h3>{t("builder.metadata.dataset.heading")}</h3>
        <p className={styles.mutedText}>{t("builder.metadata.dataset.description")}</p>
        <div className={styles.fieldRow}>
          <label className={styles.field}>
            <input
              type="radio"
              name="datasetPolicy"
              checked={value.datasetPolicy === "shared"}
              onChange={() => onChange({ ...value, datasetPolicy: "shared" })}
            />
            {t("builder.metadata.dataset.shared")}
          </label>
          <label className={styles.field}>
            <input
              type="radio"
              name="datasetPolicy"
              checked={value.datasetPolicy === "custom"}
              onChange={() => onChange({ ...value, datasetPolicy: "custom" })}
            />
            {t("builder.metadata.dataset.custom")}
          </label>
        </div>
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
