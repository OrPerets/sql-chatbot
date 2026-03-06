"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowLeft, BarChart3, Download, RefreshCw } from "lucide-react";
import AdminLayout from "@/app/components/admin/AdminLayout";
import ErrorBanner from "@/app/components/admin/ErrorBanner";
import type { ExamPrepStudentRow } from "@/app/api/admin/exam-prep-analytics/route";
import styles from "./page.module.css";

const DEFAULT_SET_ID = "697b602f8d8cd886902367b1";

type SortKey =
  | "studentName"
  | "status"
  | "overallScore"
  | "progressPercent"
  | "submittedAt"
  | "gradedAt"
  | "attemptNumber"
  | "aiCommitmentSigned"
  | "totalTimeSpentMs"
  | "avgTypingSpeed"
  | "totalAttempts"
  | "totalCharactersTyped"
  | "totalEditsCount"
  | "totalCopyPasteCount"
  | "totalShowAnswerClicks"
  | "avgTimeToFirstShowAnswer"
  | "totalExecutions"
  | "hintsUsedTotal"
  | "confidenceAvg"
  | "aiAssistanceUsedCount";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "studentName", label: "סטודנט" },
  { key: "status", label: "סטטוס" },
  { key: "overallScore", label: "ציון" },
  { key: "progressPercent", label: "התקדמות" },
  { key: "submittedAt", label: "נשלח" },
  { key: "gradedAt", label: "דורג" },
  { key: "attemptNumber", label: "ניסיונות" },
  { key: "aiCommitmentSigned", label: "AI חתום" },
  { key: "totalTimeSpentMs", label: "זמן כולל" },
  { key: "avgTypingSpeed", label: "מהירות הקלדה" },
  { key: "totalAttempts", label: "ניסיונות (שאלות)" },
  { key: "totalCharactersTyped", label: "תווים" },
  { key: "totalEditsCount", label: "עריכות" },
  { key: "totalCopyPasteCount", label: "העתקות" },
  { key: "totalShowAnswerClicks", label: "לחצ׳ הצג תשובה" },
  { key: "avgTimeToFirstShowAnswer", label: "זמן להצגה ראשונה" },
  { key: "totalExecutions", label: "הרצות SQL" },
  { key: "hintsUsedTotal", label: "רמזים" },
  { key: "confidenceAvg", label: "ביטחון (ממוצע)" },
  { key: "aiAssistanceUsedCount", label: "שימוש ב-AI" },
];

function getSortValue(row: ExamPrepStudentRow, key: SortKey): string | number | null {
  switch (key) {
    case "studentName":
      return (row.studentName ?? row.studentId) ?? "";
    case "status":
      return row.status;
    case "overallScore":
      return row.overallScore;
    case "progressPercent":
      return row.progressPercent;
    case "submittedAt":
      return row.submittedAt ? new Date(row.submittedAt).getTime() : -1;
    case "gradedAt":
      return row.gradedAt ? new Date(row.gradedAt).getTime() : -1;
    case "attemptNumber":
      return row.attemptNumber;
    case "aiCommitmentSigned":
      return row.aiCommitmentSigned ? 1 : 0;
    case "totalTimeSpentMs":
      return row.analytics.totalTimeSpentMs;
    case "avgTypingSpeed":
      return row.analytics.avgTypingSpeed;
    case "totalAttempts":
      return row.analytics.totalAttempts;
    case "totalCharactersTyped":
      return row.analytics.totalCharactersTyped;
    case "totalEditsCount":
      return row.analytics.totalEditsCount;
    case "totalCopyPasteCount":
      return row.analytics.totalCopyPasteCount;
    case "totalShowAnswerClicks":
      return row.analytics.totalShowAnswerClicks;
    case "avgTimeToFirstShowAnswer":
      return row.analytics.avgTimeToFirstShowAnswer ?? -1;
    case "totalExecutions":
      return row.analytics.totalExecutions;
    case "hintsUsedTotal":
      return row.analytics.hintsUsedTotal;
    case "confidenceAvg":
      return row.analytics.confidenceAvg ?? -1;
    case "aiAssistanceUsedCount":
      return row.analytics.aiAssistanceUsedCount;
    default:
      return null;
  }
}

