"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Code2, FileText, ArrowRight } from "lucide-react";
import { useHomeworkDraft } from "@/app/homework/hooks/useHomeworkDraft";
import { useHomeworkLocale } from "@/app/homework/context/HomeworkLocaleProvider";
import styles from "./solution.module.css";

interface SolutionPageProps {
  params: { setId: string };
}

export default function SolutionHomeworkPage({ params }: SolutionPageProps) {
  const { draft, isLoading, error } = useHomeworkDraft(params.setId);
  const { t, direction } = useHomeworkLocale();

  if (isLoading) {
    return (
      <div className={styles.container} dir={direction}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner} />
          <p className={styles.loadingText}>טוען פתרונות...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container} dir={direction}>
        <div className={styles.errorContainer}>
          <h2 className={styles.errorTitle}>שגיאה בטעינה</h2>
          <p className={styles.errorMessage}>לא ניתן לטעון את הפתרונות. נסו שוב מאוחר יותר.</p>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className={styles.container} dir={direction}>
        <div className={styles.notFoundContainer}>
          <h2 className={styles.notFoundTitle}>מטלה לא נמצאה</h2>
          <p className={styles.notFoundMessage}>המטלה המבוקשת אינה קיימת או שאין לכם הרשאה לצפייה בה.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} dir={direction}>
      <header className={styles.header}>
        <h2 className={styles.title}>
          <Code2 size={24} />
          פתרון — {draft.metadata.title}
        </h2>
        <p className={styles.subtitle}>
          פתרונות SQL לכל השאלות במטלה. כל שאלה כוללת את השאילתה המלאה הנדרשת לפתרון.
        </p>
        
        <Link href={`/homework/builder/${params.setId}`} className={styles.backLink}>
          <ArrowRight size={18} />
          חזרה לעריכה
        </Link>
      </header>

      <section className={styles.questionsSection}>
        <h3 className={styles.sectionTitle}>
          <FileText size={20} />
          פתרונות SQL
          <span className={styles.questionCount}>
            {draft.questions.length} {draft.questions.length !== 1 ? "שאלות" : "שאלה"}
          </span>
        </h3>
        
        <ol className={styles.questionsList}>
          {draft.questions.map((question, index) => (
            <li key={question.id} className={styles.questionCard}>
              <div className={styles.questionHeader}>
                <div className={styles.questionNumber}>{index + 1}</div>
                <h4 className={styles.questionPrompt}>
                  {question.prompt || `שאלה ${index + 1}`}
                </h4>
              </div>
              
              {question.instructions && (
                <p className={styles.questionInstructions}>{question.instructions}</p>
              )}
              
              <div className={styles.solutionSection}>
                <div className={styles.solutionLabel}>
                  <Code2 size={16} />
                  <span>פתרון SQL:</span>
                </div>
                
                <pre className={styles.sqlBlock}>
                  {question.starterSql?.trim() ? (
                    question.starterSql
                  ) : (
                    <span className={styles.noSqlText}>
                      פתרון לא זמין - יש להוסיף פתרון SQL לשאלה זו
                    </span>
                  )}
                </pre>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

