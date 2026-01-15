"use client";

import { CheckCircle, Mail, Lock } from "lucide-react";
import Link from "next/link";
import { useHomeworkLocale } from "@/app/homework/context/HomeworkLocaleProvider";
import styles from "./submitted.module.css";

interface SubmittedPageProps {
  homeworkTitle?: string;
  submittedAt?: string;
  studentId?: string;
}

export function SubmittedPage({ homeworkTitle, submittedAt, studentId }: SubmittedPageProps) {
  const { t, direction, formatDateTime } = useHomeworkLocale();

  return (
    <div className={styles.container} dir={direction}>
      <div className={styles.content}>
        <div className={styles.iconContainer}>
          <CheckCircle className={styles.successIcon} size={64} />
        </div>
        
        <h1 className={styles.title}>הגשתך בוצעה בהצלחה!</h1>
        
        <div className={styles.messageBox}>
          <p className={styles.message}>
            {homeworkTitle ? (
              <>שיעורי הבית <strong>{homeworkTitle}</strong> הוגשו בהצלחה.</>
            ) : (
              <>שיעורי הבית הוגשו בהצלחה.</>
            )}
          </p>
          
          <div className={styles.infoBox}>
            <div className={styles.infoItem}>
              <Mail className={styles.infoIcon} size={20} />
              <span>אימייל אישור נשלח לכתובת הדוא&quot;ל שלך</span>
            </div>
            
            <div className={styles.infoItem}>
              <Lock className={styles.infoIcon} size={20} />
              <span>ההגשה ננעלה ואינה ניתנת לעריכה נוספת</span>
            </div>
            
            {submittedAt && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>תאריך הגשה:</span>
                <span>{formatDateTime(submittedAt)}</span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.actions}>
          <Link href="/homework" className={styles.backButton}>
            ← חזרה לדף הבית
          </Link>
        </div>
      </div>
    </div>
  );
}

