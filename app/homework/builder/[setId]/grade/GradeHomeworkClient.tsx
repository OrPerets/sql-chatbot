"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getHomeworkQuestions, getHomeworkSet, publishHomeworkGrades } from "@/app/homework/services/homeworkService";
import {
  getSubmissionById,
  getSubmissionProgressById,
  gradeSubmission,
  listSubmissionSummaries,
} from "@/app/homework/services/submissionService";
import { listAnalyticsEvents } from "@/app/homework/services/analyticsService";
import { useHomeworkLocale } from "@/app/homework/context/HomeworkLocaleProvider";
import type { Question, QuestionProgress, Submission } from "@/app/homework/types";
import styles from "./grade.module.css";

interface GradeHomeworkClientProps {
  setId: string;
}

interface GradeDraftEntry {
  score: number;
  instructorNotes?: string;
}

type GradeDraft = Record<string, GradeDraftEntry>;

const SCORE_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 0 });

export function GradeHomeworkClient({ setId }: GradeHomeworkClientProps) {
  const queryClient = useQueryClient();
  const { t, direction, formatNumber } = useHomeworkLocale();
  const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(null);
  const [gradeDraft, setGradeDraft] = useState<GradeDraft>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const homeworkQuery = useQuery({
    queryKey: ["homework", setId],
    queryFn: () => getHomeworkSet(setId),
  });

  const questionsQuery = useQuery({
    queryKey: ["homework", setId, "questions"],
    queryFn: () => getHomeworkQuestions(setId),
  });

  const summariesQuery = useQuery({
    queryKey: ["submissions", setId, "summaries"],
    queryFn: () => listSubmissionSummaries(setId),
  });

  const analyticsQuery = useQuery({
    queryKey: ["analytics", setId],
    queryFn: () => listAnalyticsEvents(setId),
  });

  const submissionQuery = useQuery({
    queryKey: ["submission", activeSubmissionId],
    queryFn: () => (activeSubmissionId ? getSubmissionById(activeSubmissionId) : Promise.resolve(undefined)),
    enabled: Boolean(activeSubmissionId),
  });

  const progressQuery = useQuery({
    queryKey: ["submission", activeSubmissionId, "progress"],
    queryFn: () => (activeSubmissionId ? getSubmissionProgressById(activeSubmissionId) : Promise.resolve(undefined)),
    enabled: Boolean(activeSubmissionId),
  });

  useEffect(() => {
    if (activeSubmissionId || !summariesQuery.data?.length) return;
    setActiveSubmissionId(summariesQuery.data[0]!.id);
  }, [activeSubmissionId, summariesQuery.data]);

  const questionsById = useMemo(() => {
    const map = new Map<string, Question>();
    (questionsQuery.data ?? []).forEach((question) => map.set(question.id, question));
    return map;
  }, [questionsQuery.data]);

  useEffect(() => {
    const submission = submissionQuery.data;
    if (!submission) return;
    const draft: GradeDraft = {};
    Object.entries(submission.answers).forEach(([questionId, answer]) => {
      const question = questionsById.get(questionId);
      const sqlAnswer = answer as any; // Type assertion for compatibility
      const defaultScore = Math.min(question?.points ?? 0, sqlAnswer.feedback?.score ?? 0);
      draft[questionId] = {
        score: defaultScore,
        instructorNotes: sqlAnswer.feedback?.instructorNotes ?? "",
      };
    });
    setGradeDraft(draft);
  }, [submissionQuery.data, questionsById]);

  const gradeMutation = useMutation({
    mutationFn: async () => {
      if (!activeSubmissionId || !submissionQuery.data) return;
      const submission = submissionQuery.data;
      const answersPayload: Submission["answers"] = Object.fromEntries(
        Object.entries(submission.answers).map(([questionId, answer]) => {
          const draft = gradeDraft[questionId];
          const question = questionsById.get(questionId);
          const sqlAnswer = answer as any; // Type assertion for compatibility
          const maxPoints = question?.points ?? draft?.score ?? 0;
          const score = draft ? Math.min(maxPoints, Math.max(0, draft.score)) : sqlAnswer.feedback?.score ?? 0;
          return [
            questionId,
            {
              ...sqlAnswer,
              feedback: {
                questionId,
                score,
                autoNotes: sqlAnswer.feedback?.autoNotes ?? "",
                instructorNotes: draft?.instructorNotes ?? sqlAnswer.feedback?.instructorNotes,
                rubricBreakdown: sqlAnswer.feedback?.rubricBreakdown ?? [],
              },
            },
          ];
        }),
      );

      const overallScore = Object.values(answersPayload).reduce((sum, current) => sum + (current.feedback?.score ?? 0), 0);
      return gradeSubmission(activeSubmissionId, {
        answers: answersPayload,
        overallScore,
        status: "graded",
      });
    },
    onSuccess: (updated) => {
      if (!updated) return;
      queryClient.invalidateQueries({ queryKey: ["submissions", setId, "summaries"] });
      queryClient.setQueryData<Submission | undefined>(["submission", updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ["analytics", setId] });
      setStatusMessage("Grades saved successfully.");
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => publishHomeworkGrades(setId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["submissions", setId, "summaries"] });
      queryClient.invalidateQueries({ queryKey: ["analytics", setId] });
      setStatusMessage(result.message);
    },
  });

  const summaries = summariesQuery.data ?? [];
  const submission = submissionQuery.data;
  const progress = progressQuery.data as QuestionProgress[] | undefined;
  const analytics = analyticsQuery.data ?? [];

  const gradedCount = summaries.filter((item) => item.status === "graded").length;
  const averageScore = summaries.length
    ? Math.round((summaries.reduce((sum, item) => sum + (item.overallScore ?? 0), 0) / summaries.length))
    : undefined;
  const totalPoints = useMemo(
    () =>
      (questionsQuery.data ?? []).reduce((sum, question) => sum + (question.points ?? 0), 0),
    [questionsQuery.data],
  );

  if (homeworkQuery.isLoading || questionsQuery.isLoading || summariesQuery.isLoading) {
    return (
      <div className={styles.container} dir={direction}>
        <div className={styles.loading}>{t("builder.grade.loading")}</div>
      </div>
    );
  }

  if (!homeworkQuery.data) {
    return (
      <div className={styles.container} dir={direction}>
        <div className={styles.errorState}>
          <h2>{t("builder.grade.notFound.title")}</h2>
          <Link href="/homework/builder" className={styles.backLink}>
            {t("builder.grade.notFound.back")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} dir={direction}>
      <header className={styles.header}>
        <div>
          <Link href="/homework/builder" className={styles.backLink}>
            {direction === "rtl" ? "→" : "←"} {t("builder.grade.back")}
          </Link>
          <h2>{homeworkQuery.data.title}</h2>
          <p className={styles.subtitle}>{t("builder.grade.subtitle")}</p>
        </div>
        <div className={styles.headerMetrics}>
          <span>{formatNumber(summaries.length)} {t("builder.grade.submissions")}</span>
          <span>{formatNumber(gradedCount)} {t("builder.grade.graded")}</span>
          {typeof averageScore === "number" && <span>{t("builder.grade.avgScore")}: {formatNumber(averageScore)}</span>}
          <button
            type="button"
            className={styles.publishButton}
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending}
          >
            {publishMutation.isPending ? t("builder.grade.publishing") : t("builder.grade.publishGrades")}
          </button>
        </div>
      </header>

      {statusMessage && <div className={styles.banner}>{statusMessage}</div>}

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <h3>{t("builder.grade.submissions")}</h3>
          <ul className={styles.summaryList}>
            {summaries.map((summary) => (
              <li key={summary.id}>
                <button
                  type="button"
                  className={summary.id === activeSubmissionId ? `${styles.summaryButton} ${styles.active}` : styles.summaryButton}
                  onClick={() => setActiveSubmissionId(summary.id)}
                >
                  <span className={styles.summaryPrimary}>{summary.studentId}</span>
                  <span className={styles.summaryMeta}>
                    {summary.status} · {SCORE_FORMATTER.format(summary.overallScore)} pts
                  </span>
                  <span className={styles.summaryProgress}>{Math.round(summary.progress * 100)}%</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className={styles.detailPane}>
          {!submission ? (
            <div className={styles.placeholder}>Select a submission to review details.</div>
          ) : (
            <div className={styles.detailInner}>
              <header className={styles.detailHeader}>
                <div>
                  <h3>Submission by {submission.studentId}</h3>
                  <p className={styles.detailMeta}>
                    Attempt {submission.attemptNumber} · Status: {submission.status}
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.saveButton}
                  onClick={() => gradeMutation.mutate()}
                  disabled={gradeMutation.isPending}
                >
                  {gradeMutation.isPending ? "Saving…" : "Save grading"}
                </button>
              </header>

              <div className={styles.progressGrid}>
                {(progress ?? []).map((item) => {
                  const question = questionsById.get(item.questionId);
                  return (
                    <div key={item.questionId} className={styles.progressCard}>
                      <span className={styles.progressTitle}>{question?.prompt ?? item.questionId}</span>
                      <span className={styles.progressStats}>
                        Attempts: {item.attempts} · Score: {item.earnedScore ?? 0}/{question?.points ?? 0}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className={styles.questionsList}>
                {Object.entries(submission.answers).map(([questionId, answer]) => {
                  const question = questionsById.get(questionId);
                  const draft = gradeDraft[questionId];
                  const sqlAnswer = answer as any; // Type assertion for compatibility
                  return (
                    <article key={questionId} className={styles.questionCard}>
                      <header>
                        <h4>{question?.prompt ?? `Question ${questionId}`}</h4>
                        <span className={styles.questionPoints}>{draft?.score ?? 0}/{question?.points ?? 0} pts</span>
                      </header>
                      <p className={styles.questionInstructions}>{question?.instructions}</p>
                      <pre className={styles.sqlBlock}>{sqlAnswer.sql || "-- no response"}</pre>
                      {sqlAnswer.resultPreview?.rows?.length ? (
                        <div className={styles.resultPreview}>
                          <strong>Result preview</strong>
                          <table>
                            <thead>
                              <tr>
                                {sqlAnswer.resultPreview.columns.map((column) => (
                                  <th key={column}>{column}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sqlAnswer.resultPreview.rows.slice(0, 3).map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                  {sqlAnswer.resultPreview!.columns.map((column) => (
                                    <td key={column}>{String(row[column] ?? "")}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}

                      <div className={styles.gradeControls}>
                        <label>
                          Score
                          <input
                            type="number"
                            min={0}
                            max={question?.points ?? 100}
                            step={0.5}
                            value={draft?.score ?? 0}
                            onChange={(event) =>
                              setGradeDraft((prev) => ({
                                ...prev,
                                [questionId]: {
                                  ...prev[questionId],
                                  score: Number(event.target.value),
                                },
                              }))
                            }
                          />
                        </label>
                        <label className={styles.notesField}>
                          Instructor notes
                          <textarea
                            placeholder="Add override notes"
                            value={draft?.instructorNotes ?? ""}
                            onChange={(event) =>
                              setGradeDraft((prev) => ({
                                ...prev,
                                [questionId]: {
                                  ...prev[questionId],
                                  instructorNotes: event.target.value,
                                },
                              }))
                            }
                          />
                        </label>
                      </div>
                    </article>
                  );
                })}

                <div className={styles.summaryBar}>
                  <strong>Total score:</strong>
                  <span>
                    {SCORE_FORMATTER.format(
                      Object.values(gradeDraft).reduce((sum, entry) => sum + (entry.score ?? 0), 0),
                    )}
                    /{totalPoints}
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className={styles.analyticsPane}>
          <h3>Activity log</h3>
          <ul className={styles.analyticsList}>
            {analytics.length === 0 && <li>No events yet.</li>}
            {analytics.map((event) => (
              <li key={event.id}>
                <span className={styles.analyticsType}>{event.type}</span>
                <span className={styles.analyticsMeta}>
                  {new Date(event.createdAt).toLocaleString()} · actor: {event.actorId}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
