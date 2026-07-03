"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Coins,
  Database,
  FileUp,
  Layers3,
  LifeBuoy,
  Users,
} from "lucide-react";

import { useAdminShell } from "./AdminShell";
import {
  ADMIN_BUCKETS,
  getTileRoutesForBucket,
} from "./adminRoutes";
import styles from "./CommandCenter.module.css";

type AdminOverview = {
  generatedAt: string;
  attention: {
    unreadNotifications: number;
    pendingAnalysisReviews: number;
    missingAnswers: number;
    activeAlerts: number;
  };
  statuses: {
    michaelEnabled: boolean;
    coinsVisible: boolean;
    coinsModules?: {
      mainChat: boolean;
      homeworkHints: boolean;
      sqlPractice: boolean;
    };
    coinsActiveModules?: number;
    runtimeModel: string;
    totalUsers: number;
    totalTemplates: number;
    totalDatasets: number;
    totalHomeworkSets: number;
    atRiskStudents: number;
    extraTimeUploads: number;
    notificationsUnread: number;
  };
  recent: {
    alerts: Array<{ id: string; title: string; severity?: string }>;
    notifications: Array<{ id: string; title: string; createdAt: string }>;
  };
};

function getCoinModules(overview: AdminOverview | null) {
  return overview?.statuses.coinsModules ?? {
    mainChat: overview?.statuses.coinsVisible === true,
    homeworkHints: false,
    sqlPractice: false,
  };
}

function getActiveCoinModuleCount(overview: AdminOverview | null) {
  if (typeof overview?.statuses.coinsActiveModules === "number") {
    return overview.statuses.coinsActiveModules;
  }

  return Object.values(getCoinModules(overview)).filter(Boolean).length;
}

function formatCoinModuleSummary(overview: AdminOverview | null, loading: boolean) {
  if (loading) return "...";
  const count = getActiveCoinModuleCount(overview);
  return count > 0 ? `${count}/3 פעילים` : "כבוי";
}

function formatNumber(value: number | undefined, loading: boolean) {
  if (loading) return "...";
  return (value ?? 0).toLocaleString("he-IL");
}

function clampPercent(value: number, maxValue: number) {
  if (maxValue <= 0) return 0;
  return Math.max(6, Math.min(100, Math.round((value / maxValue) * 100)));
}

