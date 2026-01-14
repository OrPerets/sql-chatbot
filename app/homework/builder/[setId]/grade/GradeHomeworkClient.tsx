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
import { exportHomeworkGradesToExcel } from "@/lib/excel-export";

// Comment Bank types
interface CommentBankEntry {
  id: string;
  homeworkSetId: string;
  questionId: string;
  comment: string;
  score: number;
  maxScore: number;
  category?: string;
  usageCount: number;
}

interface GradeHomeworkClientProps {
  setId: string;
}

interface GradeDraftEntry {
  score: number;
  instructorNotes?: string;
  aiSuggested?: boolean;  // Track if this was AI-suggested
}

// AI Grading types
interface AIGradingResult {
  questionId: string;
  score: number;
  comment: string;
  confidence: number;
  breakdown: {
    queryCorrectness: number;
    outputCorrectness: number;
  };
}

interface BulkGradingResult {
  submissionId: string;
  studentId: string;
  results: AIGradingResult[];
  totalScore: number;
  gradedAt: string;
}

interface AIEvaluateResponse {
  success: boolean;
  results: BulkGradingResult[];
  totalSubmissions: number;
  totalQuestionsGraded: number;
  errors?: string[];
}

// Test AI types
interface TestAIResult {
  submissionId: string;
  studentId: string;
  studentName?: string;
  studentIdNumber?: string;
  sql: string;
  result: {
    score: number;
    comment: string;
    confidence: number;
    breakdown: {
      queryCorrectness: number;
      outputCorrectness: number;
    };
  };
}

interface TestAIResponse {
  success: boolean;
  questionId: string;
  questionPrompt: string;
  results: TestAIResult[];
  errors?: string[];
}

type GradeDraft = Record<string, GradeDraftEntry>;
type QuestionGradeDraft = Record<string, Record<string, GradeDraftEntry>>; // questionId -> submissionId -> grade

type ViewMode = "student" | "question";
type FilterStatus = "all" | "graded" | "ungraded" | "partial";
type SortField = "name" | "score" | "status" | "date";
type SortDirection = "asc" | "desc";

