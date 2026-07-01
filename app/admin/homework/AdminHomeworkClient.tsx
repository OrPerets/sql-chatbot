"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileText,
  Filter,
  GraduationCap,
  Inbox,
  ListChecks,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  Users,
  X,
} from "lucide-react";

import BuilderDashboardPage from "@/app/homework/builder/page";
import type { Question, Submission } from "@/app/homework/types";
import type {
  AdminHomeworkManagementPayload,
  AdminHomeworkSubmissionPayload,
  AdminHomeworkUserRow,
} from "@/lib/admin-homework-management";

import styles from "./homework-admin.module.css";

type Mode = "builder" | "students";
type StatusFilter =
  | "attention"
  | "all"
  | "none"
  | "in_progress"
  | "submitted"
  | "graded"
  | "blocked"
  | "override"
  | "open"
  | "closing_soon";

const STATUS_FILTERS = new Set<StatusFilter>([
  "attention",
  "all",
  "none",
  "in_progress",
  "submitted",
  "graded",
  "blocked",
  "override",
  "open",
  "closing_soon",
]);

interface AccessEditorState {
  row: AdminHomeworkUserRow;
  availableFrom: string;
  availableUntil: string;
}

interface SubmissionDialogState {
  row: AdminHomeworkUserRow;
  loading: boolean;
  error: string | null;
  payload: AdminHomeworkSubmissionPayload | null;
}

const STATUS_LABELS: Record<string, string> = {
  none: "אין הגשה",
  in_progress: "בתהליך",
  submitted: "הוגש",
  graded: "נבדק",
  upcoming: "טרם נפתח",
  open: "פתוח",
  closed: "סגור",
};

function isStatusFilter(value: string | null): value is StatusFilter {
  return Boolean(value && STATUS_FILTERS.has(value as StatusFilter));
}

function getRowKey(row: AdminHomeworkUserRow, index: number) {
  if (row.user.id) return `user:${row.user.id}`;
  if (row.submission.id) return `submission:${row.submission.id}`;
  if (row.user.studentIdNumber) return `student-id:${row.user.studentIdNumber}`;
  return `email:${row.user.email}:row:${index}`;
}

function getHoursUntil(value?: string | null) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return null;
  return (timestamp - Date.now()) / (1000 * 60 * 60);
}

function isClosingSoon(row: AdminHomeworkUserRow) {
  if (!row.access.accessible || row.access.availabilityState !== "open") return false;
  const hoursUntilClose = getHoursUntil(row.access.effectiveAvailableUntil);
  return hoursUntilClose !== null && hoursUntilClose >= 0 && hoursUntilClose <= 48;
}

function getAttentionReason(row: AdminHomeworkUserRow) {
  if (!row.access.accessible && row.access.availabilityState === "closed" && row.submission.status !== "graded") {
    return "סגור לגישה";
  }
  if (row.submission.status === "submitted") return "ממתין לבדיקה";
  if (row.submission.status === "none" && row.access.accessible) return "אין הגשה";
  if (row.submission.status === "in_progress" && row.submission.progress > 0) return "טיוטה פעילה";
  if (isClosingSoon(row) && row.submission.status !== "graded") return "נסגר בקרוב";
  return "";
}

