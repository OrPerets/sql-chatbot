"use client";

import type React from "react";
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

const AUTOSAVE_DELAY = 800;

// Transform background story for תרגיל 3
const transformBackgroundStory = (story: string | undefined, title: string): string => {
  if (!story) return "";
  
  // Only transform if it's תרגיל 3
  if (title === "תרגיל 3" || title === "תרגיל בית 3") {
    // First, remove unwanted sections from the entire story (before processing)
    let cleanedStory = story;
    
    // Remove: "הנחייה חשובה" section - remove from entire story first
    cleanedStory = cleanedStory.replace(/הנחייה חשובה:[\s\S]*?וכד'\.?\s*/g, "").trim();
    cleanedStory = cleanedStory.replace(/הנחייה חשובה:[^\n]*(?:[^\n]*וכד'[^\n]*)?/g, "").trim();
    
    // Remove: "דוגמא: אם ת.ז.:321654987 (ABCDEFGHI), אז ABC= 321, DEF= 654, GHI= 987."
    cleanedStory = cleanedStory.replace(/דוגמא: אם ת\.ז\.:321654987 \(ABCDEFGHI\), אז ABC= 321, DEF= 654, GHI= 987\.\s*/g, "").trim();
    
    // Remove: "יש להיצמד להגדרות סוגי הנתונים בבואכם להגדיר את סכמת הטבלה לפי הפירוט המופיע בכל טבלה וטבלה."
    cleanedStory = cleanedStory.replace(/יש להיצמד להגדרות סוגי הנתונים בבואכם להגדיר את סכמת הטבלה לפי הפירוט המופיע בכל טבלה וטבלה\.\s*/g, "").trim();
    
    // Remove: "למרות שניתן לפתור את התרגיל רק ע"י הצגת הסכמות וללא רשומות בטבלאות עצמן כפי שלמדנו בתרגיל 2, נבנו בתרגיל זה לכל טבלה מספר רשומות לדוגמא בכדי לסייע בהבנת הסכמות. עם זאת במקרה ותשובה של אחת מהשאילתות יוצאת ריקה - יש להוסיף נתונים לטבלאות כך שע"י הפעלת כל אחת מהשאילתות בתרגיל תתקבל תשובה שאינה טבלה ריקה, ז"א עליכם למלא תוכן רלוונטי בטבלאות כך שבכל תוצאת שאילתא תחזור לפחות שורה אחת - שאילתות שיחזירו סכמות ריקות לא תקבלנה את מלאו הנקודות!"
    cleanedStory = cleanedStory.replace(/למרות שניתן לפתור את התרגיל רק ע"י הצגת הסכמות וללא רשומות בטבלאות עצמן כפי שלמדנו בתרגיל 2, נבנו בתרגיל זה לכל טבלה מספר רשומות לדוגמא בכדי לסייע בהבנת הסכמות\. עם זאת במקרה ותשובה של אחת מהשאילתות יוצאת ריקה - יש להוסיף נתונים לטבלאות כך שע"י הפעלת כל אחת מהשאילתות בתרגיל תתקבל תשובה שאינה טבלה ריקה, ז"א עליכם למלא תוכן רלוונטי בטבלאות כך שבכל תוצאת שאילתא תחזור לפחות שורה אחת - שאילתות שיחזירו סכמות ריקות לא תקבלנה את מלאו הנקודות!\s*/g, "").trim();
    
    // Remove any remaining lines that contain "הנחייה חשובה"
    const allLines = cleanedStory.split('\n');
    cleanedStory = allLines.filter(line => !line.includes('הנחייה חשובה')).join('\n').trim();
    
    // Remove existing credits note from the entire story (before processing)
    cleanedStory = cleanedStory.replace(/עמודת credits מייצגת[^\n]*/g, "").trim();
    cleanedStory = cleanedStory.replace(/עמודת credits מייצגת את כמות נקודות הזכות שהסטודנט יקבל בסיום הקורס\.?\s*/g, "").trim();
    
    // Now process the cleaned story
    // Find where the tables start
    const tablesStart = cleanedStory.indexOf("1) מידע על הסטודנטים:");
    if (tablesStart === -1) return cleanedStory;
    
    // Find where the tables end (after Enrollments table definition)
    const enrollmentsEnd = cleanedStory.indexOf("Enrollments (StudentID, CourseID, EnrollmentDate, Grade)");
    if (enrollmentsEnd === -1) return cleanedStory;
    
    // Find the newline after the Enrollments line
    let tablesEndIndex = cleanedStory.indexOf("\n", enrollmentsEnd + 60);
    if (tablesEndIndex === -1) tablesEndIndex = cleanedStory.length;
    
    // Extract the tables section
    const tablesText = cleanedStory.substring(tablesStart, tablesEndIndex).trim();
    
    // Get everything after the tables
    let afterTables = cleanedStory.substring(tablesEndIndex).trim();
    
    // Clean up multiple consecutive newlines
    afterTables = afterTables.replace(/\n{3,}/g, "\n\n").trim();
    
    // Build the new background story
    const newFirstParagraph = `בתרגיל זה, נתון מסד נתונים הקשור לניהול מערכת סטודנטים וקורסים במכללה. הנכם מגלמים תפקיד של מנהל/מנהלת מערכת קורסים במכללה האחראי/ת על ניהול קורסים, סטודנטים, מרצים ונרשמים לקורסים. מסד הנתונים כולל 4 טבלאות.`;
    const creditsNote = `עמודת credits מייצגת את כמות נקודות הזכות שהסטודנט יקבל בסיום הקורס`;
    
    // Combine: new first paragraph + tables + credits note + rest
    if (afterTables) {
      return `${newFirstParagraph}\n\n${tablesText}\n\n${creditsNote}\n\n${afterTables}`;
    } else {
      return `${newFirstParagraph}\n\n${tablesText}\n\n${creditsNote}`;
    }
  }
  
  return story;
};

// Database sample data for each table (matches תרגיל 3 schema)
const DATABASE_SAMPLE_DATA: Record<string, { columns: string[]; rows: Record<string, string | number>[] }> = {
  Students: {
    columns: ["StudentID", "FirstName", "LastName", "BirthDate", "City", "Email"],
    rows: [
      { StudentID: 1, FirstName: "יעל", LastName: "כהן", BirthDate: "1999-03-15", City: "תל אביב", Email: "yael@example.com" },
      { StudentID: 2, FirstName: "דוד", LastName: "לוי", BirthDate: "2000-07-22", City: "חיפה", Email: "david@example.com" },
      { StudentID: 3, FirstName: "שרה", LastName: "מזרחי", BirthDate: "1998-11-08", City: "ירושלים", Email: "sara@example.com" },
    ],
  },
  Courses: {
    columns: ["CourseID", "CourseName", "Credits", "Department"],
    rows: [
      { CourseID: 101, CourseName: "מבוא למערכות מידע", Credits: 3, Department: "מערכות מידע" },
      { CourseID: 102, CourseName: "מסדי נתונים", Credits: 4, Department: "מדעי המחשב" },
      { CourseID: 103, CourseName: "תכנות מתקדם", Credits: 3, Department: "מדעי המחשב" },
    ],
  },
  Lecturers: {
    columns: ["LecturerID", "FirstName", "LastName", "City", "HireDate", "CourseID", "Seniority"],
    rows: [
      { LecturerID: 1, FirstName: "משה", LastName: "אברהם", City: "תל אביב", HireDate: "2015-09-01", CourseID: 101, Seniority: 9 },
      { LecturerID: 2, FirstName: "רות", LastName: "בנימין", City: "חיפה", HireDate: "2018-03-15", CourseID: 102, Seniority: 6 },
      { LecturerID: 3, FirstName: "יוסף", LastName: "כהן", City: "ירושלים", HireDate: "2020-10-01", CourseID: 103, Seniority: 4 },
    ],
  },
  Enrollments: {
    columns: ["StudentID", "CourseID", "EnrollmentDate", "Grade"],
    rows: [
      { StudentID: 1, CourseID: 101, EnrollmentDate: "2024-09-01", Grade: 85 },
      { StudentID: 1, CourseID: 102, EnrollmentDate: "2024-09-01", Grade: 92 },
      { StudentID: 2, CourseID: 101, EnrollmentDate: "2024-09-01", Grade: 78 },
      { StudentID: 3, CourseID: 103, EnrollmentDate: "2024-09-01", Grade: 88 },
    ],
  },
};

export function RunnerClient({ setId, studentId }: RunnerClientProps) {
  const queryClient = useQueryClient();
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [editorValues, setEditorValues] = useState<Record<string, string>>({});
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCommitmentDialog, setShowCommitmentDialog] = useState(false);
  const [aiCommitmentChecked, setAiCommitmentChecked] = useState(false);
  const [aiEvidenceFile, setAiEvidenceFile] = useState<File | null>(null);
  const [commitmentError, setCommitmentError] = useState<string | null>(null);
  const [showDatabaseViewer, setShowDatabaseViewer] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});
  const pendingRef = useRef<Record<string, PendingSave>>({});
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
    mutationFn: (payload?: FormData) => submitHomework(setId, payload ?? { studentId }),
    onSuccess: (submission) => {
      // Update the query cache immediately so the component re-renders with new status
      queryClient.setQueryData<Submission | undefined>(["submission", setId, studentId], submission);
      queryClient.invalidateQueries({ queryKey: ["submission", setId, studentId] });
      // Close confirmation dialog
      setShowConfirmDialog(false);
      setShowCommitmentDialog(false);
      setAiCommitmentChecked(false);
      setAiEvidenceFile(null);
      // The page will automatically show SubmittedPage due to the check below
      // Force a refetch to ensure the UI updates
      submissionQuery.refetch();
    },
  });

  const handleSubmitClick = useCallback(() => {
    setShowConfirmDialog(true);
  }, []);

  const handleConfirmSubmit = useCallback(() => {
    setShowConfirmDialog(false);
    setShowCommitmentDialog(true);
  }, []);

  const handleCancelSubmit = useCallback(() => {
    setShowConfirmDialog(false);
  }, []);

  const handleCommitmentConfirm = useCallback(() => {
    if (!aiCommitmentChecked && !aiEvidenceFile) {
      setCommitmentError("יש לסמן הצהרה או לצרף קובץ שיחה");
      return;
    }

    setCommitmentError(null);
    const formData = new FormData();
    formData.append("studentId", studentId);
    formData.append("aiConfirmed", aiCommitmentChecked ? "true" : "false");
    if (aiEvidenceFile) {
      formData.append("aiFile", aiEvidenceFile);
    }

    submitMutation.mutate(formData);
  }, [aiCommitmentChecked, aiEvidenceFile, studentId, submitMutation]);

  const handleCommitmentCancel = useCallback(() => {
    setShowCommitmentDialog(false);
  }, []);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setAiEvidenceFile(file ?? null);
  }, []);

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

  useEffect(() => {
    if (showCommitmentDialog) {
      setCommitmentError(null);
    }
  }, [showCommitmentDialog]);

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
  const attemptsRemaining = activeQuestion?.maxAttempts
    ? Math.max(0, activeQuestion.maxAttempts - (activeAnswer?.executionCount ?? 0))
    : undefined;

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

  const handleDownloadDatabasePdf = useCallback(async () => {
    try {
      setIsDownloadingPdf(true);
      const response = await fetch(`/api/homework/${setId}/database-pdf?studentId=${studentId}`);

      if (!response.ok) {
        console.error("Failed to download database PDF", await response.text());
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `database-${setId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading database PDF", error);
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [setId, studentId]);

  return (
    <div className={styles.runner} dir={direction}>

      {/* Confirmation Dialog Overlay */}
      {showConfirmDialog && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmDialog}>
            <h3 className={styles.confirmTitle}>אישור הגשה</h3>
            <p className={styles.confirmText}>
              האם אתה בטוח שברצונך להגיש? לאחר מכן לא יהיה ניתן לחזור ולערוך את התרגיל
            </p>
            <div className={styles.confirmActions}>
              <button
                className={styles.confirmButton}
                onClick={handleConfirmSubmit}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? "מגיש..." : "כן, הגש"}
              </button>
              <button
                className={styles.cancelButton}
                onClick={handleCancelSubmit}
                disabled={submitMutation.isPending}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {showCommitmentDialog && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmDialog}>
            <h3 className={styles.confirmTitle}>הצהרת שימוש ב-AI</h3>
            <p className={styles.confirmText}>
              אני הסטודנט/ית מתחייב/ת שאם השתמשתי בכלי AI אחר אני מצרף/ת את השיחה להלן או
              מסמן/ת שלא נעשה שימוש בכלי AI חיצוניים.
            </p>

            <label className={styles.commitmentCheckbox}>
              <input
                type="checkbox"
                checked={aiCommitmentChecked}
                onChange={(event) => setAiCommitmentChecked(event.target.checked)}
                disabled={submitMutation.isPending}
              />
              <span>אישרתי שלא השתמשתי בכלי AI</span>
            </label>

            <div className={styles.commitmentFileRow}>
              <label className={styles.fileLabel} htmlFor="ai-file-upload">
                צרף קובץ שיחה (אופציונלי)
              </label>
              <input
                id="ai-file-upload"
                type="file"
                accept=".pdf,.txt,.doc,.docx,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                disabled={submitMutation.isPending}
              />
              {aiEvidenceFile && (
                <p className={styles.fileName}>קובץ נבחר: {aiEvidenceFile.name}</p>
              )}
            </div>

            {commitmentError && <p className={styles.commitmentError}>{commitmentError}</p>}

            <div className={styles.confirmActions}>
              <button
                className={styles.confirmButton}
                onClick={handleCommitmentConfirm}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? "מגיש..." : "אישור והגשה"}
              </button>
              <button
                className={styles.cancelButton}
                onClick={handleCommitmentCancel}
                disabled={submitMutation.isPending}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Right Sidebar: Background Story */}
      <aside className={styles.sidebar}>
        <div className={styles.assignmentMeta}>
          {homework.backgroundStory && (
            <InstructionsSection
              instructions={transformBackgroundStory(homework.backgroundStory, homework.title)}
            />
          )}

          {/* Database Viewer Button */}
          <div className={styles.databaseViewerSection}>
            <button
              type="button"
              className={styles.databasePdfButton}
              onClick={handleDownloadDatabasePdf}
              disabled={isDownloadingPdf}
            >
              <span>📄</span>
              {isDownloadingPdf ? "יוצר PDF..." : "הורד PDF של מסד הנתונים"}
            </button>

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
          <div className={styles.unknownAnswerNote}>
            💡 עבור שאלות שאינכם יודעים לענות, עליכם לרשום &quot;X&quot;
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

      {/* Right Sidebar: Michael Chat */}
      <aside className={styles.chatSidebar}>
        <div className={styles.chatHeader}>
          <span className={styles.chatIcon}>💬</span>
          <h3 className={styles.chatTitle}>שאל את Michael</h3>
        </div>
        <div className={styles.chatContent}>
          <Chat
            chatId={null}
            hideSidebar={true}
            hideAvatar={true}
            minimalMode={true}
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
        {submitMutation.isPending
          ? t("runner.actions.submitting")
          : submission?.status === "submitted"
            ? t("runner.actions.submitted")
            : t("runner.actions.submit")}
      </button>
    </div>
  );
}
