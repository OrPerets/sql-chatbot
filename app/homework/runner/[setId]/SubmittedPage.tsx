"use client";

import { CheckCircle } from "lucide-react";
import { useHomeworkLocale } from "@/app/homework/context/HomeworkLocaleProvider";
import styles from "./submitted.module.css";

interface SubmittedPageProps {
  homeworkTitle?: string;
  submittedAt?: string;
  studentId?: string;
}

export function SubmittedPage(_: SubmittedPageProps) {
  const { direction } = useHomeworkLocale();

  return (
    <div className={styles.container} dir={direction}>
      <div className={styles.content}>
        <div className={styles.iconContainer}>
          <CheckCircle className={styles.successIcon} size={64} />
        </div>
        <h1 className={styles.title}>תרגיל הסתיים בהצלחה</h1>
      </div>
    </div>
  );
}
