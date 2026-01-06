"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Code2, FileText, ArrowRight, Sparkles } from "lucide-react";
import { useHomeworkDraft } from "@/app/homework/hooks/useHomeworkDraft";
import { useHomeworkLocale } from "@/app/homework/context/HomeworkLocaleProvider";
import styles from "./solution.module.css";

interface SolutionPageProps {
  params: { setId: string };
}

interface AIGenerateSolutionsResponse {
  success: boolean;
  results: Array<{
    questionId: string;
    sql: string;
    explanation?: string;
    saved: boolean;
  }>;
  totalGenerated: number;
  totalSaved: number;
  errors?: string[];
}

export default function SolutionHomeworkPage({ params }: SolutionPageProps) {
  const { draft, isLoading, error } = useHomeworkDraft(params.setId);
  const { t, direction } = useHomeworkLocale();
  const queryClient = useQueryClient();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [aiGenerationProgress, setAIGenerationProgress] = useState<{ current: number; total: number } | null>(null);

  // AI Solution Generation mutation
  const aiGenerateMutation = useMutation({
    mutationFn: async (overwrite: boolean = false) => {
      setIsAIGenerating(true);
      setAIGenerationProgress({ current: 0, total: 0 });
      
      const response = await fetch(`/api/homework/${params.setId}/ai-generate-solutions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overwrite }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate solutions");
      }
      
      return response.json() as Promise<AIGenerateSolutionsResponse>;
    },
    onSuccess: (data) => {
      if (!data.success || data.results.length === 0) {
        setStatusMessage("אין שאלות ליצירת פתרונות או שכולן כבר כוללות פתרונות");
        return;
      }

      // Refresh the draft to show new solutions
      queryClient.invalidateQueries({ queryKey: ["homework", params.setId] });
      queryClient.invalidateQueries({ queryKey: ["homework", params.setId, "questions"] });

      const successCount = data.totalSaved;
      const totalCount = data.totalGenerated;
      
      if (successCount === totalCount) {
        setStatusMessage(`✨ יצירת פתרונות AI הושלמה: ${successCount} פתרונות נוצרו ונשמרו בהצלחה`);
      } else {
        setStatusMessage(`⚠️ יצירת פתרונות AI הושלמה חלקית: ${successCount}/${totalCount} פתרונות נשמרו`);
      }
    },
    onError: (error: Error) => {
      setStatusMessage(`שגיאה ביצירת פתרונות AI: ${error.message}`);
    },
    onSettled: () => {
      setIsAIGenerating(false);
      setAIGenerationProgress(null);
    },
  });

  const questionsWithoutSolutions = draft?.questions.filter((q) => !q.starterSql?.trim()).length ?? 0;
  const hasQuestions = (draft?.questions.length ?? 0) > 0;

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
        
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.aiGenerateButton}
            onClick={() => aiGenerateMutation.mutate(false)}
            disabled={isAIGenerating || !hasQuestions}
            title="יצירת פתרונות אוטומטית באמצעות AI"
          >
            {isAIGenerating ? (
              <>
                <span className={styles.aiSpinner} />
                {aiGenerationProgress ? (
                  `יוצר... (${aiGenerationProgress.current}/${aiGenerationProgress.total})`
                ) : (
                  "יוצר..."
                )}
              </>
            ) : (
              <>
                <Sparkles size={18} />
                {questionsWithoutSolutions > 0
                  ? `✨ צור פתרונות AI (${questionsWithoutSolutions} שאלות)`
                  : "✨ צור פתרונות AI"}
              </>
            )}
          </button>
          
          {draft.questions.some((q) => q.starterSql?.trim()) && (
            <button
              type="button"
              className={styles.aiRegenerateButton}
              onClick={() => aiGenerateMutation.mutate(true)}
              disabled={isAIGenerating || !hasQuestions}
              title="יצירת פתרונות מחדש לכל השאלות (דורס פתרונות קיימים)"
            >
              {isAIGenerating ? (
                <>
                  <span className={styles.aiSpinner} />
                  יוצר מחדש...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  🔄 צור מחדש כל הפתרונות
                </>
              )}
            </button>
          )}
          
          <Link href={`/homework/builder/${params.setId}`} className={styles.backLink}>
            <ArrowRight size={18} />
            חזרה לעריכה
          </Link>
        </div>
        
        {statusMessage && (
          <div className={styles.statusMessage}>
            {statusMessage}
          </div>
        )}
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

