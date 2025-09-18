"use client";

import Link from "next/link";
import styles from "./Wizard.module.css";
import type { DatasetDraft, MetadataDraft, QuestionDraft, WizardStepId } from "./types";

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
  return (
    <div className={styles.stepContainer}>
      <section className={styles.section}>
        <h3>Review configuration</h3>
        <p className={styles.mutedText}>Confirm metadata, dataset selection, question coverage, and grading readiness before publishing.</p>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label>Title</label>
            <span>{metadata.title}</span>
          </div>
          <div className={styles.field}>
            <label>Course</label>
            <span>{metadata.courseId || "—"}</span>
          </div>
          <div className={styles.field}>
            <label>Due date</label>
            <span>{metadata.dueAt ? new Date(metadata.dueAt).toLocaleString() : "—"}</span>
          </div>
          <div className={styles.field}>
            <label>Visibility</label>
            <span className={styles.badge}>{metadata.visibility}</span>
          </div>
        </div>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label>Dataset strategy</label>
            <span>{metadata.datasetPolicy === "shared" ? "Reuse shared course datasets" : "Custom dataset"}</span>
          </div>
          <div className={styles.field}>
            <label>Selected dataset</label>
            <span>{dataset.selectedDatasetId || dataset.newDatasetName || "Pending"}</span>
          </div>
          <div className={styles.field}>
            <label>Tags</label>
            <span>{dataset.tags.length > 0 ? dataset.tags.join(", ") : "—"}</span>
          </div>
        </div>

        <div className={styles.section}>
          <h4>Question coverage</h4>
          <p className={styles.mutedText}>Ensure each question has a prompt, instructions, starter SQL, expected results, and rubric criteria.</p>
          <ul className={styles.list}>
            {questions.map((question, index) => (
              <li key={question.id} className={styles.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>Question {index + 1}</strong>
                  <span className={styles.badge}>{question.rubric.length} rubric items</span>
                </div>
                <p className={styles.mutedText}>{question.prompt.slice(0, 160) || "No prompt provided"}</p>
                <p className={styles.mutedText}>Points: {question.points} • Max attempts: {question.maxAttempts}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className={styles.actions}>
        <button type="button" className={styles.secondaryButton} onClick={() => onBack(PREV_STEP)}>
          Back
        </button>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <span className={styles.mutedText}>
            {autoSaveState === "saving" && "Saving draft…"}
            {autoSaveState === "saved" && "Draft saved"}
            {autoSaveState === "error" && (
              <>
                Unable to save draft. <button type="button" className={styles.smallButton} onClick={onRefresh}>Retry</button>
              </>
            )}
          </span>
          {setId && (
            <Link href={`/homework/builder/${setId}/preview`} className={styles.secondaryButton}>
              Preview
            </Link>
          )}
          <button
            type="button"
            className={`${styles.primaryButton} ${publishDisabled ? styles.disabled : ""}`}
            disabled={publishDisabled}
            onClick={onPublish}
          >
            Publish homework
          </button>
        </div>
      </footer>
    </div>
  );
}
