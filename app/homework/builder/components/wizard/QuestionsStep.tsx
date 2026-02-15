"use client";

import { useState, useEffect } from "react";
import styles from "./Wizard.module.css";
import { createQuestionDraft } from "./defaults";
import type { QuestionDraft, WizardStepId } from "./types";
import { useHomeworkLocale } from "@/app/homework/context/HomeworkLocaleProvider";
import type { QuestionTemplate } from "@/app/homework/types";

interface QuestionsStepProps {
  questions: QuestionDraft[];
  onChange: (questions: QuestionDraft[]) => void;
  onBack: (step: WizardStepId) => void;
  onNext: (step: WizardStepId) => void;
  primaryDatasetId?: string;
}

const NEXT_STEP: WizardStepId = "rubric";
const PREV_STEP: WizardStepId = "dataset";
const MAX_QUESTIONS = 25; // Increased to support homework sets with more questions (e.g., תרגיל 3 with 13 questions)

export function QuestionsStep({ questions, onChange, onBack, onNext, primaryDatasetId }: QuestionsStepProps) {
  const { t } = useHomeworkLocale();
  const [templates, setTemplates] = useState<QuestionTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const canContinue =
    questions.length > 0 &&
    questions.length <= MAX_QUESTIONS &&
    questions.every((question) => {
      if (question.isParametric) {
        return question.templateId && question.templateId.trim().length > 0;
      } else {
        return question.prompt.trim().length > 0 && question.instructions.trim().length > 0;
      }
    });

  // Load templates when component mounts
  useEffect(() => {
    const loadTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const response = await fetch('/api/templates');
        const data = await response.json();
        if (data.success) {
          setTemplates(data.data);
        }
      } catch (error) {
        console.error('Failed to load templates:', error);
      } finally {
        setLoadingTemplates(false);
      }
    };

    loadTemplates();
  }, []);

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
                <label>
                  <input
                    type="checkbox"
                    checked={question.isParametric || false}
                    onChange={(event) => handleQuestionChange(question.id, { 
                      isParametric: event.target.checked,
                      templateId: event.target.checked ? question.templateId : undefined
                    })}
                  />
                  {' '}שאלה פרמטרית (תבנית)
                </label>
              </div>

              {question.isParametric ? (
                <div className={styles.field}>
                  <label htmlFor={`template-${question.id}`}>בחר תבנית:</label>
                  <select
                    id={`template-${question.id}`}
                    value={question.templateId || ''}
                    onChange={(event) => handleQuestionChange(question.id, { templateId: event.target.value })}
                    disabled={loadingTemplates}
                  >
                    <option value="">בחר תבנית...</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} ({template.variables.length} משתנים)
                      </option>
                    ))}
                  </select>
                  {loadingTemplates && <p>טוען תבניות...</p>}
                  <div style={{ marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => window.open('/admin/templates/new', '_blank')}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      צור תבנית חדשה
                    </button>
                  </div>
                  {question.templateId && (
                    <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                      <strong>תבנית נבחרת:</strong>
                      <p style={{ margin: '4px 0', fontSize: '14px' }}>
                        {templates.find(t => t.id === question.templateId)?.description || 'אין תיאור'}
                      </p>
                      <p style={{ margin: '4px 0', fontSize: '12px', color: '#666' }}>
                        משתנים: {templates.find(t => t.id === question.templateId)?.variables.map(v => v.name).join(', ') || 'אין משתנים'}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className={styles.field}>
                    <label htmlFor={`prompt-${question.id}`}>{t("builder.questions.prompt")}</label>
                    <textarea
                      id={`prompt-${question.id}`}
                      value={question.prompt}
                      onChange={(event) => handleQuestionChange(question.id, { prompt: event.target.value })}
                      placeholder={t("builder.questions.promptPlaceholder")}
                      rows={3}
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor={`instructions-${question.id}`}>{t("builder.questions.instructions")}</label>
                    <textarea
                      id={`instructions-${question.id}`}
                      value={question.instructions}
                      onChange={(event) => handleQuestionChange(question.id, { instructions: event.target.value })}
                      placeholder={t("builder.questions.instructionsPlaceholder")}
                    />
                  </div>
                </>
              )}

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
