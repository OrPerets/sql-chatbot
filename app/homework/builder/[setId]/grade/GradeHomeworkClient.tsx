"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
import type { Question, QuestionProgress, Submission, SqlAnswer } from "@/app/homework/types";
import styles from "./grade.module.css";

interface GradeHomeworkClientProps {
  setId: string;
}

interface GradeDraftEntry {
  score: number;
  instructorNotes?: string;
}

type GradeDraft = Record<string, GradeDraftEntry>;
type QuestionGradeDraft = Record<string, Record<string, GradeDraftEntry>>; // questionId -> submissionId -> grade

type ViewMode = "student" | "question";
type FilterStatus = "all" | "graded" | "ungraded" | "partial";
type SortField = "name" | "score" | "status" | "date";
type SortDirection = "asc" | "desc";

// Status Badge Component
function StatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const getStatusClass = () => {
    switch (status) {
      case "graded": return styles.graded;
      case "submitted": return styles.submitted;
      case "in_progress": return styles.inProgress;
      case "partial": return styles.partial;
      default: return styles.ungraded;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "graded": return t("builder.grade.status.graded");
      case "submitted": return t("builder.grade.status.submitted");
      case "in_progress": return t("builder.grade.status.inProgress");
      case "partial": return t("builder.grade.status.partial");
      default: return t("builder.grade.status.ungraded");
    }
  };

  return (
    <span className={`${styles.statusBadge} ${getStatusClass()}`}>
      {getStatusText()}
    </span>
  );
}

const SCORE_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 0 });

