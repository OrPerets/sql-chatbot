"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getHomeworkQuestions, getHomeworkSet } from "@/app/homework/services/homeworkService";
import {
  getSubmission,
  saveSubmissionDraft,
  submitHomework,
} from "@/app/homework/services/submissionService";
import { executeSql } from "@/app/homework/services/sqlService";
import type { Question, SqlExecutionRequest, Submission } from "@/app/homework/types";
import styles from "./runner.module.css";
import { useHomeworkLocale } from "@/app/homework/context/HomeworkLocaleProvider";
import { InstructionsSection } from "./InstructionsSection";

import Editor from "@monaco-editor/react";

// Simple student name mapping
const STUDENT_NAMES: Record<string, string> = {
  "304993092": "אור פרץ",
  "123456789": "סטודנט דמו",
};

interface RunnerClientProps {
  setId: string;
  studentId: string;
}

interface PendingSave {
  questionId: string;
  timer: number;
}

const AUTOSAVE_DELAY = 800;

export function RunnerClient({ setId, studentId }: RunnerClientProps) {
  const queryClient = useQueryClient();
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [editorValues, setEditorValues] = useState<Record<string, string>>({});
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved">("idle");
  const pendingRef = useRef<Record<string, PendingSave>>({});
  const { t, direction, formatDateTime, formatNumber } = useHomeworkLocale();
  const backArrow = direction === "rtl" ? "→" : "←";

  const clearPendingSaves = useCallback(() => {
    Object.values(pendingRef.current).forEach((pending) => {
      window.clearTimeout(pending.timer);
    });
    pendingRef.current = {};
  }, []);

  const homeworkQuery = useQuery({
    queryKey: ["homework", setId],
    queryFn: () => getHomeworkSet(setId),
  });

  const questionsQuery = useQuery({
    queryKey: ["homework", setId, "questions"],
    queryFn: () => getHomeworkQuestions(setId),
  });

  const submissionQuery = useQuery({
    queryKey: ["submission", setId, studentId],
    queryFn: () => getSubmission(setId, studentId),
    enabled: Boolean(setId && studentId),
  });

  const questionsById = useMemo(() => {
    const map = new Map<string, Question>();
    (questionsQuery.data ?? []).forEach((question) => map.set(question.id, question));
    return map;
  }, [questionsQuery.data]);

  useEffect(() => {
    if (!submissionQuery.data) return;
    setEditorValues((prev) => {
      const next: Record<string, string> = { ...prev };
      Object.entries(submissionQuery.data!.answers ?? {}).forEach(([questionId, answer]) => {
        next[questionId] = typeof answer?.sql === "string" ? answer.sql : "";
      });
      return next;
    });
  }, [submissionQuery.data]);

  useEffect(() => {
    if (activeQuestionId) return;
    const questionOrder = homeworkQuery.data?.questionOrder ?? [];
    console.log("Setting active question:", { questionOrder, homework: homeworkQuery.data });
    if (questionOrder.length > 0) {
      setActiveQuestionId(questionOrder[0]!);
      console.log("Active question set to:", questionOrder[0]);
    }
  }, [activeQuestionId, homeworkQuery.data?.questionOrder]);

  const autosaveMutation = useMutation({
    mutationFn: (payload: { questionId: string; sql: string }) =>
      saveSubmissionDraft(setId, {
        studentId,
        answers: {
          [payload.questionId]: {
            sql: payload.sql,
          },
        },
      }),
    onMutate: () => {
      setAutosaveState("saving");
    },
    onSuccess: (submission) => {
      queryClient.setQueryData<Submission | undefined>(["submission", setId, studentId], submission);
      setAutosaveState("saved");
      window.setTimeout(() => setAutosaveState("idle"), 1500);
    },
    onError: () => {
      setAutosaveState("idle");
    },
  });

  const executeMutation = useMutation({
    mutationFn: (payload: SqlExecutionRequest) => {
      console.log("🔵 executeMutation mutationFn called", payload);
      return executeSql(payload);
    },
    onSuccess: (result, variables) => {
      console.log("✅ SQL execution successful", result);
      console.log("📊 Result has", result.rows.length, "rows and", result.columns.length, "columns");
      
      queryClient.setQueryData<Submission | undefined>(["submission", setId, studentId], (prev) => {
        console.log("🔄 Updating query cache, prev submission:", prev);
        if (!prev) {
          console.warn("⚠️ No previous submission data in cache!");
          return prev;
        }
        
        const answer = prev.answers[variables.questionId] ?? { sql: variables.sql };
        const executionCount = (answer.executionCount ?? 0) + (variables.preview ? 0 : 1);
        
        const updatedSubmission = {
          ...prev,
          answers: {
            ...prev.answers,
            [variables.questionId]: {
              ...answer,
              sql: variables.sql,
              resultPreview: {
                columns: result.columns,
                rows: result.rows,
                executionMs: result.executionMs,
                truncated: result.truncated,
              },
              feedback: result.feedback,
              lastExecutedAt: new Date().toISOString(),
              executionCount,
            },
          },
        } as Submission;
        
        console.log("✅ Updated submission with resultPreview:", updatedSubmission.answers[variables.questionId]?.resultPreview);
        return updatedSubmission;
      });
      
      queryClient.invalidateQueries({ queryKey: ["submission", setId, studentId] });
    },
    onError: (error) => {
      console.error("❌ SQL execution failed", error);
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => submitHomework(setId, { studentId }),
    onSuccess: (submission) => {
      queryClient.setQueryData<Submission | undefined>(["submission", setId, studentId], submission);
      queryClient.invalidateQueries({ queryKey: ["submission", setId, studentId] });
    },
  });

  const scheduleAutosave = useCallback(
    (questionId: string, value: string) => {
      const pending = pendingRef.current[questionId];
      if (pending) {
        window.clearTimeout(pending.timer);
      }
      pendingRef.current[questionId] = {
        questionId,
        timer: window.setTimeout(() => {
          autosaveMutation.mutate({ questionId, sql: value });
          delete pendingRef.current[questionId];
        }, AUTOSAVE_DELAY),
      };
    },
    [autosaveMutation],
  );

  useEffect(() => clearPendingSaves, [clearPendingSaves]);

  // Debug log for editor values (reduced verbosity)
  useEffect(() => {
    if (activeQuestionId) {
      console.log("🔵 Editor values changed:", { 
        activeQuestionId, 
        currentValue: editorValues[activeQuestionId || ''] 
      });
    }
  }, [editorValues, activeQuestionId]);

  const handleSqlChange = useCallback(
    (questionId: string, value?: string) => {
      const nextValue = value ?? "";
      console.log("🔵 handleSqlChange called:", { questionId, nextValueLength: nextValue.length });
      setEditorValues((prev) => ({ ...prev, [questionId]: nextValue }));
      scheduleAutosave(questionId, nextValue);
    },
    [scheduleAutosave],
  );

  const handleExecute = useCallback(() => {
    console.log("🔴 handleExecute called", { 
      activeQuestionId, 
      hasSubmission: !!submissionQuery.data,
      sql: editorValues[activeQuestionId]
    });
    
    if (!activeQuestionId) {
      console.warn("⚠️ No active question ID");
      return;
    }
    if (!submissionQuery.data) {
      console.warn("⚠️ No submission data");
      return;
    }
    const sql = editorValues[activeQuestionId] ?? "";
    console.log("🟢 Executing SQL:", sql);
    
    executeMutation.mutate({
      setId,
      submissionId: submissionQuery.data.id,
      questionId: activeQuestionId,
      sql,
      studentId,
      attemptNumber: submissionQuery.data.attemptNumber,
    });
  }, [activeQuestionId, editorValues, executeMutation, setId, studentId, submissionQuery.data]);

  const submission = submissionQuery.data;
  const homework = homeworkQuery.data;
  const questions = useMemo(() => questionsQuery.data ?? [], [questionsQuery.data]);

  const totalQuestions = homework?.questionOrder?.length ?? questions.length;
  const answers = useMemo(() => submission?.answers ?? {}, [submission?.answers]);
  const answeredCount = useMemo(() =>
    (homework?.questionOrder ?? questions.map((question) => question.id)).filter((questionId) => {
      const answer = answers[questionId];
      return Boolean(answer?.sql?.trim()) || Boolean(answer?.feedback?.score);
    }).length,
  [answers, homework?.questionOrder, questions]);

  const progressPercent = totalQuestions === 0 ? 0 : Math.round((answeredCount / totalQuestions) * 100);
  const activeQuestion = activeQuestionId ? questionsById.get(activeQuestionId) : undefined;
  const activeAnswer = activeQuestionId ? answers[activeQuestionId] : undefined;
  const attemptsRemaining = activeQuestion?.maxAttempts
    ? Math.max(0, activeQuestion.maxAttempts - (activeAnswer?.executionCount ?? 0))
    : undefined;

  // Debug: Log activeAnswer whenever it changes
  useEffect(() => {
    if (activeQuestionId) {
      console.log("🔍 Active Answer for", activeQuestionId, ":", activeAnswer);
      console.log("   Has resultPreview?", !!activeAnswer?.resultPreview);
      console.log("   ResultPreview:", activeAnswer?.resultPreview);
    }
  }, [activeQuestionId, activeAnswer]);

  if (homeworkQuery.isLoading || questionsQuery.isLoading || submissionQuery.isLoading) {
    return (
      <div className={styles.loading} dir={direction}>
        {t("runner.loading")}
      </div>
    );
  }

  if (homeworkQuery.error || questionsQuery.error || submissionQuery.error || !homework || totalQuestions === 0) {
    return (
      <div className={styles.errorState} dir={direction}>
        <h2>{t("runner.error.title")}</h2>
        <p>{t("runner.error.description")}</p>
        <Link href="/homework" className={styles.backLink}>
          {backArrow} {t("runner.error.back")}
        </Link>
      </div>
    );
  }

  const statusLabel = submission?.status ? t(`runner.status.${submission.status}`) : t("runner.status.in_progress");
  const autosaveLabel = t(`runner.progress.autosave.${autosaveState}`);

  return (
    <div className={styles.runner} dir={direction}>
      <aside className={styles.sidebar}>
        <div className={styles.assignmentMeta}>
          <Link href="/homework" className={styles.backLink}>
            {backArrow} {t("runner.back")}
          </Link>
          
          {/* Student Info */}
          <div className={styles.studentInfo}>
            <div className={styles.studentAvatar}>
              {STUDENT_NAMES[studentId]?.charAt(0) || studentId.charAt(0)}
            </div>
            <div className={styles.studentDetails}>
              <div className={styles.studentName}>
                {STUDENT_NAMES[studentId] || "סטודנט"}
              </div>
              <div className={styles.studentId}>ת.ז: {studentId}</div>
            </div>
          </div>

          <h2>{homework.title}</h2>
          {/* <p className={styles.courseTag}>{homework.courseId}</p> */}
          <div className={styles.metaGrid}>
            <div className={styles.progressCircle}>
              <svg width="120" height="120">
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
                <circle
                  className={styles.progressCircleBackground}
                  cx="60"
                  cy="60"
                  r="52"
                />
                <circle
                  className={styles.progressCircleForeground}
                  cx="60"
                  cy="60"
                  r="52"
                  strokeDasharray={`${2 * Math.PI * 52}`}
                  strokeDashoffset={`${2 * Math.PI * 52 * (1 - progressPercent / 100)}`}
                />
              </svg>
              <div className={styles.progressText}>
                <span className={styles.progressPercent}>{formatNumber(progressPercent)}%</span>
                <span className={styles.progressLabel}>{t("runner.meta.progress")}</span>
              </div>
            </div>
          </div>
          {homework.backgroundStory && <InstructionsSection instructions={homework.backgroundStory} />}
        </div>

        <nav className={styles.navigator}>
          <h3>{t("runner.nav.heading")}</h3>
          <ul>
            {(homework.questionOrder ?? questions.map((question) => question.id)).map((questionId, index) => {
              const answer = answers[questionId];
              const isActive = questionId === activeQuestionId;
              const isCompleted = Boolean(answer?.feedback?.score);
              const hasDraft = Boolean(answer?.sql?.trim());
              return (
                <li key={questionId}>
                  <button
                    type="button"
                    className={isActive ? `${styles.navButton} ${styles.navButtonActive}` : styles.navButton}
                    onClick={() => setActiveQuestionId(questionId)}
                  >
                    <span className={styles.navIndex}>{formatNumber(index + 1)}</span>
                    <span className={styles.navLabel}>{questionsById.get(questionId)?.prompt ?? t("runner.nav.fallback")}</span>
                    <span className={styles.navStatus} data-state={isCompleted ? "complete" : hasDraft ? "draft" : "todo"}>
                      {isCompleted
                        ? t("runner.nav.status.complete")
                        : hasDraft
                          ? t("runner.nav.status.draft")
                          : t("runner.nav.status.new")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.workspaceHeader}>
          {/* Question Stepper */}
          <div className={styles.questionStepper}>
            {(homework?.questionOrder ?? questions.map((q) => q.id)).map((qId, index) => {
              const isActive = qId === activeQuestionId;
              const answer = answers[qId];
              const isCompleted = Boolean(answer?.feedback?.score);
              const questionNum = index + 1;
              
              return (
                <div key={qId} className={styles.stepperItem}>
                  <div 
                    className={`${styles.stepperCircle} ${isActive ? styles.stepperCircleActive : ''} ${isCompleted ? styles.stepperCircleCompleted : ''}`}
                    onClick={() => setActiveQuestionId(qId)}
                  >
                    {isCompleted ? '✓' : questionNum}
                  </div>
                  {index < (homework?.questionOrder ?? questions.map((q) => q.id)).length - 1 && (
                    <div className={`${styles.stepperLine} ${isCompleted ? styles.stepperLineCompleted : ''}`} />
                  )}
                </div>
              );
            })}
          </div>
          
          <div className={styles.questionContent}>
            <h3>{activeQuestion?.prompt ?? t("runner.question.placeholder")}</h3>
            <p className={styles.instructions}>{activeQuestion?.instructions}</p>
          </div>
        </header>

        <div className={styles.editorSection}>
          <div className={styles.editorContainer}>
            <div 
              onClick={(e) => {
                console.log("🔵 Editor container clicked", { 
                  target: e.target, 
                  currentTarget: e.currentTarget,
                  activeQuestionId,
                  editorValues: editorValues[activeQuestionId || '']
                });
              }}
              style={{ width: '100%', height: '300px' }}
            >
              {/* Force LTR direction for Monaco to ensure native keybindings and input work reliably even in RTL layouts */}
              <div dir="ltr" style={{ width: '100%', height: '100%' }}>
              <Editor
              height="300px"
              value={activeQuestionId ? (editorValues[activeQuestionId] || "") : ""}
              defaultLanguage="sql"
              onChange={(value) => {
                console.log("🟢 Monaco onChange triggered:", { 
                  activeQuestionId, 
                  valueLength: value?.length
                });
                if (activeQuestionId) {
                  handleSqlChange(activeQuestionId, value || "");
                }
              }}
              onMount={(editor) => {
                console.log("🟡 Monaco editor mounted successfully");
                editor.focus();
              }}
              />
              </div>
            </div>
            <div className={styles.editorActions}>
              <button
                type="button"
                className={styles.runButton}
                onClick={handleExecute}
                disabled={executeMutation.isPending || !activeQuestionId}
              >
                <span>{executeMutation.isPending ? "⏳" : "▶️"}</span>
                {executeMutation.isPending ? t("runner.actions.running") : t("runner.actions.run")}
              </button>
              <button
                type="button"
                className={styles.submitButton}
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || submission?.status === "submitted" || submission?.status === "graded"}
              >
                <span>{submitMutation.isPending ? "⏳" : submission?.status === "submitted" ? "✅" : "📤"}</span>
                {submitMutation.isPending
                  ? t("runner.actions.submitting")
                  : submission?.status === "submitted"
                    ? t("runner.actions.submitted")
                    : t("runner.actions.submit")}
              </button>
            </div>
          </div>

          <div className={styles.feedbackPanel}>
            <h4>{t("runner.results.heading")}</h4>
            {executeMutation.isError && <p className={styles.errorText}>{t("runner.results.error")}</p>}
            {activeAnswer?.resultPreview ? (
              <div className={styles.resultTableWrapper}>
                <table className={styles.resultTable}>
                  <thead>
                    <tr>
                      {activeAnswer.resultPreview.columns.map((column) => (
                        <th key={column}>{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeAnswer.resultPreview.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {activeAnswer.resultPreview!.columns.map((column) => (
                          <td key={column}>{String(row[column] ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className={styles.resultMeta}>
                  <span>
                    {t("runner.results.executionTime", {
                      ms: formatNumber(activeAnswer.resultPreview.executionMs),
                    })}
                  </span>
                  {activeAnswer.resultPreview.truncated && <span>{t("runner.results.truncated")}</span>}
                </div>
              </div>
            ) : (
              <p className={styles.placeholder}>{t("runner.results.placeholder")}</p>
            )}

          </div>
        </div>
      </section>
    </div>
  );
}
