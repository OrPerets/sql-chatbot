"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Coins, KeyRound, PencilLine, Plus, RefreshCw, Search, UserPlus, Users } from "lucide-react";

import { useAdminShell } from "./AdminShell";
import type { Class } from "./types";
import styles from "./UsersManagementPage.module.css";

interface UserRecord {
  id?: string;
  uiKey: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  classId?: number;
  coins?: number;
  lastActivity?: string;
}

type EditorMode = "add" | "edit" | null;
type BulkAction = "add_balance" | "reduce_balance" | "reset_password" | "";

const DEFAULT_USER_FORM = {
  firstName: "",
  lastName: "",
  email: "",
};

function getDisplayName(user: UserRecord) {
  const explicit = user.name?.trim();
  if (explicit) return explicit;
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email;
}

function buildUserUiKey(user: Omit<UserRecord, "uiKey">, index: number) {
  return `${user.id ?? "no-id"}:${user.email}:${index}`;
}

function normalizeClasses(payload: unknown): Class[] {
  if (!Array.isArray(payload)) return [];

  const seen = new Set<number>();

  return payload.filter((item): item is Class => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Class;
    if (typeof candidate.id !== "number" || !Number.isFinite(candidate.id) || candidate.id <= 0) {
      return false;
    }
    if (seen.has(candidate.id)) return false;
    seen.add(candidate.id);
    return typeof candidate.name === "string" && candidate.name.trim().length > 0;
  });
}

function buildClassOptions(payload: unknown): Class[] {
  return [{ id: 0, name: "כל הכיתות" }, ...normalizeClasses(payload)];
}

