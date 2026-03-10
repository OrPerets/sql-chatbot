"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Send, Eye, AlertCircle, CheckCircle, Clock, ArrowLeft } from "lucide-react";
import { getHomeworkSet, getHomeworkQuestions, publishHomework } from "@/app/homework/services/homeworkService";
import { useHomeworkLocale } from "@/app/homework/context/HomeworkLocaleProvider";
import type { HomeworkSet, Question } from "@/app/homework/types";
import styles from "./publish.module.css";
import { validateHomeworkDraft } from "@/app/homework/builder/components/wizard/validation";
import { buildExpectedOutputDescription } from "@/app/homework/utils/question-output";

interface PublishHomeworkClientProps {
  setId: string;
}

export function PublishHomeworkClient({ setId }: PublishHomeworkClientProps) {
  const queryClient = useQueryClient();
  const { t, direction } = useHomeworkLocale();
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

  const homeworkQuery = useQuery({
    queryKey: ["homework", setId, "builder"],
    queryFn: () => getHomeworkSet(setId, "builder"),
  });

  const questionsQuery = useQuery({
    queryKey: ["homework", setId, "questions", "builder"],
    queryFn: () => getHomeworkQuestions(setId),
  });

  const publishMutation = useMutation({
    mutationFn: (published: boolean) => publishHomework(setId, published),
    onSuccess: (data: HomeworkSet) => {
      queryClient.invalidateQueries({ queryKey: ["homework", setId] });
      queryClient.invalidateQueries({ queryKey: ["homework", setId, "builder"] });
      queryClient.invalidateQueries({ queryKey: ["homework"] });
      setPublishMessage(
        data.published
          ? "שיעור הבית פורסם בהצלחה וזמין כעת לסטודנטים"
          : "שיעור הבית בוטל פרסום ואינו זמין עוד לסטודנטים"
      );
      setTimeout(() => setPublishMessage(null), 5000);
    },
    onError: (error) => {
      console.error("Failed to publish homework", error);
      setPublishMessage("שגיאה בפרסום שיעור הבית. נסה שוב מאוחר יותר.");
      setTimeout(() => setPublishMessage(null), 5000);
    },
  });

  const handlePublish = () => {
    const currentPublished = homeworkQuery.data?.published ?? false;
    publishMutation.mutate(!currentPublished);
  };

  if (homeworkQuery.isLoading || questionsQuery.isLoading) {
    return (
      <div className={styles.container} dir={direction}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner} />
          <p className={styles.loadingText}>טוען פרטי שיעור בית...</p>
        </div>
      </div>
    );
  }

  if (homeworkQuery.error || questionsQuery.error) {
    return (
      <div className={styles.container} dir={direction}>
        <div className={styles.errorContainer}>
          <AlertCircle size={32} />
          <h2 className={styles.errorTitle}>שגיאה בטעינת שיעור הבית</h2>
          <p className={styles.errorMessage}>לא ניתן לטעון את פרטי שיעור הבית. אנא נסה שוב מאוחר יותר.</p>
          <Link href="/homework/builder" className={styles.backButton}>
            <ArrowLeft size={16} />
            חזרה לרשימה
          </Link>
        </div>
      </div>
    );
  }

  const homework = homeworkQuery.data;
  const questions = questionsQuery.data ?? [];

  if (!homework) {
    return (
      <div className={styles.container} dir={direction}>
        <div className={styles.notFoundContainer}>
          <AlertCircle size={32} />
          <h2 className={styles.notFoundTitle}>שיעור בית לא נמצא</h2>
          <p className={styles.notFoundMessage}>שיעור הבית המבוקש לא נמצא במערכת.</p>
          <Link href="/homework/builder" className={styles.backButton}>
            <ArrowLeft size={16} />
            חזרה לרשימה
          </Link>
        </div>
      </div>
    );
  }

  const isPublished = homework.published;
  const validationSummary = validateHomeworkDraft({
    metadata: {
      title: homework.title,
      courseId: homework.courseId,
      availableFrom: homework.availableFrom || homework.createdAt,
      availableUntil: homework.availableUntil || homework.dueAt,
      visibility: homework.visibility,
      overview: homework.overview,
      dataStructureNotes: homework.dataStructureNotes,
      datasetPolicy: homework.datasetPolicy,
    },
    dataset: {
      selectedDatasetId: homework.selectedDatasetId,
      backgroundStory: homework.backgroundStory,
    },
    questions: questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      expectedOutputDescription: buildExpectedOutputDescription(
        question.expectedOutputDescription,
        question.expectedResultSchema,
      ),
      instructions: question.instructions,
      starterSql: question.starterSql ?? "",
      expectedResultSchema: JSON.stringify(question.expectedResultSchema ?? []),
      points: question.points,
      maxAttempts: question.maxAttempts,
      datasetId: question.datasetId,
      rubric: question.gradingRubric,
      evaluationMode: question.evaluationMode ?? "auto",
    })),
  });
  const canPublish = validationSummary.canPublish;

  return (
    <div className={styles.container} dir={direction}>
      <header className={styles.header}>
        <Link href="/homework/builder" className={styles.backLink}>
          <ArrowLeft size={16} />
          {t("builder.grade.back")}
        </Link>
        <div className={styles.titleSection}>
          <div className={styles.titleIcon}>
            <Send size={32} />
          </div>
          <div>
            <h2 className={styles.title}>פרסום שיעור בית</h2>
            <p className={styles.subtitle}>{homework.title}</p>
          </div>
        </div>
      </header>

      {publishMessage && (
        <div className={`${styles.message} ${publishMutation.isSuccess ? styles.messageSuccess : styles.messageError}`}>
          {publishMutation.isSuccess ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {publishMessage}
        </div>
      )}

      <div className={styles.content}>
        <section className={styles.infoSection}>
          <h3>פרטי שיעור הבית</h3>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label>כותרת</label>
              <span>{homework.title}</span>
            </div>
            <div className={styles.field}>
              <label>קורס</label>
              <span>{homework.courseId || "—"}</span>
            </div>
            <div className={styles.field}>
              <label>פתיחה לסטודנטים</label>
              <span>
                {(homework.availableFrom || homework.createdAt) ? new Date(homework.availableFrom || homework.createdAt).toLocaleString("he-IL", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }) : "—"}
              </span>
            </div>
            <div className={styles.field}>
              <label>סגירה לסטודנטים</label>
              <span>
                {(homework.availableUntil || homework.dueAt) ? new Date(homework.availableUntil || homework.dueAt).toLocaleString("he-IL", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }) : "—"}
              </span>
            </div>
            <div className={styles.field}>
              <label>סטטוס נוכחי</label>
              <span className={`${styles.statusBadge} ${styles[`statusBadge_${homework.visibility}`]}`}>
                {isPublished ? (
                  <>
                    <CheckCircle size={14} />
                    פורסם
                  </>
                ) : (
                  <>
                    <Clock size={14} />
                    טיוטה
                  </>
                )}
              </span>
            </div>
          </div>
        </section>

        <section className={styles.infoSection}>
          <h3>מספר שאלות</h3>
          <div className={styles.questionsInfo}>
            <div className={styles.questionsCount}>
              <span className={styles.countNumber}>{questions.length}</span>
              <span className={styles.countLabel}>שאלות במטלה</span>
            </div>
            {!canPublish && (
              <div className={styles.warning}>
                <AlertCircle size={16} />
                <span>{validationSummary.blockers[0]}</span>
              </div>
            )}
          </div>
        </section>

        <section className={styles.infoSection}>
          <h3>בדיקות חובה לפני פרסום</h3>
          <ul>
            {validationSummary.blockers.length === 0 ? (
              <li>כל בדיקות החובה הושלמו.</li>
            ) : (
              validationSummary.blockers.map((item) => <li key={item}>{item}</li>)
            )}
          </ul>
        </section>

        {homework.overview && (
          <section className={styles.infoSection}>
            <h3>תיאור</h3>
            <p className={styles.overview}>{homework.overview}</p>
          </section>
        )}

        <section className={styles.publishSection}>
          <div className={styles.publishInfo}>
            <h3>
              {isPublished ? "שיעור הבית פורסם" : "שיעור הבית לא פורסם"}
            </h3>
            <p>
              {isPublished
                ? "שיעור הבית זמין כעת לסטודנטים. הם יכולים לגשת אליו דרך ממשק הסטודנט."
                : "שיעור הבית הוא כעת בטיוטה ולא זמין לסטודנטים. לחץ על כפתור הפרסום כדי להפוך אותו לזמין."}
            </p>
          </div>

          <div className={styles.actions}>
            <Link href={`/homework/builder/${setId}/preview`} className={styles.previewButton}>
              <Eye size={16} />
              תצוגה מקדימה
            </Link>
            <button
              type="button"
              className={`${styles.publishButton} ${isPublished ? styles.unpublishButton : ""}`}
              onClick={handlePublish}
              disabled={publishMutation.isPending || (!canPublish && !isPublished)}
              title={!canPublish && !isPublished ? validationSummary.blockers[0] : undefined}
            >
              {publishMutation.isPending ? (
                "מעבד..."
              ) : isPublished ? (
                <>
                  <ArrowLeft size={16} />
                  ביטול פרסום
                </>
              ) : (
                <>
                  <Send size={16} />
                  פרסם לסטודנטים
                </>
              )}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