export default function CommandCenter() {
  const { currentAdminEmail } = useAdminShell();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAdminHeaders = useCallback((baseHeaders: Record<string, string> = {}) => ({
    ...baseHeaders,
    ...(currentAdminEmail ? { "x-user-email": currentAdminEmail } : {}),
  }), [currentAdminEmail]);

  const loadOverview = useCallback(async () => {
    if (!currentAdminEmail) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/overview", {
        headers: getAdminHeaders(),
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`טעינת תמונת המצב נכשלה (${response.status})`);
      }

      const data = (await response.json()) as AdminOverview;
      setOverview(data);
    } catch (loadError) {
      console.error("Failed to load admin overview:", loadError);
      setError(loadError instanceof Error ? loadError.message : "טעינת מרכז הפיקוד נכשלה.");
    } finally {
      setLoading(false);
    }
  }, [currentAdminEmail, getAdminHeaders]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const routeBadgeMap = useMemo(() => {
    if (!overview) return {} as Record<string, string | undefined>;
    return {
      "admin-users": `${overview.statuses.totalUsers.toLocaleString("he-IL")} משתמשים`,
      "admin-settings": overview.statuses.michaelEnabled ? "Michael פעיל" : "Michael כבוי",
      "admin-coins": formatCoinModuleSummary(overview, false),
      "admin-homework": `${overview.statuses.totalHomeworkSets.toLocaleString("he-IL")} מטלות`,
      "admin-templates": `${overview.statuses.totalTemplates.toLocaleString("he-IL")} תבניות`,
      "admin-datasets": `${overview.statuses.totalDatasets.toLocaleString("he-IL")} סטים`,
      "admin-students": `${overview.statuses.atRiskStudents.toLocaleString("he-IL")} דורשים מעקב`,
      "admin-analysis": `${overview.attention.pendingAnalysisReviews.toLocaleString("he-IL")} ממתינים`,
      "admin-chat-report": `${overview.statuses.notificationsUnread.toLocaleString("he-IL")} התראות`,
      "admin-model-management": overview.statuses.runtimeModel,
    };
  }, [overview]);

  const toggleMichael = async () => {
    if (!overview) return;
    const nextValue = !overview.statuses.michaelEnabled;
    await fetch("/api/admin/status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAdminHeaders(),
      },
      body: JSON.stringify({ newStatus: nextValue ? "ON" : "OFF" }),
    });
    await loadOverview();
  };

  const toggleMainChatBilling = async () => {
    if (!overview) return;
    const modules = getCoinModules(overview);
    const nextValue = !modules.mainChat;
    await fetch("/api/users/coins", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAdminHeaders(),
      },
      body: JSON.stringify({
        config: {
          modules: {
            ...modules,
            mainChat: nextValue,
          },
        },
      }),
    });
    await loadOverview();
  };

  const statusCards = [
    {
      id: "users",
      label: "משתמשים",
      rawValue: overview?.statuses.totalUsers ?? 0,
      value: formatNumber(overview?.statuses.totalUsers, loading),
      detail: "רשומים במערכת",
      icon: Users,
    },
    {
      id: "homework",
      label: "מטלות ובחינות",
      rawValue: overview?.statuses.totalHomeworkSets ?? 0,
      value: formatNumber(overview?.statuses.totalHomeworkSets, loading),
      detail: "פריטי הערכה",
      icon: Layers3,
    },
    {
      id: "datasets",
      label: "דאטה-סטים",
      rawValue: overview?.statuses.totalDatasets ?? 0,
      value: formatNumber(overview?.statuses.totalDatasets, loading),
      detail: "מקורות לתרגול",
      icon: Database,
    },
    {
      id: "students",
      label: "דורשים מעקב",
      rawValue: overview?.statuses.atRiskStudents ?? 0,
      value: formatNumber(overview?.statuses.atRiskStudents, loading),
      detail: "סטודנטים בסיכון",
      icon: LifeBuoy,
    },
  ];
  const maxStatusValue = Math.max(...statusCards.map((card) => card.rawValue), 1);

  const priorityWorkstreams = [
    {
      id: "users",
      href: "/admin/users",
      label: "משתמשים",
      value: formatNumber(overview?.statuses.totalUsers, loading),
      status: "גישה, סיסמאות ופתיחה",
      action: "ניהול משתמשים",
      icon: Users,
      tone: "primary",
    },
    {
      id: "coins",
      href: "/admin/coins",
      label: "מטבעות",
      value: formatCoinModuleSummary(overview, loading),
      status: "מודולי חיוב פעילים",
      action: "בדיקת עלויות",
      icon: Coins,
      tone: getActiveCoinModuleCount(overview) > 0 ? "success" : "warning",
    },
    {
      id: "homework",
      href: "/admin/homework?mode=students&view=attention",
      label: "תרגילי בית",
      value: formatNumber(overview?.statuses.totalHomeworkSets, loading),
      status: "בדיקה, פתיחה וחסימות",
      action: "בדוק הגשות",
      icon: Layers3,
      tone: "accent",
    },
  ];

  const quickActions = [
    {
      id: "add-user",
      href: "/admin/users?panel=add",
      label: "פתיחת משתמש",
      description: "יצירה או איפוס",
      icon: Users,
      type: "link" as const,
      priority: "primary",
    },
    {
      id: "coins",
      href: "/admin/coins",
      label: "בדיקת מטבעות",
      description: "יתרות ועלויות",
      icon: Coins,
      type: "link" as const,
      priority: "primary",
    },
    {
      id: "homework",
      href: "/admin/homework?mode=students&view=attention",
      label: "בדיקת הגשות",
      description: "מי צריך טיפול",
      icon: Layers3,
      type: "link" as const,
      priority: "primary",
    },
    {
      id: "toggle-coins",
      label: getCoinModules(overview).mainChat ? "כבה חיוב צ'אט" : "הפעל חיוב צ'אט",
      description: getCoinModules(overview).mainChat ? "צ'אט ראשי מחויב" : "צ'אט ראשי ללא חיוב",
      icon: Coins,
      type: "button" as const,
      onClick: toggleMainChatBilling,
      priority: "secondary",
    },
    {
      id: "toggle-michael",
      label: overview?.statuses.michaelEnabled ? "כבה Michael" : "הפעל Michael",
      description: overview?.statuses.michaelEnabled ? "זמין לסטודנטים" : "כבוי כרגע",
      icon: Bot,
      type: "button" as const,
      onClick: toggleMichael,
      priority: "secondary",
    },
    {
      id: "upload-extra-time",
      href: "/admin/settings#extra-time",
      label: "התאמות זמן",
      description: "קובץ בחינה",
      icon: FileUp,
      type: "link" as const,
      priority: "secondary",
    },
  ];

  return (
    <div className={styles.page}>
      <section className={styles.priorityOpsGrid} aria-label="מוקדי ניהול מרכזיים">
        {priorityWorkstreams.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`${styles.priorityOpsCard} ${
                item.tone === "success"
                  ? styles.priorityOpsSuccess
                  : item.tone === "warning"
                    ? styles.priorityOpsWarning
                    : item.tone === "accent"
                      ? styles.priorityOpsAccent
                      : ""
              }`}
            >
              <span className={styles.priorityOpsIcon}>
                <Icon size={22} />
              </span>
              <span className={styles.priorityOpsBody}>
                <span className={styles.priorityOpsLabel}>{item.label}</span>
                <strong>{item.value}</strong>
                <span>{item.status}</span>
              </span>
              <span className={styles.priorityOpsAction}>
                {item.action}
                <ArrowUpRight size={15} />
              </span>
            </Link>
          );
        })}
      </section>

      {error ? <div className={styles.errorState}>{error}</div> : null}

      <div className={styles.mainGrid}>
        <section className={styles.section}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>פעולות מהירות</h2>
              <p className={styles.panelCaption}>קיצורים למהלך שיעור, בדיקה ותמיכה.</p>
            </div>
          </div>

          <div className={styles.quickActions}>
            {quickActions.map((action) => {
              const Icon = action.icon;
              const className = `${styles.quickAction} ${
                action.priority === "primary" ? styles.quickActionPrimary : ""
              }`;

              if (action.type === "button") {
                return (
                  <button key={action.id} type="button" className={className} onClick={action.onClick}>
                    <span className={styles.quickActionIcon}>
                      <Icon size={19} />
                    </span>
                    <span>
                      <span className={styles.quickActionTitle}>{action.label}</span>
                      <span className={styles.quickActionDescription}>{action.description}</span>
                    </span>
                    <ArrowUpRight size={15} className={styles.quickActionArrow} />
                  </button>
                );
              }

              return (
                <Link key={action.id} href={action.href} className={className}>
                  <span className={styles.quickActionIcon}>
                    <Icon size={19} />
                  </span>
                  <span>
                    <span className={styles.quickActionTitle}>{action.label}</span>
                    <span className={styles.quickActionDescription}>{action.description}</span>
                  </span>
                  <ArrowUpRight size={15} className={styles.quickActionArrow} />
                </Link>
              );
            })}
          </div>
        </section>

        <aside className={styles.section}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>מצב מערכת</h2>
              <p className={styles.panelCaption}>המצבים שמשפיעים על הסטודנטים עכשיו.</p>
            </div>
          </div>

          <div className={styles.statusGrid}>
            <div className={styles.systemRow}>
              <span>
                <span className={styles.systemLabel}>Michael</span>
                <span className={styles.systemDescription}>זמינות עוזר AI</span>
              </span>
              <span className={overview?.statuses.michaelEnabled ? styles.statusOn : styles.statusOff}>
                {overview?.statuses.michaelEnabled ? "פעיל" : "כבוי"}
              </span>
            </div>

            <div className={styles.systemRow}>
              <span>
                <span className={styles.systemLabel}>מטבעות</span>
                <span className={styles.systemDescription}>מודולי חיוב פעילים</span>
              </span>
              <span className={getActiveCoinModuleCount(overview) > 0 ? styles.statusOn : styles.statusOff}>
                {formatCoinModuleSummary(overview, loading)}
              </span>
            </div>

            <div className={styles.systemRow}>
              <span>
                <span className={styles.systemLabel}>Runtime</span>
                <span className={styles.systemDescription}>מודל פעיל</span>
              </span>
              <span className={styles.statusNeutral}>{overview?.statuses.runtimeModel || "..."}</span>
            </div>
          </div>
        </aside>
      </div>

      <section className={styles.section}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>מדדי עבודה</h2>
            <p className={styles.panelCaption}>קנה מידה לפני כניסה למסך עמוק.</p>
          </div>
        </div>

        <div className={styles.metricGrid}>
          {statusCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.id} className={styles.metricCard}>
                <span className={styles.metricIcon}>
                  <Icon size={18} />
                </span>
                <span className={styles.metricValue}>{card.value}</span>
                <span className={styles.metricLabel}>{card.label}</span>
                <span className={styles.metricDetail}>{card.detail}</span>
                <span className={styles.metricBar} aria-hidden="true">
                  <span style={{ width: `${clampPercent(card.rawValue, maxStatusValue)}%` }} />
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>ניווט לפי משימה</h2>
            <p className={styles.panelCaption}>מסכים מקובצים לפי כוונת עבודה.</p>
          </div>
        </div>

        <div className={styles.bucketSections}>
          {ADMIN_BUCKETS.map((bucket) => {
            const routes = getTileRoutesForBucket(bucket.id);
            return (
              <section key={bucket.id} className={styles.bucketSection}>
                <div className={styles.bucketHeader}>
                  <h3 className={styles.bucketTitle}>{bucket.label}</h3>
                  <p className={styles.bucketDescription}>{bucket.description}</p>
                </div>

                <div className={styles.tileGrid}>
                  {routes.map((route) => {
                    const Icon = route.icon;
                    return (
                      <Link
                        key={route.id}
                        href={route.href}
                        className={styles.routeTile}
                        title={`${route.description} ${route.whyOpen}`}
                      >
                        <div className={styles.tileHeader}>
                          <span className={styles.tileIcon}>
                            <Icon size={19} />
                          </span>
                          {routeBadgeMap[route.id] ? (
                            <span className={styles.tileBadge}>{routeBadgeMap[route.id]}</span>
                          ) : null}
                        </div>
                        <h4 className={styles.tileTitle}>{route.label}</h4>
                        <p className={styles.tileDescription}>{route.description}</p>
                        <span className={styles.tileReason}>
                          <CheckCircle2 size={14} />
                          {route.actionLabel || route.whyOpen}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}
