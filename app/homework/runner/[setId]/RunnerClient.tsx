"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getHomeworkQuestions, getHomeworkSet } from "@/app/homework/services/homeworkService";
import { getDataset } from "@/app/homework/services/datasetService";
import {
  getSubmission,
  saveSubmissionDraft,
  submitHomework,
  SubmitHomeworkPayload,
} from "@/app/homework/services/submissionService";
import { executeSql } from "@/app/homework/services/sqlService";
import type { Dataset, Question, SqlExecutionRequest, Submission } from "@/app/homework/types";
import styles from "./runner.module.css";
import { useHomeworkLocale } from "@/app/homework/context/HomeworkLocaleProvider";
import { SubmittedPage } from "./SubmittedPage";
import Chat from "@/app/components/chat";
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

interface HomeworkHintResponse {
  hint: string;
  currentBalance?: number;
}

interface CoinsConfigResponse {
  modules?: {
    homeworkHints?: boolean;
  };
  costs?: {
    homeworkHintOpen?: number;
  };
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

type SidebarTable = {
  columns: string[];
  rows: Record<string, string | number | boolean | null>[];
};

// Fallback sample data for legacy homework sets that do not point to a dataset.
const FALLBACK_SAMPLE_DATA: Record<string, SidebarTable> = {
  Debates: {
    columns: ["DebateID", "TopicCode", "DebateDate", "DurationMinutes", "Hall"],
    rows: [
      { DebateID: 1, TopicCode: "POL101", DebateDate: "2026-02-15", DurationMinutes: 90, Hall: "North Hall" },
      { DebateID: 2, TopicCode: "ENV202", DebateDate: "2026-02-18", DurationMinutes: 120, Hall: "East Hall" },
      { DebateID: 3, TopicCode: "TECH101", DebateDate: "2026-02-22", DurationMinutes: 150, Hall: "North Hall" },
      { DebateID: 4, TopicCode: "EDU202", DebateDate: "2026-02-25", DurationMinutes: 90, Hall: "West Hall" },
      { DebateID: 5, TopicCode: "MEDIA201", DebateDate: "2026-03-01", DurationMinutes: 135, Hall: "North Hall" },
      { DebateID: 6, TopicCode: "ETH301", DebateDate: "2026-03-05", DurationMinutes: 105, Hall: "South Hall" },
      { DebateID: 7, TopicCode: "HEALTH101", DebateDate: "2026-03-08", DurationMinutes: 80, Hall: "City Hall" },
      { DebateID: 8, TopicCode: "LAW201", DebateDate: "2026-03-11", DurationMinutes: 140, Hall: "North Hall" },
      { DebateID: 9, TopicCode: "ECON330", DebateDate: "2026-03-14", DurationMinutes: 110, Hall: "Innovation Hall" },
      { DebateID: 10, TopicCode: "CULT220", DebateDate: "2026-03-18", DurationMinutes: 100, Hall: "Central Hall" },
    ],
  },
  Contestants: {
    columns: ["ContestantID", "FirstName", "LastName", "School", "GradeLevel"],
    rows: [
      { ContestantID: 1001, FirstName: "Eli", LastName: "Cohen", School: "Herzl High", GradeLevel: 10 },
      { ContestantID: 1002, FirstName: "Maya", LastName: "Levy", School: "Rabin High", GradeLevel: 10 },
      { ContestantID: 1003, FirstName: "David", LastName: "Israeli", School: "Herzl High", GradeLevel: 11 },
      { ContestantID: 1004, FirstName: "Sarah", LastName: "Mizrahi", School: "Rabin High", GradeLevel: 10 },
      { ContestantID: 1005, FirstName: "Yossi", LastName: "Avraham", School: "Herzl High", GradeLevel: 11 },
      { ContestantID: 1006, FirstName: "Ronit", LastName: "Dahan", School: "Rabin High", GradeLevel: 9 },
      { ContestantID: 1007, FirstName: "Amit", LastName: "Ben-David", School: "Herzl High", GradeLevel: 10 },
      { ContestantID: 1008, FirstName: "Noa", LastName: "Shimon", School: "Galil School", GradeLevel: 9 },
      { ContestantID: 1009, FirstName: "Tom", LastName: "Gal", School: "Herzl High", GradeLevel: 12 },
      { ContestantID: 1010, FirstName: "Hila", LastName: "Adari", School: "Rabin High", GradeLevel: 11 },
    ],
  },
  Enrollments: {
    columns: ["EnrollmentID", "ContestantID", "DebateID", "RegisteredAt", "Status"],
    rows: [
      { EnrollmentID: 1, ContestantID: 1001, DebateID: 1, RegisteredAt: "2026-01-10", Status: "approved" },
      { EnrollmentID: 2, ContestantID: 1001, DebateID: 2, RegisteredAt: "2026-01-12", Status: "approved" },
      { EnrollmentID: 3, ContestantID: 1002, DebateID: 1, RegisteredAt: "2026-01-11", Status: "approved" },
      { EnrollmentID: 4, ContestantID: 1002, DebateID: 3, RegisteredAt: "2026-01-14", Status: "waitlist" },
      { EnrollmentID: 5, ContestantID: 1003, DebateID: 1, RegisteredAt: "2026-01-09", Status: "approved" },
      { EnrollmentID: 6, ContestantID: 1003, DebateID: 2, RegisteredAt: "2026-01-13", Status: "approved" },
      { EnrollmentID: 7, ContestantID: 1003, DebateID: 3, RegisteredAt: "2026-01-15", Status: "approved" },
      { EnrollmentID: 8, ContestantID: 1004, DebateID: 2, RegisteredAt: "2026-01-11", Status: "approved" },
      { EnrollmentID: 9, ContestantID: 1004, DebateID: 4, RegisteredAt: "2026-01-16", Status: "waitlist" },
      { EnrollmentID: 10, ContestantID: 1005, DebateID: 1, RegisteredAt: "2026-01-10", Status: "approved" },
      { EnrollmentID: 11, ContestantID: 1005, DebateID: 3, RegisteredAt: "2026-01-14", Status: "approved" },
      { EnrollmentID: 12, ContestantID: 1006, DebateID: 2, RegisteredAt: "2026-01-12", Status: "waitlist" },
      { EnrollmentID: 13, ContestantID: 1007, DebateID: 1, RegisteredAt: "2026-01-15", Status: "approved" },
      { EnrollmentID: 14, ContestantID: 1007, DebateID: 2, RegisteredAt: "2026-01-16", Status: "approved" },
      { EnrollmentID: 15, ContestantID: 1008, DebateID: 4, RegisteredAt: "2026-01-17", Status: "approved" },
      { EnrollmentID: 16, ContestantID: 1009, DebateID: 5, RegisteredAt: "2026-01-19", Status: "approved" },
      { EnrollmentID: 17, ContestantID: 1009, DebateID: 8, RegisteredAt: "2026-01-21", Status: "approved" },
      { EnrollmentID: 18, ContestantID: 1010, DebateID: 6, RegisteredAt: "2026-01-20", Status: "approved" },
      { EnrollmentID: 19, ContestantID: 1010, DebateID: 10, RegisteredAt: "2026-01-24", Status: "waitlist" },
    ],
  },
  Results: {
    columns: ["ContestantID", "DebateID", "Score", "JudgedAt", "FirstDebateDate"],
    rows: [
      { ContestantID: 1001, DebateID: 1, Score: 85, JudgedAt: "2026-02-16", FirstDebateDate: "2026-02-15" },
      { ContestantID: 1001, DebateID: 2, Score: 90, JudgedAt: "2026-02-19", FirstDebateDate: "2026-02-18" },
      { ContestantID: 1002, DebateID: 1, Score: 78, JudgedAt: "2026-02-16", FirstDebateDate: "2026-02-15" },
      { ContestantID: 1003, DebateID: 1, Score: 92, JudgedAt: "2026-02-16", FirstDebateDate: "2026-02-15" },
      { ContestantID: 1003, DebateID: 2, Score: 88, JudgedAt: "2026-02-19", FirstDebateDate: "2026-02-18" },
      { ContestantID: 1003, DebateID: 3, Score: 95, JudgedAt: "2026-02-23", FirstDebateDate: "2026-02-22" },
      { ContestantID: 1004, DebateID: 2, Score: 72, JudgedAt: "2026-02-19", FirstDebateDate: "2026-02-18" },
      { ContestantID: 1005, DebateID: 1, Score: 80, JudgedAt: "2026-02-16", FirstDebateDate: "2026-02-15" },
      { ContestantID: 1005, DebateID: 3, Score: 84, JudgedAt: "2026-02-23", FirstDebateDate: "2026-02-22" },
      { ContestantID: 1007, DebateID: 1, Score: 91, JudgedAt: "2026-02-16", FirstDebateDate: "2026-02-15" },
      { ContestantID: 1007, DebateID: 2, Score: 87, JudgedAt: "2026-02-19", FirstDebateDate: "2026-02-18" },
      { ContestantID: 1008, DebateID: 4, Score: 75, JudgedAt: "2026-02-26", FirstDebateDate: "2026-02-25" },
      { ContestantID: 1009, DebateID: 5, Score: 89, JudgedAt: "2026-03-02", FirstDebateDate: "2026-03-01" },
      { ContestantID: 1009, DebateID: 8, Score: 86, JudgedAt: "2026-03-12", FirstDebateDate: "2026-03-11" },
      { ContestantID: 1010, DebateID: 6, Score: 82, JudgedAt: "2026-03-06", FirstDebateDate: "2026-03-05" },
    ],
  },
};

export function RunnerClient({ setId, studentId }: RunnerClientProps) {
  const queryClient = useQueryClient();
  const isPreviewContext = studentId === "student-demo";
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [editorValues, setEditorValues] = useState<Record<string, string>>({});
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showDatabaseViewer, setShowDatabaseViewer] = useState(true);
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});
  const [solutionModalQuestionId, setSolutionModalQuestionId] = useState<string | null>(null);
  const [copyAnswerStatus, setCopyAnswerStatus] = useState<Record<string, "idle" | "copied">>({});
  const [hintModalOpen, setHintModalOpen] = useState(false);
  const [hintText, setHintText] = useState("");
  const [hintQuestionPrompt, setHintQuestionPrompt] = useState("");
  const [hintErrorMessage, setHintErrorMessage] = useState<string | null>(null);
  const [hintSuccessMessage, setHintSuccessMessage] = useState<string | null>(null);
  const pendingRef = useRef<Record<string, PendingSave>>({});
  const analyticsRef = useRef<Record<string, QuestionAnalyticsState>>({});
  const activeQuestionRef = useRef<string | null>(null);
  const { t, direction, formatDateTime, formatNumber } = useHomeworkLocale();
  const backArrow = direction === "rtl" ? "→" : "←";

  const toggleTableExpanded = useCallback((tableName: string) => {
    setExpandedTables((prev) => ({ ...prev, [tableName]: !prev[tableName] }));
  }, []);
  const getVisibleQuestionText = useCallback((question: Question) => {
    const prompt = question.prompt?.trim() ?? "";
    const instructions = question.instructions?.trim() ?? "";
    const promptLooksLikeLabel = /^שאלה\s*\d+$/u.test(prompt) || /^question\s*\d+$/iu.test(prompt);
    return !prompt || promptLooksLikeLabel ? instructions || prompt : prompt;
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
  const datasetQuery = useQuery({
    queryKey: ["dataset", homeworkQuery.data?.selectedDatasetId ?? null],
    queryFn: () => getDataset(homeworkQuery.data!.selectedDatasetId!),
    enabled: Boolean(homeworkQuery.data?.selectedDatasetId),
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
  const coinsConfigQuery = useQuery<CoinsConfigResponse>({
    queryKey: ["coins-config", "homework-hints"],
    queryFn: async () => {
      const response = await fetch("/api/users/coins?status=1", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load coins config");
      }
      return (await response.json()) as CoinsConfigResponse;
    },
    enabled: !isPreviewContext,
    staleTime: 30_000,
  });

  const questionsById = useMemo(() => {
    const map = new Map<string, Question>();
    const questions = questionsQuery.data;
    if (Array.isArray(questions)) {
      questions.forEach((question) => map.set(question.id, question));
    }
    return map;
  }, [questionsQuery.data]);

  // Sync editor from submission only on initial load or when switching question, to avoid cursor jumping while typing
  const lastSyncedSubmissionIdRef = useRef<string | null>(null);
  const lastSyncedActiveQuestionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!submissionQuery.data) return;
    const submissionId = submissionQuery.data.id;
    const isInitialLoad = lastSyncedSubmissionIdRef.current !== submissionId;
    const isQuestionSwitch = activeQuestionId !== null && lastSyncedActiveQuestionIdRef.current !== activeQuestionId;

    if (isInitialLoad || isQuestionSwitch) {
      lastSyncedSubmissionIdRef.current = submissionId;
      lastSyncedActiveQuestionIdRef.current = activeQuestionId;
      setEditorValues((prev) => {
        const next: Record<string, string> = { ...prev };
        Object.entries(submissionQuery.data!.answers ?? {}).forEach(([questionId, answer]) => {
          next[questionId] = typeof answer?.sql === "string" ? answer.sql : "";
        });
        return next;
      });
    }
  }, [submissionQuery.data, activeQuestionId]);

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

  const hintMutation = useMutation<
    HomeworkHintResponse,
    Error & { status?: number; payload?: any },
    { questionId: string; questionPrompt: string }
  >({
    mutationFn: async ({ questionId }) => {
      const response = await fetch("/api/homework/hints", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          setId,
          studentId,
          questionId,
        }),
      });

      if (!response.ok) {
        let payload: any = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }

        const error = new Error(payload?.error || "Failed to open homework hint") as Error & {
          status?: number;
          payload?: any;
        };
        error.status = response.status;
        error.payload = payload;
        throw error;
      }

      return (await response.json()) as HomeworkHintResponse;
    },
    onMutate: () => {
      setHintErrorMessage(null);
      setHintSuccessMessage(null);
    },
    onSuccess: (payload, variables) => {
      setHintText(payload.hint);
      setHintQuestionPrompt(variables.questionPrompt);
      setHintSuccessMessage("הרמז נפתח בהצלחה");
      setHintModalOpen(true);
      void queryClient.invalidateQueries({ queryKey: ["coins-config", "homework-hints"] });
    },
    onError: (error) => {
      const balance = Number(error.payload?.balance);
      const required = Number(error.payload?.required);

      if (error.status === 402 && Number.isFinite(balance) && Number.isFinite(required)) {
        setHintErrorMessage(`אין מספיק מטבעות. יתרה: ${balance}, נדרש: ${required}.`);
        return;
      }

      setHintErrorMessage(
        typeof error.payload?.error === "string" && error.payload.error.trim().length > 0
          ? error.payload.error
          : "לא ניתן לפתוח רמז כרגע."
      );
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
  const dataset = datasetQuery.data as Dataset | undefined;
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
  const activeQuestionIndex = activeQuestion
    ? Math.max(0, questions.findIndex((question) => question.id === activeQuestion.id))
    : -1;
  const questionNumber = activeQuestionIndex >= 0 ? activeQuestionIndex + 1 : 0;
  const dataStructureNotes = homework?.dataStructureNotes?.trim() || homework?.backgroundStory?.trim() || "";
  const questionInstructions = activeQuestion?.instructions?.trim() ?? "";
  const expectedOutputDescription = activeQuestion?.expectedOutputDescription?.trim() ?? "";
  const schemaColumnSummary = activeQuestion?.expectedResultSchema?.length
    ? activeQuestion.expectedResultSchema.map((column) => column.column).join(", ")
    : "";
  const resolvedExpectedOutputDescription = expectedOutputDescription
    || (schemaColumnSummary ? `הפלט צריך לכלול את העמודות: ${schemaColumnSummary}.` : "")
    || (isPreviewContext
      ? "לא הוגדר עדיין תיאור פלט צפוי. במצב תצוגה מקדימה כדאי להוסיף expectedOutputDescription לשאלה."
      : "לא הוגדר תיאור מפורש לפלט הצפוי. הסתמכו על נוסח השאלה ועל תוצאות השאילתה הנכונות.");
  const isExpectedOutputPlaceholder = !expectedOutputDescription;
  const activeQuestionText = useMemo(
    () => (activeQuestion ? getVisibleQuestionText(activeQuestion) : ""),
    [activeQuestion, getVisibleQuestionText],
  );
  const homeworkHintsEnabled = Boolean(coinsConfigQuery.data?.modules?.homeworkHints) && !isPreviewContext;
  const homeworkHintCost = Number(coinsConfigQuery.data?.costs?.homeworkHintOpen ?? 1);
  const sidebarTables = useMemo<Record<string, SidebarTable>>(() => {
    if (submission?.studentTableData && Object.keys(submission.studentTableData).length > 0) {
      return Object.fromEntries(
        Object.entries(submission.studentTableData).map(([tableName, rows]) => {
          const normalizedRows = Array.isArray(rows)
            ? rows.map((row) => row as Record<string, string | number | boolean | null>)
            : [];
          const previewColumns = dataset?.previewTables.find((table) => table.name === tableName)?.columns ?? [];
          const rowColumns = normalizedRows[0] ? Object.keys(normalizedRows[0]) : [];

          return [
            tableName,
            {
              columns: previewColumns.length > 0 ? previewColumns : rowColumns,
              rows: normalizedRows,
            },
          ];
        }),
      );
    }

    if (dataset?.previewTables?.length) {
      return Object.fromEntries(
        dataset.previewTables.map((table) => [
          table.name,
          {
            columns: table.columns,
            rows: (table.rows ?? []) as Record<string, string | number | boolean | null>[],
          },
        ]),
      );
    }

    return FALLBACK_SAMPLE_DATA;
  }, [dataset?.previewTables, submission?.studentTableData]);

  useEffect(() => {
    setExpandedTables((prev) => {
      const next = { ...prev };
      let changed = false;

      Object.entries(sidebarTables).forEach(([tableName, tableData]) => {
        if (prev[tableName] === undefined && tableData.rows.length > 0) {
          next[tableName] = true;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [sidebarTables]);

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

  useEffect(() => {
    if (!hintModalOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHintModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [hintModalOpen]);

  const chatHomeworkContext = useMemo(() => {
    if (!homework) return null;

    const currentQuestionIndex = activeQuestion
      ? Math.max(0, questions.findIndex((question) => question.id === activeQuestion.id))
      : -1;

    return {
      homeworkTitle: homework.title,
      backgroundStory: homework.backgroundStory,
      tables: Object.entries(sidebarTables).map(([name, data]) => ({
        name,
        columns: data.columns,
        sampleRows: data.rows,
      })),
      questions: questions.map((question, index) => ({
        id: question.id,
        prompt: getVisibleQuestionText(question),
        instructions: question.instructions,
        index: index + 1,
        points: question.points,
      })),
      currentQuestion: activeQuestion
        ? {
            id: activeQuestion.id,
            prompt: activeQuestionText,
            instructions: activeQuestion.instructions,
            index: currentQuestionIndex >= 0 ? currentQuestionIndex + 1 : 1,
          }
        : null,
      studentTableData: submission?.studentTableData,
    };
  }, [activeQuestion, activeQuestionText, getVisibleQuestionText, homework, questions, sidebarTables, submission?.studentTableData]);

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

  void (submission?.status ? t(`runner.status.${submission.status}`) : t("runner.status.in_progress"));

  return (
    <div className={styles.runner} dir={direction}>

      {/* Sidebar: Tables + Data */}
      <aside className={styles.sidebar}>
        <div className={styles.assignmentMeta}>
          <InstructionsSection
            title="מבנה הנתונים"
            instructions={dataStructureNotes}
            emptyMessage="לא צורף הסבר ייעודי למבנה הנתונים. היעזרו בטבלאות הדוגמה שמופיעות מתחת."
          />

          {/* Database Viewer */}
          <div className={styles.databaseViewerSection}>
            <div className={styles.tablesSectionHeader}>
              <h3 className={styles.tablesSectionTitle}>טבלאות לדוגמה</h3>
              <p className={styles.tablesSectionSubtitle}>
                עיינו במבנה הטבלאות ובנתונים לדוגמה לפני כתיבת השאילתה.
              </p>
            </div>
            <button
              type="button"
              className={styles.databaseViewerButton}
              onClick={() => setShowDatabaseViewer(!showDatabaseViewer)}
            >
              <span className={styles.databaseViewerButtonIcon}>{showDatabaseViewer ? "▾" : "▸"}</span>
              {showDatabaseViewer ? "הסתר נתוני דוגמא" : "הצג נתוני דוגמא"}
            </button>
            
            {showDatabaseViewer && (
              <div className={styles.databaseViewer}>
                {Object.entries(sidebarTables).map(([tableName, tableData]) => (
                  <div key={tableName} className={styles.tableSection}>
                    <button
                      type="button"
                      className={`${styles.tableHeader} ${expandedTables[tableName] ? styles.tableHeaderExpanded : ''}`}
                      onClick={() => toggleTableExpanded(tableName)}
                    >
                      <span className={styles.tableToggle}>
                        {expandedTables[tableName] ? "▾" : "▸"}
                      </span>
                      <span className={styles.tableName}>{tableName}</span>
                      <span className={styles.tableColumnCount}>
                        {tableData.columns.length} עמודות, {tableData.rows.length} שורות
                      </span>
                    </button>
                    
                    {expandedTables[tableName] && (
                      <div className={styles.tableSampleData}>
                        {tableData.rows.length > 0 ? (
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
                        ) : (
                          <p className={styles.instructionsEmpty}>לא הוגדרו שורות דוגמה לטבלה זו.</p>
                        )}
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
          {/* Question Stepper */}
          <div className={styles.questionStepperWrapper}>
            <div className={styles.questionStepper}>
              {questions.map((question, index) => {
                const qId = question.id;
                const isActive = qId === activeQuestionId;
                const answer = answers[qId];
                const hasAnswer = Boolean(answer?.sql?.trim());
                const isCompleted = Boolean(answer?.feedback?.score);
                const questionNum = index + 1;

                return (
                  <div key={qId} className={styles.stepperItem}>
                    <button
                      type="button"
                      className={`${styles.stepperCircle} ${isActive ? styles.stepperCircleActive : ''} ${isCompleted ? styles.stepperCircleCompleted : ''} ${hasAnswer && !isCompleted ? styles.stepperCircleDraft : ''}`}
                      onClick={() => setActiveQuestionId(qId)}
                      title={`שאלה ${questionNum}`}
                      aria-label={`שאלה ${questionNum}`}
                    >
                      {isCompleted ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : questionNum}
                    </button>
                    {index < questions.length - 1 && (
                      <div className={`${styles.stepperLine} ${isCompleted ? styles.stepperLineCompleted : ''}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.questionContent}>
            {activeQuestion ? (
              <div className={styles.questionSummaryCard}>
                {/* <span className={styles.questionSummaryBadge}>שאלה {questionNumber}</span> */}
                <p className={styles.questionSummaryPrompt}>{activeQuestionText}</p>
                {resolvedExpectedOutputDescription && (
                  <p
                    className={`${styles.questionSummaryOutput} ${
                      isExpectedOutputPlaceholder ? styles.questionSummaryOutputPlaceholder : ""
                    }`}
                  >
                    {resolvedExpectedOutputDescription}
                  </p>
                )}
                {homeworkHintsEnabled ? (
                  <div className={styles.questionSummaryActions}>
                    <button
                      type="button"
                      className={styles.hintButton}
                      onClick={() =>
                        activeQuestionId &&
                        hintMutation.mutate({
                          questionId: activeQuestionId,
                          questionPrompt: activeQuestionText,
                        })
                      }
                      disabled={!activeQuestionId || hintMutation.isPending}
                    >
                      {hintMutation.isPending ? "פותח רמז..." : "הצג רמז"}
                    </button>
                    <span className={styles.hintMeta}>עלות פתיחה: {homeworkHintCost} מטבע</span>
                  </div>
                ) : null}
                {hintErrorMessage ? (
                  <p className={styles.hintErrorText} role="alert">
                    {hintErrorMessage}
                  </p>
                ) : null}
                {hintSuccessMessage ? (
                  <p className={styles.hintSuccessText} role="status">
                    {hintSuccessMessage}
                  </p>
                ) : null}
              </div>
            ) : (
              <h3>{t("runner.question.placeholder")}</h3>
            )}
          </div>
        </header>

        <div className={styles.editorSection}>
          <div className={styles.editorContainer}>
            <div className={styles.editorLabel}>
              <span>SQL</span>
              <span className={styles.autosaveIndicator}>
                {autosaveState === "saving" ? "שומר..." : autosaveState === "saved" ? "נשמר ✓" : ""}
              </span>
            </div>
            <div style={{ width: '100%', height: '260px' }}>
              <div dir="ltr" style={{ width: '100%', height: '100%' }}>
                <Editor
                  height="260px"
                  value={activeQuestionId ? (editorValues[activeQuestionId] || "") : ""}
                  defaultLanguage="sql"
                  options={{
                    fontSize: 15,
                    fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Monaco, monospace",
                    minimap: { enabled: false },
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    padding: { top: 12 },
                    renderLineHighlight: "gutter",
                  }}
                  onChange={(value) => {
                    if (activeQuestionId) {
                      handleSqlChange(activeQuestionId, value || "");
                    }
                  }}
                  onMount={(editor) => {
                    editor.focus();
                  }}
                />
              </div>
            </div>
            <div className={styles.editorActions}>
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
                  → הקודמת
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
                  הבאה ←
                </button>
                <button
                  type="button"
                  className={styles.showAnswerButton}
                  onClick={() => activeQuestionId && handleShowAnswer(activeQuestionId)}
                  disabled={!activeQuestionId}
                >
                  הצג פתרון
                </button>
              </div>
              
              <button
                type="button"
                className={styles.runButton}
                onClick={handleExecute}
                disabled={executeMutation.isPending || !activeQuestionId}
              >
                {executeMutation.isPending ? (
                  <span className={styles.runButtonSpinner} />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                )}
                {executeMutation.isPending ? t("runner.actions.running") : t("runner.actions.run")}
              </button>
            </div>
          </div>

          <div className={styles.feedbackPanel}>
            <div className={styles.feedbackHeader}>
              <h4 className={styles.feedbackTitle}>{t("runner.results.heading")}</h4>
              {activeAnswer?.resultPreview && (
                <span className={styles.resultCount}>
                  {activeAnswer.resultPreview.rows.length} שורות
                  {activeAnswer.resultPreview.truncated ? " (חלקי)" : ""}
                </span>
              )}
            </div>
            {executeMutation.isError && <p className={styles.errorText}>{t("runner.results.error")}</p>}
            
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
                      <p className={styles.schemaHelpTitle}>הטבלאות והעמודות הזמינות:</p>
                      <div className={styles.schemaTablesList}>
                        {Object.entries(sidebarTables).map(([tableName, tableData]) => (
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

      {/* Left Sidebar: Michael Chat */}
      <aside className={styles.chatSidebar}>
        <div className={styles.chatHeader}>
          <div className={styles.chatAvatarSmall}>M</div>
          <div className={styles.chatHeaderText}>
            <h3 className={styles.chatTitle}>שאל את Michael</h3>
            <span className={styles.chatSubtitle}>עוזר AI לשאלות SQL</span>
          </div>
        </div>
        <div className={styles.chatContent}>
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

      {/* Submit Button - Fixed Bottom */}
      <button
        type="button"
        className={styles.submitButtonFixed}
        onClick={handleSubmitClick}
        disabled={submitMutation.isPending || submission?.status === "submitted" || submission?.status === "graded"}
      >
        {submitMutation.isPending ? (
          <span className={styles.runButtonSpinner} />
        ) : submission?.status === "submitted" ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        )}
        {submitMutation.isPending ? "שולח..." : "הגש מטלה"}
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

            <div className={styles.solutionModalBody}>
              <span className={styles.solutionModalLabel}>שאילתת הפתרון:</span>
              {solutionModalSql ? (
                <pre className={styles.solutionCode}>
                  <code>{solutionModalSql}</code>
                </pre>
              ) : (
                <p className={styles.solutionEmpty}>טרם הוגדרה תשובה לשאלה זו.</p>
              )}
            </div>

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

      {hintModalOpen && (
        <div
          className={styles.solutionModalOverlay}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setHintModalOpen(false);
            }
          }}
        >
          <div className={styles.hintModal} dir="rtl">
            <div className={styles.solutionModalHeader}>
              <h4 className={styles.solutionModalTitle}>רמז</h4>
              <button
                type="button"
                className={styles.solutionModalClose}
                onClick={() => setHintModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {hintQuestionPrompt ? <p className={styles.solutionModalPrompt}>{hintQuestionPrompt}</p> : null}

            <div className={styles.solutionModalBody}>
              <span className={styles.solutionModalLabel}>כיוון לפתרון:</span>
              <p className={styles.hintText}>{hintText}</p>
            </div>

            <div className={styles.solutionModalActions}>
              <button
                type="button"
                className={styles.showAnswerButton}
                onClick={() => setHintModalOpen(false)}
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
