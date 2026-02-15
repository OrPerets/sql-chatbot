"use client";

import Link from "next/link";
import { use, useMemo } from "react";
import { Eye, Play, FileText, Code2, BarChart3 } from "lucide-react";
import { useHomeworkDraft } from "@/app/homework/hooks/useHomeworkDraft";
import { useHomeworkLocale } from "@/app/homework/context/HomeworkLocaleProvider";
import styles from "./preview.module.css";

interface PreviewPageProps {
  params: Promise<{ setId: string }>;
}

export default function PreviewHomeworkPage({ params }: PreviewPageProps) {
  const { setId } = use(params);
  const { draft, isLoading, error } = useHomeworkDraft(setId);
  const { t, direction } = useHomeworkLocale();

  const stats = useMemo(() => {
    if (!draft?.questions) return null;
    
    const totalQuestions = draft.questions.length;
    const questionsWithSql = draft.questions.filter(q => q.starterSql?.trim()).length;
    const avgInstructionLength = Math.round(
      draft.questions.reduce((sum, q) => sum + (q.instructions?.length || 0), 0) / totalQuestions
    );

    return {
      totalQuestions,
      questionsWithSql,
      avgInstructionLength,
    };
  }, [draft?.questions]);

  if (isLoading) {
    return (
      <div className={styles.container} dir={direction}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner} />
          <p className={styles.loadingText}>{t("builder.preview.loading")}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container} dir={direction}>
        <div className={styles.errorContainer}>
          <h2 className={styles.errorTitle}>{t("builder.preview.error.title")}</h2>
          <p className={styles.errorMessage}>{t("builder.preview.error.message")}</p>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className={styles.container} dir={direction}>
        <div className={styles.notFoundContainer}>
          <h2 className={styles.notFoundTitle}>{t("builder.preview.notFound.title")}</h2>
          <p className={styles.notFoundMessage}>{t("builder.preview.notFound.message")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} dir={direction}>
      <header className={styles.header}>
        <h2 className={styles.title}>
          <Eye size={24} />
          {t("builder.preview.title")} — {draft.metadata.title}
        </h2>
        <p className={styles.subtitle}>{t("builder.preview.subtitle")}</p>
        
        {stats && (
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.totalQuestions}</div>
              <div className={styles.statLabel}>{t("builder.preview.stats.totalQuestions")}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.questionsWithSql}</div>
              <div className={styles.statLabel}>{t("builder.preview.stats.questionsWithSql")}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.avgInstructionLength}</div>
              <div className={styles.statLabel}>{t("builder.preview.stats.avgInstructionLength")}</div>
            </div>
          </div>
        )}

        <Link href={`/homework/runner/${setId}`} className={styles.runnerLink}>
          <Play size={18} />
          {t("builder.preview.openRunner")}
        </Link>
      </header>

      <section className={styles.questionsSection}>
        <h3 className={styles.sectionTitle}>
          <FileText size={20} />
          {t("builder.preview.questions.title")}
          <span className={styles.questionCount}>
            {draft.questions.length} {t("builder.preview.questions.count")}
            {draft.questions.length !== 1 ? "ות" : ""}
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
              
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <Code2 size={16} style={{ color: "#64748b" }} />
                <span style={{ color: "#64748b", fontSize: "0.9rem", fontWeight: "500" }}>
                  קוד SQL התחלתי:
                </span>
              </div>
              
              <pre className={styles.sqlBlock}>
                {question.starterSql?.trim() ? (
                  question.starterSql
                ) : (
                  <span className={styles.noSqlText}>
                    {t("builder.preview.questions.noSql")}
                  </span>
                )}
              </pre>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
