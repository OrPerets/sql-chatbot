"use client";

import styles from "./Wizard.module.css";
import { createQuestionDraft } from "./defaults";
import type { QuestionDraft, WizardStepId } from "./types";

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
  const canContinue =
    questions.length > 0 &&
    questions.length <= MAX_QUESTIONS &&
    questions.every((question) => question.prompt.trim().length > 0 && question.instructions.trim().length > 0);

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
          <h3>Author questions</h3>
          <p className={styles.mutedText}>
            Provide clear prompts, starter SQL, and expected results for up to ten questions. Students will see these in the runner workspace.
          </p>
        </header>

        <div className={styles.list}>
          {questions.map((question, index) => (
            <article key={question.id} className={styles.card}>
              <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4>Question {index + 1}</h4>
                <div style={{ display: "flex", gap: "8px" }}>
                  {questions.length > 1 && (
                    <button type="button" className={styles.smallButton} onClick={() => handleRemove(question.id)}>
                      Remove
                    </button>
                  )}
                </div>
              </header>

              <div className={styles.field}>
                <label htmlFor={`prompt-${question.id}`}>Prompt</label>
                <textarea
                  id={`prompt-${question.id}`}
                  value={question.prompt}
                  onChange={(event) => handleQuestionChange(question.id, { prompt: event.target.value })}
                  placeholder="Explain the task for the student, referencing relevant tables."
                />
              </div>

              <div className={styles.field}>
                <label htmlFor={`instructions-${question.id}`}>Instructions</label>
                <textarea
                  id={`instructions-${question.id}`}
                  value={question.instructions}
                  onChange={(event) => handleQuestionChange(question.id, { instructions: event.target.value })}
                  placeholder="Highlight hints, call out expected functions, and mention grading expectations."
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label htmlFor={`starter-${question.id}`}>Starter SQL</label>
                  <textarea
                    id={`starter-${question.id}`}
                    value={question.starterSql}
                    onChange={(event) => handleQuestionChange(question.id, { starterSql: event.target.value })}
                    placeholder="SELECT ..."
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor={`schema-${question.id}`}>Expected Result Schema (JSON)</label>
                  <textarea
                    id={`schema-${question.id}`}
                    className={styles.schemaTextarea}
                    value={question.expectedResultSchema}
                    onChange={(event) => handleQuestionChange(question.id, { expectedResultSchema: event.target.value })}
                    placeholder='[
  { "column": "total_sales", "type": "number" }
]'
                  />
                </div>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label htmlFor={`points-${question.id}`}>Points</label>
                  <input
                    id={`points-${question.id}`}
                    type="number"
                    min={0}
                    value={question.points}
                    onChange={(event) => handleQuestionChange(question.id, { points: Number(event.target.value) })}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor={`attempts-${question.id}`}>Max attempts</label>
                  <input
                    id={`attempts-${question.id}`}
                    type="number"
                    min={1}
                    value={question.maxAttempts}
                    onChange={(event) => handleQuestionChange(question.id, { maxAttempts: Number(event.target.value) })}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor={`dataset-${question.id}`}>Dataset override (optional)</label>
                  <input
                    id={`dataset-${question.id}`}
                    value={question.datasetId ?? ""}
                    onChange={(event) => handleQuestionChange(question.id, { datasetId: event.target.value || undefined })}
                    placeholder={primaryDatasetId ? `Default: ${primaryDatasetId}` : "Use default dataset"}
                  />
                  <p className={styles.mutedText}>
                    Leave blank to reuse the homework dataset.
                  </p>
                </div>
              </div>

              <div className={styles.field}>
                <label htmlFor={`evaluation-${question.id}`}>Evaluation mode</label>
                <select
                  id={`evaluation-${question.id}`}
                  value={question.evaluationMode}
                  onChange={(event) => handleQuestionChange(question.id, { evaluationMode: event.target.value as QuestionDraft["evaluationMode"] })}
                >
                  <option value="auto">Auto-grade using result diff</option>
                  <option value="manual">Manual grading only</option>
                  <option value="custom">Custom assertion script</option>
                </select>
                {question.evaluationMode === "custom" && (
                  <p className={styles.mutedText}>Flagged for backend review before activation. Provide script in rubric step.</p>
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
          Add question ({questions.length}/{MAX_QUESTIONS})
        </button>
      </section>

      <div className={styles.actions}>
        <button type="button" className={styles.secondaryButton} onClick={() => onBack(PREV_STEP)}>
          Back
        </button>
        <button
          type="button"
          className={`${styles.primaryButton} ${!canContinue ? styles.disabled : ""}`}
          disabled={!canContinue}
          onClick={() => onNext(NEXT_STEP)}
        >
          Continue to rubric
        </button>
      </div>
    </div>
  );
}
