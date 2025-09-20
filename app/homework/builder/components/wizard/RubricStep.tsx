"use client";

import styles from "./Wizard.module.css";
import { useHomeworkLocale } from "@/app/homework/context/HomeworkLocaleProvider";
import type { QuestionDraft, WizardStepId } from "./types";
import { generateTempId } from "@/app/homework/utils/id";

interface RubricStepProps {
  questions: QuestionDraft[];
  onChange: (questions: QuestionDraft[]) => void;
  onBack: (step: WizardStepId) => void;
  onNext: (step: WizardStepId) => void;
}

const NEXT_STEP: WizardStepId = "publish";
const PREV_STEP: WizardStepId = "questions";

export function RubricStep({ questions, onChange, onBack, onNext }: RubricStepProps) {
  const { t } = useHomeworkLocale();
  const weightsValid = questions.every((question) => {
    const total = question.rubric.reduce((sum, criterion) => sum + (Number.isFinite(criterion.weight) ? criterion.weight : 0), 0);
    return question.rubric.length > 0 && Math.abs(total - 100) <= 1;
  });

  const handleCriterionChange = (questionId: string, criterionId: string, field: "label" | "description" | "weight" | "autoGraded", value: string | number | boolean) => {
    onChange(
      questions.map((question) => {
        if (question.id !== questionId) return question;
        return {
          ...question,
          rubric: question.rubric.map((criterion) =>
            criterion.id === criterionId
              ? {
                  ...criterion,
                  [field]: field === "weight" ? Number(value) : value,
                }
              : criterion,
          ),
        };
      }),
    );
  };

  const handleAddCriterion = (questionId: string) => {
    onChange(
      questions.map((question) => {
        if (question.id !== questionId) return question;
        return {
          ...question,
          rubric: [
            ...question.rubric,
            {
              id: generateTempId("criterion"),
              label: t("builder.rubric.newCriterion"),
              description: "",
              weight: 0,
              autoGraded: false,
            },
          ],
        };
      }),
    );
  };

  const handleRemoveCriterion = (questionId: string, criterionId: string) => {
    onChange(
      questions.map((question) => {
        if (question.id !== questionId) return question;
        if (question.rubric.length === 1) return question;
        return {
          ...question,
          rubric: question.rubric.filter((criterion) => criterion.id !== criterionId),
        };
      }),
    );
  };

  const handleApplyToAll = (sourceId: string) => {
    const source = questions.find((question) => question.id === sourceId);
    if (!source) return;
    onChange(
      questions.map((question) =>
        question.id === sourceId
          ? question
          : {
              ...question,
              rubric: source.rubric.map((criterion) => ({
                ...criterion,
                id: generateTempId("criterion"),
              })),
            },
      ),
    );
  };

  return (
    <div className={styles.stepContainer}>
      <section className={styles.section}>
        <header>
          <h3>Configure grading rubric</h3>
          <p className={styles.mutedText}>Ensure each question&rsquo;s rubric weights sum to 100%. Auto-graded criteria run immediately after students submit.</p>
        </header>

        <div className={styles.list}>
          {questions.map((question, index) => {
            const totalWeight = question.rubric.reduce((sum, criterion) => sum + criterion.weight, 0);
            return (
              <article key={question.id} className={styles.card}>
                <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h4>{t("builder.rubric.question")} {index + 1}</h4>
                    <p className={styles.mutedText}>{question.prompt.slice(0, 120) || t("builder.rubric.untitledPrompt")}</p>
                  </div>
                  <button type="button" className={styles.smallButton} onClick={() => handleApplyToAll(question.id)}>
                    {t("builder.rubric.applyToAll")}
                  </button>
                </header>

                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Criterion</th>
                      <th>Description</th>
                      <th style={{ width: "100px" }}>Weight</th>
                      <th style={{ width: "110px" }}>Auto-graded</th>
                      <th style={{ width: "80px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {question.rubric.map((criterion) => (
                      <tr key={criterion.id}>
                        <td>
                          <input
                            value={criterion.label}
                            onChange={(event) => handleCriterionChange(question.id, criterion.id, "label", event.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            value={criterion.description}
                            onChange={(event) => handleCriterionChange(question.id, criterion.id, "description", event.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={criterion.weight}
                            onChange={(event) => handleCriterionChange(question.id, criterion.id, "weight", Number(event.target.value))}
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={criterion.autoGraded}
                            onChange={(event) => handleCriterionChange(question.id, criterion.id, "autoGraded", event.target.checked)}
                          />
                        </td>
                        <td>
                          {question.rubric.length > 1 && (
                            <button type="button" className={styles.smallButton} onClick={() => handleRemoveCriterion(question.id, criterion.id)}>
                              Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className={styles.mutedText}>Total weight: {totalWeight}%</span>
                  <button type="button" className={styles.smallButton} onClick={() => handleAddCriterion(question.id)}>
                    Add criterion
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className={styles.actions}>
        <button type="button" className={styles.secondaryButton} onClick={() => onBack(PREV_STEP)}>
          Back
        </button>
        <button
          type="button"
          className={`${styles.primaryButton} ${!weightsValid ? styles.disabled : ""}`}
          disabled={!weightsValid}
          onClick={() => onNext(NEXT_STEP)}
        >
          Review &amp; publish
        </button>
      </div>
    </div>
  );
}