export function GradeHomeworkClient({ setId }: GradeHomeworkClientProps) {
  const queryClient = useQueryClient();
  const { t, direction, formatNumber } = useHomeworkLocale();
  const [viewMode, setViewMode] = useState<ViewMode>("student");
  const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [gradeDraft, setGradeDraft] = useState<GradeDraft>({});
  const [questionGradeDraft, setQuestionGradeDraft] = useState<QuestionGradeDraft>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  
  // Filtering & Sorting State
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  
  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "unsaved">("idle");
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDraftRef = useRef<string>("");

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

  // Fetch all submissions for per-question view
  const allSubmissionsQuery = useQuery({
    queryKey: ["submissions", setId, "all"],
    queryFn: async () => {
      const summaries = summariesQuery.data ?? [];
      const submissions = await Promise.all(
        summaries.map((summary) => getSubmissionById(summary.id).catch(() => null))
      );
      return submissions.filter((s): s is Submission => s !== null);
    },
    enabled: viewMode === "question" && summariesQuery.isSuccess,
  });

  useEffect(() => {
    if (viewMode === "student" && activeSubmissionId) return;
    if (viewMode === "student" && summariesQuery.data?.length && !activeSubmissionId) {
    setActiveSubmissionId(summariesQuery.data[0]!.id);
    }
    if (viewMode === "question" && questionsQuery.data?.length && !activeQuestionId) {
      setActiveQuestionId(questionsQuery.data[0]!.id);
    }
  }, [viewMode, activeSubmissionId, activeQuestionId, summariesQuery.data, questionsQuery.data]);

  // Clear selected students when switching view modes
  useEffect(() => {
    setSelectedStudentIds(new Set());
  }, [viewMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        gradeMutation.mutate();
        return;
      }

      // Arrow keys for navigation
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        if (viewMode === "student") {
          const currentIndex = filteredSummaries.findIndex(s => s.id === activeSubmissionId);
          if (currentIndex !== -1) {
            const nextIndex = e.key === "ArrowRight" 
              ? Math.min(currentIndex + 1, filteredSummaries.length - 1)
              : Math.max(currentIndex - 1, 0);
            setActiveSubmissionId(filteredSummaries[nextIndex]?.id || null);
          }
        } else {
          const questions = questionsQuery.data ?? [];
          const currentIndex = questions.findIndex(q => q.id === activeQuestionId);
          if (currentIndex !== -1) {
            const nextIndex = e.key === "ArrowRight"
              ? Math.min(currentIndex + 1, questions.length - 1)
              : Math.max(currentIndex - 1, 0);
            setActiveQuestionId(questions[nextIndex]?.id || null);
          }
        }
        return;
      }

      // ? to show keyboard shortcuts
      if (e.key === "?") {
        setShowKeyboardShortcuts(prev => !prev);
        return;
      }

      // Escape to close shortcuts modal
      if (e.key === "Escape") {
        setShowKeyboardShortcuts(false);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, activeSubmissionId, activeQuestionId, questionsQuery.data]);

  // Auto-save effect
  useEffect(() => {
    const currentDraft = JSON.stringify(viewMode === "student" ? gradeDraft : questionGradeDraft);
    
    if (currentDraft !== lastSavedDraftRef.current && lastSavedDraftRef.current !== "") {
      setAutoSaveStatus("unsaved");
      
      // Clear any existing timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      // Set new auto-save timeout (30 seconds)
      autoSaveTimeoutRef.current = setTimeout(() => {
        setAutoSaveStatus("saving");
        gradeMutation.mutate();
      }, 30000);
    }
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [gradeDraft, questionGradeDraft, viewMode]);

  const questionsById = useMemo(() => {
    const map = new Map<string, Question>();
    (questionsQuery.data ?? []).forEach((question) => map.set(question.id, question));
    return map;
  }, [questionsQuery.data]);

  // Compute question statistics for per-question view
  const questionStats = useMemo(() => {
    const allSubmissions = allSubmissionsQuery.data ?? [];
    const stats = new Map<string, {
      answeredCount: number;
      averageScore: number;
      gradedCount: number;
      totalPoints: number;
    }>();

    questionsQuery.data?.forEach((question) => {
      let answeredCount = 0;
      let totalScore = 0;
      let gradedCount = 0;
      const totalPoints = question.points ?? 0;

      allSubmissions.forEach((submission) => {
        const answer = submission.answers[question.id] as SqlAnswer | undefined;
        if (answer?.sql) {
          answeredCount++;
          const score = answer.feedback?.score ?? 0;
          totalScore += score;
          if (submission.status === "graded" || answer.feedback?.score !== undefined) {
            gradedCount++;
          }
        }
      });

      stats.set(question.id, {
        answeredCount,
        averageScore: answeredCount > 0 ? totalScore / answeredCount : 0,
        gradedCount,
        totalPoints,
      });
    });

    return stats;
  }, [questionsQuery.data, allSubmissionsQuery.data]);

  // Compute overall grading progress
  const gradingProgress = useMemo(() => {
    const summaries = summariesQuery.data ?? [];
    if (summaries.length === 0) return { total: 0, graded: 0, percentage: 0 };
    
    const totalQuestions = (questionsQuery.data ?? []).length * summaries.length;
    const gradedQuestions = summaries.reduce((count, summary) => {
      return count + (summary.status === "graded" ? (questionsQuery.data ?? []).length : 0);
    }, 0);
    
    return {
      total: totalQuestions,
      graded: gradedQuestions,
      percentage: totalQuestions > 0 ? (gradedQuestions / totalQuestions) * 100 : 0,
    };
  }, [summariesQuery.data, questionsQuery.data]);

  useEffect(() => {
    if (viewMode === "student") {
    const submission = submissionQuery.data;
    if (!submission) return;
    const draft: GradeDraft = {};
    Object.entries(submission.answers).forEach(([questionId, answer]) => {
      const question = questionsById.get(questionId);
        const sqlAnswer = answer as SqlAnswer;
      const defaultScore = Math.min(question?.points ?? 0, sqlAnswer.feedback?.score ?? 0);
      draft[questionId] = {
        score: defaultScore,
        instructorNotes: sqlAnswer.feedback?.instructorNotes ?? "",
      };
    });
    setGradeDraft(draft);
    } else if (viewMode === "question" && activeQuestionId) {
      const allSubmissions = allSubmissionsQuery.data ?? [];
      const question = questionsById.get(activeQuestionId);
      const draft: Record<string, GradeDraftEntry> = {};
      
      allSubmissions.forEach((submission) => {
        const answer = submission.answers[activeQuestionId] as SqlAnswer | undefined;
        if (answer) {
          const defaultScore = Math.min(question?.points ?? 0, answer.feedback?.score ?? 0);
          draft[submission.id] = {
            score: defaultScore,
            instructorNotes: answer.feedback?.instructorNotes ?? "",
          };
        }
      });
      
      setQuestionGradeDraft((prev) => ({
        ...prev,
        [activeQuestionId]: draft,
      }));
    }
  }, [viewMode, submissionQuery.data, allSubmissionsQuery.data, activeQuestionId, questionsById]);

  const gradeMutation = useMutation({
    mutationFn: async () => {
      if (viewMode === "student") {
      if (!activeSubmissionId || !submissionQuery.data) return;
      const submission = submissionQuery.data;
      const answersPayload: Submission["answers"] = Object.fromEntries(
        Object.entries(submission.answers).map(([questionId, answer]) => {
          const draft = gradeDraft[questionId];
          const question = questionsById.get(questionId);
            const sqlAnswer = answer as SqlAnswer;
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
      } else {
        // Per-question view: grade selected students or all if none selected
        if (!activeQuestionId) return;
        const allSubmissions = allSubmissionsQuery.data ?? [];
        const submissionsToGrade = selectedStudentIds.size > 0
          ? allSubmissions.filter((s) => selectedStudentIds.has(s.id))
          : allSubmissions;

        const question = questionsById.get(activeQuestionId);
        if (!question) return;

        const results = await Promise.all(
          submissionsToGrade.map(async (submission) => {
            const draft = questionGradeDraft[activeQuestionId]?.[submission.id];
            if (!draft) return null;

            const answer = submission.answers[activeQuestionId] as SqlAnswer | undefined;
            if (!answer) return null;

            const maxPoints = question.points ?? draft.score ?? 0;
            const score = Math.min(maxPoints, Math.max(0, draft.score));
            
            const updatedAnswer: SqlAnswer = {
              ...answer,
              feedback: {
                questionId: activeQuestionId,
                score,
                autoNotes: answer.feedback?.autoNotes ?? "",
                instructorNotes: draft.instructorNotes ?? answer.feedback?.instructorNotes,
                rubricBreakdown: answer.feedback?.rubricBreakdown ?? [],
              },
            };

            const updatedAnswers: Submission["answers"] = {
              ...submission.answers,
              [activeQuestionId]: updatedAnswer,
            };

            const overallScore = Object.values(updatedAnswers).reduce(
              (sum, ans) => sum + (ans.feedback?.score ?? 0),
              0
            );

            return gradeSubmission(submission.id, {
              answers: updatedAnswers,
              overallScore,
              status: "graded",
            });
          })
        );

        return results.filter((r): r is Submission => r !== null);
      }
    },
    onSuccess: (updated) => {
      if (!updated) return;
      queryClient.invalidateQueries({ queryKey: ["submissions", setId, "summaries"] });
      queryClient.invalidateQueries({ queryKey: ["submissions", setId, "all"] });
      if (viewMode === "student" && !Array.isArray(updated)) {
      queryClient.setQueryData<Submission | undefined>(["submission", updated.id], updated);
      }
      queryClient.invalidateQueries({ queryKey: ["analytics", setId] });
      setStatusMessage(Array.isArray(updated) 
        ? t("builder.grade.saveSuccessMultiple", { count: updated.length })
        : t("builder.grade.saveSuccess"));
      setSelectedStudentIds(new Set());
      
      // Update auto-save status
      setAutoSaveStatus("saved");
      lastSavedDraftRef.current = JSON.stringify(viewMode === "student" ? gradeDraft : questionGradeDraft);
      
      // Reset to idle after 3 seconds
      setTimeout(() => setAutoSaveStatus("idle"), 3000);
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

  // Bulk grading helpers
  const handleBulkScoreChange = useCallback((newScore: number) => {
    if (!activeQuestionId) return;
    const allSubmissions = allSubmissionsQuery.data ?? [];
    const submissionsToUpdate = selectedStudentIds.size > 0
      ? allSubmissions.filter((s) => selectedStudentIds.has(s.id))
      : allSubmissions;

    setQuestionGradeDraft((prev) => {
      const questionDraft = prev[activeQuestionId] ?? {};
      const updated: Record<string, GradeDraftEntry> = { ...questionDraft };
      
      submissionsToUpdate.forEach((submission) => {
        updated[submission.id] = {
          ...questionDraft[submission.id],
          score: newScore,
        };
      });

      return {
        ...prev,
        [activeQuestionId]: updated,
      };
    });
  }, [activeQuestionId, selectedStudentIds, allSubmissionsQuery.data]);

  const handleBulkNotesChange = useCallback((notes: string) => {
    if (!activeQuestionId) return;
    const allSubmissions = allSubmissionsQuery.data ?? [];
    const submissionsToUpdate = selectedStudentIds.size > 0
      ? allSubmissions.filter((s) => selectedStudentIds.has(s.id))
      : allSubmissions;

    setQuestionGradeDraft((prev) => {
      const questionDraft = prev[activeQuestionId] ?? {};
      const updated: Record<string, GradeDraftEntry> = { ...questionDraft };
      
      submissionsToUpdate.forEach((submission) => {
        updated[submission.id] = {
          ...questionDraft[submission.id],
          instructorNotes: notes,
        };
      });

      return {
        ...prev,
        [activeQuestionId]: updated,
      };
    });
  }, [activeQuestionId, selectedStudentIds, allSubmissionsQuery.data]);

  const toggleStudentSelection = useCallback((submissionId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(submissionId)) {
        next.delete(submissionId);
      } else {
        next.add(submissionId);
      }
      return next;
    });
  }, []);

  const toggleAllStudents = useCallback(() => {
    const allSubmissions = allSubmissionsQuery.data ?? [];
    if (!activeQuestionId) return;
    
    const submissionsForQuestion = allSubmissions.filter(
      (s) => s.answers[activeQuestionId] as SqlAnswer | undefined
    );
    
    setSelectedStudentIds((prev) => {
      if (prev.size === submissionsForQuestion.length) {
        return new Set();
      }
      return new Set(submissionsForQuestion.map((s) => s.id));
    });
  }, [activeQuestionId, allSubmissionsQuery.data]);

  const summaries = summariesQuery.data ?? [];
  const submission = submissionQuery.data;
  const progress = progressQuery.data as QuestionProgress[] | undefined;
  const analytics = analyticsQuery.data ?? [];

  // Filter and sort summaries
  const filteredSummaries = useMemo(() => {
    let filtered = [...summaries];
    
    // Apply status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter(summary => {
        if (filterStatus === "graded") return summary.status === "graded";
        if (filterStatus === "ungraded") return summary.status !== "graded" && summary.status !== "submitted";
        if (filterStatus === "partial") return summary.status === "submitted" || (summary.progress > 0 && summary.progress < 1);
        return true;
      });
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(summary => 
        summary.studentId.toLowerCase().includes(query)
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.studentId.localeCompare(b.studentId);
          break;
        case "score":
          comparison = (a.overallScore ?? 0) - (b.overallScore ?? 0);
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        case "date":
          comparison = new Date(a.submittedAt ?? 0).getTime() - new Date(b.submittedAt ?? 0).getTime();
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
    
    return filtered;
  }, [summaries, filterStatus, searchQuery, sortField, sortDirection]);

  // Find next ungraded submission
  const nextUngradedId = useMemo(() => {
    const currentIndex = filteredSummaries.findIndex(s => s.id === activeSubmissionId);
    for (let i = currentIndex + 1; i < filteredSummaries.length; i++) {
      if (filteredSummaries[i].status !== "graded") {
        return filteredSummaries[i].id;
      }
    }
    // Wrap around to the beginning
    for (let i = 0; i < currentIndex; i++) {
      if (filteredSummaries[i].status !== "graded") {
        return filteredSummaries[i].id;
      }
    }
    return null;
  }, [filteredSummaries, activeSubmissionId]);

  const gradedCount = summaries.filter((item) => item.status === "graded").length;
  const averageScore = summaries.length
    ? Math.round((summaries.reduce((sum, item) => sum + (item.overallScore ?? 0), 0) / summaries.length))
    : undefined;
  const totalPoints = useMemo(
    () =>
      (questionsQuery.data ?? []).reduce((sum, question) => sum + (question.points ?? 0), 0),
    [questionsQuery.data],
  );

  // Quick score preset handler
  const handleQuickScorePreset = useCallback((percentage: number) => {
    if (viewMode === "student" && activeSubmissionId) {
      const newDraft: GradeDraft = {};
      Object.keys(gradeDraft).forEach(questionId => {
        const question = questionsById.get(questionId);
        const maxPoints = question?.points ?? 0;
        newDraft[questionId] = {
          ...gradeDraft[questionId],
          score: Math.round(maxPoints * percentage / 100),
        };
      });
      setGradeDraft(newDraft);
    } else if (viewMode === "question" && activeQuestionId) {
      const question = questionsById.get(activeQuestionId);
      const maxPoints = question?.points ?? 0;
      handleBulkScoreChange(Math.round(maxPoints * percentage / 100));
    }
  }, [viewMode, activeSubmissionId, activeQuestionId, gradeDraft, questionsById, handleBulkScoreChange]);

  // Get progress bar color class
  const getProgressColorClass = (percentage: number) => {
    if (percentage < 25) return styles.low;
    if (percentage < 50) return styles.medium;
    if (percentage < 75) return styles.good;
    return styles.complete;
  };

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

      {/* Progress Bar */}
      <div className={styles.progressBarContainer}>
        <div className={styles.progressBarLabel}>
          {t("builder.grade.progress.label")}: {formatNumber(gradingProgress.graded)} / {formatNumber(gradingProgress.total)} ({Math.round(gradingProgress.percentage)}%)
          {autoSaveStatus !== "idle" && (
            <span className={`${styles.autoSaveIndicator} ${styles[autoSaveStatus]}`}>
              <span className={`${styles.savingDot} ${styles[autoSaveStatus]}`} />
              {autoSaveStatus === "saving" && t("builder.grade.submission.saving")}
              {autoSaveStatus === "saved" && t("builder.grade.submission.saved")}
              {autoSaveStatus === "unsaved" && "●"}
            </span>
          )}
        </div>
        <div className={styles.progressBarEnhanced}>
          <div 
            className={`${styles.progressBarFillEnhanced} ${getProgressColorClass(gradingProgress.percentage)}`}
            style={{ width: `${gradingProgress.percentage}%` }}
          />
          <div className={styles.progressMilestones}>
            <div className={styles.milestone} />
            <div className={styles.milestone} />
            <div className={styles.milestone} />
          </div>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className={styles.viewModeToggle}>
        <button
          type="button"
          className={viewMode === "student" ? `${styles.viewModeButton} ${styles.active}` : styles.viewModeButton}
          onClick={() => setViewMode("student")}
        >
          {t("builder.grade.viewMode.student")}
        </button>
        <button
          type="button"
          className={viewMode === "question" ? `${styles.viewModeButton} ${styles.active}` : styles.viewModeButton}
          onClick={() => setViewMode("question")}
        >
          {t("builder.grade.viewMode.question")}
        </button>
      </div>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          {viewMode === "student" ? (
            <>
          <h3>{t("builder.grade.submissions")}</h3>
          
          {/* Filter & Sort Controls */}
          <div className={styles.filterSortControls}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder={t("builder.grade.filter.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className={styles.filterChips}>
              {(["all", "graded", "ungraded", "partial"] as FilterStatus[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`${styles.filterChip} ${filterStatus === status ? styles.active : ""}`}
                  onClick={() => setFilterStatus(status)}
                >
                  {t(`builder.grade.filter.${status}`)}
                </button>
              ))}
            </div>
            <select
              className={styles.sortDropdown}
              value={`${sortField}-${sortDirection}`}
              onChange={(e) => {
                const [field, dir] = e.target.value.split("-") as [SortField, SortDirection];
                setSortField(field);
                setSortDirection(dir);
              }}
            >
              <option value="name-asc">{t("builder.grade.sort.name")} ↑</option>
              <option value="name-desc">{t("builder.grade.sort.name")} ↓</option>
              <option value="score-desc">{t("builder.grade.sort.score")} ↓</option>
              <option value="score-asc">{t("builder.grade.sort.score")} ↑</option>
              <option value="status-asc">{t("builder.grade.sort.status")} ↑</option>
              <option value="status-desc">{t("builder.grade.sort.status")} ↓</option>
            </select>
          </div>

          {/* Next Ungraded Button */}
          {nextUngradedId && (
            <button
              type="button"
              className={styles.nextUngradedButton}
              onClick={() => setActiveSubmissionId(nextUngradedId)}
            >
              {direction === "rtl" ? "←" : "→"} {t("builder.grade.filter.ungraded")}
            </button>
          )}
          
          <ul className={styles.summaryList}>
            {filteredSummaries.map((summary) => (
              <li key={summary.id}>
                <button
                  type="button"
                  className={summary.id === activeSubmissionId ? `${styles.summaryButton} ${styles.active}` : styles.summaryButton}
                  onClick={() => setActiveSubmissionId(summary.id)}
                >
                  <span className={styles.summaryPrimary}>{summary.studentId}</span>
                  <StatusBadge status={summary.status} t={t} />
                  <span className={styles.summaryMeta}>
                    {SCORE_FORMATTER.format(summary.overallScore)} pts
                  </span>
                  <span className={styles.summaryProgress}>{Math.round(summary.progress * 100)}%</span>
                </button>
              </li>
            ))}
            {filteredSummaries.length === 0 && (
              <li className={styles.placeholder}>{t("builder.grade.empty.noSubmissions")}</li>
            )}
          </ul>
            </>
          ) : (
            <>
              <h3>{t("builder.grade.questions")}</h3>
              <ul className={styles.summaryList}>
                {questionsQuery.data?.map((question) => {
                  const stats = questionStats.get(question.id);
                  const isGraded = stats ? stats.gradedCount === stats.answeredCount && stats.answeredCount > 0 : false;
                  const isPartiallyGraded = stats ? stats.gradedCount > 0 && stats.gradedCount < stats.answeredCount : false;
                  const statusClass = isGraded ? styles.questionStatusGraded : isPartiallyGraded ? styles.questionStatusPartial : styles.questionStatusUngraded;
                  
                  return (
                    <li key={question.id}>
                      <button
                        type="button"
                        className={question.id === activeQuestionId ? `${styles.summaryButton} ${styles.active}` : styles.summaryButton}
                        onClick={() => setActiveQuestionId(question.id)}
                      >
                        <span className={styles.summaryPrimary}>
                          {question.prompt.length > 50 ? `${question.prompt.substring(0, 50)}...` : question.prompt}
                        </span>
                        <span className={styles.summaryMeta}>
                          {stats?.answeredCount ?? 0} {t("builder.grade.answered")} · {t("builder.grade.avgScore")}: {SCORE_FORMATTER.format(stats?.averageScore ?? 0)}/{question.points ?? 0}
                        </span>
                        <span className={`${styles.summaryProgress} ${statusClass}`}>
                          {stats?.gradedCount ?? 0}/{stats?.answeredCount ?? 0} {t("builder.grade.gradedCount")}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </aside>

        <section className={styles.detailPane}>
          {viewMode === "student" ? (
            !submission ? (
            <div className={styles.placeholder}>{t("builder.grade.submission.select")}</div>
          ) : (
            <div className={styles.detailInner}>
              <header className={styles.detailHeader}>
                <div>
                  <h3>{t("builder.grade.submission.by", { studentId: submission.studentId })}</h3>
                  <p className={styles.detailMeta}>
                    {t("builder.grade.submission.attempt", { number: submission.attemptNumber })} · {t("builder.grade.submission.status", { status: submission.status })}
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.saveButton}
                  onClick={() => gradeMutation.mutate()}
                  disabled={gradeMutation.isPending}
                >
                  {gradeMutation.isPending ? t("builder.grade.submission.saving") : t("builder.grade.submission.save")}
                </button>
              </header>

              <div className={styles.progressGrid}>
                {(progress ?? []).map((item) => {
                  const question = questionsById.get(item.questionId);
                  return (
                    <div key={item.questionId} className={styles.progressCard}>
                      <span className={styles.progressTitle}>{question?.prompt ?? item.questionId}</span>
                      <span className={styles.progressStats}>
                        {t("builder.grade.attempts")}: {item.attempts} · {t("builder.grade.score.label")}: {item.earnedScore ?? 0}/{question?.points ?? 0}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className={styles.questionsList}>
                {Object.entries(submission.answers).map(([questionId, answer]) => {
                  const question = questionsById.get(questionId);
                  const draft = gradeDraft[questionId];
                  const sqlAnswer = answer as SqlAnswer;
                  return (
                    <article key={questionId} className={styles.questionCard}>
                      <header>
                        <h4>{question?.prompt ?? `Question ${questionId}`}</h4>
                        <span className={styles.questionPoints}>{draft?.score ?? 0}/{question?.points ?? 0} pts</span>
                      </header>
                      <p className={styles.questionInstructions}>{question?.instructions}</p>
                      <pre className={styles.sqlBlock}>{sqlAnswer.sql || t("builder.grade.noResponse")}</pre>
                      {sqlAnswer.resultPreview?.rows?.length ? (
                        <div className={styles.resultPreview}>
                          <strong>{t("builder.grade.resultPreview")}</strong>
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
                          {t("builder.grade.score.label")}
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
                          {t("builder.grade.notes.label")}
                          <textarea
                            placeholder={t("builder.grade.notes.placeholder")}
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
                  <strong>{t("builder.grade.totalScore")}:</strong>
                  <span>
                    {SCORE_FORMATTER.format(
                      Object.values(gradeDraft).reduce((sum, entry) => sum + (entry.score ?? 0), 0),
                    )}
                    /{totalPoints}
                  </span>
                </div>
              </div>
            </div>
          )
          ) : (
            !activeQuestionId ? (
              <div className={styles.placeholder}>{t("builder.grade.question.select")}</div>
            ) : (
              <div className={styles.detailInner}>
                {(() => {
                  const question = questionsById.get(activeQuestionId);
                  const allSubmissions = allSubmissionsQuery.data ?? [];
                  const submissionsForQuestion = allSubmissions.filter(
                    (s) => s.answers[activeQuestionId] as SqlAnswer | undefined
                  );
                  const questionDraft = questionGradeDraft[activeQuestionId] ?? {};
                  const stats = questionStats.get(activeQuestionId);

                  return (
                    <>
                      <header className={styles.detailHeader}>
                        <div>
                          <h3>{question?.prompt ?? `Question ${activeQuestionId}`}</h3>
                          <p className={styles.detailMeta}>
                            {question?.points ?? 0} {t("builder.grade.question.points", { points: "" }).replace("{points} ", "")} · {submissionsForQuestion.length} {t("builder.grade.question.answered", { count: "" }).replace("{count} ", "")}
                          </p>
                          <p className={styles.questionInstructions}>{question?.instructions}</p>
                        </div>
                        <div className={styles.bulkControls}>
                          <button
                            type="button"
                            className={styles.bulkButton}
                            onClick={toggleAllStudents}
                          >
                            {selectedStudentIds.size === submissionsForQuestion.length ? t("builder.grade.question.deselectAll") : t("builder.grade.question.selectAll")}
                          </button>
                          <button
                            type="button"
                            className={styles.saveButton}
                            onClick={() => gradeMutation.mutate()}
                            disabled={gradeMutation.isPending}
                          >
                            {gradeMutation.isPending ? t("builder.grade.submission.saving") : `${t("builder.grade.submission.save")} (${selectedStudentIds.size || submissionsForQuestion.length})`}
                          </button>
                        </div>
                      </header>

                      {/* Bulk Grading Controls */}
                      {selectedStudentIds.size > 0 && (
                        <div className={styles.bulkGradingPanel}>
                          <h4>{t("builder.grade.question.bulkEdit", { count: selectedStudentIds.size })}</h4>
                          <div className={styles.bulkGradingControls}>
                            <label>
                              {t("builder.grade.question.bulkScore")}
                              <input
                                type="number"
                                min={0}
                                max={question?.points ?? 100}
                                step={0.5}
                                placeholder="Score"
                                onChange={(e) => handleBulkScoreChange(Number(e.target.value))}
                              />
                              {/* Quick Score Presets */}
                              <div className={styles.quickScorePresets}>
                                <button
                                  type="button"
                                  className={`${styles.presetButton} ${styles.danger}`}
                                  onClick={() => handleQuickScorePreset(0)}
                                >
                                  0%
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.presetButton} ${styles.warning}`}
                                  onClick={() => handleQuickScorePreset(50)}
                                >
                                  50%
                                </button>
                                <button
                                  type="button"
                                  className={styles.presetButton}
                                  onClick={() => handleQuickScorePreset(75)}
                                >
                                  75%
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.presetButton} ${styles.success}`}
                                  onClick={() => handleQuickScorePreset(100)}
                                >
                                  100%
                                </button>
                              </div>
                            </label>
                            <label className={styles.notesField}>
                              {t("builder.grade.question.bulkNotes")}
                              <textarea
                                placeholder={t("builder.grade.notes.placeholder")}
                                onChange={(e) => handleBulkNotesChange(e.target.value)}
                              />
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Student Submissions Grid */}
                      <div className={styles.studentSubmissionsGrid}>
                        {submissionsForQuestion.map((submission) => {
                          const answer = submission.answers[activeQuestionId] as SqlAnswer;
                          const draft = questionDraft[submission.id];
                          const isSelected = selectedStudentIds.has(submission.id);
                          
                          return (
                            <article key={submission.id} className={`${styles.studentSubmissionCard} ${isSelected ? styles.selected : ""}`}>
                              <div className={styles.cardHeader}>
                                <label className={styles.checkboxLabel}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleStudentSelection(submission.id)}
                                  />
                                  <strong>{submission.studentId}</strong>
                                </label>
                                <span className={styles.cardStatus}>{submission.status}</span>
                              </div>
                              
                              <div className={styles.cardContent}>
                                <pre className={styles.sqlBlock}>{answer?.sql || t("builder.grade.noResponse")}</pre>
                                
                                {answer?.resultPreview?.rows?.length ? (
                                  <div className={styles.resultPreview}>
                                    <strong>{t("builder.grade.resultPreview")}</strong>
                                    <table>
                                      <thead>
                                        <tr>
                                          {answer.resultPreview.columns.map((column) => (
                                            <th key={column}>{column}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {answer.resultPreview.rows.slice(0, 3).map((row, rowIndex) => (
                                          <tr key={rowIndex}>
                                            {answer.resultPreview!.columns.map((column) => (
                                              <td key={column}>{String(row[column] ?? "")}</td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : null}

                                {answer?.feedback?.autoNotes && (
                                  <div className={styles.autoFeedback}>
                                    <strong>{t("builder.grade.notes.autoFeedback")}:</strong> {answer.feedback.autoNotes}
                                  </div>
                                )}

                                <div className={styles.cardGradeControls}>
                                  <label>
                                    {t("builder.grade.score.label")}
                                    <input
                                      type="number"
                                      min={0}
                                      max={question?.points ?? 100}
                                      step={0.5}
                                      value={draft?.score ?? 0}
                                      onChange={(event) =>
                                        setQuestionGradeDraft((prev) => ({
                                          ...prev,
                                          [activeQuestionId]: {
                                            ...prev[activeQuestionId],
                                            [submission.id]: {
                                              ...prev[activeQuestionId]?.[submission.id],
                                              score: Number(event.target.value),
                                            },
                                          },
                                        }))
                                      }
                                    />
                                    <span className={styles.pointsLabel}>/ {question?.points ?? 0}</span>
                                  </label>
                                  <label className={styles.notesField}>
                                    {t("builder.grade.notes.label")}
                                    <textarea
                                      placeholder={t("builder.grade.notes.placeholder")}
                                      value={draft?.instructorNotes ?? ""}
                                      onChange={(event) =>
                                        setQuestionGradeDraft((prev) => ({
                                          ...prev,
                                          [activeQuestionId]: {
                                            ...prev[activeQuestionId],
                                            [submission.id]: {
                                              ...prev[activeQuestionId]?.[submission.id],
                                              instructorNotes: event.target.value,
                                            },
                                          },
                                        }))
                                      }
                                    />
                                  </label>
                                </div>

                                <div className={styles.cardMeta}>
                                  <span>{t("builder.grade.attempts")}: {answer?.executionCount ?? 0}</span>
                                  {answer?.lastExecutedAt && (
                                    <span>{t("builder.grade.lastExecuted")}: {new Date(answer.lastExecutedAt).toLocaleString()}</span>
                                  )}
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
            )
          )}
        </section>

        <aside className={styles.analyticsPane}>
          {viewMode === "student" ? (
            <>
          <h3>{t("builder.grade.analytics.title")}</h3>
          <ul className={styles.analyticsList}>
            {analytics.length === 0 && <li>{t("builder.grade.noEvents")}</li>}
            {analytics.map((event) => (
              <li key={event.id}>
                <span className={styles.analyticsType}>{event.type}</span>
                <span className={styles.analyticsMeta}>
                  {new Date(event.createdAt).toLocaleString()} · actor: {event.actorId}
                </span>
              </li>
            ))}
          </ul>
            </>
          ) : (
            (() => {
              const question = questionsById.get(activeQuestionId);
              const stats = questionStats.get(activeQuestionId);
              const allSubmissions = allSubmissionsQuery.data ?? [];
              const submissionsForQuestion = allSubmissions.filter(
                (s) => s.answers[activeQuestionId] as SqlAnswer | undefined
              );

              // Calculate score distribution
              const scoreDistribution = submissionsForQuestion.reduce((acc, submission) => {
                const answer = submission.answers[activeQuestionId] as SqlAnswer | undefined;
                const score = answer?.feedback?.score ?? 0;
                const percentage = question ? Math.round((score / question.points) * 100 / 10) * 10 : 0;
                acc[percentage] = (acc[percentage] || 0) + 1;
                return acc;
              }, {} as Record<number, number>);

              return (
                <>
                  <h3>{t("builder.grade.analytics.question.title")}</h3>
                  {stats && (
                    <div className={styles.questionAnalytics}>
                      <div className={styles.analyticsMetric}>
                        <span className={styles.metricLabel}>{t("builder.grade.analytics.studentsAnswered")}:</span>
                        <span className={styles.metricValue}>{stats.answeredCount}</span>
                      </div>
                      <div className={styles.analyticsMetric}>
                        <span className={styles.metricLabel}>{t("builder.grade.analytics.averageScore")}:</span>
                        <span className={styles.metricValue}>
                          {SCORE_FORMATTER.format(stats.averageScore)} / {stats.totalPoints}
                        </span>
                      </div>
                      <div className={styles.analyticsMetric}>
                        <span className={styles.metricLabel}>{t("builder.grade.analytics.graded")}:</span>
                        <span className={styles.metricValue}>{stats.gradedCount} / {stats.answeredCount}</span>
                      </div>
                      
                      <div className={styles.scoreDistribution}>
                        <h4>{t("builder.grade.analytics.scoreDistribution")}</h4>
                        <div className={styles.distributionBars}>
                          {Object.entries(scoreDistribution)
                            .sort(([a], [b]) => Number(a) - Number(b))
                            .map(([percentage, count]) => (
                              <div key={percentage} className={styles.distributionBar}>
                                <div className={styles.barLabel}>{percentage}%</div>
                                <div className={styles.barContainer}>
                                  <div
                                    className={styles.barFill}
                                    style={{
                                      height: `${(count / submissionsForQuestion.length) * 100}%`,
                                    }}
                                  />
                                </div>
                                <div className={styles.barCount}>{count}</div>
                              </div>
                            ))}
                        </div>
                      </div>

                      <div className={styles.averageAttempts}>
                        <h4>{t("builder.grade.analytics.averageAttempts")}</h4>
                        <span className={styles.metricValue}>
                          {submissionsForQuestion.length > 0
                            ? (
                                submissionsForQuestion.reduce((sum, s) => {
                                  const answer = s.answers[activeQuestionId] as SqlAnswer | undefined;
                                  return sum + (answer?.executionCount ?? 0);
                                }, 0) / submissionsForQuestion.length
                              ).toFixed(1)
                            : 0}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              );
            })()
          )}
        </aside>
      </div>

      {/* Keyboard Shortcuts Help */}
      {showKeyboardShortcuts && (
        <div className={styles.keyboardShortcuts}>
          <span><kbd>Ctrl</kbd>+<kbd>S</kbd> {t("builder.grade.keyboard.save")}</span>
          <span><kbd>←</kbd>/<kbd>→</kbd> {t("builder.grade.keyboard.prev")}/{t("builder.grade.keyboard.next")}</span>
          <span><kbd>?</kbd> {t("builder.grade.keyboard.shortcuts")}</span>
          <span><kbd>Esc</kbd> סגירה</span>
        </div>
      )}
    </div>
  );
}
