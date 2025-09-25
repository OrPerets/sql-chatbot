"use client";

import styles from "./Wizard.module.css";
import { createQuestionDraft } from "./defaults";
import type { QuestionDraft, WizardStepId } from "./types";
import { useHomeworkLocale } from "@/app/homework/context/HomeworkLocaleProvider";

interface QuestionsStepProps {
  questions: QuestionDraft[];
  onChange: (questions: QuestionDraft[]) => void;
  onBack: (step: WizardStepId) => void;
  onNext: (step: WizardStepId) => void;
  primaryDatasetId?: string;
}

const NEXT_STEP: WizardStepId = "rubric";
const PREV_STEP: WizardStepId = "dataset";
const MAX_QUESTIONS = 10;

export function QuestionsStep({ questions, onChange, onBack, onNext, primaryDatasetId }: QuestionsStepProps) {
  const { t } = useHomeworkLocale();
  const canContinue =
    questions.length > 0 &&
    questions.length <= MAX_QUESTIONS &&
    questions.every((question) => question.instructions.trim().length > 0);

  const handleQuestionChange = (id: string, partial: Partial<QuestionDraft>) => {
    onChange(questions.map((question) => (question.id === id ? { ...question, ...partial } : question)));
  };

  const handleRemove = (id: string) => {
    if (questions.length === 1) return;
    onChange(questions.filter((question) => question.id !== id));
  };

  const handleAdd = () => {
    if (questions.length >= MAX_QUESTIONS) return;
    onChange([...questions, createQuestionDraft({ datasetId: primaryDatasetId })]);
  };

  return (
    <div className={styles.stepContainer}>
      <section className={styles.section}>
        <header>
          <h3>{t("builder.questions.title")}</h3>
          <p className={styles.mutedText}>{t("builder.questions.subtitle")}</p>
        </header>

        <div className={styles.list}>
          {questions.map((question, index) => (
            <article key={question.id} className={styles.card}>
              <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4>{t("builder.questions.question")} {index + 1}</h4>
                <div style={{ display: "flex", gap: "8px" }}>
                  {questions.length > 1 && (
                    <button type="button" className={styles.smallButton} onClick={() => handleRemove(question.id)}>
                      {t("builder.common.remove")}
                    </button>
                  )}
                </div>
              </header>

              <div className={styles.field}>
                <label htmlFor={`instructions-${question.id}`}>{t("builder.questions.instructions")}</label>
                <textarea
                  id={`instructions-${question.id}`}
                  value={question.instructions}
                  onChange={(event) => handleQuestionChange(question.id, { instructions: event.target.value })}
                  placeholder={t("builder.questions.instructionsPlaceholder")}
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label htmlFor={`starter-${question.id}`}>{t("builder.questions.starterSql")}</label>
                  <textarea
                    id={`starter-${question.id}`}
                    value={question.starterSql}
                    onChange={(event) => handleQuestionChange(question.id, { starterSql: event.target.value })}
                    placeholder={t("builder.questions.starterSqlPlaceholder")}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor={`schema-${question.id}`}>{t("builder.questions.expectedSchema")}</label>
                  <textarea
                    id={`schema-${question.id}`}
                    className={styles.schemaTextarea}
                    value={question.expectedResultSchema}
                    onChange={(event) => handleQuestionChange(question.id, { expectedResultSchema: event.target.value })}
                    placeholder={t("builder.questions.expectedSchemaPlaceholder")}
                  />
                </div>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label htmlFor={`points-${question.id}`}>{t("builder.questions.points")}</label>
                  <input
                    id={`points-${question.id}`}
                    type="number"
                    min={0}
                    value={question.points}
                    onChange={(event) => handleQuestionChange(question.id, { points: Number(event.target.value) })}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor={`attempts-${question.id}`}>{t("builder.questions.maxAttempts")}</label>
                  <input
                    id={`attempts-${question.id}`}
                    type="number"
                    min={1}
                    value={question.maxAttempts}
                    onChange={(event) => handleQuestionChange(question.id, { maxAttempts: Number(event.target.value) })}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor={`dataset-${question.id}`}>{t("builder.questions.datasetOverride")}</label>
                  <input
                    id={`dataset-${question.id}`}
                    value={question.datasetId ?? ""}
                    onChange={(event) => handleQuestionChange(question.id, { datasetId: event.target.value || undefined })}
                    placeholder={primaryDatasetId ? t("builder.questions.defaultDataset", { id: primaryDatasetId }) : t("builder.questions.useDefaultDataset")}
                  />
                  <p className={styles.mutedText}>
                    {t("builder.questions.datasetHint")}
                  </p>
                </div>
              </div>

              <div className={styles.field}>
                <label htmlFor={`evaluation-${question.id}`}>{t("builder.questions.evaluationMode")}</label>
                <select
                  id={`evaluation-${question.id}`}
                  value={question.evaluationMode}
                  onChange={(event) => handleQuestionChange(question.id, { evaluationMode: event.target.value as QuestionDraft["evaluationMode"] })}
                >
                  <option value="auto">{t("builder.questions.eval.auto")}</option>
                  <option value="manual">{t("builder.questions.eval.manual")}</option>
                  <option value="custom">{t("builder.questions.eval.custom")}</option>
                </select>
                {question.evaluationMode === "custom" && (
                  <p className={styles.mutedText}>{t("builder.questions.eval.customNote")}</p>
                )}
              </div>
            </article>
          ))}
        </div>

        <button
          type="button"
          className={`${styles.smallButton} ${questions.length >= MAX_QUESTIONS ? styles.disabled : ""}`}
          onClick={handleAdd}
          disabled={questions.length >= MAX_QUESTIONS}
        >
          {t("builder.questions.addQuestion", { count: `${questions.length}/${MAX_QUESTIONS}` })}
        </button>
      </section>

      <div className={styles.actions}>
        <button type="button" className={styles.secondaryButton} onClick={() => onBack(PREV_STEP)}>{t("builder.dataset.actions.back")}</button>
        <button
          type="button"
          className={`${styles.primaryButton} ${!canContinue ? styles.disabled : ""}`}
          disabled={!canContinue}
          onClick={() => onNext(NEXT_STEP)}
        >
          {t("builder.questions.continueToRubric")}
        </button>
      </div>
    </div>
  );
}
