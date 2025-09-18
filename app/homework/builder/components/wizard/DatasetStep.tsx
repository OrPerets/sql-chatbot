"use client";

import { useMemo, useState } from "react";
import { useDatasets } from "@/app/homework/hooks/useDatasets";
import { useHomeworkLocale } from "@/app/homework/context/HomeworkLocaleProvider";
import styles from "./Wizard.module.css";
import type { DatasetDraft, WizardStepId } from "./types";

interface DatasetStepProps {
  value: DatasetDraft;
  onChange: (value: DatasetDraft) => void;
  onBack: (step: WizardStepId) => void;
  onNext: (step: WizardStepId) => void;
  allowCustomDatasets: boolean;
}

const NEXT_STEP: WizardStepId = "questions";
const PREV_STEP: WizardStepId = "metadata";

export function DatasetStep({ value, onChange, onBack, onNext, allowCustomDatasets }: DatasetStepProps) {
  const { data, isLoading, error } = useDatasets();
  const [tagInput, setTagInput] = useState("");
  const { t } = useHomeworkLocale();

  const canContinue =
    (value.mode === "reuse" && !!value.selectedDatasetId) ||
    (value.mode === "create" && value.newDatasetName.trim().length > 0);

  const datasets = useMemo(() => data?.items ?? [], [data]);

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    if (value.tags.includes(trimmed)) return;
    onChange({ ...value, tags: [...value.tags, trimmed] });
    setTagInput("");
  };

  return (
    <div className={styles.stepContainer}>
      <section className={styles.section}>
        <h3>{t("builder.dataset.heading")}</h3>
        <p className={styles.mutedText}>{t("builder.dataset.description")}</p>

        <div className={styles.fieldRow}>
          <label className={styles.field}>
            <input
              type="radio"
              name="dataset-mode"
              checked={value.mode === "reuse"}
              onChange={() => onChange({ ...value, mode: "reuse" })}
            />
            {t("builder.dataset.mode.reuse")}
          </label>
          <label className={`${styles.field} ${!allowCustomDatasets ? styles.disabled : ""}`}>
            <input
              type="radio"
              name="dataset-mode"
              checked={value.mode === "create"}
              onChange={() => allowCustomDatasets && onChange({ ...value, mode: "create" })}
              disabled={!allowCustomDatasets}
            />
            {t("builder.dataset.mode.create")}
          </label>
        </div>

        {value.mode === "reuse" && (
          <div className={styles.list}>
            {isLoading && <p>{t("builder.dataset.loading")}</p>}
            {error && <p className={styles.mutedText}>{t("builder.dataset.error")}</p>}
            {datasets.map((dataset) => (
              <label key={dataset.id} className={styles.card}>
                <input
                  type="radio"
                  name="dataset"
                  checked={value.selectedDatasetId === dataset.id}
                  onChange={() => onChange({ ...value, selectedDatasetId: dataset.id })}
                />
                <div>
                  <strong>{dataset.name}</strong>
                  <p className={styles.mutedText}>{dataset.description ?? t("builder.dataset.noDescription")}</p>
                </div>
                <div className={styles.tagInputWrapper}>
                  {dataset.previewTables.slice(0, 3).map((table) => (
                    <span key={table.name} className={styles.tag}>
                      {table.name}
                    </span>
                  ))}
                </div>
              </label>
            ))}
            {!isLoading && datasets.length === 0 && (
              <div className={styles.card}>
                <p className={styles.mutedText}>{t("builder.dataset.none")}</p>
              </div>
            )}
          </div>
        )}

        {value.mode === "create" && (
          <div className={styles.section}>
            <div className={styles.field}>
              <label htmlFor="dataset-name">{t("builder.dataset.create.nameLabel")}</label>
              <input
                id="dataset-name"
                value={value.newDatasetName}
                onChange={(event) => onChange({ ...value, newDatasetName: event.target.value })}
                placeholder={t("builder.dataset.create.namePlaceholder")}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="dataset-description">{t("builder.dataset.create.descriptionLabel")}</label>
              <textarea
                id="dataset-description"
                value={value.newDatasetDescription ?? ""}
                onChange={(event) => onChange({ ...value, newDatasetDescription: event.target.value })}
                placeholder={t("builder.dataset.create.descriptionPlaceholder")}
              />
            </div>
            <div className={styles.field}>
              <label>{t("builder.dataset.create.tagsLabel")}</label>
              <div className={styles.tagInputWrapper}>
                {value.tags.map((tag) => (
                  <span key={tag} className={styles.tag}>
                    {tag}
                  </span>
                ))}
              </div>
              <div className={styles.fieldRow}>
                <input
                  placeholder={t("builder.dataset.create.tagsPlaceholder")}
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                />
                <button type="button" className={styles.smallButton} onClick={handleAddTag}>
                  {t("builder.dataset.create.addTag")}
                </button>
              </div>
              <p className={styles.mutedText}>{t("builder.dataset.create.note")}</p>
            </div>
          </div>
        )}
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