function getNextAction(row: AdminHomeworkUserRow) {
  if (!row.access.accessible && row.access.availabilityState === "closed" && row.submission.status !== "graded") {
    return { label: "פתח חלון", tone: "danger" };
  }
  if (row.submission.status === "submitted") return { label: "בדוק הגשה", tone: "info" };
  if (row.submission.status === "graded") return { label: "נבדק", tone: "success" };
  if (row.submission.status === "in_progress") return { label: "בדוק טיוטה", tone: "warning" };
  if (row.submission.status === "none" && row.access.accessible) return { label: "מעקב", tone: "neutral" };
  if (row.access.hasOverride) return { label: "בדוק פתיחה", tone: "override" };
  return { label: "פתח הגשה", tone: "neutral" };
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateTimeInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoFromInputValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Request failed (${response.status})`);
  }
  return payload as T;
}

function getCsvValue(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(rows: AdminHomeworkUserRow[], homeworkTitle: string) {
  const headers = [
    "name",
    "email",
    "student_id",
    "submission_status",
    "progress",
    "score",
    "accessible",
    "availability_state",
    "effective_from",
    "effective_until",
    "submitted_at",
    "graded_at",
  ];
  const body = rows.map((row) => [
    row.user.name,
    row.user.email,
    row.user.studentIdNumber ?? "",
    row.submission.status,
    `${Math.round(row.submission.progress * 100)}%`,
    row.submission.overallScore ?? "",
    row.access.accessible ? "yes" : "no",
    row.access.availabilityState,
    row.access.effectiveAvailableFrom ?? "",
    row.access.effectiveAvailableUntil ?? "",
    row.submission.submittedAt ?? "",
    row.submission.gradedAt ?? "",
  ]);
  const csv = [headers, ...body].map((line) => line.map(getCsvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${homeworkTitle || "homework"}-student-management.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function answerSummary(answer: Submission["answers"][string] | undefined) {
  if (!answer) return { attempts: 0, score: "-", lastExecutedAt: undefined };
  return {
    attempts: answer.executionCount ?? 0,
    score: typeof answer.feedback?.score === "number" ? answer.feedback.score : "-",
    lastExecutedAt: answer.lastExecutedAt,
  };
}

function StudentManagementPanel({ initialFilter }: { initialFilter: StatusFilter }) {
  const [payload, setPayload] = useState<AdminHomeworkManagementPayload | null>(null);
  const [selectedSetId, setSelectedSetId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialFilter);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [bulkFrom, setBulkFrom] = useState("");
  const [bulkUntil, setBulkUntil] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [accessEditor, setAccessEditor] = useState<AccessEditorState | null>(null);
  const [submissionDialog, setSubmissionDialog] = useState<SubmissionDialogState | null>(null);

  const loadManagementData = useCallback(async (setId: string) => {
    setLoading(true);
    setError(null);
    try {
      const query = setId ? `?setId=${encodeURIComponent(setId)}` : "";
      const data = await fetchJson<AdminHomeworkManagementPayload>(`/api/admin/homework-management${query}`);
      setPayload(data);
      setSelectedSetId(data.selectedSet?.id ?? "");
      setSelectedRowKeys([]);
    } catch (loadError) {
      console.error("Failed to load homework management:", loadError);
      setError(loadError instanceof Error ? loadError.message : "טעינת נתוני המטלות נכשלה.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadManagementData("");
  }, [loadManagementData]);

  useEffect(() => {
    setStatusFilter(initialFilter);
  }, [initialFilter]);

  const rows = useMemo(() => payload?.rows ?? [], [payload?.rows]);
  const selectedSet = payload?.selectedSet ?? null;

  const rowItems = useMemo(
    () =>
      rows.map((row, index) => ({
        row,
        rowKey: getRowKey(row, index),
        attentionReason: getAttentionReason(row),
        closingSoon: isClosingSoon(row),
      })),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return rowItems.filter(({ row, attentionReason, closingSoon }) => {
      const matchesFilter =
        statusFilter === "all" ||
        (statusFilter === "attention" && Boolean(attentionReason)) ||
        (statusFilter === "blocked" && !row.access.accessible && row.access.availabilityState === "closed") ||
        (statusFilter === "override" && row.access.hasOverride) ||
        (statusFilter === "open" && row.access.accessible && row.access.availabilityState === "open") ||
        (statusFilter === "closing_soon" && closingSoon) ||
        row.submission.status === statusFilter;

      if (!matchesFilter) {
        return false;
      }
      if (!normalizedSearch) return true;
      return (
        row.user.name.toLowerCase().includes(normalizedSearch) ||
        row.user.email.toLowerCase().includes(normalizedSearch) ||
        String(row.user.studentIdNumber || "").includes(normalizedSearch)
      );
    });
  }, [rowItems, searchTerm, statusFilter]);

  const selectedRowKeySet = useMemo(() => new Set(selectedRowKeys), [selectedRowKeys]);
  const selectedRows = useMemo(
    () => rowItems.filter((item) => selectedRowKeySet.has(item.rowKey)).map((item) => item.row),
    [rowItems, selectedRowKeySet],
  );

  const triage = useMemo(() => {
    return rowItems.reduce(
      (acc, item) => {
        acc.attention += item.attentionReason ? 1 : 0;
        acc.open += item.row.access.accessible && item.row.access.availabilityState === "open" ? 1 : 0;
        acc.closingSoon += item.closingSoon ? 1 : 0;
        return acc;
      },
      { attention: 0, open: 0, closingSoon: 0 },
    );
  }, [rowItems]);

  const openAccessEditor = (row: AdminHomeworkUserRow) => {
    setAccessEditor({
      row,
      availableFrom: toDateTimeInputValue(row.access.effectiveAvailableFrom || row.access.globalAvailableFrom),
      availableUntil: toDateTimeInputValue(row.access.effectiveAvailableUntil || row.access.globalAvailableUntil),
    });
    setError(null);
    setSuccess(null);
  };

  const saveAccessOverride = async () => {
    if (!accessEditor || !selectedSet) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await fetchJson("/api/admin/homework-management/access", {
        method: "PUT",
        body: JSON.stringify({
          homeworkSetId: selectedSet.id,
          userEmail: accessEditor.row.user.email,
          availableFrom: toIsoFromInputValue(accessEditor.availableFrom),
          availableUntil: toIsoFromInputValue(accessEditor.availableUntil),
        }),
      });
      setSuccess("חלון הזמנים האישי נשמר.");
      setAccessEditor(null);
      await loadManagementData(selectedSet.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "שמירת חלון הזמנים נכשלה.");
    } finally {
      setSaving(false);
    }
  };

  const clearAccessOverride = async (row: AdminHomeworkUserRow) => {
    if (!selectedSet) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await fetchJson(
        `/api/admin/homework-management/access?homeworkSetId=${encodeURIComponent(selectedSet.id)}&userEmail=${encodeURIComponent(row.user.email)}`,
        { method: "DELETE" },
      );
      setSuccess("הפתיחה האישית נמחקה.");
      await loadManagementData(selectedSet.id);
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "מחיקת הפתיחה האישית נכשלה.");
    } finally {
      setSaving(false);
    }
  };

  const applyBulkWindow = async () => {
    if (!selectedSet || selectedRows.length === 0 || !bulkFrom || !bulkUntil) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await Promise.all(selectedRows.map((row) => fetchJson("/api/admin/homework-management/access", {
        method: "PUT",
        body: JSON.stringify({
          homeworkSetId: selectedSet.id,
          userEmail: row.user.email,
          availableFrom: toIsoFromInputValue(bulkFrom),
          availableUntil: toIsoFromInputValue(bulkUntil),
        }),
      })));
      setSuccess(`עודכנו ${selectedRows.length} סטודנטים.`);
      setBulkFrom("");
      setBulkUntil("");
      await loadManagementData(selectedSet.id);
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : "עדכון מרובה נכשל.");
    } finally {
      setSaving(false);
    }
  };

  const openSubmission = async (row: AdminHomeworkUserRow) => {
    if (!selectedSet) return;
    setSubmissionDialog({ row, loading: true, error: null, payload: null });
    try {
      const data = await fetchJson<AdminHomeworkSubmissionPayload>(
        `/api/admin/homework-management/submission?setId=${encodeURIComponent(selectedSet.id)}&studentId=${encodeURIComponent(row.user.email)}`,
      );
      setSubmissionDialog({ row, loading: false, error: null, payload: data });
    } catch (dialogError) {
      setSubmissionDialog({
        row,
        loading: false,
        error: dialogError instanceof Error ? dialogError.message : "טעינת ההגשה נכשלה.",
        payload: null,
      });
    }
  };

  const reopenSubmission = async () => {
    if (!submissionDialog || !selectedSet) return;
    setSaving(true);
    setError(null);
    try {
      await fetchJson("/api/admin/homework-management/submission-actions", {
        method: "POST",
        body: JSON.stringify({
          action: "reopen",
          homeworkSetId: selectedSet.id,
          studentId: submissionDialog.row.user.email,
        }),
      });
      setSuccess("ההגשה נפתחה מחדש ונשמר עותק ארכיון.");
      setSubmissionDialog(null);
      await loadManagementData(selectedSet.id);
    } catch (reopenError) {
      setError(reopenError instanceof Error ? reopenError.message : "פתיחה מחדש נכשלה.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={styles.management} dir="rtl">
      <div className={styles.managementHeader}>
        <div>
          <h2>בקרת מטלה</h2>
          <p>{selectedSet ? selectedSet.title : "בחר מטלה כדי לראות הגשות, חסימות ופתיחות אישיות."}</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.secondaryButton} onClick={() => loadManagementData(selectedSetId)} disabled={loading}>
            <RefreshCw size={16} />
            רענן
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => downloadCsv(filteredRows.map((item) => item.row), selectedSet?.title || "homework")}
            disabled={filteredRows.length === 0}
          >
            <Download size={16} />
            יצוא CSV
          </button>
        </div>
      </div>

      <div className={styles.triageStrip} aria-label="סינון מהיר לפי מצב">
        <button
          type="button"
          className={statusFilter === "attention" ? styles.activeTriage : ""}
          data-tone="warning"
          onClick={() => setStatusFilter("attention")}
        >
          <AlertTriangle size={18} />
          <strong>{triage.attention}</strong>
          <span>צריך טיפול</span>
        </button>
        <button
          type="button"
          className={statusFilter === "submitted" ? styles.activeTriage : ""}
          data-tone="info"
          onClick={() => setStatusFilter("submitted")}
        >
          <CheckCircle2 size={18} />
          <strong>{payload?.summary.submitted ?? 0}</strong>
          <span>הוגשו לבדיקה</span>
        </button>
        <button
          type="button"
          className={statusFilter === "none" ? styles.activeTriage : ""}
          data-tone="neutral"
          onClick={() => setStatusFilter("none")}
        >
          <Inbox size={18} />
          <strong>{payload?.summary.noSubmission ?? 0}</strong>
          <span>ללא הגשה</span>
        </button>
        <button
          type="button"
          className={statusFilter === "blocked" ? styles.activeTriage : ""}
          data-tone="danger"
          onClick={() => setStatusFilter("blocked")}
        >
          <ShieldAlert size={18} />
          <strong>{payload?.summary.blockedByClosedWindow ?? 0}</strong>
          <span>סגור לגישה</span>
        </button>
        <button
          type="button"
          className={statusFilter === "override" ? styles.activeTriage : ""}
          data-tone="override"
          onClick={() => setStatusFilter("override")}
        >
          <CalendarClock size={18} />
          <strong>{payload?.summary.overrides ?? 0}</strong>
          <span>פתיחות אישיות</span>
        </button>
        <button
          type="button"
          className={statusFilter === "closing_soon" ? styles.activeTriage : ""}
          data-tone="closing"
          onClick={() => setStatusFilter("closing_soon")}
        >
          <Clock3 size={18} />
          <strong>{triage.closingSoon}</strong>
          <span>נסגר בקרוב</span>
        </button>
      </div>

      <div className={styles.toolbar}>
        <label className={styles.field}>
          <span>מטלה</span>
          <select
            value={selectedSetId}
            onChange={(event) => {
              setSelectedSetId(event.target.value);
              void loadManagementData(event.target.value);
            }}
          >
            {(payload?.homeworkSets ?? []).map((set) => (
              <option key={set.id} value={set.id}>
                {set.title}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.searchField}>
          <Search size={16} />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="חיפוש לפי שם, אימייל או ת.ז"
          />
        </label>
        <label className={styles.field}>
          <span>תצוגה</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
            <option value="attention">צריך טיפול</option>
            <option value="all">כולם</option>
            <option value="open">פתוחים עכשיו</option>
            <option value="closing_soon">נסגר בקרוב</option>
            <option value="none">ללא הגשה</option>
            <option value="in_progress">בתהליך</option>
            <option value="submitted">הוגש</option>
            <option value="graded">נבדק</option>
            <option value="blocked">סגור לגישה</option>
            <option value="override">פתיחות אישיות</option>
          </select>
        </label>
        <div className={styles.resultCount}>
          <Filter size={15} />
          {filteredRows.length} מתוך {rows.length}
        </div>
      </div>

      {payload?.summary ? (
        <div className={styles.statsGrid}>
          <div className={styles.statCard} data-tone="total"><Users size={18} /><strong>{payload.summary.totalUsers}</strong><span>סטודנטים</span></div>
          <div className={styles.statCard} data-tone="open"><ListChecks size={18} /><strong>{triage.open}</strong><span>פתוחים עכשיו</span></div>
          <div className={styles.statCard} data-tone="warning"><FileText size={18} /><strong>{payload.summary.noSubmission}</strong><span>ללא הגשה</span></div>
          <div className={styles.statCard} data-tone="info"><CheckCircle2 size={18} /><strong>{payload.summary.submitted}</strong><span>הוגשו</span></div>
          <div className={styles.statCard} data-tone="success"><GraduationCap size={18} /><strong>{payload.summary.graded}</strong><span>נבדקו</span></div>
          <div className={styles.statCard} data-tone="danger"><ShieldAlert size={18} /><strong>{payload.summary.blockedByClosedWindow}</strong><span>סגור לגישה</span></div>
        </div>
      ) : null}

      {selectedRows.length > 0 ? (
        <div className={styles.bulkBar}>
          <div className={styles.bulkMeta}>
            <strong>{selectedRows.length} נבחרו</strong>
            <span>החלת חלון אישי רק על הסטודנטים המסומנים</span>
          </div>
          <input type="datetime-local" value={bulkFrom} onChange={(event) => setBulkFrom(event.target.value)} aria-label="תחילת חלון אישי" />
          <input type="datetime-local" value={bulkUntil} onChange={(event) => setBulkUntil(event.target.value)} aria-label="סיום חלון אישי" />
          <button
            type="button"
            className={styles.primaryButton}
            disabled={saving || selectedRows.length === 0 || !bulkFrom || !bulkUntil}
            onClick={applyBulkWindow}
          >
            החל חלון אישי
          </button>
        </div>
      ) : null}

      {error ? <div className={styles.errorBanner}>{error}</div> : null}
      {success ? <div className={styles.successBanner}>{success}</div> : null}
      {loading ? <div className={styles.loadingState}>טוען נתוני מטלות...</div> : null}

      {!loading ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={filteredRows.length > 0 && filteredRows.every((item) => selectedRowKeySet.has(item.rowKey))}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setSelectedRowKeys((current) => Array.from(new Set([...current, ...filteredRows.map((item) => item.rowKey)])));
                      } else {
                        const visible = new Set(filteredRows.map((item) => item.rowKey));
                        setSelectedRowKeys((current) => current.filter((rowKey) => !visible.has(rowKey)));
                      }
                    }}
                    aria-label="בחר את כל השורות המסוננות"
                  />
                </th>
                <th>סטודנט</th>
                <th>מצב</th>
                <th>גישה</th>
                <th>ציון</th>
                <th>התקדמות</th>
                <th>תאריכים</th>
                <th>פעולה מומלצת</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({ row, rowKey, attentionReason, closingSoon }) => {
                const nextAction = getNextAction(row);
                return (
                <tr key={rowKey} data-attention={attentionReason ? "true" : "false"}>
                  <td className={styles.selectionCell} data-label="בחירה">
                    <input
                      type="checkbox"
                      checked={selectedRowKeySet.has(rowKey)}
                      onChange={(event) => {
                        setSelectedRowKeys((current) => event.target.checked
                          ? Array.from(new Set([...current, rowKey]))
                          : current.filter((currentKey) => currentKey !== rowKey));
                      }}
                      aria-label={`בחר ${row.user.name}`}
                    />
                  </td>
                  <td className={styles.studentCell} data-label="סטודנט">
                    <strong>{row.user.name}</strong>
                    <span dir="ltr">{row.user.email}</span>
                    {row.user.studentIdNumber ? <small>ת.ז {row.user.studentIdNumber}</small> : null}
                  </td>
                  <td className={styles.stateCell} data-label="מצב">
                    <span className={styles.statusBadge} data-status={row.submission.status}>
                      {STATUS_LABELS[row.submission.status] || row.submission.status}
                    </span>
                    {attentionReason ? <small className={styles.attentionReason}>{attentionReason}</small> : null}
                  </td>
                  <td className={styles.accessCell} data-label="גישה">
                    <span className={styles.accessState} data-state={row.access.availabilityState}>
                      {STATUS_LABELS[row.access.availabilityState] || row.access.availabilityState}
                    </span>
                    {row.access.hasOverride ? <span className={styles.overrideTag}>אישי</span> : <span className={styles.mutedText}>גלובלי</span>}
                    <small>{row.access.availabilityMessage}</small>
                  </td>
                  <td className={styles.scoreCell} data-label="ציון">{typeof row.submission.overallScore === "number" ? row.submission.overallScore : "-"}</td>
                  <td data-label="התקדמות">
                    <div className={styles.progressCell}>
                      <span>{row.submission.answeredCount}/{row.submission.totalQuestions}</span>
                      <div className={styles.progressTrack}>
                        <div style={{ width: `${Math.round(row.submission.progress * 100)}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className={styles.dateCell} data-label="תאריכים">
                    <span>{formatDateTime(row.access.effectiveAvailableFrom)}</span>
                    <span>{formatDateTime(row.access.effectiveAvailableUntil)}</span>
                    {row.submission.submittedAt ? <small>הוגש: {formatDateTime(row.submission.submittedAt)}</small> : null}
                    {closingSoon ? <small className={styles.closingSoon}>נסגר בקרוב</small> : null}
                  </td>
                  <td data-label="פעולה">
                    <span className={styles.actionChip} data-tone={nextAction.tone}>{nextAction.label}</span>
                  </td>
                  <td data-label="פעולות">
                    <div className={styles.rowActions}>
                      <button type="button" onClick={() => openAccessEditor(row)} title="ערוך חלון אישי" aria-label="ערוך חלון אישי">
                        <Pencil size={15} />
                      </button>
                      <button type="button" onClick={() => openSubmission(row)} title="פתח הגשה" aria-label="פתח הגשה">
                        <Eye size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => clearAccessOverride(row)}
                        disabled={!row.access.hasOverride || saving}
                        title="מחק חלון אישי"
                        aria-label="מחק חלון אישי"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
              })}
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className={styles.emptyTable}>אין משתמשים שתואמים לסינון.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {accessEditor ? (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>חלון אישי עבור {accessEditor.row.user.name}</h3>
              <button type="button" onClick={() => setAccessEditor(null)} aria-label="סגור">
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.windowCompare}>
                <div>
                  <span>חלון גלובלי</span>
                  <strong>{formatDateTime(accessEditor.row.access.globalAvailableFrom)} - {formatDateTime(accessEditor.row.access.globalAvailableUntil)}</strong>
                </div>
                <div>
                  <span>מצב נוכחי</span>
                  <strong>{accessEditor.row.access.hasOverride ? "חלון אישי פעיל" : "חלון גלובלי"}</strong>
                </div>
              </div>
              <label className={styles.field}>
                <span>פתיחה</span>
                <input type="datetime-local" value={accessEditor.availableFrom} onChange={(event) => setAccessEditor({ ...accessEditor, availableFrom: event.target.value })} />
              </label>
              <label className={styles.field}>
                <span>סגירה</span>
                <input type="datetime-local" value={accessEditor.availableUntil} onChange={(event) => setAccessEditor({ ...accessEditor, availableUntil: event.target.value })} />
              </label>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setAccessEditor(null)}>ביטול</button>
              <button type="button" className={styles.primaryButton} onClick={saveAccessOverride} disabled={saving || !accessEditor.availableFrom || !accessEditor.availableUntil}>
                שמור
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {submissionDialog ? (
        <SubmissionDialog
          state={submissionDialog}
          saving={saving}
          onClose={() => setSubmissionDialog(null)}
          onReopen={reopenSubmission}
        />
      ) : null}
    </section>
  );
}