// Status Badge Component
// Comment Bank Dropdown Component
function CommentBankDropdown({
  questionId,
  comments,
  onApply,
  onSave,
  onDelete,
  isOpen,
  onToggle,
  direction,
}: {
  questionId: string;
  comments: CommentBankEntry[];
  onApply: (comment: CommentBankEntry) => void;
  onSave: () => void;
  onDelete: (commentId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  direction: "rtl" | "ltr";
}) {
  const questionComments = comments.filter((c) => c.questionId === questionId);

  return (
    <div className={styles.commentBankContainer}>
      <div className={styles.commentBankButtons}>
        <button
          type="button"
          className={styles.commentBankToggle}
          onClick={onToggle}
          title="הערות נפוצות"
        >
          📝 {questionComments.length > 0 ? `(${questionComments.length})` : ""}
        </button>
        <button
          type="button"
          className={styles.saveCommentButton}
          onClick={onSave}
          title="שמור הערה לבנק"
        >
          💾
        </button>
      </div>
      {isOpen && (
        <div className={styles.commentBankDropdown} dir={direction}>
          <div className={styles.commentBankHeader}>
            <strong>הערות נפוצות</strong>
            <button type="button" onClick={onToggle} className={styles.closeButton}>✕</button>
          </div>
          {questionComments.length === 0 ? (
            <p className={styles.noComments}>אין הערות שמורות לשאלה זו</p>
          ) : (
            <ul className={styles.commentBankList}>
              {questionComments.map((comment) => (
                <li key={comment.id} className={styles.commentBankItem}>
                  <div className={styles.commentContent}>
                    <span className={styles.commentScore}>{comment.score}/{comment.maxScore}</span>
                    <span className={styles.commentText}>{comment.comment}</span>
                    {comment.usageCount > 0 && (
                      <span className={styles.commentUsage}>({comment.usageCount} שימושים)</span>
                    )}
                  </div>
                  <div className={styles.commentActions}>
                    <button
                      type="button"
                      className={styles.applyCommentButton}
                      onClick={() => onApply(comment)}
                    >
                      החל
                    </button>
                    <button
                      type="button"
                      className={styles.deleteCommentButton}
                      onClick={() => onDelete(comment.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

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
  const [isExporting, setIsExporting] = useState(false);
  
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

  // Comment Bank state
  const [showCommentBank, setShowCommentBank] = useState<string | null>(null); // questionId when showing
  const [savingComment, setSavingComment] = useState<string | null>(null); // questionId when saving

  // AI Grading state
  const [isAIGrading, setIsAIGrading] = useState(false);
  const [aiGradingProgress, setAIGradingProgress] = useState<{ current: number; total: number } | null>(null);
  const [showAIGradingDialog, setShowAIGradingDialog] = useState(false);
  const [aiGradingInstructions, setAIGradingInstructions] = useState("");
  
  // Test AI state
  const [showTestAIDialog, setShowTestAIDialog] = useState(false);
  const [isTestingAI, setIsTestingAI] = useState(false);
  const [testAIResults, setTestAIResults] = useState<TestAIResponse | null>(null);
  const [selectedTestQuestionId, setSelectedTestQuestionId] = useState<string | null>(null);

  const homeworkQuery = useQuery({
    queryKey: ["homework", setId],
    queryFn: () => getHomeworkSet(setId, "builder"),
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

  // Comment Bank query
  const commentBankQuery = useQuery({
    queryKey: ["comment-bank", setId],
    queryFn: async () => {
      const response = await fetch(`/api/comment-bank?homeworkSetId=${setId}`);
      if (!response.ok) throw new Error("Failed to fetch comment bank");
      return response.json() as Promise<CommentBankEntry[]>;
    },
  });

  // Group comments by questionId
  const commentsByQuestion = useMemo(() => {
    const map = new Map<string, CommentBankEntry[]>();
    (commentBankQuery.data ?? []).forEach((comment) => {
      const existing = map.get(comment.questionId) ?? [];
      existing.push(comment);
      map.set(comment.questionId, existing);
    });
    return map;
  }, [commentBankQuery.data]);

  // Save comment to bank mutation
  const saveCommentMutation = useMutation({
    mutationFn: async (params: { questionId: string; comment: string; score: number; maxScore: number }) => {
      const response = await fetch("/api/comment-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeworkSetId: setId,
          questionId: params.questionId,
          comment: params.comment,
          score: params.score,
          maxScore: params.maxScore,
          createdBy: "instructor", // TODO: Get from auth context
        }),
      });
      if (!response.ok) throw new Error("Failed to save comment");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comment-bank", setId] });
      setSavingComment(null);
      setStatusMessage("ההערה נשמרה בבנק ההערות");
    },
  });

  // Use comment (increment usage count) mutation
  const useCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const response = await fetch("/api/comment-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "use", commentId }),
      });
      if (!response.ok) throw new Error("Failed to update usage count");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comment-bank", setId] });
    },
  });

  // Delete comment from bank mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const response = await fetch(`/api/comment-bank?commentId=${commentId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete comment");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comment-bank", setId] });
      setStatusMessage("ההערה נמחקה מבנק ההערות");
    },
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

  const questionsById = useMemo(() => {
    const map = new Map<string, Question>();
    (questionsQuery.data ?? []).forEach((question) => map.set(question.id, question));
    return map;
  }, [questionsQuery.data]);

  // Memoize summaries to avoid dependency issues
  const summaries = useMemo(() => summariesQuery.data ?? [], [summariesQuery.data]);

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
    
    // Apply search filter - search by studentId, studentName, and studentIdNumber
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(summary => 
        summary.studentId.toLowerCase().includes(query) ||
        (summary.studentName && summary.studentName.toLowerCase().includes(query)) ||
        (summary.studentIdNumber && summary.studentIdNumber.includes(query))
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
  }, [viewMode, activeSubmissionId, activeQuestionId, questionsQuery.data, gradeMutation, filteredSummaries]);

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
      // Use saved score if it exists, otherwise start with 0
      draft[questionId] = {
        score: sqlAnswer.feedback?.score ?? 0,
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
          // Use saved score if it exists, otherwise start with 0
          const instructorNotes = answer.feedback?.instructorNotes ?? "";
          if (instructorNotes) {
            console.log(`[Load Draft] Question ${activeQuestionId}, Submission ${submission.id}: Found instructorNotes:`, instructorNotes.substring(0, 100));
          }
          draft[submission.id] = {
            score: answer.feedback?.score ?? 0,
            instructorNotes,
          };
        }
      });
      
      setQuestionGradeDraft((prev) => ({
        ...prev,
        [activeQuestionId]: draft,
      }));
    }
  }, [viewMode, submissionQuery.data, allSubmissionsQuery.data, activeQuestionId, questionsById]);

  // Auto-save effect - moved after gradeMutation definition
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
  }, [gradeDraft, questionGradeDraft, viewMode, gradeMutation]);

  const publishMutation = useMutation({
    mutationFn: () => publishHomeworkGrades(setId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["submissions", setId, "summaries"] });
      queryClient.invalidateQueries({ queryKey: ["analytics", setId] });
      setStatusMessage(result.message);
    },
  });

  // AI Grading mutation
  const aiGradingMutation = useMutation({
    mutationFn: async (additionalInstructions?: string) => {
      setIsAIGrading(true);
      setAIGradingProgress({ current: 0, total: 0 });
      
      try {
        // Create an AbortController for timeout handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 minute timeout
        
      const response = await fetch("/api/grading/ai-evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          homeworkSetId: setId,
          additionalGradingInstructions: additionalInstructions || undefined
        }),
        signal: controller.signal,
      });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
          throw new Error(error.error || error.details || "Failed to evaluate submissions");
        }
        
        return response.json() as Promise<AIEvaluateResponse>;
      } catch (error: any) {
        if (error.name === 'AbortError') {
          throw new Error("הבקשה ארכה זמן רב מדי. נסה שוב או בדוק פחות הגשות בבת אחת.");
        }
        if (error.message) {
          throw error;
        }
        throw new Error(`שגיאה בהערכת AI: ${error.message || "Unknown error"}`);
      }
    },
    onSuccess: async (data) => {
      if (!data.success || data.results.length === 0) {
        setStatusMessage("אין הגשות לבדיקה או שכולן כבר נבדקו");
        return;
      }

      // Save AI results directly to database
      try {
        const allSubmissions = allSubmissionsQuery.data ?? [];
        const submissionsMap = new Map(allSubmissions.map(s => [s.id, s]));
        const questionsMap = new Map((questionsQuery.data ?? []).map(q => [q.id, q]));

        // Save each submission with AI grades
        const savePromises = data.results.map(async (result) => {
          try {
            const submission = submissionsMap.get(result.submissionId);
            if (!submission) {
              console.warn(`[AI Grading] Submission ${result.submissionId} not found in submissionsMap`);
              return { success: false, submissionId: result.submissionId, error: "Submission not found" };
            }

          // Build updated answers with AI grades
          const updatedAnswers: Submission["answers"] = { ...submission.answers };

          for (const aiResult of result.results) {
            const question = questionsMap.get(aiResult.questionId);
            if (!question) continue;

            const answer = submission.answers[aiResult.questionId] as SqlAnswer | undefined;
            if (!answer) continue;

            // Use AI comment if there's no existing instructor note (or if it's empty)
            const existingInstructorNotes = answer.feedback?.instructorNotes?.trim();
            const aiComment = aiResult.comment?.trim() || "";
            
            console.log(`[AI Grading] Question ${aiResult.questionId}, Submission ${result.submissionId}:`, {
              existingInstructorNotes: existingInstructorNotes || "(empty)",
              aiComment: aiComment || "(EMPTY - AI didn't return comment!)",
              aiCommentLength: aiComment.length,
              score: aiResult.score,
              fullAiResult: aiResult, // Log full result to see what AI returned
            });
            
            if (!aiComment) {
              console.warn(`⚠️ [AI Grading] WARNING: AI comment is empty for question ${aiResult.questionId}, submission ${result.submissionId}`);
            }

            // Determine what to save - prioritize AI comment if no existing note
            // Only use existing notes if they're not empty, otherwise use AI comment
            const notesToSave = (existingInstructorNotes && existingInstructorNotes.trim()) 
              ? existingInstructorNotes 
              : (aiComment && aiComment.trim() ? aiComment : "");
            
            updatedAnswers[aiResult.questionId] = {
              ...answer,
              feedback: {
                questionId: aiResult.questionId,
                score: aiResult.score,
                // Keep existing autoNotes from SQL execution (if any), but don't overwrite with AI comment
                autoNotes: answer.feedback?.autoNotes || "",
                // Put AI comment in instructorNotes - use AI comment if no existing note or if existing is empty
                instructorNotes: notesToSave,
                rubricBreakdown: answer.feedback?.rubricBreakdown || [],
              },
            };
            
            // Verify what we're about to save
            if (!notesToSave || !notesToSave.trim()) {
              console.error(`❌ [AI Grading] ERROR: No instructorNotes to save for question ${aiResult.questionId}, submission ${result.submissionId}`);
              console.error(`   existingInstructorNotes: "${existingInstructorNotes}" (length: ${existingInstructorNotes?.length || 0})`);
              console.error(`   aiComment: "${aiComment}" (length: ${aiComment?.length || 0})`);
              console.error(`   aiResult object:`, JSON.stringify(aiResult, null, 2));
            } else {
              console.log(`✅ [AI Grading] Will save instructorNotes (${notesToSave.length} chars) for question ${aiResult.questionId}:`, notesToSave.substring(0, 100));
            }
          }

          // Calculate overall score
          const overallScore = Object.values(updatedAnswers).reduce(
            (sum, ans) => sum + (ans.feedback?.score ?? 0),
            0
          );

          // Verify what we're about to save before sending to DB
          const answersWithFeedback = Object.entries(updatedAnswers).filter(([_, ans]) => {
            const hasNotes = ans.feedback?.instructorNotes?.trim();
            if (hasNotes) {
              console.log(`[AI Grading] Answer ${Object.keys(updatedAnswers).indexOf(_)} has instructorNotes:`, {
                questionId: _,
                notesLength: hasNotes.length,
                notesPreview: hasNotes.substring(0, 50),
              });
            }
            return !!hasNotes;
          });
          console.log(`[AI Grading] Submission ${result.submissionId}: ${answersWithFeedback.length} answers with instructorNotes before save`);
          
          // Log the exact structure we're sending
          console.log(`[AI Grading] Sending to gradeSubmission:`, {
            submissionId: result.submissionId,
            totalAnswers: Object.keys(updatedAnswers).length,
            answersWithNotes: answersWithFeedback.length,
            sampleAnswerStructure: answersWithFeedback[0] ? {
              questionId: answersWithFeedback[0][0],
              feedback: answersWithFeedback[0][1].feedback,
            } : null,
          });
          
          // Save to database
          const saved = await gradeSubmission(result.submissionId, {
            answers: updatedAnswers,
            overallScore,
            status: "graded",
          });
          
          // Log what was actually saved for debugging
          if (saved) {
            const savedAnswersWithNotes = Object.entries(saved.answers).filter(([_, ans]) => ans.feedback?.instructorNotes);
            console.log(`[AI Grading] Saved submission ${result.submissionId}:`, {
              totalAnswers: Object.keys(saved.answers).length,
              answersWithInstructorNotes: savedAnswersWithNotes.length,
              sampleAnswer: savedAnswersWithNotes[0] ? {
                questionId: savedAnswersWithNotes[0][0],
                hasFeedback: !!savedAnswersWithNotes[0][1].feedback,
                instructorNotes: savedAnswersWithNotes[0][1].feedback?.instructorNotes?.substring(0, 100),
                score: savedAnswersWithNotes[0][1].feedback?.score,
              } : null,
            });
            
            if (savedAnswersWithNotes.length === 0) {
              console.error(`❌ [AI Grading] CRITICAL: No instructorNotes found in saved submission ${result.submissionId}!`);
              console.error(`   Expected ${answersWithFeedback.length} answers with notes, but got 0 after save`);
            }
          } else {
            console.error(`❌ [AI Grading] Failed to save submission ${result.submissionId} - gradeSubmission returned null`);
            return { success: false, submissionId: result.submissionId, error: "gradeSubmission returned null" };
          }
          
          return { success: true, submissionId: result.submissionId, saved };
          } catch (error) {
            console.error(`❌ [AI Grading] Error saving submission ${result.submissionId}:`, error);
            return { success: false, submissionId: result.submissionId, error: error instanceof Error ? error.message : String(error) };
          }
        });

        // Use allSettled instead of all to continue even if some fail
        const saveResults = await Promise.allSettled(savePromises);
        const successful = saveResults.filter(r => r.status === 'fulfilled' && r.value && r.value.success).length;
        const failed = saveResults.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && (!r.value || !r.value.success)));
        
        console.log(`[AI Grading] Save results: ${successful} successful, ${failed.length} failed out of ${saveResults.length} total`);
        
        // Log failed submissions
        failed.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(`[AI Grading] Promise rejected for submission at index ${index}:`, result.reason);
          } else if (result.status === 'fulfilled' && result.value && !result.value.success) {
            console.error(`[AI Grading] Failed to save submission ${result.value.submissionId}:`, result.value.error);
          } else if (result.status === 'fulfilled' && !result.value) {
            console.error(`[AI Grading] Unexpected: fulfilled promise with null value at index ${index}`);
          }
        });

        // Also update local drafts for UI
        const newQuestionGradeDraft: QuestionGradeDraft = { ...questionGradeDraft };
        const newGradeDraft: GradeDraft = { ...gradeDraft };

        for (const result of data.results) {
          for (const aiResult of result.results) {
            // Update question-based draft - use AI comment directly since we just saved it
            if (!newQuestionGradeDraft[aiResult.questionId]) {
              newQuestionGradeDraft[aiResult.questionId] = {};
            }
            const submission = submissionsMap.get(result.submissionId);
            const existingAnswer = submission?.answers[aiResult.questionId] as SqlAnswer | undefined;
            const existingInstructorNotes = existingAnswer?.feedback?.instructorNotes?.trim();
            const aiComment = aiResult.comment?.trim() || "";
            
            newQuestionGradeDraft[aiResult.questionId][result.submissionId] = {
              score: aiResult.score,
              // Use AI comment if no existing note, otherwise keep existing
              instructorNotes: existingInstructorNotes || aiComment,
              aiSuggested: !existingInstructorNotes, // Only mark as AI if there was no existing note
            };

            // If this is the active submission, also update the student draft
            if (result.submissionId === activeSubmissionId) {
              newGradeDraft[aiResult.questionId] = {
                score: aiResult.score,
                // Use AI comment if no existing note, otherwise keep existing
                instructorNotes: existingInstructorNotes || aiComment,
                aiSuggested: !existingInstructorNotes, // Only mark as AI if there was no existing note
              };
            }
          }
        }

        setQuestionGradeDraft(newQuestionGradeDraft);
        setGradeDraft(newGradeDraft);

        // Refresh submission data - wait a bit to ensure DB write is complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        queryClient.invalidateQueries({ queryKey: ["submissions", setId, "summaries"] });
        queryClient.invalidateQueries({ queryKey: ["submissions", setId, "all"] });
        queryClient.invalidateQueries({ queryKey: ["submission"] });
        
        // Force refetch to get fresh data
        await queryClient.refetchQueries({ queryKey: ["submissions", setId, "all"] });
        
        console.log(`[AI Grading] Refreshed queries, data should be reloaded`);

        setStatusMessage(`✨ הערכת AI הושלמה ונשמרה: ${data.totalSubmissions} הגשות, ${data.totalQuestionsGraded} תשובות. ניתן לבדוק ולעדכן את הציונים בממשק.`);
      } catch (error) {
        console.error("Error saving AI grades:", error);
        setStatusMessage(`שגיאה בשמירת ציוני AI: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    },
    onError: (error: Error) => {
      setStatusMessage(`שגיאה בהערכת AI: ${error.message}`);
    },
    onSettled: () => {
      setIsAIGrading(false);
      setAIGradingProgress(null);
    },
  });

  // Test AI mutation
  const testAIMutation = useMutation({
    mutationFn: async (questionId: string) => {
      setIsTestingAI(true);
      setTestAIResults(null);
      
      const response = await fetch("/api/grading/test-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          homeworkSetId: setId,
          questionId
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to test AI evaluation");
      }
      
      return response.json() as Promise<TestAIResponse>;
    },
    onSuccess: (data) => {
      setTestAIResults(data);
    },
    onError: (error: Error) => {
      setStatusMessage(`שגיאה בבדיקת AI: ${error.message}`);
    },
    onSettled: () => {
      setIsTestingAI(false);
    },
  });

  const handleExportGrades = useCallback(async () => {
    if (isExporting) return;

    try {
      setIsExporting(true);
      const questions = questionsQuery.data ?? [];
      const summaries = summariesQuery.data ?? [];

      if (questions.length === 0 || summaries.length === 0) {
        setStatusMessage("אין נתונים זמינים לייצוא");
        return;
      }

      const submissions = await Promise.all(
        summaries.map((summary) => getSubmissionById(summary.id).catch(() => null))
      );

      const validSubmissions = submissions.filter((submission): submission is Submission => submission !== null);
      const datePart = new Date().toISOString().split("T")[0];

      exportHomeworkGradesToExcel({
        homeworkTitle: homeworkQuery.data?.title ?? setId,
        questions,
        submissions: validSubmissions,
        summaries, // Include summaries with student names and ID numbers
        fileName: `תרגיל-3-הגשות-${datePart}.xlsx`,
      });

      setStatusMessage("קובץ הציונים נוצר בהצלחה");
    } catch (error) {
      console.error("Failed to export grades", error);
      setStatusMessage("אירעה שגיאה בעת ייצוא הציונים");
    } finally {
      setIsExporting(false);
    }
  }, [homeworkQuery.data?.title, isExporting, questionsQuery.data, setId, summariesQuery.data]);

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

  // Apply a saved comment from the comment bank
  const applyCommentFromBank = useCallback((questionId: string, comment: CommentBankEntry, submissionId?: string) => {
    if (viewMode === "student") {
      setGradeDraft((prev) => ({
        ...prev,
        [questionId]: {
          ...prev[questionId],
          score: comment.score,
          instructorNotes: comment.comment,
        },
      }));
    } else if (viewMode === "question" && submissionId) {
      setQuestionGradeDraft((prev) => ({
        ...prev,
        [questionId]: {
          ...prev[questionId],
          [submissionId]: {
            ...prev[questionId]?.[submissionId],
            score: comment.score,
            instructorNotes: comment.comment,
          },
        },
      }));
    }
    useCommentMutation.mutate(comment.id);
    setShowCommentBank(null);
  }, [viewMode, useCommentMutation]);

  // Save current comment to the comment bank
  const saveCurrentCommentToBank = useCallback((questionId: string, submissionId?: string) => {
    const question = questionsById.get(questionId);
    const maxScore = question?.points ?? 10;
    
    let comment: string;
    let score: number;
    
    if (viewMode === "student") {
      const draft = gradeDraft[questionId];
      comment = draft?.instructorNotes ?? "";
      score = draft?.score ?? 0;
    } else if (submissionId) {
      const draft = questionGradeDraft[questionId]?.[submissionId];
      comment = draft?.instructorNotes ?? "";
      score = draft?.score ?? 0;
    } else {
      return;
    }
    
    if (!comment.trim()) {
      setStatusMessage("אין הערה לשמירה");
      return;
    }
    
    saveCommentMutation.mutate({ questionId, comment, score, maxScore });
  }, [viewMode, gradeDraft, questionGradeDraft, questionsById, saveCommentMutation]);

  const submission = submissionQuery.data;
  const progress = progressQuery.data as QuestionProgress[] | undefined;
  const analytics = analyticsQuery.data ?? [];

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
            className={styles.aiGradeButton}
            onClick={() => setShowAIGradingDialog(true)}
            disabled={isAIGrading || summaries.length === 0}
            title="בדיקה אוטומטית באמצעות AI"
          >
            {isAIGrading ? (
              <>
                <span className={styles.aiSpinner} />
                מעריך...
              </>
            ) : (
              <>✨ בדיקת AI</>
            )}
          </button>
          <button
            type="button"
            className={styles.testAIButton}
            onClick={() => setShowTestAIDialog(true)}
            disabled={isTestingAI || summaries.length === 0 || (questionsQuery.data ?? []).length === 0}
            title="בדיקת AI - לא נשמר במסד הנתונים"
          >
            {isTestingAI ? (
              <>
                <span className={styles.aiSpinner} />
                בודק...
              </>
            ) : (
              <>🧪 Test AI</>
            )}
          </button>
          <button
            type="button"
            className={styles.exportButton}
            onClick={handleExportGrades}
            disabled={isExporting || summaries.length === 0}
          >
            {isExporting ? "מייצא..." : "ייצא ציונים ל-Excel"}
          </button>
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
                  <span className={styles.summaryPrimary}>
                    {summary.studentName || summary.studentId}
                  </span>
                  {summary.studentIdNumber && (
                    <span className={styles.studentIdNumber}>ת.ז: {summary.studentIdNumber}</span>
                  )}
                  <StatusBadge status={summary.status} t={t} />
                  <span className={styles.summaryMeta}>
                    {SCORE_FORMATTER.format(summary.overallScore)} נקודות
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
            submissionQuery.isLoading ? (
              <div className={styles.placeholder}>{t("builder.grade.loading")}</div>
            ) : submissionQuery.isError ? (
              <div className={styles.placeholder}>
                {t("builder.grade.error")}: {submissionQuery.error instanceof Error ? submissionQuery.error.message : "Unknown error"}
              </div>
            ) : !submission ? (
              <div className={styles.placeholder}>{t("builder.grade.submission.select")}</div>
            ) : (
            <div className={styles.detailInner}>
              <header className={styles.detailHeader}>
                <div>
                  <h3>{t("builder.grade.submission.by", { studentId: summaries.find(s => s.id === activeSubmissionId)?.studentName || submission.studentId })}</h3>
                  {summaries.find(s => s.id === activeSubmissionId)?.studentIdNumber && (
                    <p className={styles.studentIdBadge}>
                      ת.ז: {summaries.find(s => s.id === activeSubmissionId)?.studentIdNumber}
                    </p>
                  )}
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
                        <span className={styles.questionPoints}>{draft?.score ?? 0}/{question?.points ?? 0} נקודות</span>
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
                        <label className={draft?.aiSuggested ? styles.aiSuggestedField : ""}>
                          {t("builder.grade.score.label")}
                          {draft?.aiSuggested && <span className={styles.aiSuggestedBadge}>AI</span>}
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
                                  aiSuggested: false, // Clear AI flag when manually edited
                                },
                              }))
                            }
                          />
                        </label>
                        <div className={styles.notesFieldWithBank}>
                          <label className={`${styles.notesField} ${draft?.aiSuggested ? styles.aiSuggestedField : ""}`}>
                            {t("builder.grade.notes.label")}
                            {draft?.aiSuggested && <span className={styles.aiSuggestedBadge}>AI</span>}
                            <textarea
                              placeholder={t("builder.grade.notes.placeholder")}
                              value={draft?.instructorNotes ?? sqlAnswer.feedback?.instructorNotes ?? ""}
                              onChange={(event) =>
                                setGradeDraft((prev) => ({
                                  ...prev,
                                  [questionId]: {
                                    ...prev[questionId],
                                    aiSuggested: false, // Clear AI flag when manually edited
                                    instructorNotes: event.target.value,
                                  },
                                }))
                              }
                            />
                          </label>
                          <CommentBankDropdown
                            questionId={questionId}
                            comments={commentBankQuery.data ?? []}
                            onApply={(comment) => applyCommentFromBank(questionId, comment)}
                            onSave={() => saveCurrentCommentToBank(questionId)}
                            onDelete={(commentId) => deleteCommentMutation.mutate(commentId)}
                            isOpen={showCommentBank === questionId}
                            onToggle={() => setShowCommentBank(showCommentBank === questionId ? null : questionId)}
                            direction={direction}
                          />
                        </div>
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
                                  <div className={styles.studentInfo}>
                                    <strong>{summaries.find(s => s.id === submission.id)?.studentName || submission.studentId}</strong>
                                    {summaries.find(s => s.id === submission.id)?.studentIdNumber && (
                                      <span className={styles.studentIdNumberSmall}>
                                        ת.ז: {summaries.find(s => s.id === submission.id)?.studentIdNumber}
                                      </span>
                                    )}
                                  </div>
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
                                  <label className={draft?.aiSuggested || (answer?.feedback?.autoNotes && !answer?.feedback?.instructorNotes) ? styles.aiSuggestedField : ""}>
                                    {t("builder.grade.score.label")}
                                    {(draft?.aiSuggested || (answer?.feedback?.autoNotes && !answer?.feedback?.instructorNotes)) && <span className={styles.aiSuggestedBadge}>AI</span>}
                                    <input
                                      type="number"
                                      min={0}
                                      max={question?.points ?? 100}
                                      step={0.5}
                                      value={draft?.score ?? answer?.feedback?.score ?? 0}
                                      onChange={(event) =>
                                        setQuestionGradeDraft((prev) => ({
                                          ...prev,
                                          [activeQuestionId]: {
                                            ...prev[activeQuestionId],
                                            [submission.id]: {
                                              ...prev[activeQuestionId]?.[submission.id],
                                              score: Number(event.target.value),
                                              aiSuggested: false, // Clear AI flag when manually edited
                                            },
                                          },
                                        }))
                                      }
                                    />
                                    <span className={styles.pointsLabel}>/ {question?.points ?? 0}</span>
                                  </label>
                                  <div className={styles.notesFieldWithBank}>
                                    <label className={`${styles.notesField} ${draft?.aiSuggested ? styles.aiSuggestedField : ""}`}>
                                      {t("builder.grade.notes.label")}
                                      {draft?.aiSuggested && <span className={styles.aiSuggestedBadge}>AI</span>}
                                      <textarea
                                        placeholder={t("builder.grade.notes.placeholder")}
                                        value={draft?.instructorNotes ?? answer?.feedback?.instructorNotes ?? ""}
                                        onChange={(event) =>
                                          setQuestionGradeDraft((prev) => ({
                                            ...prev,
                                            [activeQuestionId]: {
                                              ...prev[activeQuestionId],
                                              [submission.id]: {
                                                ...prev[activeQuestionId]?.[submission.id],
                                                instructorNotes: event.target.value,
                                                aiSuggested: false, // Clear AI flag when manually edited
                                              },
                                            },
                                          }))
                                        }
                                      />
                                    </label>
                                    <CommentBankDropdown
                                      questionId={activeQuestionId}
                                      comments={commentBankQuery.data ?? []}
                                      onApply={(comment) => applyCommentFromBank(activeQuestionId, comment, submission.id)}
                                      onSave={() => saveCurrentCommentToBank(activeQuestionId, submission.id)}
                                      onDelete={(commentId) => deleteCommentMutation.mutate(commentId)}
                                      isOpen={showCommentBank === `${activeQuestionId}-${submission.id}`}
                                      onToggle={() => setShowCommentBank(
                                        showCommentBank === `${activeQuestionId}-${submission.id}` ? null : `${activeQuestionId}-${submission.id}`
                                      )}
                                      direction={direction}
                                    />
                                  </div>
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

      {/* AI Grading Instructions Dialog */}
      {showAIGradingDialog && (
        <div className={styles.aiGradingDialogOverlay} onClick={(e) => e.target === e.currentTarget && setShowAIGradingDialog(false)}>
          <div className={styles.aiGradingDialog}>
            <div className={styles.aiGradingDialogHeader}>
              <h3>הנחיות בדיקת AI</h3>
              <button
                type="button"
                className={styles.aiGradingDialogClose}
                onClick={() => setShowAIGradingDialog(false)}
              >
                ×
              </button>
            </div>
            <div className={styles.aiGradingDialogContent}>
              <p className={styles.aiGradingDialogDescription}>
                בדיקת AI תבדוק את כל השאלות והסטודנטים ותשמור את הציונים במסד הנתונים. לאחר מכן תוכל לבדוק, לעדכן ולאשר את הציונים בממשק.
                <br /><br />
                הוסף הנחיות נוספות להערכת AI (אופציונלי). ההנחיות יופיעו בכל השאלות ונוסף להנחיות הקיימות של כל שאלה.
              </p>
              <label className={styles.aiGradingDialogLabel}>
                הנחיות נוספות להערכה (אופציונלי)
                <textarea
                  className={styles.aiGradingDialogTextarea}
                  value={aiGradingInstructions}
                  onChange={(e) => setAIGradingInstructions(e.target.value)}
                  placeholder="לדוגמה: הקפד על תשובות מפורטות, שים לב לניקוד תקין..."
                  rows={6}
                  dir="rtl"
                />
              </label>
            </div>
            <div className={styles.aiGradingDialogActions}>
              <button
                type="button"
                className={styles.aiGradingDialogCancel}
                onClick={() => {
                  setShowAIGradingDialog(false);
                  setAIGradingInstructions("");
                }}
              >
                ביטול
              </button>
              <button
                type="button"
                className={styles.aiGradingDialogStart}
                onClick={() => {
                  setShowAIGradingDialog(false);
                  aiGradingMutation.mutate(aiGradingInstructions.trim() || undefined);
                }}
              >
                התחל בדיקת AI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test AI Dialog */}
      {showTestAIDialog && (
        <div className={styles.testAIDialogOverlay} onClick={(e) => e.target === e.currentTarget && setShowTestAIDialog(false)}>
          <div className={styles.testAIDialog}>
            <div className={styles.testAIDialogHeader}>
              <h3>בדיקת AI - לא נשמר במסד הנתונים</h3>
              <button
                type="button"
                className={styles.testAIDialogClose}
                onClick={() => {
                  setShowTestAIDialog(false);
                  setTestAIResults(null);
                  setSelectedTestQuestionId(null);
                }}
              >
                ×
              </button>
            </div>
            <div className={styles.testAIDialogContent}>
              {!testAIResults ? (
                <>
                  <p className={styles.testAIDialogDescription}>
                    בחר שאלה כדי לבדוק את ביצועי ה-AI על כל התשובות של הסטודנטים. התוצאות לא יישמרו במסד הנתונים.
                  </p>
                  {isTestingAI && (
                    <div className={styles.testAILoading}>
                      <span className={styles.aiSpinner} />
                      בודק תשובות...
                    </div>
                  )}
                  <div className={styles.testAIQuestionList}>
                    {(questionsQuery.data ?? []).map((question) => (
                      <button
                        key={question.id}
                        type="button"
                        className={`${styles.testAIQuestionButton} ${selectedTestQuestionId === question.id ? styles.active : ''}`}
                        onClick={() => {
                          setSelectedTestQuestionId(question.id);
                          testAIMutation.mutate(question.id);
                        }}
                        disabled={isTestingAI}
                      >
                        <div className={styles.testAIQuestionTitle}>
                          {question.prompt.length > 80 ? `${question.prompt.substring(0, 80)}...` : question.prompt}
                        </div>
                        <div className={styles.testAIQuestionMeta}>
                          {question.points ?? 0} נקודות
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className={styles.testAIResults}>
                  <div className={styles.testAIQuestionHeader}>
                    <h4>{testAIResults.questionPrompt}</h4>
                  </div>
                  {isTestingAI ? (
                    <div className={styles.testAILoading}>
                      <span className={styles.aiSpinner} />
                      בודק תשובות...
                    </div>
                  ) : (
                    <>
                      <div className={styles.testAIResultsSummary}>
                        סה"כ {testAIResults.results.length} תשובות נבדקו
                      </div>
                      <div className={styles.testAIResultsList}>
                        {testAIResults.results.map((result, index) => (
                          <div key={result.submissionId} className={styles.testAIResultItem}>
                            <div className={styles.testAIResultHeader}>
                              <div className={styles.testAIResultStudent}>
                                <strong>{result.studentName || result.studentId}</strong>
                                {result.studentIdNumber && (
                                  <span className={styles.testAIResultIdNumber}>ת.ז: {result.studentIdNumber}</span>
                                )}
                              </div>
                              <div className={styles.testAIResultScore}>
                                {result.result.score} / {questionsQuery.data?.find(q => q.id === testAIResults.questionId)?.points ?? 0}
                              </div>
                            </div>
                            <div className={styles.testAIResultSQL}>
                              <strong>SQL:</strong>
                              <pre>{result.sql}</pre>
                            </div>
                            <div className={styles.testAIResultComment}>
                              <strong>הערת AI:</strong>
                              <p>{result.result.comment}</p>
                            </div>
                            <div className={styles.testAIResultBreakdown}>
                              <span>נכונות שאילתה: {result.result.breakdown.queryCorrectness}%</span>
                              <span>נכונות תוצאות: {result.result.breakdown.outputCorrectness}%</span>
                              <span>רמת ביטחון: {result.result.confidence}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {testAIResults.errors && testAIResults.errors.length > 0 && (
                        <div className={styles.testAIErrors}>
                          <strong>שגיאות:</strong>
                          <ul>
                            {testAIResults.errors.map((error, index) => (
                              <li key={index}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className={styles.testAIResultsActions}>
                        <button
                          type="button"
                          className={styles.testAIResultsBackButton}
                          onClick={() => {
                            setTestAIResults(null);
                            setSelectedTestQuestionId(null);
                          }}
                        >
                          חזור לבחירת שאלה
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            {!testAIResults && (
              <div className={styles.testAIDialogActions}>
                <button
                  type="button"
                  className={styles.testAIDialogCancel}
                  onClick={() => {
                    setShowTestAIDialog(false);
                    setTestAIResults(null);
                    setSelectedTestQuestionId(null);
                  }}
                >
                  ביטול
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
