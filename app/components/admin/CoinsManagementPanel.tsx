"use client";

import { useEffect, useMemo, useState } from "react";
import { Coins, RefreshCw, RotateCcw, Search, Send, Settings2, Trophy, TrendingUp, XCircle, Users } from "lucide-react";

import { useAdminShell } from "@/app/components/admin/AdminShell";
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

type SqlCoinChallengeStatus = "pending" | "active" | "completed" | "expired" | "cancelled";

interface SqlCoinChallengeOverview {
  id: string;
  studentEmail: string;
  year: number;
  semester: number;
  status: SqlCoinChallengeStatus;
  questions: Array<{ queryId: string; question: string; practiceId: string }>;
  attempts: Array<{ questionId: string; correct: boolean; similarity: number; submittedAt: string }>;
  score?: {
    correctCount: number;
    totalQuestions: number;
    passingCorrectCount: number;
    passed: boolean;
  };
  coinLedgerTransactionId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  cancelledAt?: string;
}

interface UserRecord {
  id?: string;
  _id?: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

interface EnrichedUserRow {
  rowKey: string;
  email: string;
  name: string;
  currentBalance: number;
  totalSpent: number;
  chatUsageCount: number;
  sqlChallengeCompletedCount: number;
  homeworkHintUsageCount: number;
  usageCount: number;
  lastUsageDate: string | null;
  duplicateEmailCount: number;
  duplicateEmailIndex: number;
}

function normalizeCoinsConfig(config: CoinsConfig): CoinsConfig {
  return {
    ...config,
    modules: {
      ...config.modules,
      sqlPractice: false,
    },
    costs: {
      ...config.costs,
      sqlPracticeOpen: 0,
    },
  };
}

function getChallengeLabel(status: SqlCoinChallengeStatus): string {
  switch (status) {
    case "pending":
      return "ממתין";
    case "active":
      return "זמין לסטודנט";
    case "completed":
      return "הושלם";
    case "expired":
      return "פג תוקף";
    case "cancelled":
      return "בוטל";
    default:
      return status;
  }
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

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

interface CoinsManagementPanelProps {
  currentAdminEmail: string;
}

export default function CoinsManagementPanel({ currentAdminEmail }: CoinsManagementPanelProps) {
  const { academicPeriod, academicPeriodQuery } = useAdminShell();
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [successDetails, setSuccessDetails] = useState<string | null>(null);
  const [config, setConfig] = useState<CoinsConfig | null>(null);
  const [savedConfig, setSavedConfig] = useState<CoinsConfig | null>(null);
  const [summary, setSummary] = useState<CoinsOverview["summary"] | null>(null);
  const [users, setUsers] = useState<EnrichedUserRow[]>([]);
  const [challenges, setChallenges] = useState<SqlCoinChallengeOverview[]>([]);
  const [selectedChallengeUser, setSelectedChallengeUser] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingAmounts, setPendingAmounts] = useState<Record<string, string>>({});
  const [busyUsers, setBusyUsers] = useState<Record<string, boolean>>({});
  const [busyChallenges, setBusyChallenges] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void loadCoinsData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the selected admin/cohort changes.
  }, [academicPeriodQuery, currentAdminEmail]);

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

  const challengeByEmail = useMemo(() => {
    const priority: Record<SqlCoinChallengeStatus, number> = {
      active: 0,
      pending: 1,
      completed: 2,
      expired: 3,
      cancelled: 4,
    };
    const map = new Map<string, SqlCoinChallengeOverview>();

    [...challenges]
      .sort((left, right) => {
        const statusOrder = priority[left.status] - priority[right.status];
        if (statusOrder !== 0) return statusOrder;
        return new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime();
      })
      .forEach((challenge) => {
        const email = normalizeEmail(challenge.studentEmail);
        if (email && !map.has(email)) {
          map.set(email, challenge);
        }
      });

    return map;
  }, [challenges]);

  const challengeSummary = useMemo(() => {
    return challenges.reduce(
      (accumulator, challenge) => {
        accumulator.total += 1;
        if (challenge.status === "active" || challenge.status === "pending") accumulator.active += 1;
        if (challenge.status === "completed") accumulator.completed += 1;
        return accumulator;
      },
      { total: 0, active: 0, completed: 0 }
    );
  }, [challenges]);

  const duplicateEmailGroups = useMemo(() => {
    const groups = new Map<string, number>();
    users.forEach((user) => {
      const email = normalizeEmail(user.email);
      if (!email) return;
      groups.set(email, (groups.get(email) || 0) + 1);
    });

    return Array.from(groups.entries())
      .filter(([, count]) => count > 1)
      .sort(([leftEmail], [rightEmail]) => leftEmail.localeCompare(rightEmail));
  }, [users]);

  const hasUnsavedConfigChanges = useMemo(() => {
    if (!config || !savedConfig) {
      return false;
    }

    return JSON.stringify(config) !== JSON.stringify(savedConfig);
  }, [config, savedConfig]);

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
      const [overviewResponse, usersResponse, challengesResponse] = await Promise.all([
        fetch(`/api/admin/coins/analytics?${academicPeriodQuery}`, {
          headers: getAdminHeaders(),
          cache: "no-store",
        }),
        fetch(`/api/users?${academicPeriodQuery}`, {
          cache: "no-store",
        }),
        fetch(`/api/admin/coins/challenges?${academicPeriodQuery}`, {
          headers: getAdminHeaders(),
          cache: "no-store",
        }),
      ]);

      if (!overviewResponse.ok) {
        const message =
          overviewResponse.status === 403
            ? "פג תוקף ההתחברות לממשק המנהל. יש להתחבר מחדש."
            : `טעינת נתוני מטבעות נכשלה (${overviewResponse.status})`;
        throw new Error(message);
      }
      if (!usersResponse.ok) {
        const message =
          usersResponse.status === 403
            ? "פג תוקף ההתחברות לממשק המנהל. יש להתחבר מחדש."
            : `טעינת רשימת משתמשים נכשלה (${usersResponse.status})`;
        throw new Error(message);
      }
      if (!challengesResponse.ok) {
        const message =
          challengesResponse.status === 403
            ? "פג תוקף ההתחברות לממשק המנהל. יש להתחבר מחדש."
            : `טעינת אתגרי המטבע נכשלה (${challengesResponse.status})`;
        throw new Error(message);
      }

      const overview = (await overviewResponse.json()) as CoinsOverview;
      const userRecords = (await usersResponse.json()) as UserRecord[];
      const challengesPayload = (await challengesResponse.json()) as { challenges?: SqlCoinChallengeOverview[] };
      const normalizedConfig = normalizeCoinsConfig(overview.config);

      const analyticsByEmail = new Map(overview.users.map((user) => [normalizeEmail(user.user), user]));
      const emailCounts = new Map<string, number>();
      userRecords.forEach((profile) => {
        const email = normalizeEmail(profile.email);
        if (!email) return;
        emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
      });

      const emailSeen = new Map<string, number>();
      const mergedRows: EnrichedUserRow[] = userRecords
        .map((profile, index) => {
          const normalizedEmail = normalizeEmail(profile.email);
          const duplicateEmailIndex = (emailSeen.get(normalizedEmail) || 0) + 1;
          emailSeen.set(normalizedEmail, duplicateEmailIndex);
          const analytics = analyticsByEmail.get(normalizedEmail);
          return {
            rowKey: `${profile.id ?? profile._id ?? "user"}:${normalizedEmail}:${index}`,
            email: profile.email,
            name: getDisplayName(profile),
            currentBalance: analytics?.coins ?? 0,
            totalSpent: analytics?.totalSpent || 0,
            chatUsageCount: analytics?.usageByReason.main_chat_message || 0,
            sqlChallengeCompletedCount: analytics?.usageByReason.sql_coin_challenge_completed || 0,
            homeworkHintUsageCount: analytics?.usageByReason.homework_hint_open || 0,
            usageCount: analytics?.usageCount || 0,
            lastUsageDate: analytics?.lastActivity ?? null,
            duplicateEmailCount: emailCounts.get(normalizedEmail) || 1,
            duplicateEmailIndex,
          };
        })
        .sort((left, right) => {
          const leftTime = left.lastUsageDate ? new Date(left.lastUsageDate).getTime() : 0;
          const rightTime = right.lastUsageDate ? new Date(right.lastUsageDate).getTime() : 0;
          return rightTime - leftTime || left.name.localeCompare(right.name, "he");
        });

      setConfig(normalizedConfig);
      setSavedConfig(normalizedConfig);
      setSummary({
        ...overview.summary,
        totalUsers: mergedRows.length,
        totalBalance: mergedRows.reduce((sum, user) => sum + user.currentBalance, 0),
        totalSpent: mergedRows.reduce((sum, user) => sum + user.totalSpent, 0),
      });
      setUsers(mergedRows);
      setChallenges(Array.isArray(challengesPayload.challenges) ? challengesPayload.challenges : []);
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

    setSuccessMessage(null);
    setSuccessDetails(null);

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
            modules: { ...config.modules, sqlPractice: false },
            costs: { ...config.costs, sqlPracticeOpen: 0 },
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        const message =
          response.status === 403
            ? "פג תוקף ההתחברות לממשק המנהל. יש להתחבר מחדש."
            : payload.error || "שמירת ההגדרות נכשלה.";
        throw new Error(message);
      }

      const normalizedPayload = normalizeCoinsConfig(payload);
      setConfig(normalizedPayload);
      setSavedConfig(normalizedPayload);
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

  const createChallenge = async (emailOverride?: string) => {
    const email = normalizeEmail(emailOverride || selectedChallengeUser);
    if (!email) {
      setError("יש לבחור סטודנט לאתגר SQL.");
      return;
    }

    setBusyChallenges((current) => ({ ...current, [email]: true }));
    setError(null);

    try {
      const response = await fetch("/api/admin/coins/challenges", {
        method: "POST",
        headers: getAdminHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          studentEmail: email,
          year: academicPeriod.year,
          semester: academicPeriod.semester,
          questionCount: 3,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "פתיחת אתגר SQL נכשלה.");
      }

      setSuccessMessage("אתגר SQL נפתח לסטודנט");
      setSuccessDetails(`האתגר זמין עכשיו ב-/landing עבור ${email}.`);
      setSelectedChallengeUser(email);
      await loadCoinsData(true);
    } catch (challengeError) {
      console.error("Failed to create SQL coin challenge:", challengeError);
      setError(challengeError instanceof Error ? challengeError.message : "פתיחת אתגר SQL נכשלה.");
    } finally {
      setBusyChallenges((current) => ({ ...current, [email]: false }));
    }
  };

  const updateChallengeStatus = async (challenge: SqlCoinChallengeOverview, status: "active" | "cancelled") => {
    const busyKey = challenge.id;
    setBusyChallenges((current) => ({ ...current, [busyKey]: true }));
    setError(null);

    try {
      const response = await fetch(`/api/admin/coins/challenges/${encodeURIComponent(challenge.id)}`, {
        method: "PATCH",
        headers: getAdminHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          status,
          year: academicPeriod.year,
          semester: academicPeriod.semester,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "עדכון סטטוס האתגר נכשל.");
      }

      setSuccessMessage(status === "active" ? "אתגר SQL הופעל מחדש" : "אתגר SQL בוטל");
      setSuccessDetails(`${challenge.studentEmail} - ${getChallengeLabel(status)}.`);
      await loadCoinsData(true);
    } catch (challengeError) {
      console.error("Failed to update SQL coin challenge:", challengeError);
      setError(challengeError instanceof Error ? challengeError.message : "עדכון סטטוס האתגר נכשל.");
    } finally {
      setBusyChallenges((current) => ({ ...current, [busyKey]: false }));
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
            <h1 className={styles.title}>ניהול מטבעות ואתגרי SQL</h1>
            <p className={styles.subtitle}>
              ניהול יתרות, חיובי צ׳אט ורמזים, ואתגר SQL אישי שמעניק מטבע אחד רק אחרי הגשה מתועדת.
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
              disabled={!config || savingConfig || !hasUnsavedConfigChanges}
              title={hasUnsavedConfigChanges ? "שמירת השינויים בהגדרות" : "אין שינויים לשמירה"}
            >
              <Settings2 size={16} />
              {savingConfig ? "שומר..." : hasUnsavedConfigChanges ? "שמירת שינויים" : "ההגדרות שמורות"}
            </button>
          </div>
        </section>

        <section className={styles.statsGrid}>
          <article className={styles.statCard}>
            <div className={styles.statLabel}>סה״כ משתמשים</div>
            <div className={styles.statValue}>{summary?.totalUsers ?? 0}</div>
            <Users size={18} className={styles.statIcon} />
          </article>
          <article className={styles.statCard}>
            <div className={styles.statLabel}>סה״כ יתרה</div>
            <div className={styles.statValue}>{summary?.totalBalance ?? 0}</div>
            <Coins size={18} className={styles.statIcon} />
          </article>
          <article className={styles.statCard}>
            <div className={styles.statLabel}>סה״כ חיובים</div>
            <div className={styles.statValue}>{summary?.totalTransactions ?? 0}</div>
            <TrendingUp size={18} className={styles.statIcon} />
          </article>
          <article className={styles.statCard}>
            <div className={styles.statLabel}>סה״כ מטבעות שנצרכו</div>
            <div className={styles.statValue}>{summary?.totalSpent ?? 0}</div>
            <RefreshCw size={18} className={styles.statIcon} />
          </article>
          <article className={styles.statCard}>
            <div className={styles.statLabel}>אתגרי SQL פעילים</div>
            <div className={styles.statValue}>{challengeSummary.active}</div>
            <Trophy size={18} className={styles.statIcon} />
          </article>
        </section>

        <section className={styles.challengePanel}>
          <div className={styles.challengeCopy}>
            <div className={styles.challengeEyebrow}>אתגר SQL למטבע</div>
            <h2>פתיחת אתגר לסטודנט מהמחזור הנבחר</h2>
            <p>
              האתגר מופיע רק לסטודנט שנבחר, בתקופה {academicPeriod.year}/{academicPeriod.semester}, ומעניק מטבע אחד אחרי 3 תשובות נכונות.
            </p>
          </div>
          <div className={styles.challengeControls}>
            <label className={styles.challengeSelect}>
              <span>סטודנט</span>
              <select
                value={selectedChallengeUser}
                onChange={(event) => setSelectedChallengeUser(event.target.value)}
              >
                <option value="">בחר סטודנט</option>
                {users.map((user) => {
                  const email = normalizeEmail(user.email);
                  const challenge = challengeByEmail.get(email);
                  const disabled = challenge?.status === "active" || challenge?.status === "pending";
                  return (
                    <option key={user.rowKey} value={email} disabled={disabled}>
                      {user.name} - {email}{disabled ? " (כבר פעיל)" : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void createChallenge()}
              disabled={!selectedChallengeUser || busyChallenges[normalizeEmail(selectedChallengeUser)] === true}
            >
              <Send size={16} />
              {busyChallenges[normalizeEmail(selectedChallengeUser)] ? "פותח..." : "פתח אתגר"}
            </button>
            <div className={styles.challengeMiniStats}>
              <span>{challengeSummary.total} אתגרים במחזור</span>
              <span>{challengeSummary.completed} הושלמו</span>
            </div>
          </div>
        </section>

        <div className={styles.contentGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>הגדרות וחיוב</h2>
                <p>הפעלה וכיבוי לפי משטח, תמחור נקודתי ויתרת פתיחה למשתמש חדש.</p>
              </div>
              {hasUnsavedConfigChanges ? (
                <span className={styles.unsavedBadge}>יש שינויים שלא נשמרו</span>
              ) : (
                <span className={styles.savedBadge}>נשמר</span>
              )}
            </div>

            {config ? (
              <div className={styles.configSections}>
                <div className={styles.configBlock}>
                  <h3>הפעלת פיצ׳רים</h3>
                  <label className={styles.toggleRow}>
                    <span>צ׳אט ראשי</span>
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
                  <div className={styles.configNotice}>
                    תרגול SQL רגיל פתוח ללא חיוב. מטבעות SQL ניתנים רק דרך אתגר אישי מתועד.
                  </div>
                </div>

                <div className={styles.configBlock}>
                  <h3>תמחור</h3>
                  <label className={styles.inputRow}>
                    <span>עלות הודעת צ׳אט</span>
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
                      <dt>צ׳אט שמור</dt>
                      <dd>{savedConfig?.modules.mainChat ? "פעיל" : "כבוי"}</dd>
                    </div>
                    <div>
                      <dt>רמזים שמורים</dt>
                      <dd>{savedConfig?.modules.homeworkHints ? "פעיל" : "כבוי"}</dd>
                    </div>
                    <div>
                      <dt>שימושי צ׳אט</dt>
                      <dd>{summary?.usageByReason.main_chat_message ?? 0}</dd>
                    </div>
                    <div>
                      <dt>אתגרי SQL שהושלמו</dt>
                      <dd>{summary?.usageByReason.sql_coin_challenge_completed ?? 0}</dd>
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

            {duplicateEmailGroups.length > 0 ? (
              <div className={styles.duplicateNotice}>
                נמצאו אימיילים כפולים:{" "}
                {duplicateEmailGroups.map(([email, count]) => `${email} (${count})`).join(", ")}.
                היתרה משותפת לפי אימייל, לכן עדכון אחד ישפיע על כל הרשומות עם אותו אימייל.
              </div>
            ) : null}

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
	                      <th>אתגר SQL</th>
	                      <th>פעילות אחרונה</th>
	                      <th>עדכון יתרה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => {
	                      const pendingAmount = pendingAmounts[user.email] ?? "";
	                      const customAmount = Number(pendingAmount);
	                      const rowBusy = busyUsers[user.email] === true;
                        const normalizedEmail = normalizeEmail(user.email);
                        const challenge = challengeByEmail.get(normalizedEmail);
                        const challengeBusy =
                          busyChallenges[challenge?.id || normalizedEmail] === true ||
                          busyChallenges[normalizedEmail] === true;
                        const canCancelChallenge =
                          challenge?.status === "active" || challenge?.status === "pending";
                        const canRetryChallenge =
                          !challenge || challenge.status === "cancelled" || challenge.status === "expired";

	                      return (
                        <tr key={user.rowKey}>
                          <td data-label="שם משתמש">
                            <div className={styles.userNameCell}>
                              <span>{user.name}</span>
                              {user.duplicateEmailCount > 1 ? (
                                <span className={styles.duplicateBadge}>
                                  כפול {user.duplicateEmailIndex}/{user.duplicateEmailCount}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td data-label="אימייל" className={styles.emailCell} title={user.email}>{user.email}</td>
                          <td data-label="יתרה נוכחית" className={styles.balanceCell}>
                            <span className={styles.balanceBadge}>{user.currentBalance}</span>
                          </td>
	                          <td data-label="שימוש וצריכה">
	                            <div className={styles.usageCell}>
                              <div className={styles.usageTotal}>
                                <span>סה״כ נצרך</span>
                                <strong>{user.totalSpent}</strong>
                              </div>

                              <div className={styles.usageBreakdown}>
                                <div>
                                  <span>צ׳אט</span>
                                  <strong>{user.chatUsageCount}</strong>
                                </div>
	                                <div>
	                                  <span>אתגר</span>
	                                  <strong>{user.sqlChallengeCompletedCount}</strong>
	                                </div>
                                <div>
                                  <span>רמזים</span>
                                  <strong>{user.homeworkHintUsageCount}</strong>
                                </div>
                              </div>
	                            </div>
	                          </td>
                          <td data-label="אתגר SQL">
                            <div className={styles.challengeCell}>
                              {challenge ? (
                                <>
                                  <span className={`${styles.challengeStatus} ${styles[`challengeStatus_${challenge.status}`]}`}>
                                    {getChallengeLabel(challenge.status)}
                                  </span>
                                  <span className={styles.challengeMeta}>
                                    {challenge.status === "completed" && challenge.score
                                      ? `${challenge.score.correctCount}/${challenge.score.totalQuestions} נכון`
                                      : `${challenge.questions?.length || 3} שאלות`}
                                  </span>
                                  {challenge.coinLedgerTransactionId ? (
                                    <span className={styles.challengeLedger}>נרשם בלדג׳ר</span>
                                  ) : null}
                                  <div className={styles.challengeActions}>
                                    {canCancelChallenge ? (
                                      <button
                                        type="button"
                                        className={styles.inlineActionMuted}
                                        disabled={challengeBusy}
                                        onClick={() => void updateChallengeStatus(challenge, "cancelled")}
                                      >
                                        <XCircle size={14} />
                                        {challengeBusy ? "מבטל..." : "בטל"}
                                      </button>
                                    ) : null}
                                    {canRetryChallenge ? (
                                      <button
                                        type="button"
                                        className={styles.inlineAction}
                                        disabled={challengeBusy}
                                        onClick={() => void createChallenge(user.email)}
                                      >
                                        <RotateCcw size={14} />
                                        {challengeBusy ? "פותח..." : "פתח מחדש"}
                                      </button>
                                    ) : null}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <span className={`${styles.challengeStatus} ${styles.challengeStatus_none}`}>
                                    אין אתגר
                                  </span>
                                  <button
                                    type="button"
                                    className={styles.inlineAction}
                                    disabled={challengeBusy}
                                    onClick={() => void createChallenge(user.email)}
                                  >
                                    <Send size={14} />
                                    {challengeBusy ? "פותח..." : "פתח אתגר"}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
	                          <td data-label="פעילות אחרונה">
                            <div className={styles.activityCell}>
                              <strong>{formatDateTime(user.lastUsageDate)}</strong>
                              <span>{user.usageCount} חיובים מצטברים</span>
                            </div>
                          </td>
                          <td data-label="עדכון יתרה">
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
