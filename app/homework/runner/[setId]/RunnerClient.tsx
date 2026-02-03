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
  SubmitHomeworkPayload,
} from "@/app/homework/services/submissionService";
import { executeSql } from "@/app/homework/services/sqlService";
import type { Question, SqlExecutionRequest, Submission } from "@/app/homework/types";
import styles from "./runner.module.css";
import { useHomeworkLocale } from "@/app/homework/context/HomeworkLocaleProvider";
import { SubmittedPage } from "./SubmittedPage";
import Chat from "@/app/components/chat";

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

interface QuestionAnalyticsState {
  startedAt: number;
  lastActivity: number;
  firstTypeAt?: number;
  firstExecutionAt?: number;
  lastExecutionAt?: number;
  attempts: number;
  timeBetweenExecutions: number[];
  executionTimes: number[];
  charactersTyped: number;
  editsCount: number;
  copyPasteCount: number;
  lastValue: string;
  showAnswerClicks?: number;
  timeToFirstShowAnswer?: number | null;
  showAnswerTimings?: number[];
}

const AUTOSAVE_DELAY = 800;

// Helper function to check if SQL error is about non-existing table/column
const parseSchemaError = (errorMessage: string | undefined): { type: 'table' | 'column' | null; name: string | null } => {
  if (!errorMessage) return { type: null, name: null };
  
  const lowerError = errorMessage.toLowerCase();
  
  // Common patterns for table not found errors
  const tablePatterns = [
    /table\s+['"`]?(\w+)['"`]?\s+(?:does not exist|not found|doesn't exist)/i,
    /no such table:?\s*['"`]?(\w+)['"`]?/i,
    /unknown table\s*['"`]?(\w+)['"`]?/i,
    /relation\s+['"`]?(\w+)['"`]?\s+does not exist/i,
    /table\s+['"`]?(\w+)['"`]?\s+is not defined/i,
    /from\s+['"`]?(\w+)['"`]?.*(?:does not exist|not found)/i,
  ];
  
  for (const pattern of tablePatterns) {
    const match = errorMessage.match(pattern);
    if (match && match[1]) {
      return { type: 'table', name: match[1] };
    }
  }
  
  // Common patterns for column not found errors
  const columnPatterns = [
    /column\s+['"`]?(\w+)['"`]?\s+(?:does not exist|not found|doesn't exist)/i,
    /unknown column\s*['"`]?(\w+)['"`]?/i,
    /no such column:?\s*['"`]?(\w+)['"`]?/i,
    /column\s+['"`]?(\w+)['"`]?\s+is not defined/i,
    /field\s+['"`]?(\w+)['"`]?\s+(?:does not exist|not found)/i,
  ];
  
  for (const pattern of columnPatterns) {
    const match = errorMessage.match(pattern);
    if (match && match[1]) {
      return { type: 'column', name: match[1] };
    }
  }
  
  // Also check for generic "not found" that might indicate schema issues
  // But skip JavaScript runtime errors (like "Cannot read properties of undefined")
  const isJavaScriptError = lowerError.includes('cannot read properties') || 
                           lowerError.includes('typeerror') ||
                           lowerError.includes('referenceerror') ||
                           lowerError.includes('reading \'0\'') ||
                           lowerError.includes('reading "0"');
  
  if (!isJavaScriptError && (lowerError.includes('not found') || lowerError.includes('does not exist') || lowerError.includes('undefined'))) {
    // Try to extract any identifier (but not from JavaScript errors)
    const genericMatch = errorMessage.match(/['"`](\w+)['"`]/);
    if (genericMatch && genericMatch[1]) {
      return { type: 'table', name: genericMatch[1] }; // Assume table if we can't tell
    }
  }
  
  return { type: null, name: null };
};

// Database sample data for "הכנה למבחן" schema (Exams, Students, Registrations, Scores)
const DATABASE_SAMPLE_DATA: Record<string, { columns: string[]; rows: Record<string, string | number>[] }> = {
  Exams: {
    columns: ["ExamID", "CourseCode", "ExamDate", "DurationMinutes", "Room"],
    rows: [
      { ExamID: 1, CourseCode: "SQL101", ExamDate: "2026-02-15", DurationMinutes: 90, Room: "A1" },
      { ExamID: 2, CourseCode: "DB202", ExamDate: "2026-02-18", DurationMinutes: 120, Room: "B2" },
      { ExamID: 3, CourseCode: "SQL101", ExamDate: "2026-02-22", DurationMinutes: 150, Room: "A1" },
      { ExamID: 4, CourseCode: "DB202", ExamDate: "2026-02-25", DurationMinutes: 90, Room: "C3" },
      { ExamID: 5, CourseCode: "SQL201", ExamDate: "2026-03-01", DurationMinutes: 135, Room: "A1" },
      { ExamID: 6, CourseCode: "DB301", ExamDate: "2026-03-05", DurationMinutes: 105, Room: "B1" },
      { ExamID: 7, CourseCode: "BI101", ExamDate: "2026-03-08", DurationMinutes: 80, Room: "D2" },
      { ExamID: 8, CourseCode: "ST201", ExamDate: "2026-03-11", DurationMinutes: 140, Room: "A1" },
      { ExamID: 9, CourseCode: "CS330", ExamDate: "2026-03-14", DurationMinutes: 110, Room: "C1" },
      { ExamID: 10, CourseCode: "MATH220", ExamDate: "2026-03-18", DurationMinutes: 100, Room: "B3" },
    ],
  },
  Students: {
    columns: ["StudentID", "FirstName", "LastName", "Major", "Year"],
    rows: [
      { StudentID: 1001, FirstName: "אלי", LastName: "כהן", Major: "CS", Year: 2 },
      { StudentID: 1002, FirstName: "מיה", LastName: "לוי", Major: "Math", Year: 2 },
      { StudentID: 1003, FirstName: "דוד", LastName: "ישראלי", Major: "CS", Year: 3 },
      { StudentID: 1004, FirstName: "שרה", LastName: "מזרחי", Major: "Math", Year: 2 },
      { StudentID: 1005, FirstName: "יוסי", LastName: "אברהם", Major: "CS", Year: 3 },
      { StudentID: 1006, FirstName: "רונית", LastName: "דהן", Major: "Math", Year: 1 },
      { StudentID: 1007, FirstName: "עמית", LastName: "בן דוד", Major: "CS", Year: 2 },
      { StudentID: 1008, FirstName: "נועה", LastName: "שמעון", Major: "Biology", Year: 1 },
      { StudentID: 1009, FirstName: "תום", LastName: "גל", Major: "CS", Year: 4 },
      { StudentID: 1010, FirstName: "הילה", LastName: "אדרי", Major: "Math", Year: 3 },
    ],
  },
  Registrations: {
    columns: ["RegistrationID", "StudentID", "ExamID", "RegisteredAt", "Status"],
    rows: [
      { RegistrationID: 1, StudentID: 1001, ExamID: 1, RegisteredAt: "2026-01-10", Status: "approved" },
      { RegistrationID: 2, StudentID: 1001, ExamID: 2, RegisteredAt: "2026-01-12", Status: "approved" },
      { RegistrationID: 3, StudentID: 1002, ExamID: 1, RegisteredAt: "2026-01-11", Status: "approved" },
      { RegistrationID: 4, StudentID: 1002, ExamID: 3, RegisteredAt: "2026-01-14", Status: "waitlist" },
      { RegistrationID: 5, StudentID: 1003, ExamID: 1, RegisteredAt: "2026-01-09", Status: "approved" },
      { RegistrationID: 6, StudentID: 1003, ExamID: 2, RegisteredAt: "2026-01-13", Status: "approved" },
      { RegistrationID: 7, StudentID: 1003, ExamID: 3, RegisteredAt: "2026-01-15", Status: "approved" },
      { RegistrationID: 8, StudentID: 1004, ExamID: 2, RegisteredAt: "2026-01-11", Status: "approved" },
      { RegistrationID: 9, StudentID: 1004, ExamID: 4, RegisteredAt: "2026-01-16", Status: "waitlist" },
      { RegistrationID: 10, StudentID: 1005, ExamID: 1, RegisteredAt: "2026-01-10", Status: "approved" },
      { RegistrationID: 11, StudentID: 1005, ExamID: 3, RegisteredAt: "2026-01-14", Status: "approved" },
      { RegistrationID: 12, StudentID: 1006, ExamID: 2, RegisteredAt: "2026-01-12", Status: "waitlist" },
      { RegistrationID: 13, StudentID: 1007, ExamID: 1, RegisteredAt: "2026-01-15", Status: "approved" },
      { RegistrationID: 14, StudentID: 1007, ExamID: 2, RegisteredAt: "2026-01-16", Status: "approved" },
      { RegistrationID: 15, StudentID: 1008, ExamID: 4, RegisteredAt: "2026-01-17", Status: "approved" },
      { RegistrationID: 16, StudentID: 1009, ExamID: 5, RegisteredAt: "2026-01-19", Status: "approved" },
      { RegistrationID: 17, StudentID: 1009, ExamID: 8, RegisteredAt: "2026-01-21", Status: "approved" },
      { RegistrationID: 18, StudentID: 1010, ExamID: 6, RegisteredAt: "2026-01-20", Status: "approved" },
      { RegistrationID: 19, StudentID: 1010, ExamID: 10, RegisteredAt: "2026-01-24", Status: "waitlist" },
    ],
  },
  Scores: {
    columns: ["ScoreID", "StudentID", "ExamID", "Score", "GradedAt", "Attempt"],
    rows: [
      { ScoreID: 1, StudentID: 1001, ExamID: 1, Score: 85, GradedAt: "2026-02-16", Attempt: 1 },
      { ScoreID: 2, StudentID: 1001, ExamID: 2, Score: 90, GradedAt: "2026-02-19", Attempt: 1 },
      { ScoreID: 3, StudentID: 1002, ExamID: 1, Score: 78, GradedAt: "2026-02-16", Attempt: 1 },
      { ScoreID: 4, StudentID: 1003, ExamID: 1, Score: 92, GradedAt: "2026-02-16", Attempt: 1 },
      { ScoreID: 5, StudentID: 1003, ExamID: 2, Score: 88, GradedAt: "2026-02-19", Attempt: 1 },
      { ScoreID: 6, StudentID: 1003, ExamID: 3, Score: 95, GradedAt: "2026-02-23", Attempt: 1 },
      { ScoreID: 7, StudentID: 1004, ExamID: 2, Score: 72, GradedAt: "2026-02-19", Attempt: 1 },
      { ScoreID: 8, StudentID: 1005, ExamID: 1, Score: 80, GradedAt: "2026-02-16", Attempt: 1 },
      { ScoreID: 9, StudentID: 1005, ExamID: 3, Score: 84, GradedAt: "2026-02-23", Attempt: 1 },
      { ScoreID: 10, StudentID: 1007, ExamID: 1, Score: 91, GradedAt: "2026-02-16", Attempt: 1 },
      { ScoreID: 11, StudentID: 1007, ExamID: 2, Score: 87, GradedAt: "2026-02-19", Attempt: 1 },
      { ScoreID: 12, StudentID: 1008, ExamID: 4, Score: 75, GradedAt: "2026-02-26", Attempt: 1 },
      { ScoreID: 13, StudentID: 1009, ExamID: 5, Score: 89, GradedAt: "2026-03-02", Attempt: 1 },
      { ScoreID: 14, StudentID: 1009, ExamID: 8, Score: 86, GradedAt: "2026-03-12", Attempt: 1 },
      { ScoreID: 15, StudentID: 1010, ExamID: 6, Score: 82, GradedAt: "2026-03-06", Attempt: 1 },
    ],
  },
};

export function RunnerClient({ setId, studentId }: RunnerClientProps) {
  const queryClient = useQueryClient();
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [editorValues, setEditorValues] = useState<Record<string, string>>({});
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showDatabaseViewer, setShowDatabaseViewer] = useState(true);
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});
  const [solutionModalQuestionId, setSolutionModalQuestionId] = useState<string | null>(null);
  const [copyAnswerStatus, setCopyAnswerStatus] = useState<Record<string, "idle" | "copied">>({});
  const pendingRef = useRef<Record<string, PendingSave>>({});
  const analyticsRef = useRef<Record<string, QuestionAnalyticsState>>({});
  const activeQuestionRef = useRef<string | null>(null);
  const { t, direction, formatDateTime, formatNumber } = useHomeworkLocale();
  const backArrow = direction === "rtl" ? "→" : "←";

  const toggleTableExpanded = useCallback((tableName: string) => {
    setExpandedTables((prev) => ({ ...prev, [tableName]: !prev[tableName] }));
  }, []);

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
    queryKey: ["homework", setId, "questions", studentId],
    queryFn: () => getHomeworkQuestions(setId, studentId),
  });

  const submissionQuery = useQuery({
    queryKey: ["submission", setId, studentId],
    queryFn: () => getSubmission(setId, studentId),
    enabled: Boolean(setId && studentId),
  });

  const questionsById = useMemo(() => {
    const map = new Map<string, Question>();
    const questions = questionsQuery.data;
    if (Array.isArray(questions)) {
      questions.forEach((question) => map.set(question.id, question));
    }
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

  // Set first question as active when questions load
  useEffect(() => {
    const questionsData = questionsQuery.data;
    if (Array.isArray(questionsData) && questionsData.length > 0 && !activeQuestionId) {
      setActiveQuestionId(questionsData[0].id);
    }
  }, [questionsQuery.data, activeQuestionId]);

  const ensureAnalyticsState = useCallback(
    (questionId: string) => {
      if (!analyticsRef.current[questionId]) {
        analyticsRef.current[questionId] = {
          startedAt: Date.now(),
          lastActivity: Date.now(),
          attempts: 0,
          timeBetweenExecutions: [],
          executionTimes: [],
          charactersTyped: 0,
          editsCount: 0,
          copyPasteCount: 0,
          lastValue: editorValues[questionId] ?? "",
          showAnswerClicks: 0,
          timeToFirstShowAnswer: null,
          showAnswerTimings: [],
        };
      }
      return analyticsRef.current[questionId];
    },
    [editorValues]
  );

  const recordTyping = useCallback(
    (questionId: string, nextValue: string) => {
      const state = ensureAnalyticsState(questionId);
      const previousValue = state.lastValue ?? "";
      const delta = Math.max(0, nextValue.length - previousValue.length);

      state.charactersTyped += delta;
      state.editsCount += 1;
      state.lastValue = nextValue;
      state.lastActivity = Date.now();
      if (!state.firstTypeAt) {
        state.firstTypeAt = Date.now();
      }
    },
    [ensureAnalyticsState]
  );

  const recordExecutionStart = useCallback(
    (questionId: string) => {
      const state = ensureAnalyticsState(questionId);
      const now = Date.now();

      if (state.lastExecutionAt) {
        state.timeBetweenExecutions.push(now - state.lastExecutionAt);
      }

      if (!state.firstExecutionAt) {
        state.firstExecutionAt = now;
      }

      state.lastExecutionAt = now;
      state.attempts += 1;
      state.lastActivity = now;
    },
    [ensureAnalyticsState]
  );

  const recordExecutionResult = useCallback(
    (questionId: string, executionMs: number | undefined) => {
      const state = ensureAnalyticsState(questionId);
      state.executionTimes.push(executionMs ?? 0);
      state.lastActivity = Date.now();
    },
    [ensureAnalyticsState]
  );

  const recordShowAnswer = useCallback(
    (questionId: string) => {
      const state = ensureAnalyticsState(questionId);
      const now = Date.now();
      const elapsed = now - state.startedAt;
      state.showAnswerClicks = (state.showAnswerClicks ?? 0) + 1;
      if (state.timeToFirstShowAnswer == null) {
        state.timeToFirstShowAnswer = elapsed;
      }
      if (!state.showAnswerTimings) {
        state.showAnswerTimings = [];
      }
      state.showAnswerTimings.push(elapsed);
      state.lastActivity = now;
    },
    [ensureAnalyticsState]
  );

  const finalizeAnalytics = useCallback(
    async (questionId: string) => {
      const state = analyticsRef.current[questionId];
      if (!state) return;

      const submission = submissionQuery.data;
      if (!submission) return;

      const now = Date.now();
      const timeSpent = (state.lastActivity || now) - state.startedAt;
      const typingSpeed = timeSpent > 0 ? Math.round((state.charactersTyped / timeSpent) * 60000) : 0;

      const payload = {
        submissionId: submission.id ?? `${setId}-${studentId}`,
        questionId,
        studentId,
        homeworkSetId: setId,
        metrics: {
          timeSpent,
          typingSpeed,
          attempts: state.attempts,
          timeToFirstExecution: state.firstExecutionAt ? state.firstExecutionAt - state.startedAt : null,
          timeBetweenExecutions: state.timeBetweenExecutions,
          queryExecutionTimes: state.executionTimes,
          charactersTyped: state.charactersTyped,
          editsCount: state.editsCount,
          copyPasteCount: state.copyPasteCount,
          showAnswerClicks: state.showAnswerClicks ?? 0,
          timeToFirstShowAnswer: state.timeToFirstShowAnswer ?? null,
          showAnswerTimings: state.showAnswerTimings ?? [],
          startedAt: new Date(state.startedAt).toISOString(),
          lastActivityAt: new Date(state.lastActivity || now).toISOString(),
        },
      };

      try {
        await fetch("/api/analytics/question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        console.error("Failed to submit question analytics", error);
      }
    },
    [setId, studentId, submissionQuery.data]
  );

  useEffect(() => {
    if (activeQuestionId) {
      ensureAnalyticsState(activeQuestionId);
    }

    if (activeQuestionRef.current && activeQuestionRef.current !== activeQuestionId) {
      finalizeAnalytics(activeQuestionRef.current);
    }

    activeQuestionRef.current = activeQuestionId;

    return () => {
      if (activeQuestionRef.current) {
        finalizeAnalytics(activeQuestionRef.current);
      }
    };
  }, [activeQuestionId, ensureAnalyticsState, finalizeAnalytics]);


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
    onSuccess: async (result, variables) => {
      console.log("✅ SQL execution successful", result);
      console.log("📊 Result has", result.rows.length, "rows and", result.columns.length, "columns");
      recordExecutionResult(variables.questionId, result.executionMs);

      // Update the query cache first for immediate UI update
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
      
      // Save the result to the database
      try {
        const updatedSubmission = queryClient.getQueryData<Submission>(["submission", setId, studentId]);
        if (updatedSubmission) {
          await saveSubmissionDraft(setId, {
            studentId,
            answers: updatedSubmission.answers,
          });
          console.log("💾 Saved execution result to database");
        }
      } catch (error) {
        console.error("⚠️ Failed to save execution result to database:", error);
        // Don't fail the whole operation if save fails - the cache is already updated
      }
      
      queryClient.invalidateQueries({ queryKey: ["submission", setId, studentId] });
    },
    onError: (error) => {
      console.error("❌ SQL execution failed", error);
    },
  });

  const submitMutation = useMutation({
    mutationFn: (payload: SubmitHomeworkPayload) => submitHomework(setId, payload),
    onSuccess: (submission) => {
      // Update the query cache immediately so the component re-renders with new status
      queryClient.setQueryData<Submission | undefined>(["submission", setId, studentId], submission);
      queryClient.invalidateQueries({ queryKey: ["submission", setId, studentId] });
      // The page will automatically show SubmittedPage due to the check below
      // Force a refetch to ensure the UI updates
      submissionQuery.refetch();
    },
  });

  const handleSubmitClick = useCallback(() => {
    submitMutation.mutate({ studentId });
  }, [studentId, submitMutation]);

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
      recordTyping(questionId, nextValue);
      setEditorValues((prev) => ({ ...prev, [questionId]: nextValue }));
      scheduleAutosave(questionId, nextValue);
    },
    [recordTyping, scheduleAutosave],
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

    recordExecutionStart(activeQuestionId);

    executeMutation.mutate({
      setId,
      submissionId: submissionQuery.data.id,
      questionId: activeQuestionId,
      sql,
      studentId,
      attemptNumber: submissionQuery.data.attemptNumber,
    });
  }, [activeQuestionId, editorValues, executeMutation, recordExecutionStart, setId, studentId, submissionQuery.data]);

  const handleShowAnswer = useCallback(
    (questionId: string) => {
      recordShowAnswer(questionId);
      setSolutionModalQuestionId(questionId);
    },
    [recordShowAnswer]
  );

  const handleCopyAnswer = useCallback(
    async (questionId: string, sql: string) => {
      try {
        await navigator.clipboard.writeText(sql);
        setCopyAnswerStatus((prev) => ({ ...prev, [questionId]: "copied" }));
        window.setTimeout(() => {
          setCopyAnswerStatus((prev) => ({ ...prev, [questionId]: "idle" }));
        }, 1500);
      } catch (error) {
        console.error("Failed to copy solution", error);
      }
    },
    []
  );

  const submission = submissionQuery.data;
  const homework = homeworkQuery.data;
  const questions = useMemo(() => {
    const data = questionsQuery.data;
    return Array.isArray(data) ? data : [];
  }, [questionsQuery.data]);

  const totalQuestions = questions.length;
  const answers = useMemo(() => submission?.answers ?? {}, [submission?.answers]);
  const answeredCount = useMemo(() =>
    questions.map((question) => question.id).filter((questionId) => {
      const answer = answers[questionId];
      return Boolean(answer?.sql?.trim()) || Boolean(answer?.feedback?.score);
    }).length,
  [answers, questions]);

  const progressPercent = totalQuestions === 0 ? 0 : Math.round((answeredCount / totalQuestions) * 100);
  const activeQuestion = activeQuestionId ? questionsById.get(activeQuestionId) : undefined;
  const activeAnswer = activeQuestionId ? answers[activeQuestionId] : undefined;
  const solutionModalQuestion = solutionModalQuestionId ? questionsById.get(solutionModalQuestionId) : undefined;
  const solutionModalSql = solutionModalQuestion?.starterSql?.trim() ?? "";
  const solutionModalCopyStatus = solutionModalQuestionId
    ? copyAnswerStatus[solutionModalQuestionId] ?? "idle"
    : "idle";
  const attemptsRemaining = activeQuestion?.maxAttempts
    ? Math.max(0, activeQuestion.maxAttempts - (activeAnswer?.executionCount ?? 0))
    : undefined;

  useEffect(() => {
    if (!solutionModalQuestionId) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSolutionModalQuestionId(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [solutionModalQuestionId]);

  const chatHomeworkContext = useMemo(() => {
    if (!homework) return null;

    const currentQuestionIndex = activeQuestion
      ? Math.max(0, questions.findIndex((question) => question.id === activeQuestion.id))
      : -1;

    return {
      homeworkTitle: homework.title,
      backgroundStory: homework.backgroundStory,
      tables: Object.entries(DATABASE_SAMPLE_DATA).map(([name, data]) => ({
        name,
        columns: data.columns,
        sampleRows: data.rows,
      })),
      questions: questions.map((question, index) => ({
        id: question.id,
        prompt: question.prompt,
        instructions: question.instructions,
        index: index + 1,
        points: question.points,
      })),
      currentQuestion: activeQuestion
        ? {
            id: activeQuestion.id,
            prompt: activeQuestion.prompt,
            instructions: activeQuestion.instructions,
            index: currentQuestionIndex >= 0 ? currentQuestionIndex + 1 : 1,
          }
        : null,
      studentTableData: submission?.studentTableData,
    };
  }, [activeQuestion, homework, questions, submission?.studentTableData]);

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
        <Link href="/homework/start" className={styles.backLink}>
          {backArrow} {t("runner.error.back")}
        </Link>
      </div>
    );
  }

  // If submission is already submitted or graded, show submitted page
  if (submission && (submission.status === "submitted" || submission.status === "graded")) {
    return (
      <SubmittedPage 
        homeworkTitle={homework?.title}
        submittedAt={submission.submittedAt}
        studentId={studentId}
      />
    );
  }

  const statusLabel = submission?.status ? t(`runner.status.${submission.status}`) : t("runner.status.in_progress");
  const autosaveLabel = t(`runner.progress.autosave.${autosaveState}`);

  return (
    <div className={styles.runner} dir={direction}>

      {/* Sidebar: Tables + Data */}
      <aside className={styles.sidebar}>
        <div className={styles.assignmentMeta}>
          {/* Database Viewer */}
          <div className={styles.databaseViewerSection}>
            <button
              type="button"
              className={styles.databaseViewerButton}
              onClick={() => setShowDatabaseViewer(!showDatabaseViewer)}
            >
              <span>🗃️</span>
              {showDatabaseViewer ? "הסתר נתוני דוגמא" : "הצג נתוני דוגמא מהטבלאות"}
            </button>
            
            {showDatabaseViewer && (
              <div className={styles.databaseViewer}>
                <p className={styles.databaseViewerNote}>
                  להלן נתונים לדוגמא מכל טבלה בבסיס הנתונים:
                </p>
                {Object.entries(DATABASE_SAMPLE_DATA).map(([tableName, tableData]) => (
                  <div key={tableName} className={styles.tableSection}>
                    <button
                      type="button"
                      className={styles.tableHeader}
                      onClick={() => toggleTableExpanded(tableName)}
                    >
                      <span className={styles.tableToggle}>
                        {expandedTables[tableName] ? "▼" : "▶"}
                      </span>
                      <span className={styles.tableName}>{tableName}</span>
                      <span className={styles.tableRowCount}>({tableData.rows.length} שורות)</span>
                    </button>
                    
                    {expandedTables[tableName] && (
                      <div className={styles.tableSampleData}>
                        <table className={styles.sampleDataTable}>
                          <thead>
                            <tr>
                              {tableData.columns.map((col) => (
                                <th key={col}>{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tableData.rows.map((row, idx) => (
                              <tr key={idx}>
                                {tableData.columns.map((col) => (
                                  <td key={col}>{String(row[col] ?? "")}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Middle Section: Question + SQL Editor */}
      <section className={styles.workspace}>
        <header className={styles.workspaceHeader}>
          {/* Question Stepper - full width with proper padding */}
          <div className={styles.questionStepperWrapper}>
            <div className={styles.questionStepper}>
              {questions.map((question, index) => {
                const qId = question.id;
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
                      {isCompleted ? '⚡' : questionNum}
                    </div>
                    {index < questions.length - 1 && (
                      <div className={`${styles.stepperLine} ${isCompleted ? styles.stepperLineCompleted : ''}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.questionContent}>
            <h3>{activeQuestion?.prompt ?? t("runner.question.placeholder")}</h3>
            {activeQuestion?.instructions && (
              <p className={styles.instructions}>{activeQuestion.instructions}</p>
            )}
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
              options={{
                fontSize: 16,
                fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Monaco, monospace",
              }}
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
            {/* Navigation Buttons */}
              <div className={styles.navigationButtons}>
                <button
                  type="button"
                  className={styles.navButtonPrev}
                  onClick={() => {
                    const currentIndex = questions.findIndex(q => q.id === activeQuestionId);
                    if (currentIndex > 0) {
                      setActiveQuestionId(questions[currentIndex - 1].id);
                    }
                  }}
                  disabled={questions.findIndex(q => q.id === activeQuestionId) <= 0}
                >
                  ← שאלה קודמת
                </button>
                <button
                  type="button"
                  className={styles.navButtonNext}
                  onClick={() => {
                    const currentIndex = questions.findIndex(q => q.id === activeQuestionId);
                    if (currentIndex < questions.length - 1) {
                      setActiveQuestionId(questions[currentIndex + 1].id);
                    }
                  }}
                  disabled={questions.findIndex(q => q.id === activeQuestionId) >= questions.length - 1}
                >
                  שאלה הבאה →
                </button>
                <button
                  type="button"
                  className={styles.showAnswerButton}
                  onClick={() => activeQuestionId && handleShowAnswer(activeQuestionId)}
                  disabled={!activeQuestionId}
                >
                  👀 הצג פתרון
                </button>
              </div>
              
              <button
                type="button"
                className={styles.runButton}
                onClick={handleExecute}
                disabled={executeMutation.isPending || !activeQuestionId}
              >
                <span className={styles.runIcon}>{executeMutation.isPending ? "⏳" : "▶"}</span>
                {executeMutation.isPending ? t("runner.actions.running") : t("runner.actions.run")}
              </button>
            </div>
          </div>

          <div className={styles.feedbackPanel}>
            <div className={styles.feedbackHeader}>
              <h4 className={styles.feedbackTitle}>{t("runner.results.heading")}</h4>
            </div>
            {executeMutation.isError && <p className={styles.errorText}>{t("runner.results.error")}</p>}
            
            {/* Schema Error Notification - Show when there's a table/column not found error */}
            {activeAnswer?.feedback?.autoNotes && activeAnswer.feedback.score === 0 && (() => {
              const schemaError = parseSchemaError(activeAnswer.feedback.autoNotes);
              const isSchemaError = schemaError.type !== null || 
                activeAnswer.feedback.autoNotes.toLowerCase().includes('sql error') ||
                activeAnswer.feedback.autoNotes.toLowerCase().includes('not found') ||
                activeAnswer.feedback.autoNotes.toLowerCase().includes('does not exist') ||
                activeAnswer.feedback.autoNotes.toLowerCase().includes('undefined');
              
              if (isSchemaError) {
                return (
                  <div className={styles.schemaErrorNotification}>
                    <div className={styles.schemaErrorHeader}>
                      <span className={styles.schemaErrorIcon}>⚠️</span>
                      <span className={styles.schemaErrorTitle}>שגיאה בשאילתה</span>
                    </div>
                    <p className={styles.schemaErrorMessage}>
                      {activeAnswer.feedback.autoNotes}
                    </p>
                    {schemaError.name && (
                      <p className={styles.schemaErrorHint}>
                        {schemaError.type === 'table' 
                          ? `הטבלה "${schemaError.name}" לא קיימת במסד הנתונים.`
                          : `העמודה "${schemaError.name}" לא קיימת.`}
                      </p>
                    )}
                    <div className={styles.schemaHelpSection}>
                      <p className={styles.schemaHelpTitle}>📋 הטבלאות והעמודות הזמינות:</p>
                      <div className={styles.schemaTablesList}>
                        {Object.entries(DATABASE_SAMPLE_DATA).map(([tableName, tableData]) => (
                          <div key={tableName} className={styles.schemaTableItem}>
                            <span className={styles.schemaTableName}>{tableName}</span>
                            <span className={styles.schemaColumns}>
                              ({tableData.columns.join(', ')})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
            
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

      {/* Right Sidebar: Michael Chat */}
      <aside className={styles.chatSidebar}>
        <div className={styles.chatHeader}>
          <span className={styles.chatIcon}>💬</span>
          <h3 className={styles.chatTitle}>שאל את Michael</h3>
        </div>
        <div 
          className={styles.chatContent}
          style={{
            flex: '1 1 0',
            minHeight: 0,
            height: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Chat
            chatId={null}
            hideSidebar={true}
            hideAvatar={true}
            minimalMode={true}
            embeddedMode={true}
            homeworkContext={chatHomeworkContext}
          />
        </div>
      </aside>

      {/* Submit Button - Fixed Bottom Right */}
      <button
        type="button"
        className={styles.submitButtonFixed}
        onClick={handleSubmitClick}
        disabled={submitMutation.isPending || submission?.status === "submitted" || submission?.status === "graded"}
      >
        <span>{submitMutation.isPending ? "⏳" : submission?.status === "submitted" ? "✅" : "📤"}</span>
        {submitMutation.isPending ? "מסיים..." : "סיום"}
      </button>

      {solutionModalQuestionId && (
        <div
          className={styles.solutionModalOverlay}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSolutionModalQuestionId(null);
            }
          }}
        >
          <div className={styles.solutionModal} dir="rtl">
            <div className={styles.solutionModalHeader}>
              <h4 className={styles.solutionModalTitle}>💡 פתרון רשמי</h4>
              <button
                type="button"
                className={styles.solutionModalClose}
                onClick={() => setSolutionModalQuestionId(null)}
              >
                ✕
              </button>
            </div>

            {solutionModalQuestion ? (
              <p className={styles.solutionModalPrompt}>{solutionModalQuestion.prompt}</p>
            ) : null}

            {solutionModalSql ? (
              <pre className={styles.solutionCode}>
                <code>{solutionModalSql}</code>
              </pre>
            ) : (
              <p className={styles.solutionEmpty}>טרם הוגדרה תשובה לשאלה זו.</p>
            )}

            <div className={styles.solutionModalActions}>
              {solutionModalSql && (
                <button
                  type="button"
                  className={styles.copyAnswerButton}
                  onClick={() => solutionModalQuestionId && handleCopyAnswer(solutionModalQuestionId, solutionModalSql)}
                >
                  {solutionModalCopyStatus === "copied" ? "✅ הועתק" : "📋 העתק פתרון"}
                </button>
              )}
              <button
                type="button"
                className={styles.showAnswerButton}
                onClick={() => setSolutionModalQuestionId(null)}
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
