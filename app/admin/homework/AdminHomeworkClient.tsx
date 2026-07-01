"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  GraduationCap,
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
type StatusFilter = "all" | "none" | "in_progress" | "submitted" | "graded" | "blocked";

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

function StudentManagementPanel() {
  const [payload, setPayload] = useState<AdminHomeworkManagementPayload | null>(null);
  const [selectedSetId, setSelectedSetId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
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
      setSelectedEmails([]);
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

  const rows = useMemo(() => payload?.rows ?? [], [payload?.rows]);
  const selectedSet = payload?.selectedSet ?? null;

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter === "blocked" && (row.access.accessible || row.access.availabilityState !== "closed")) {
        return false;
      }
      if (statusFilter !== "all" && statusFilter !== "blocked" && row.submission.status !== statusFilter) {
        return false;
      }
      if (!normalizedSearch) return true;
      return (
        row.user.name.toLowerCase().includes(normalizedSearch) ||
        row.user.email.toLowerCase().includes(normalizedSearch) ||
        String(row.user.studentIdNumber || "").includes(normalizedSearch)
      );
    });
  }, [rows, searchTerm, statusFilter]);

  const selectedEmailSet = useMemo(() => new Set(selectedEmails), [selectedEmails]);

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
    if (!selectedSet || selectedEmails.length === 0 || !bulkFrom || !bulkUntil) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await Promise.all(selectedEmails.map((email) => fetchJson("/api/admin/homework-management/access", {
        method: "PUT",
        body: JSON.stringify({
          homeworkSetId: selectedSet.id,
          userEmail: email,
          availableFrom: toIsoFromInputValue(bulkFrom),
          availableUntil: toIsoFromInputValue(bulkUntil),
        }),
      })));
      setSuccess(`עודכנו ${selectedEmails.length} סטודנטים.`);
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
    const confirmed = window.confirm("לפתוח מחדש את ההגשה? המערכת תשמור ארכיון לפני שינוי הסטטוס.");
    if (!confirmed) return;
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
          <h2>ניהול סטודנטים לפי מטלה</h2>
          <p>רשימה מבוססת משתמשים קיימים, עם מצב הגשה וחלונות זמינות אישיים.</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.secondaryButton} onClick={() => loadManagementData(selectedSetId)} disabled={loading}>
            <RefreshCw size={16} />
            רענן
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => downloadCsv(filteredRows, selectedSet?.title || "homework")}
            disabled={filteredRows.length === 0}
          >
            <Download size={16} />
            CSV
          </button>
        </div>
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
          <span>סטטוס</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
            <option value="all">כולם</option>
            <option value="none">ללא הגשה</option>
            <option value="in_progress">בתהליך</option>
            <option value="submitted">הוגש</option>
            <option value="graded">נבדק</option>
            <option value="blocked">סגור לגישה</option>
          </select>
        </label>
      </div>

      {payload?.summary ? (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}><Users size={18} /><strong>{payload.summary.totalUsers}</strong><span>משתמשים</span></div>
          <div className={styles.statCard}><FileText size={18} /><strong>{payload.summary.noSubmission}</strong><span>ללא הגשה</span></div>
          <div className={styles.statCard}><CheckCircle2 size={18} /><strong>{payload.summary.submitted}</strong><span>הוגשו</span></div>
          <div className={styles.statCard}><GraduationCap size={18} /><strong>{payload.summary.graded}</strong><span>נבדקו</span></div>
          <div className={styles.statCard}><ShieldAlert size={18} /><strong>{payload.summary.blockedByClosedWindow}</strong><span>סגור לגישה</span></div>
          <div className={styles.statCard}><CalendarClock size={18} /><strong>{payload.summary.overrides}</strong><span>פתיחות אישיות</span></div>
        </div>
      ) : null}

      <div className={styles.bulkBar}>
        <span>{selectedEmails.length} נבחרו</span>
        <input type="datetime-local" value={bulkFrom} onChange={(event) => setBulkFrom(event.target.value)} />
        <input type="datetime-local" value={bulkUntil} onChange={(event) => setBulkUntil(event.target.value)} />
        <button
          type="button"
          className={styles.primaryButton}
          disabled={saving || selectedEmails.length === 0 || !bulkFrom || !bulkUntil}
          onClick={applyBulkWindow}
        >
          החל חלון אישי
        </button>
      </div>

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
                    checked={filteredRows.length > 0 && filteredRows.every((row) => selectedEmailSet.has(row.user.email))}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setSelectedEmails(Array.from(new Set([...selectedEmails, ...filteredRows.map((row) => row.user.email)])));
                      } else {
                        const visible = new Set(filteredRows.map((row) => row.user.email));
                        setSelectedEmails(selectedEmails.filter((email) => !visible.has(email)));
                      }
                    }}
                    aria-label="בחר את כל השורות המסוננות"
                  />
                </th>
                <th>סטודנט</th>
                <th>סטטוס הגשה</th>
                <th>התקדמות</th>
                <th>ציון</th>
                <th>חלון אישי</th>
                <th>זמינות אפקטיבית</th>
                <th>תאריכים</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.user.email}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedEmailSet.has(row.user.email)}
                      onChange={(event) => {
                        setSelectedEmails((current) => event.target.checked
                          ? Array.from(new Set([...current, row.user.email]))
                          : current.filter((email) => email !== row.user.email));
                      }}
                      aria-label={`בחר ${row.user.name}`}
                    />
                  </td>
                  <td>
                    <strong>{row.user.name}</strong>
                    <span>{row.user.email}</span>
                    {row.user.studentIdNumber ? <small>ת.ז {row.user.studentIdNumber}</small> : null}
                  </td>
                  <td>
                    <span className={styles.statusBadge} data-status={row.submission.status}>
                      {STATUS_LABELS[row.submission.status] || row.submission.status}
                    </span>
                  </td>
                  <td>
                    <div className={styles.progressCell}>
                      <span>{row.submission.answeredCount}/{row.submission.totalQuestions}</span>
                      <div className={styles.progressTrack}>
                        <div style={{ width: `${Math.round(row.submission.progress * 100)}%` }} />
                      </div>
                    </div>
                  </td>
                  <td>{typeof row.submission.overallScore === "number" ? row.submission.overallScore : "-"}</td>
                  <td>
                    {row.access.hasOverride ? (
                      <span className={styles.overrideTag}>אישי</span>
                    ) : (
                      <span className={styles.mutedText}>גלובלי</span>
                    )}
                  </td>
                  <td>
                    <span className={styles.accessState} data-state={row.access.availabilityState}>
                      {STATUS_LABELS[row.access.availabilityState] || row.access.availabilityState}
                    </span>
                    <small>{row.access.availabilityMessage}</small>
                  </td>
                  <td>
                    <span>{formatDateTime(row.access.effectiveAvailableFrom)}</span>
                    <span>{formatDateTime(row.access.effectiveAvailableUntil)}</span>
                    {row.submission.submittedAt ? <small>הוגש: {formatDateTime(row.submission.submittedAt)}</small> : null}
                  </td>
                  <td>
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
              ))}
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
            <button type="button" className={styles.dangerButton} onClick={onReopen} disabled={saving}>
              <RotateCcw size={16} />
              פתח מחדש
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function AdminHomeworkClient() {
  const [mode, setMode] = useState<Mode>("builder");

  return (
    <div className={styles.shell}>
      <div className={styles.modeTabs} role="tablist" aria-label="מצבי ניהול מטלות">
        <button
          type="button"
          className={mode === "builder" ? styles.activeTab : ""}
          onClick={() => setMode("builder")}
          aria-pressed={mode === "builder"}
        >
          <FileText size={16} />
          בניית מטלות
        </button>
        <button
          type="button"
          className={mode === "students" ? styles.activeTab : ""}
          onClick={() => setMode("students")}
          aria-pressed={mode === "students"}
        >
          <Users size={16} />
          ניהול סטודנטים
        </button>
      </div>

      {mode === "builder" ? <BuilderDashboardPage /> : <StudentManagementPanel />}
    </div>
  );
}
