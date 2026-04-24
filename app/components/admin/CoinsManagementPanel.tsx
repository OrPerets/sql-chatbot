"use client";

import { useEffect, useMemo, useState } from "react";
import { Coins, RefreshCw, Search, Settings2, TrendingUp, Users } from "lucide-react";

import ErrorBanner from "@/app/components/admin/ErrorBanner";
import styles from "@/app/admin/coins/page.module.css";

type CoinsFeatureStatus = "ON" | "OFF";

interface CoinsConfig {
  status: CoinsFeatureStatus;
  starterBalance: number;
  messageCost: number;
  modules: {
    mainChat: boolean;
    homeworkHints: boolean;
    sqlPractice: boolean;
  };
  costs: {
    mainChatMessage: number;
    sqlPracticeOpen: number;
    homeworkHintOpen: number;
  };
}

interface CoinsUserOverview {
  user: string;
  coins: number;
  totalSpent: number;
  usageCount: number;
  usageByReason: Partial<Record<string, number>>;
  lastActivity: string | null;
}

interface CoinsOverview {
  config: CoinsConfig;
  users: CoinsUserOverview[];
  summary: {
    totalUsers: number;
    totalBalance: number;
    totalTransactions: number;
    totalSpent: number;
    usageByReason: Partial<Record<string, number>>;
    lastActivity: string | null;
  };
}

interface UserRecord {
  id?: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

interface EnrichedUserRow {
  email: string;
  name: string;
  currentBalance: number;
  totalSpent: number;
  chatUsageCount: number;
  sqlPracticeUsageCount: number;
  homeworkHintUsageCount: number;
  usageCount: number;
  lastUsageDate: string | null;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "ללא פעילות";
  }