function formatMs(ms: number): string {
  if (ms <= 0) return "—";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec} ש׳`;
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  return `${min} ד׳ ${s} ש׳`;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "graded":
      return styles.badgeGraded;
    case "submitted":
      return styles.badgeSubmitted;
    default:
      return styles.badgeInProgress;
  }
}

export default function ExamPrepAnalyticsPage() {
  const router = useRouter();
  const [setId, setSetId] = useState(DEFAULT_SET_ID);
  const [data, setData] = useState<{
    homeworkSetId: string;
    questionCount: number;
    students: ExamPrepStudentRow[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("studentName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sortedStudents = useMemo(() => {
    if (!data?.students) return [];
    const list = [...data.students];
    list.sort((a, b) => {
      const va = getSortValue(a, sortKey);
      const vb = getSortValue(b, sortKey);
      const isNum = typeof va === "number" && typeof vb === "number";
      if (isNum) {
        return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
      }
      const sa = String(va ?? "");
      const sb = String(vb ?? "");
      const cmp = sa.localeCompare(sb, "he");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [data?.students, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/exam-prep-analytics?setId=${encodeURIComponent(setId)}`
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to load analytics");
      }
      if (!json.success || !json.data) {
        throw new Error("Invalid response");
      }
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [setId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExportCsv = () => {
    if (!data?.students?.length) return;
    const headers = [
      "studentId",
      "studentName",
      "studentIdNumber",
      "status",
      "overallScore",
      "progressPercent",
      "answeredCount",
      "totalQuestions",
      "submittedAt",
      "gradedAt",
      "attemptNumber",
      "aiCommitmentSigned",
      "totalTimeSpentMs",
      "avgTypingSpeed",
      "totalAttempts",
      "totalCharactersTyped",
      "totalEditsCount",
      "totalCopyPasteCount",
      "totalShowAnswerClicks",
      "avgTimeToFirstShowAnswer",
      "totalExecutions",
      "hintsUsedTotal",
      "confidenceAvg",
      "aiAssistanceUsedCount",
    ];
    const rows = data.students.map((s) => [
      s.studentId,
      s.studentName ?? "",
      s.studentIdNumber ?? "",
      s.status,
      String(s.overallScore),
      String(s.progressPercent),
      String(s.answeredCount),
      String(s.totalQuestions),
      s.submittedAt ?? "",
      s.gradedAt ?? "",
      String(s.attemptNumber),
      s.aiCommitmentSigned ? "1" : "0",
      String(s.analytics.totalTimeSpentMs),
      String(s.analytics.avgTypingSpeed),
      String(s.analytics.totalAttempts),
      String(s.analytics.totalCharactersTyped),
      String(s.analytics.totalEditsCount),
      String(s.analytics.totalCopyPasteCount),
      String(s.analytics.totalShowAnswerClicks),
      s.analytics.avgTimeToFirstShowAnswer != null
        ? String(s.analytics.avgTimeToFirstShowAnswer)
        : "",
      String(s.analytics.totalExecutions),
      String(s.analytics.hintsUsedTotal),
      s.analytics.confidenceAvg != null
        ? String(s.analytics.confidenceAvg)
        : "",
      String(s.analytics.aiAssistanceUsedCount),
    ]);
    const csv =
      [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exam-prep-analytics-${setId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout
      activeTab="exam-prep-analytics"
      onTabChange={() => {}}
      currentUser={null}
      onLogout={() => {}}
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <button
            type="button"
            onClick={() => router.back()}
            className={styles.backButton}
          >
            <ArrowLeft size={20} />
            חזור
          </button>
          <div className={styles.titleSection}>
            <BarChart3 size={32} />
            <div>
              <h1>אנליטיקת הכנה למבחן</h1>
              <p>ניתוח פעילות סטודנטים לפי הגשות ואנליטיקת שאלות (מטלה 697b602f8d8cd886902367b1)</p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleExportCsv}
              disabled={!data?.students?.length}
            >
              <Download size={18} />
              יצוא CSV
            </button>
            <button
              type="button"
              className={styles.refreshButton}
              onClick={fetchData}
              disabled={loading}
            >
              <RefreshCw size={18} />
              {loading ? "טוען..." : "רענן"}
            </button>
          </div>
        </div>

        <div className={styles.filterBar}>
          <label>
            מזהה סט מטלה:
            <input
              type="text"
              value={setId}
              onChange={(e) => setSetId(e.target.value)}
              placeholder="697b602f8d8cd886902367b1"
            />
          </label>
        </div>

        {error && (
          <ErrorBanner
            message="טעינת האנליטיקה נכשלה"
            details={error}
            retryable
            onRetry={fetchData}
          />
        )}

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>טבלת סטודנטים ומדדים</h2>
            <span className={styles.sectionMeta}>
              {data
                ? `סה״כ ${data.students.length} סטודנטים · ${data.questionCount} שאלות בסט`
                : "מבוסס על submissions + question_analytics"}
            </span>
          </div>

          {loading && (
            <div className={styles.loadingStack}>טוען נתונים...</div>
          )}

          {!loading && data && data.students.length === 0 && (
            <div className={styles.emptyState}>
              לא נמצאו הגשות או נתוני אנליטיקה לסט המטלה הזה.
            </div>
          )}

          {!loading && data && data.students.length > 0 && (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {COLUMNS.map(({ key, label }) => (
                      <th
                        key={key}
                        className={styles.sortableTh}
                        onClick={() => handleSort(key)}
                        role="columnheader"
                        aria-sort={
                          sortKey === key
                            ? sortDir === "asc"
                              ? "ascending"
                              : "descending"
                            : undefined
                        }
                      >
                        <span className={styles.thContent}>
                          {label}
                          {sortKey === key &&
                            (sortDir === "asc" ? (
                              <ArrowUp size={14} className={styles.sortIcon} />
                            ) : (
                              <ArrowDown size={14} className={styles.sortIcon} />
                            ))}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedStudents.map((row) => (
                    <tr key={row.submissionId}>
                      <td>{row.studentName ?? row.studentId}</td>
                      <td>
                        <span
                          className={`${styles.badge} ${statusBadgeClass(row.status)}`}
                        >
                          {row.status === "graded"
                            ? "דורג"
                            : row.status === "submitted"
                              ? "נשלח"
                              : "בתהליך"}
                        </span>
                      </td>
                      <td>{row.overallScore}</td>
                      <td>
                        {row.answeredCount}/{row.totalQuestions} ({row.progressPercent}%)
                      </td>
                      <td>{formatDate(row.submittedAt)}</td>
                      <td>{formatDate(row.gradedAt)}</td>
                      <td>{row.attemptNumber}</td>
                      <td>{row.aiCommitmentSigned ? "כן" : "—"}</td>
                      <td>{formatMs(row.analytics.totalTimeSpentMs)}</td>
                      <td>{row.analytics.avgTypingSpeed || "—"}</td>
                      <td>{row.analytics.totalAttempts}</td>
                      <td>{row.analytics.totalCharactersTyped.toLocaleString("he-IL")}</td>
                      <td>{row.analytics.totalEditsCount}</td>
                      <td>{row.analytics.totalCopyPasteCount}</td>
                      <td>{row.analytics.totalShowAnswerClicks}</td>
                      <td>
                        {row.analytics.avgTimeToFirstShowAnswer != null
                          ? formatMs(row.analytics.avgTimeToFirstShowAnswer)
                          : "—"}
                      </td>
                      <td>{row.analytics.totalExecutions}</td>
                      <td>{row.analytics.hintsUsedTotal}</td>
                      <td>
                        {row.analytics.confidenceAvg != null
                          ? row.analytics.confidenceAvg
                          : "—"}
                      </td>
                      <td>{row.analytics.aiAssistanceUsedCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
