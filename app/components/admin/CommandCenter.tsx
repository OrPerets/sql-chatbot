"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Bot,
  Coins,
  Database,
  FileUp,
  Layers3,
  ShieldCheck,
  Users,
} from "lucide-react";

import { useAdminShell } from "./AdminShell";
import {
  ADMIN_BUCKETS,
  ADMIN_ROUTES,
  getAdminRouteMatch,
  getPinnedRoutes,
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

type RecentRouteItem = { href: string; at: string };

const RECENT_ROUTES_STORAGE_KEY = "admin_recent_routes";

function formatFreshness(dateString: string) {
  const value = new Date(dateString);
  return value.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CommandCenter() {
  const { currentAdminEmail } = useAdminShell();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentRoutes, setRecentRoutes] = useState<RecentRouteItem[]>([]);

  const getAdminHeaders = (baseHeaders: Record<string, string> = {}) => ({
    ...baseHeaders,
    ...(currentAdminEmail ? { "x-user-email": currentAdminEmail } : {}),
  });

  const loadOverview = async () => {
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
  };

  useEffect(() => {
    void loadOverview();
  }, [currentAdminEmail]);

  useEffect(() => {
    const stored = localStorage.getItem(RECENT_ROUTES_STORAGE_KEY);
    if (!stored) {
      setRecentRoutes([]);
      return;
    }
    try {
      setRecentRoutes(JSON.parse(stored) as RecentRouteItem[]);
    } catch (parseError) {
      console.error("Failed to parse recent admin routes:", parseError);
      setRecentRoutes([]);
    }
  }, []);

  const recentRouteConfigs = useMemo(() => {
    return recentRoutes
      .map((item) => {
        const route = getAdminRouteMatch(item.href);
        if (!route) return null;
        return { route, at: item.at };
      })
      .filter((item): item is { route: (typeof ADMIN_ROUTES)[number]; at: string } => Boolean(item))
      .slice(0, 4);
  }, [recentRoutes]);

  const pinnedRoutes = useMemo(() => getPinnedRoutes(), []);

  const routeBadgeMap = useMemo(() => {
    if (!overview) return {} as Record<string, string | undefined>;
    return {
      "admin-users": `${overview.statuses.totalUsers} משתמשים`,
      "admin-settings": overview.statuses.michaelEnabled ? "Michael פעיל" : "Michael כבוי",
      "admin-coins": overview.statuses.coinsVisible ? "נראות פעילה" : "נראות כבויה",
      "admin-homework": `${overview.statuses.totalHomeworkSets} מטלות`,
      "admin-templates": `${overview.statuses.totalTemplates} תבניות`,
      "admin-datasets": `${overview.statuses.totalDatasets} דאטה-סטים`,
      "admin-students": `${overview.statuses.atRiskStudents} בסיכון`,
      "admin-analysis": `${overview.attention.pendingAnalysisReviews} ממתינים`,
      "admin-chat-report": `${overview.statuses.notificationsUnread} התראות`,
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

  const toggleCoinsVisibility = async () => {
    if (!overview) return;
    const nextValue = !overview.statuses.coinsVisible;
    await fetch("/api/users/coins", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAdminHeaders(),
      },
      body: JSON.stringify({ newStatus: nextValue ? "ON" : "OFF" }),
    });
    await loadOverview();
  };

  const quickActions = [
    {
      id: "add-user",
      href: "/admin/users?panel=add",
      label: "משתמש",
      description: "פתיחת מסך המשתמשים עם יצירה או עריכה נגישה מיידית.",
      icon: Users,
      type: "link" as const,
    },
    {
      id: "coins",
      href: "/admin/coins",
      label: "מטבעות",
      description: "מעבר ישיר ליתרות, שימושים וחיובים.",
      icon: Coins,
      type: "link" as const,
    },
    {
      id: "toggle-michael",
      label: overview?.statuses.michaelEnabled ? "Michael off" : "Michael on",
      description: "שליטה מיידית בזמינות העוזר לסטודנטים.",
      icon: Bot,
      type: "button" as const,
      onClick: toggleMichael,
    },
    {
      id: "upload-extra-time",
      href: "/admin/settings#extra-time",
      label: "התאמות זמן",
      description: "קיצור לפאנל העלאת קובץ התאמות זמן לבחינה.",
      icon: FileUp,
      type: "link" as const,
    },
    {
      id: "homework",
      href: "/admin/homework",
      label: "מטלות",
      description: "כניסה ישירה למרחב בנייה, תצוגה ופרסום.",
      icon: Layers3,
      type: "link" as const,
    },
    {
      id: "datasets",
      href: "/admin/datasets",
      label: "דאטה",
      description: "קיצור למסך הנתונים והוולידציה.",
      icon: Database,
      type: "link" as const,
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.topGrid}>
        <section className={styles.primaryPanel}>
          <div className={styles.heroBlock}>
            <span className={styles.eyebrow}>
              <ShieldCheck size={16} />
              Control
            </span>
            <h1 className={styles.title}>מרכז פיקוד</h1>
          </div>

          {error && <div className={styles.errorState}>{error}</div>}

          <div className={styles.attentionGrid}>
            <div className={styles.attentionCard} title="סה״כ משתמשים במערכת">
              <div className={styles.attentionHeader}>
                <Users size={18} />
              </div>
              <div className={styles.attentionValue}>
                {loading ? "..." : overview?.statuses.totalUsers ?? 0}
              </div>
              <p className={styles.attentionLabel}>Total Users</p>
            </div>

            <div className={styles.attentionCard} title="סה״כ מטלות בית במערכת">
              <div className={styles.attentionHeader}>
                <Layers3 size={18} />
              </div>
              <div className={styles.attentionValue}>
                {loading ? "..." : overview?.statuses.totalHomeworkSets ?? 0}
              </div>
              <p className={styles.attentionLabel}>Total HW</p>
            </div>

            <div className={styles.attentionCard} title="מצב נראות המטבעות לסטודנטים">
              <div className={styles.attentionHeader}>
                <Coins size={18} />
              </div>
              <div className={styles.attentionValue}>
                {loading ? "..." : overview?.statuses.coinsVisible ? "ON" : "OFF"}
              </div>
              <p className={styles.attentionLabel}>Coins</p>
            </div>
          </div>

          <div>
            <h2 className={styles.panelTitle}>פעולות</h2>
          </div>

          <div className={styles.quickActions}>
            {quickActions.map((action) => {
              const Icon = action.icon;
              if (action.type === "button") {
                return (
                  <button
                    key={action.id}
                    className={styles.quickActionButton}
                    onClick={action.onClick}
                    title={action.description}
                  >
                    <span className={styles.quickActionIcon}>
                      <Icon size={20} />
                    </span>
                    <div className={styles.quickActionTitle}>{action.label}</div>
                  </button>
                );
              }

              return (
                <Link key={action.id} href={action.href} className={styles.quickActionLink} title={action.description}>
                  <span className={styles.quickActionIcon}>
                    <Icon size={20} />
                  </span>
                  <div className={styles.quickActionTitle}>{action.label}</div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* <aside className={styles.secondaryPanel}>
          <div>
            <h2 className={styles.panelTitle}>מצב מערכת</h2>
          </div>

          <div className={styles.snapshotList}>
            <div className={styles.snapshotRow} title="זמינות עוזר הלמידה לסטודנטים">
              <div>
                <div className={styles.snapshotLabel}>Michael</div>
              </div>
              <span
                className={`${styles.statusPill} ${
                  overview?.statuses.michaelEnabled ? styles.statusOn : styles.statusOff
                }`}
              >
                {overview?.statuses.michaelEnabled ? "פעיל" : "כבוי"}
              </span>
            </div>

            <div className={styles.snapshotRow} title="האם משתמשים רואים כרגע יתרות מטבעות">
              <div>
                <div className={styles.snapshotLabel}>מטבעות</div>
              </div>
              <span
                className={`${styles.statusPill} ${
                  overview?.statuses.coinsVisible ? styles.statusOn : styles.statusOff
                }`}
              >
                {overview?.statuses.coinsVisible ? "מוצג" : "מוסתר"}
              </span>
            </div>

            <div className={styles.snapshotRow} title="סטודנטים שמסומנים כרגע בסיכון גבוה">
              <div>
                <div className={styles.snapshotLabel}>סיכון</div>
              </div>
              <span className={styles.statusPill}>
                {loading ? "..." : `${overview?.statuses.atRiskStudents ?? 0}`}
              </span>
            </div>

            <div className={styles.snapshotRow} title="רשומות התאמות זמן שנשמרו במסד">
              <div>
                <div className={styles.snapshotLabel}>התאמות</div>
              </div>
              <span className={styles.statusPill}>
                {loading ? "..." : `${overview?.statuses.extraTimeUploads ?? 0}`}
              </span>
            </div>
          </div>

          <div className={styles.systemActions}>
            <button className={styles.inlineButton} onClick={toggleMichael}>
              <Bot size={16} />
              {overview?.statuses.michaelEnabled ? "כבה Michael" : "הפעל Michael"}
            </button>
            <button className={styles.inlineButton} onClick={toggleCoinsVisibility}>
              <Coins size={16} />
              {overview?.statuses.coinsVisible ? "הסתר מטבעות" : "הצג מטבעות"}
            </button>
            <Link href="/admin/settings" className={styles.inlineLink}>
              <ArrowUpRight size={16} />
              הגדרות מערכת
            </Link>
          </div>

          <div>
            <h3 className={styles.panelTitle}>עדכונים</h3>
          </div>

          {overview?.recent.notifications?.length ? (
            <div className={styles.snapshotList}>
              {overview.recent.notifications.slice(0, 3).map((notification) => (
                <div key={notification.id} className={styles.snapshotRow} title={notification.title}>
                  <div>
                    <div className={styles.snapshotLabel}>{notification.title}</div>
                  </div>
                  <span className={styles.statusPill}>{formatFreshness(notification.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>אין כרגע עדכונים טריים להצגה.</div>
          )}
        </aside> */}
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionIntro}>
            <h2 className={styles.panelTitle}>קיצורים</h2>
          </div>
        </div>

        <div className={styles.miniRouteGrid}>
          {pinnedRoutes.map((route) => (
            <Link key={route.id} href={route.href} className={styles.miniRoute} title={route.whyOpen}>
              <span className={styles.miniRouteLabel}>{route.label}</span>
            </Link>
          ))}

          {recentRouteConfigs.map(({ route, at }) => (
            <Link
              key={`${route.id}-${at}`}
              href={route.href}
              className={styles.miniRoute}
              title={`נפתח לאחרונה: ${formatFreshness(at)}`}
            >
              <span className={styles.miniRouteLabel}>{route.label}</span>
              <span className={styles.miniRouteMeta}>{formatFreshness(at)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionIntro}>
            <h2 className={styles.panelTitle}>לפי משימה</h2>
          </div>
        </div>

        <div className={styles.bucketSections}>
          {ADMIN_BUCKETS.map((bucket) => {
            const routes = getTileRoutesForBucket(bucket.id);
            return (
              <section key={bucket.id}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionIntro}>
                    <h3 className={styles.panelTitle} title={bucket.description}>{bucket.label}</h3>
                  </div>
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
                            <Icon size={20} />
                          </span>
                          {routeBadgeMap[route.id] ? (
                            <span className={styles.tileBadge}>{routeBadgeMap[route.id]}</span>
                          ) : null}
                        </div>
                        <div>
                          <h4 className={styles.tileTitle}>{route.label}</h4>
                        </div>
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
