"use client";

import { useMemo } from "react";
import { useDatasets } from "@/app/homework/hooks/useDatasets";
import { useHomeworkLocale } from "@/app/homework/context/HomeworkLocaleProvider";
import styles from "./Wizard.module.css";
import type { DatasetDraft, WizardStepId } from "./types";

interface DatasetStepProps {
  value: DatasetDraft;
  onChange: (value: DatasetDraft) => void;
  onBack: (step: WizardStepId) => void;
  onNext: (step: WizardStepId) => void;
}

const NEXT_STEP: WizardStepId = "questions";
const PREV_STEP: WizardStepId = "metadata";

export function DatasetStep({ value, onChange, onBack, onNext }: DatasetStepProps) {
  const { data, isLoading, error } = useDatasets();
  const { t } = useHomeworkLocale();

  const canContinue = !!value.selectedDatasetId;
  const datasets = useMemo(() => data?.items ?? [], [data]);

  return (
    <div className={styles.stepContainer}>
      <section className={styles.section}>
        <h3>{t("builder.dataset.heading")}</h3>
        <p className={styles.mutedText}>בחרו מאגר נתונים קיים לשימוש במטלה זו</p>

        <div className={styles.field}>
          <label htmlFor="dataset-select">מאגר נתונים</label>
          <select
            id="dataset-select"
            value={value.selectedDatasetId || ""}
            onChange={(e) => onChange({ ...value, selectedDatasetId: e.target.value || undefined })}
            className={styles.select}
          >
            <option value="">-- בחרו מאגר נתונים --</option>
            {datasets.map((dataset) => (
              <option key={dataset.id} value={dataset.id}>
                {dataset.name} - {dataset.description || t("builder.dataset.noDescription")}
              </option>
            ))}
          </select>
        </div>

        {isLoading && <p className={styles.mutedText}>{t("builder.dataset.loading")}</p>}
        {error && <p className={styles.mutedText}>{t("builder.dataset.error")}</p>}
        
        {!isLoading && datasets.length === 0 && (
          <div className={styles.emptyState}>
            <p className={styles.mutedText}>{t("builder.dataset.none")}</p>
            <p className={styles.mutedText}>
              לחץ על "יצירת מסד נתונים" בתפריט הניהול כדי ליצור מאגר נתונים חדש
            </p>
          </div>
        )}

        {value.selectedDatasetId && (
          <div className={styles.selectedDataset}>
            {(() => {
              const selectedDataset = datasets.find(d => d.id === value.selectedDatasetId);
              if (!selectedDataset) return null;
              
              return (
                <div className={styles.datasetPreview}>
                  <h4>מאגר נבחר: {selectedDataset.name}</h4>
                  <p className={styles.mutedText}>{selectedDataset.description || t("builder.dataset.noDescription")}</p>
                  {selectedDataset.previewTables.length > 0 && (
                    <div>
                      <strong>טבלאות זמינות:</strong>
                      <div className={styles.tagInputWrapper}>
                        {selectedDataset.previewTables.map((table) => (
                          <span key={table.name} className={styles.tag}>
                            {table.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        <div className={styles.field}>
          <label htmlFor="background-story">סיפור רקע</label>
          <textarea
            id="background-story"
            value={value.backgroundStory || ""}
            onChange={(e) => onChange({ ...value, backgroundStory: e.target.value })}
            placeholder="תארו את הסיפור הרקע של המאגר - מה הוא מייצג, איך הנתונים נאספו, וההקשר העסקי או האקדמי שלו"
            rows={4}
            className={styles.textarea}
          />
          <p className={styles.mutedText}>
            הסיפור הרקע יסייע לסטודנטים להבין את ההקשר של המאגר ויעזור להם לכתוב שאילתות רלוונטיות
          </p>
        </div>
      </section>

      <div className={styles.actions}>
        <button type="button" className={styles.secondaryButton} onClick={() => onBack(PREV_STEP)}>
          {t("builder.dataset.actions.back")}
        </button>
        <button
          type="button"
          className={`${styles.primaryButton} ${!canContinue ? styles.disabled : ""}`}
          disabled={!canContinue}
          onClick={() => onNext(NEXT_STEP)}
        >
          {t("builder.dataset.actions.next")}
        </button>
      </div>
    </div>
  );
}
