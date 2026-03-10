"use client";

import { Target } from "lucide-react";
import styles from "./runner.module.css";

interface ExpectedOutputCardProps {
  description: string;
  isPlaceholder?: boolean;
}

export function ExpectedOutputCard({
  description,
  isPlaceholder = false,
}: ExpectedOutputCardProps) {
  return (
    <section className={`${styles.questionCard} ${isPlaceholder ? styles.questionCardPlaceholder : ""}`}>
      <div className={styles.questionCardHeader}>
        <span className={styles.questionCardBadge}>פלט מצופה</span>
        <span className={styles.questionCardIconWrap}>
          <Target className={styles.questionCardIcon} />
        </span>
      </div>
      <h3 className={styles.questionCardTitle}>מה אמור להתקבל?</h3>
      <p className={styles.questionCardBody}>{description}</p>
    </section>
  );
}