  return new Date(value).toLocaleString("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDisplayName(user: UserRecord): string {
  const explicitName = user.name?.trim();
  if (explicitName) {
    return explicitName;
  }

  const combined = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return combined || user.email;
}

interface CoinsManagementPanelProps {
  currentAdminEmail: string;
}

export default function CoinsManagementPanel({ currentAdminEmail }: CoinsManagementPanelProps) {
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [successDetails, setSuccessDetails] = useState<string | null>(null);
  const [config, setConfig] = useState<CoinsConfig | null>(null);
  const [summary, setSummary] = useState<CoinsOverview["summary"] | null>(null);
  const [users, setUsers] = useState<EnrichedUserRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingAmounts, setPendingAmounts] = useState<Record<string, string>>({});
  const [busyUsers, setBusyUsers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void loadCoinsData();
  }, [currentAdminEmail]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return users;
    }

    return users.filter((user) => {
      return (
        user.name.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [searchTerm, users]);

  const filteredUsersBalance = useMemo(() => {
    return filteredUsers.reduce((sum, user) => sum + user.currentBalance, 0);
  }, [filteredUsers]);

  const getAdminHeaders = (baseHeaders: Record<string, string> = {}) => ({
    ...baseHeaders,
    "x-user-email": currentAdminEmail,
  });

  const loadCoinsData = async (showRefreshState = false) => {
    if (showRefreshState) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [overviewResponse, usersResponse] = await Promise.all([
        fetch("/api/admin/coins/analytics", {
          headers: getAdminHeaders(),
          cache: "no-store",
        }),
        fetch("/api/users", {
          cache: "no-store",
        }),
      ]);

      if (!overviewResponse.ok) {
        throw new Error(`טעינת נתוני מטבעות נכשלה (${overviewResponse.status})`);
      }
      if (!usersResponse.ok) {
        throw new Error(`טעינת רשימת משתמשים נכשלה (${usersResponse.status})`);
      }

      const overview = (await overviewResponse.json()) as CoinsOverview;
      const userRecords = (await usersResponse.json()) as UserRecord[];

      const analyticsByEmail = new Map(overview.users.map((user) => [user.user, user]));
      const mergedRowsMap = new Map<string, EnrichedUserRow>();

      userRecords
        .map((profile) => {
          const analytics = analyticsByEmail.get(profile.email);
          return {
            email: profile.email,
            name: getDisplayName(profile),
            currentBalance: analytics?.coins ?? 0,
            totalSpent: analytics?.totalSpent || 0,
            chatUsageCount: analytics?.usageByReason.main_chat_message || 0,
            sqlPracticeUsageCount: analytics?.usageByReason.sql_practice_open || 0,
            homeworkHintUsageCount: analytics?.usageByReason.homework_hint_open || 0,
            usageCount: analytics?.usageCount || 0,
            lastUsageDate: analytics?.lastActivity ?? null,
          };
        })
        .forEach((row) => {
          const existing = mergedRowsMap.get(row.email);
          if (!existing) {
            mergedRowsMap.set(row.email, row);
            return;
          }

          const existingTime = existing.lastUsageDate ? new Date(existing.lastUsageDate).getTime() : 0;
          const nextTime = row.lastUsageDate ? new Date(row.lastUsageDate).getTime() : 0;

          if (nextTime > existingTime) {
            mergedRowsMap.set(row.email, row);
          }
        });

      const mergedRows: EnrichedUserRow[] = Array.from(mergedRowsMap.values()).sort((left, right) => {
          const leftTime = left.lastUsageDate ? new Date(left.lastUsageDate).getTime() : 0;
          const rightTime = right.lastUsageDate ? new Date(right.lastUsageDate).getTime() : 0;
          return rightTime - leftTime || left.name.localeCompare(right.name, "he");
        });

      setConfig(overview.config);
      setSummary({
        ...overview.summary,
        totalUsers: mergedRows.length,
        totalBalance: mergedRows.reduce((sum, user) => sum + user.currentBalance, 0),
        totalSpent: mergedRows.reduce((sum, user) => sum + user.totalSpent, 0),
      });
      setUsers(mergedRows);
    } catch (loadError) {
      console.error("Failed to load coins data:", loadError);
      setError(loadError instanceof Error ? loadError.message : "טעינת מסך המטבעות נכשלה.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleConfigChange = (
    section: "modules" | "costs" | "starterBalance",
    key: string,
    value: boolean | number
  ) => {
    if (!config) {
      return;
    }

    if (section === "starterBalance") {
      setConfig({
        ...config,
        starterBalance: Number(value) || 0,
      });
      return;
    }

    setConfig({
      ...config,
      [section]: {
        ...config[section],
        [key]: value,
      },
    });
  };

  const saveConfig = async () => {
    if (!config) {
      return;
    }

    setSavingConfig(true);
    setError(null);

    try {
      const response = await fetch("/api/users/coins", {
        method: "POST",
        headers: getAdminHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          config: {
            starterBalance: config.starterBalance,
            modules: config.modules,
            costs: config.costs,
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "שמירת ההגדרות נכשלה.");
      }

      setConfig(payload);
      setSuccessMessage("הגדרות המטבעות נשמרו בהצלחה");
      setSuccessDetails(null);
      await loadCoinsData(true);
    } catch (saveError) {
      console.error("Failed to save coins config:", saveError);
      setError(saveError instanceof Error ? saveError.message : "שמירת ההגדרות נכשלה.");
    } finally {
      setSavingConfig(false);
    }
  };

  const adjustBalance = async (email: string, delta: number) => {
    if (!delta || !Number.isFinite(delta)) {
      setError("יש להזין כמות מטבעות תקינה.");
      return;
    }

    setBusyUsers((current) => ({ ...current, [email]: true }));
    setError(null);

    try {
      const response = await fetch("/api/users/coins", {
        method: "POST",
        headers: getAdminHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          users: [email],
          amount: delta,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "עדכון היתרה נכשל.");
      }

      setPendingAmounts((current) => ({ ...current, [email]: "" }));
      setSuccessMessage(delta > 0 ? "המטבעות התווספו בהצלחה" : "המטבעות הופחתו בהצלחה");
      setSuccessDetails(
        delta > 0
          ? `${delta} מטבעות נוספו עבור ${email}.`
          : `עד ${Math.abs(delta)} מטבעות הופחתו עבור ${email} בלי לרדת מתחת לאפס.`
      );
      await loadCoinsData(true);
    } catch (adjustError) {
      console.error("Failed to adjust coins balance:", adjustError);
      setError(adjustError instanceof Error ? adjustError.message : "עדכון היתרה נכשל.");
    } finally {
      setBusyUsers((current) => ({ ...current, [email]: false }));
    }
  };

  return (
    <>
      {successMessage ? (
        <ErrorBanner
          message={successMessage}
          details={successDetails ?? undefined}
          type="info"
          dismissible
          onDismiss={() => {
            setSuccessMessage(null);
            setSuccessDetails(null);
          }}
        />
      ) : null}

      {error ? (
        <ErrorBanner
          message="שגיאה במסך המטבעות"
          details={error}
          type="error"
          dismissible
          onDismiss={() => setError(null)}
          retryable
          onRetry={() => void loadCoinsData(true)}
        />
      ) : null}

      <div className={styles.page}>
        <section className={styles.hero}>
          <div>
            <div className={styles.eyebrow}>מטבעות</div>
            <h1 className={styles.title}>ניהול מטבעות וצריכה</h1>
            <p className={styles.subtitle}>
              ניהול חיוב לפי משטח, מחירי שימוש, יתרות משתמשים וניתוח פעילות ממסך אחד.
            </p>
          </div>

          <div className={styles.heroActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => void loadCoinsData(true)}
              disabled={refreshing || loading}
            >
              <RefreshCw size={16} className={refreshing ? styles.spin : ""} />
              רענון נתונים
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={saveConfig}
              disabled={!config || savingConfig}
            >
              <Settings2 size={16} />
              {savingConfig ? "שומר..." : "שמירת הגדרות"}
            </button>
          </div>
        </section>

        <section className={styles.statsGrid}>
          <article className={styles.statCard}>
            <div className={styles.statLabel}>סה"כ משתמשים</div>
            <div className={styles.statValue}>{summary?.totalUsers ?? 0}</div>
            <Users size={18} className={styles.statIcon} />
          </article>
          <article className={styles.statCard}>
            <div className={styles.statLabel}>סה"כ יתרה</div>
            <div className={styles.statValue}>{summary?.totalBalance ?? 0}</div>
            <Coins size={18} className={styles.statIcon} />
          </article>
          <article className={styles.statCard}>
            <div className={styles.statLabel}>סה"כ חיובים</div>
            <div className={styles.statValue}>{summary?.totalTransactions ?? 0}</div>
            <TrendingUp size={18} className={styles.statIcon} />
          </article>
          <article className={styles.statCard}>
            <div className={styles.statLabel}>סה"כ מטבעות שנצרכו</div>
            <div className={styles.statValue}>{summary?.totalSpent ?? 0}</div>
            <RefreshCw size={18} className={styles.statIcon} />
          </article>
        </section>

        <div className={styles.contentGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>הגדרות וחיוב</h2>
                <p>הפעלה וכיבוי לפי משטח, תמחור נקודתי ויתרת פתיחה למשתמש חדש.</p>
              </div>
            </div>

            {config ? (
              <div className={styles.configSections}>
                <div className={styles.configBlock}>
                  <h3>הפעלת פיצ'רים</h3>
                  <label className={styles.toggleRow}>
                    <span>צ'אט ראשי</span>
                    <input
                      type="checkbox"
                      checked={config.modules.mainChat}
                      onChange={(event) =>
                        handleConfigChange("modules", "mainChat", event.target.checked)
                      }
                    />
                  </label>
                  <label className={styles.toggleRow}>
                    <span>רמזים בשיעורי בית</span>
                    <input
                      type="checkbox"
                      checked={config.modules.homeworkHints}
                      onChange={(event) =>
                        handleConfigChange("modules", "homeworkHints", event.target.checked)
                      }
                    />
                  </label>
                  <label className={styles.toggleRow}>
                    <span>תרגול SQL</span>
                    <input
                      type="checkbox"
                      checked={config.modules.sqlPractice}
                      onChange={(event) =>
                        handleConfigChange("modules", "sqlPractice", event.target.checked)
                      }
                    />
                  </label>
                </div>

                <div className={styles.configBlock}>
                  <h3>תמחור</h3>
                  <label className={styles.inputRow}>
                    <span>עלות הודעת צ'אט</span>
                    <input
                      type="number"
                      min={0}
                      value={config.costs.mainChatMessage}
                      onChange={(event) =>
                        handleConfigChange("costs", "mainChatMessage", Number(event.target.value))
                      }
                    />
                  </label>
                  <label className={styles.inputRow}>
                    <span>עלות פתיחת תרגול SQL</span>
                    <input
                      type="number"
                      min={0}
                      value={config.costs.sqlPracticeOpen}
                      onChange={(event) =>
                        handleConfigChange("costs", "sqlPracticeOpen", Number(event.target.value))
                      }
                    />
                  </label>
                  <label className={styles.inputRow}>
                    <span>עלות פתיחת רמז</span>
                    <input
                      type="number"
                      min={0}
                      value={config.costs.homeworkHintOpen}
                      onChange={(event) =>
                        handleConfigChange("costs", "homeworkHintOpen", Number(event.target.value))
                      }
                    />
                  </label>
                  <label className={styles.inputRow}>
                    <span>יתרת פתיחה</span>
                    <input
                      type="number"
                      min={0}
                      value={config.starterBalance}
                      onChange={(event) =>
                        handleConfigChange("starterBalance", "starterBalance", Number(event.target.value))
                      }
                    />
                  </label>
                </div>

                <div className={styles.configBlock}>
                  <h3>תקציר תפעולי</h3>
                  <dl className={styles.definitionList}>
                    <div>
                      <dt>סטטוס ישן</dt>
                      <dd>{config.status}</dd>
                    </div>
                    <div>
                      <dt>שימושי צ'אט</dt>
                      <dd>{summary?.usageByReason.main_chat_message ?? 0}</dd>
                    </div>
                    <div>
                      <dt>שימושי תרגול SQL</dt>
                      <dd>{summary?.usageByReason.sql_practice_open ?? 0}</dd>
                    </div>
                    <div>
                      <dt>שימושי רמזים</dt>
                      <dd>{summary?.usageByReason.homework_hint_open ?? 0}</dd>
                    </div>
                    <div>
                      <dt>פעילות אחרונה</dt>
                      <dd>{formatDateTime(summary?.lastActivity ?? null)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            ) : (
              <div className={styles.emptyState}>טוען הגדרות מטבעות...</div>
            )}
          </section>

          <section className={`${styles.panel} ${styles.usersPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <h2>משתמשים ויתרות</h2>
                <p>חיפוש מהיר, צפייה בדפוסי שימוש ועדכון יתרה ידני עם כמות מותאמת לכל משתמש.</p>
              </div>
            </div>

            <div className={styles.panelToolbar}>
              <div className={styles.toolbarSummary}>
                <span className={styles.summaryBadge}>משתמשים מוצגים: {filteredUsers.length}</span>
                <span className={styles.summaryBadge}>יתרה מוצגת: {filteredUsersBalance}</span>
                <span className={styles.summaryHint}>הפחתה לא תרד מתחת לאפס.</span>
              </div>

              <label className={styles.searchBox}>
                <Search size={16} />
                <input
                  type="search"
                  placeholder="חיפוש לפי שם או אימייל"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </label>
            </div>

            {loading ? (
              <div className={styles.emptyState}>טוען טבלת משתמשים...</div>
            ) : filteredUsers.length === 0 ? (
              <div className={styles.emptyState}>לא נמצאו משתמשים להצגה.</div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>שם משתמש</th>
                      <th>אימייל</th>
                      <th>יתרה נוכחית</th>
                      <th>שימוש וצריכה</th>
                      <th>פעילות אחרונה</th>
                      <th>עדכון יתרה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => {
                      const pendingAmount = pendingAmounts[user.email] ?? "";
                      const customAmount = Number(pendingAmount);
                      const rowBusy = busyUsers[user.email] === true;

                      return (
                        <tr key={user.email}>
                          <td>{user.name}</td>
                          <td className={styles.emailCell} title={user.email}>{user.email}</td>
                          <td className={styles.balanceCell}>
                            <span className={styles.balanceBadge}>{user.currentBalance}</span>
                          </td>
                          <td>
                            <div className={styles.usageCell}>
                              <div className={styles.usageTotal}>
                                <span>סה"כ נצרך</span>
                                <strong>{user.totalSpent}</strong>
                              </div>

                              <div className={styles.usageBreakdown}>
                                <div>
                                  <span>צ'אט</span>
                                  <strong>{user.chatUsageCount}</strong>
                                </div>
                                <div>
                                  <span>SQL</span>
                                  <strong>{user.sqlPracticeUsageCount}</strong>
                                </div>
                                <div>
                                  <span>רמזים</span>
                                  <strong>{user.homeworkHintUsageCount}</strong>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className={styles.activityCell}>
                              <strong>{formatDateTime(user.lastUsageDate)}</strong>
                              <span>{user.usageCount} חיובים מצטברים</span>
                            </div>
                          </td>
                          <td>
                            <div className={styles.actionsCell}>
                              <div className={styles.adjustCard}>
                                <div className={styles.adjustCardHeader}>
                                  <strong>הוספה או הפחתה ידנית</strong>
                                  <span>הזן כמות אחת ובחר פעולה.</span>
                                </div>

                                <div className={styles.customAdjustRow}>
                                  <input
                                    type="number"
                                    min={1}
                                    inputMode="numeric"
                                    aria-label={`כמות לעדכון יתרה עבור ${user.email}`}
                                    placeholder="כמות"
                                    value={pendingAmount}
                                    onChange={(event) =>
                                      setPendingAmounts((current) => ({
                                        ...current,
                                        [user.email]: event.target.value,
                                      }))
                                    }
                                  />
                                  <button
                                    type="button"
                                    className={styles.inlineAction}
                                    disabled={rowBusy || !customAmount}
                                    onClick={() => void adjustBalance(user.email, customAmount)}
                                  >
                                    {rowBusy ? "מעדכן..." : "הוסף"}
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.inlineActionMuted}
                                    disabled={rowBusy || !customAmount}
                                    onClick={() => void adjustBalance(user.email, -customAmount)}
                                  >
                                    {rowBusy ? "מעדכן..." : "הפחת"}
                                  </button>
                                </div>

                                <div className={styles.adjustHint}>
                                  אפשר להזין כל כמות. בהפחתה המערכת תעצור ב-0 אם צריך.
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