function SubmissionDialog({
  state,
  saving,
  onClose,
  onReopen,
}: {
  state: SubmissionDialogState;
  saving: boolean;
  onClose: () => void;
  onReopen: () => void;
}) {
  const submission = state.payload?.submission ?? null;
  const questions = state.payload?.questions ?? [];
  const [confirmReopen, setConfirmReopen] = useState(false);

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={`${styles.modal} ${styles.submissionModal}`}>
        <div className={styles.modalHeader}>
          <div>
            <h3>הגשה של {state.row.user.name}</h3>
            <p>{state.row.user.email}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="סגור">
            <X size={18} />
          </button>
        </div>

        {state.loading ? <div className={styles.loadingState}>טוען הגשה...</div> : null}
        {state.error ? <div className={styles.errorBanner}>{state.error}</div> : null}

        {!state.loading && !state.error ? (
          <div className={styles.modalBody}>
            {!submission ? (
              <div className={styles.emptySubmission}>
                <FileText size={26} />
                <h4>אין עדיין הגשה לסטודנט הזה.</h4>
                <p>לא נוצרה טיוטה ולא נשמרו תשובות עבור המטלה הנבחרת.</p>
              </div>
            ) : (
              <>
                <div className={styles.submissionMeta}>
                  <span>{STATUS_LABELS[submission.status] || submission.status}</span>
                  <span>ניסיון {submission.attemptNumber}</span>
                  <span>ציון {typeof submission.overallScore === "number" ? submission.overallScore : "-"}</span>
                  {submission.submittedAt ? <span>הוגש {formatDateTime(submission.submittedAt)}</span> : null}
                  {submission.gradedAt ? <span>נבדק {formatDateTime(submission.gradedAt)}</span> : null}
                </div>

                {confirmReopen ? (
                  <div className={styles.reopenWarning}>
                    <ShieldAlert size={18} />
                    <div>
                      <strong>פתיחה מחדש תשמור ארכיון ותעביר את ההגשה לסטטוס בתהליך.</strong>
                      <span>{state.row.user.name} · {state.row.user.email}</span>
                    </div>
                  </div>
                ) : null}

                <div className={styles.answerList}>
                  {questions.map((question, index) => {
                    const answer = submission.answers?.[question.id];
                    const summary = answerSummary(answer);
                    return (
                      <article key={question.id} className={styles.answerCard}>
                        <header>
                          <h4>שאלה {index + 1}</h4>
                          <span>ניסיונות {summary.attempts} · ציון {summary.score}</span>
                        </header>
                        <p>{question.prompt}</p>
                        <pre>{answer?.sql || answer?.expression || "לא נשמרה תשובה."}</pre>
                        {answer?.resultPreview ? (
                          <div className={styles.previewBox}>
                            <strong>תצוגת תוצאה</strong>
                            <span>{answer.resultPreview.rows.length} שורות · {answer.resultPreview.executionMs}ms</span>
                          </div>
                        ) : null}
                        {answer?.feedback ? (
                          <div className={styles.feedbackBox}>
                            {answer.feedback.autoNotes ? <p>{answer.feedback.autoNotes}</p> : null}
                            {answer.feedback.instructorNotes ? <p>{answer.feedback.instructorNotes}</p> : null}
                          </div>
                        ) : null}
                        {summary.lastExecutedAt ? <small>הרצה אחרונה: {formatDateTime(summary.lastExecutedAt)}</small> : null}
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ) : null}

        <div className={styles.modalActions}>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>סגור</button>
          {submission && (submission.status === "submitted" || submission.status === "graded") ? (
            confirmReopen ? (
              <>
                <button type="button" className={styles.secondaryButton} onClick={() => setConfirmReopen(false)} disabled={saving}>
                  ביטול
                </button>
                <button type="button" className={styles.dangerButton} onClick={onReopen} disabled={saving}>
                  <RotateCcw size={16} />
                  אשר פתיחה מחדש
                </button>
              </>
            ) : (
              <button type="button" className={styles.dangerButton} onClick={() => setConfirmReopen(true)} disabled={saving}>
                <RotateCcw size={16} />
                פתח מחדש
              </button>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function AdminHomeworkClient() {
  const searchParams = useSearchParams();
  const requestedMode = searchParams.get("mode");
  const requestedView = searchParams.get("view");
  const [mode, setMode] = useState<Mode>(requestedMode === "builder" ? "builder" : "students");
  const initialFilter = isStatusFilter(requestedView) ? requestedView : "attention";

  useEffect(() => {
    setMode(requestedMode === "builder" ? "builder" : "students");
  }, [requestedMode]);

  return (
    <div className={styles.shell}>
      <div className={styles.modeTabs} role="tablist" aria-label="מצבי ניהול מטלות">
        <button
          type="button"
          className={mode === "students" ? styles.activeTab : ""}
          onClick={() => setMode("students")}
          aria-pressed={mode === "students"}
        >
          <Users size={16} />
          ניהול הגשות
        </button>
        <button
          type="button"
          className={mode === "builder" ? styles.activeTab : ""}
          onClick={() => setMode("builder")}
          aria-pressed={mode === "builder"}
        >
          <FileText size={16} />
          בניית מטלות
        </button>
      </div>

      {mode === "builder" ? <BuilderDashboardPage /> : <StudentManagementPanel initialFilter={initialFilter} />}
    </div>
  );
}