export default function UsersManagementPage() {
  const { currentAdminEmail } = useAdminShell();
  const searchParams = useSearchParams();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [classes, setClasses] = useState<Class[]>(buildClassOptions([]));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState(0);
  const [selectedUserKeys, setSelectedUserKeys] = useState<string[]>([]);
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [userForm, setUserForm] = useState(DEFAULT_USER_FORM);
  const [bulkAction, setBulkAction] = useState<BulkAction>("");
  const [bulkAmount, setBulkAmount] = useState("");

  const getAdminHeaders = (baseHeaders: Record<string, string> = {}) => ({
    ...baseHeaders,
    ...(currentAdminEmail ? { "x-user-email": currentAdminEmail } : {}),
  });

  const loadUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const [usersResponse, coinsResponse, classesResponse] = await Promise.all([
        fetch("/api/users", { cache: "no-store" }),
        fetch("/api/users/coins?all=1", { headers: getAdminHeaders(), cache: "no-store" }),
        fetch("/api/classes", { cache: "no-store" }).catch(() => null),
      ]);

      if (!usersResponse.ok) {
        throw new Error(`טעינת משתמשים נכשלה (${usersResponse.status})`);
      }
      if (!coinsResponse.ok) {
        throw new Error(`טעינת יתרות מטבעות נכשלה (${coinsResponse.status})`);
      }

      const [usersPayload, coinsPayload] = await Promise.all([usersResponse.json(), coinsResponse.json()]);
      const coinsMap = new Map(
        (Array.isArray(coinsPayload) ? coinsPayload : coinsPayload?.users || []).map((entry: any) => [
          entry.user,
          entry.coins,
        ])
      );

      const mergedUsers = (usersPayload as Omit<UserRecord, "uiKey">[]).map((user, index) => ({
        ...user,
        uiKey: buildUserUiKey(user, index),
        coins: coinsMap.get(user.email) ?? 0,
      }));

      setUsers(mergedUsers);

      if (classesResponse?.ok) {
        const classesPayload = await classesResponse.json();
        setClasses(buildClassOptions(classesPayload));
      }
    } catch (loadError) {
      console.error("Failed to load users:", loadError);
      setError(loadError instanceof Error ? loadError.message : "טעינת נתוני משתמשים נכשלה.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, [currentAdminEmail]);

  useEffect(() => {
    const panel = searchParams.get("panel");
    if (panel === "add") {
      setEditorMode("add");
      setEditingUser(null);
      setUserForm(DEFAULT_USER_FORM);
    }
  }, [searchParams]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      const matchesClass = selectedClass === 0 || user.classId === selectedClass;
      if (!matchesClass) return false;
      if (!normalizedSearch) return true;
      return (
        getDisplayName(user).toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [searchTerm, selectedClass, users]);

  const selectedSet = useMemo(() => new Set(selectedUserKeys), [selectedUserKeys]);
  const selectedUserEmails = useMemo(
    () => Array.from(new Set(users.filter((user) => selectedSet.has(user.uiKey)).map((user) => user.email))),
    [selectedSet, users]
  );

  const openAddPanel = () => {
    setEditorMode("add");
    setEditingUser(null);
    setUserForm(DEFAULT_USER_FORM);
    setError(null);
    setSuccess(null);
  };

  const openEditPanel = (user: UserRecord) => {
    setEditorMode("edit");
    setEditingUser(user);
    setUserForm({
      firstName: user.firstName || user.name?.split(" ")[0] || "",
      lastName:
        user.lastName || (user.name?.split(" ").slice(1).join(" ") || ""),
      email: user.email,
    });
    setError(null);
    setSuccess(null);
  };

  const resetEditor = () => {
    setEditorMode(null);
    setEditingUser(null);
    setUserForm(DEFAULT_USER_FORM);
  };

  const handleCreateOrUpdate = async () => {
    if (!userForm.firstName || !userForm.lastName || !userForm.email) {
      setError("יש למלא שם פרטי, שם משפחה ואימייל.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (editorMode === "add") {
        const response = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...userForm,
            password: "shenkar",
            isFirst: true,
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "יצירת המשתמש נכשלה.");
        }

        setSuccess("המשתמש נוצר בהצלחה.");
      } else if (editorMode === "edit" && editingUser) {
        const response = await fetch(`/api/users/${encodeURIComponent(editingUser.email)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: userForm.firstName,
            lastName: userForm.lastName,
            email: userForm.email,
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "עדכון המשתמש נכשל.");
        }

        setSuccess("פרטי המשתמש נשמרו.");
      }

      await loadUsers();
      resetEditor();
    } catch (saveError) {
      console.error("Failed to save user:", saveError);
      setError(saveError instanceof Error ? saveError.message : "שמירת המשתמש נכשלה.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!editingUser) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/users/${encodeURIComponent(editingUser.email)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "shenkar" }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "איפוס הסיסמה נכשל.");
      }

      setSuccess('הסיסמה אופסה ל-"shenkar".');
    } catch (resetError) {
      console.error("Failed to reset password:", resetError);
      setError(resetError instanceof Error ? resetError.message : "איפוס הסיסמה נכשל.");
    } finally {
      setSaving(false);
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedUserEmails.length === 0) {
      setError("יש לבחור פעולה ולפחות משתמש אחד.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (bulkAction === "reset_password") {
        const response = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emails: selectedUserEmails, password: "shenkar" }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "איפוס סיסמאות נכשל.");
        }
      } else {
        const amount = Number.parseInt(bulkAmount, 10);
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error("יש להזין כמות מטבעות תקינה.");
        }

        const response = await fetch("/api/users/coins", {
          method: "POST",
          headers: getAdminHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            users: selectedUserEmails,
            amount: bulkAction === "reduce_balance" ? -amount : amount,
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "עדכון היתרות נכשל.");
        }
      }

      setBulkAction("");
      setBulkAmount("");
      setSelectedUserKeys([]);
      setSuccess("הפעולה המרובה הושלמה.");
      await loadUsers();
    } catch (bulkError) {
      console.error("Failed bulk action:", bulkError);
      setError(bulkError instanceof Error ? bulkError.message : "הפעולה המרובה נכשלה.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>ניהול משתמשים</h1>
          <p className={styles.description}>
            כל פעולות המשתמשים במקום אחד: יצירה, עריכה, איפוס סיסמה ופעולות מרובות בלי
            להסתתר בתוך מודאלים.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button className={styles.secondaryButton} onClick={() => void loadUsers()}>
            <RefreshCw size={16} />
            רענן
          </button>
          <button className={styles.primaryButton} onClick={openAddPanel}>
            <UserPlus size={16} />
            משתמש חדש
          </button>
        </div>
      </div>

      {error && <div className={`${styles.notice} ${styles.noticeError}`}>{error}</div>}
      {success && <div className={`${styles.notice} ${styles.noticeSuccess}`}>{success}</div>}

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <p className={styles.summaryLabel}>משתמשים במערכת</p>
          <p className={styles.summaryValue}>{loading ? "..." : users.length}</p>
        </div>
        <div className={styles.summaryCard}>
          <p className={styles.summaryLabel}>משתמשים מסוננים</p>
          <p className={styles.summaryValue}>{loading ? "..." : filteredUsers.length}</p>
        </div>
        <div className={styles.summaryCard}>
          <p className={styles.summaryLabel}>נבחרו לפעולה</p>
          <p className={styles.summaryValue}>{selectedUserKeys.length}</p>
        </div>
        <div className={styles.summaryCard}>
          <p className={styles.summaryLabel}>פתח/ערוך מהיר</p>
          <p className={styles.summaryValue}>{editorMode === "edit" ? "עריכה" : editorMode === "add" ? "יצירה" : "הכן"}</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.toolbarField}>
          <Search size={18} color="#64748b" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="חפש לפי שם או אימייל"
          />
        </div>
        <div className={styles.toolbarField}>
          <Users size={18} color="#64748b" />
          <select value={selectedClass} onChange={(event) => setSelectedClass(Number(event.target.value))}>
            {classes.map((item, index) => (
              <option key={`class-${item.id}-${index}`} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.bulkBar}>
        <div className={styles.bulkMeta}>
          פעולות מרובות
          <span className={styles.bulkHint}>
            {selectedUserKeys.length
              ? `${selectedUserKeys.length} משתמשים מסומנים כרגע`
              : "בחר משתמשים מהרשימה כדי להפעיל פעולה מרובה"}
          </span>
        </div>
        <div className={styles.bulkControls}>
          <select
            className={styles.bulkSelect}
            value={bulkAction}
            onChange={(event) => setBulkAction(event.target.value as BulkAction)}
          >
            <option value="">בחר פעולה</option>
            <option value="add_balance">הוסף מטבעות</option>
            <option value="reduce_balance">הפחת מטבעות</option>
            <option value="reset_password">אפס סיסמה</option>
          </select>
          {bulkAction && bulkAction !== "reset_password" ? (
            <input
              className={styles.bulkInput}
              type="number"
              min={1}
              value={bulkAmount}
              onChange={(event) => setBulkAmount(event.target.value)}
              placeholder="כמות"
            />
          ) : null}
        </div>
        <button
          className={styles.primaryButton}
          onClick={handleBulkAction}
          disabled={saving || !bulkAction || selectedUserKeys.length === 0}
        >
          <Coins size={16} />
          החל
        </button>
      </div>

      <div className={styles.splitLayout}>
        <section className={styles.listPanel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>רשימת משתמשים</h2>
              <p className={styles.panelCaption}>
                לחיצה על שורה פותחת עריכה צדדית, בלי לאבד את ההקשר של הרשימה.
              </p>
            </div>
            <label className={styles.inlineButton}>
              <input
                type="checkbox"
                checked={filteredUsers.length > 0 && filteredUsers.every((user) => selectedSet.has(user.uiKey))}
                onChange={(event) =>
                  setSelectedUserKeys(event.target.checked ? filteredUsers.map((user) => user.uiKey) : [])
                }
              />
              בחר הכל
            </label>
          </div>

          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <div>בחירה</div>
              <div>שם</div>
              <div>אימייל</div>
              <div>יתרה</div>
              <div>עריכה</div>
            </div>

            {filteredUsers.map((user, index) => {
              const selected = selectedSet.has(user.uiKey);
              const displayName = getDisplayName(user);
              return (
                <div
                  key={`user-${user.uiKey}-${index}`}
                  className={`${styles.tableRow} ${selected ? styles.selectedRow : ""}`}
                >
                  <div className={styles.checkboxCell}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) =>
                        setSelectedUserKeys((current) =>
                          event.target.checked
                            ? [...current, user.uiKey]
                            : current.filter((key) => key !== user.uiKey)
                        )
                      }
                    />
                  </div>
                  <div className={styles.userCell}>
                    <span className={styles.userName}>{displayName}</span>
                  </div>
                  <div className={styles.userEmail}>{user.email}</div>
                  <div>
                    <span className={styles.balanceBadge}>
                      <Coins size={14} />
                      {user.coins ?? 0}
                    </span>
                  </div>
                  <div>
                    <button className={styles.ghostButton} onClick={() => openEditPanel(user)}>
                      <PencilLine size={16} />
                      ערוך
                    </button>
                  </div>
                </div>
              );
            })}

            {!loading && filteredUsers.length === 0 ? (
              <div className={styles.emptyEditor}>לא נמצאו משתמשים התואמים לסינון הנוכחי.</div>
            ) : null}
          </div>
        </section>

        <aside className={styles.editorPanel}>
          <div className={styles.editorHeader}>
            <div>
              <h2 className={styles.editorTitle}>
                {editorMode === "add"
                  ? "משתמש חדש"
                  : editorMode === "edit"
                    ? "עריכת משתמש"
                    : "פאנל פעולה"}
              </h2>
              <p className={styles.editorDescription}>
                {editorMode === "add"
                  ? "פתיחת משתמש חדש בלי לקפוץ למודאל."
                  : editorMode === "edit"
                    ? "העדכון נשאר צמוד לרשימה, כך שההקשר נשמר."
                    : "בחר שורה מהרשימה או פתח יצירת משתמש חדש."}
              </p>
            </div>

            {editorMode ? (
              <button className={styles.ghostButton} onClick={resetEditor}>
                סגור
              </button>
            ) : null}
          </div>

          {editorMode ? (
            <div className={styles.editorForm}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>שם פרטי</label>
                <input
                  className={styles.editorInput}
                  value={userForm.firstName}
                  onChange={(event) => setUserForm((current) => ({ ...current, firstName: event.target.value }))}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>שם משפחה</label>
                <input
                  className={styles.editorInput}
                  value={userForm.lastName}
                  onChange={(event) => setUserForm((current) => ({ ...current, lastName: event.target.value }))}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>אימייל</label>
                <input
                  className={styles.editorInput}
                  dir="ltr"
                  value={userForm.email}
                  onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))}
                />
              </div>

              <div className={styles.editorMeta}>
                {editorMode === "add"
                  ? 'סיסמת ברירת המחדל למשתמש חדש: "shenkar".'
                  : 'ניתן גם לאפס סיסמה מיידית מאותו פאנל בלי לפתוח חלון נוסף.'}
              </div>

              <div className={styles.editorFooter}>
                <button className={styles.primaryButton} onClick={handleCreateOrUpdate} disabled={saving}>
                  <Plus size={16} />
                  {editorMode === "add" ? "צור משתמש" : "שמור שינויים"}
                </button>

                {editorMode === "edit" ? (
                  <button className={styles.secondaryButton} onClick={handleResetPassword} disabled={saving}>
                    <KeyRound size={16} />
                    איפוס סיסמה
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className={styles.emptyEditor}>
              הפאנל הזה מחליף את המודאל הישן. בחר משתמש מהרשימה כדי לערוך אותו, או לחץ על
              "משתמש חדש" כדי להתחיל יצירה.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
