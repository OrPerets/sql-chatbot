"use client";

import { Lightbulb } from "lucide-react";
import styles from "./runner.module.css";

interface QuestionTipsCardProps {
  instructions: string;
}

export function QuestionTipsCard({ instructions }: QuestionTipsCardProps) {
  return (
    <section className={styles.questionCard}>
      <div className={styles.questionCardHeader}>
        <span className={styles.questionCardBadge}>הנחיות משלימות</span>
        <span className={styles.questionCardIconWrap}>
          <Lightbulb className={styles.questionCardIcon} />
        </span>
      </div>
      <h3 className={styles.questionCardTitle}>טיפים ודגשים</h3>
      <p className={styles.questionCardBody}>{instructions}</p>
    </section>
  );
}
