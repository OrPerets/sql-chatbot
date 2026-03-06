"use client";

import { FileText } from "lucide-react";
import styles from "./runner.module.css";

interface QuestionPromptCardProps {
  questionNumber: number;
  prompt: string;
}

export function QuestionPromptCard({ questionNumber, prompt }: QuestionPromptCardProps) {
  return (
    <section className={styles.questionCard}>
      <div className={styles.questionCardHeader}>
        <span className={styles.questionCardBadge}>שאלה {questionNumber}</span>
        <span className={styles.questionCardIconWrap}>
          <FileText className={styles.questionCardIcon} />
        </span>
      </div>
      <h3 className={styles.questionCardTitle}>מה צריך לעשות?</h3>
      <p className={styles.questionCardBody}>{prompt}</p>
    </section>
  );
}
