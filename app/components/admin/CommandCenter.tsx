"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Bot,
  CheckCircle2,
  Clock3,
  Coins,
  Database,
  FileUp,
  GraduationCap,
  Layers3,
  LifeBuoy,
  MessageSquareWarning,
  Radio,
  RefreshCw,
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
      "admin-users": `${overview.statuses.totalUsers.toLocaleString("he-IL")} משתמשים`,
      "admin-settings": overview.statuses.michaelEnabled ? "Michael פעיל" : "Michael כבוי",
      "admin-coins": overview.statuses.coinsVisible ? "נראות פעילה" : "נראות כבויה",
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

  const totalAttention =
    (overview?.attention.activeAlerts ?? 0) +
    (overview?.attention.missingAnswers ?? 0) +
    (overview?.attention.pendingAnalysisReviews ?? 0) +
    (overview?.attention.unreadNotifications ?? 0);

  const attentionItems = [
    {
      id: "alerts",
      label: "התראות פעילות",
      value: overview?.attention.activeAlerts ?? 0,
      href: "/admin/chat-report",
      icon: AlertTriangle,
      tone: "critical",
      description: "אירועים לבדיקה",
    },
    {
      id: "missing",
      label: "תשובות חסרות",
      value: overview?.attention.missingAnswers ?? 0,
      href: "/admin/settings",
      icon: MessageSquareWarning,
      tone: "warning",
      description: "פערי תוכן",
    },
    {
      id: "reviews",
      label: "סקירות ממתינות",
      value: overview?.attention.pendingAnalysisReviews ?? 0,
      href: "/admin/students",
      icon: GraduationCap,
      tone: "neutral",
      description: "מקרים לעיון",
    },
    {
      id: "notifications",
      label: "עדכונים שלא נקראו",
      value: overview?.attention.unreadNotifications ?? 0,
      href: "/admin/weekly-analytics",
      icon: Bell,
      tone: "neutral",
      description: "עדכונים אחרונים",
    },
  ];

  const nextAttentionItem = attentionItems.find((item) => item.value > 0);
  const nextAction = nextAttentionItem
    ? {
        href: nextAttentionItem.href,
        label: nextAttentionItem.label,
        description: nextAttentionItem.description,
        icon: nextAttentionItem.icon,
        tone: nextAttentionItem.tone,
      }
    : {
        href: "/admin/users",
        label: "בדוק משתמשים ומטלות",
        description: "השלושה המרכזיים תקינים",
        icon: Users,
        tone: "ok",
      };
  const NextActionIcon = nextAction.icon;

  const activityItems = [
    ...(overview?.recent.alerts || []).map((alert) => ({
      id: `alert-${alert.id}`,
      label: alert.title,
      meta: alert.severity === "critical" ? "קריטי" : "התראה",
      icon: AlertTriangle,
      tone: "critical",
    })),
    ...(overview?.recent.notifications || []).map((notification) => ({
      id: `notification-${notification.id}`,
      label: notification.title,
      meta: formatFreshness(notification.createdAt),
      icon: Bell,
      tone: "neutral",
    })),
  ].slice(0, 4);

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
      value: overview?.statuses.coinsVisible ? "מוצג" : "מוסתר",
      status: "יתרות וחיובים",
      action: "בדיקת עלויות",
      icon: Coins,
      tone: overview?.statuses.coinsVisible ? "success" : "warning",
    },
    {
      id: "homework",
      href: "/admin/homework",
      label: "מטלות",
      value: formatNumber(overview?.statuses.totalHomeworkSets, loading),
      status: "בנייה, פרסום ובדיקה",
      action: "המשך מטלות",
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
      href: "/admin/homework",
      label: "המשך מטלות",
      description: "בנייה ופרסום",
      icon: Layers3,
      type: "link" as const,
      priority: "primary",
    },
    {
      id: "toggle-coins",
      label: overview?.statuses.coinsVisible ? "הסתר יתרות" : "הצג יתרות",
      description: overview?.statuses.coinsVisible ? "מוצג לסטודנטים" : "מוסתר כרגע",
      icon: Coins,
      type: "button" as const,
      onClick: toggleCoinsVisibility,
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
      <section className={styles.heroPanel} aria-labelledby="admin-command-title">
        <div className={styles.heroText}>
          <span className={styles.eyebrow}>
            <ShieldCheck size={16} />
            סביבת תפעול מרצים
          </span>
          <h1 id="admin-command-title" className={styles.title}>
            מרכז פיקוד
          </h1>
          <p className={styles.subtitle}>
            משתמשים, מטבעות ומטלות בראש. כל השאר תומך בתפעול השוטף.
          </p>
        </div>

        <div className={styles.heroStatus}>
          <div className={styles.liveBadge}>
            <Clock3 size={16} />
            {overview?.generatedAt ? `עודכן ${formatFreshness(overview.generatedAt)}` : "ממתין לנתונים"}
          </div>
          <button className={styles.refreshButton} type="button" onClick={() => void loadOverview()}>
            <RefreshCw size={16} />
            רענן תמונת מצב
          </button>
        </div>
      </section>

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

      <section className={styles.opsStrip} aria-label="פעולה מומלצת">
        <Link
          href={nextAction.href}
          className={`${styles.nextActionCard} ${
            nextAction.tone === "critical"
              ? styles.nextActionCritical
              : nextAction.tone === "warning"
                ? styles.nextActionWarning
                : ""
          }`}
        >
          <span className={styles.nextActionIcon}>
            <NextActionIcon size={22} />
          </span>
          <span className={styles.nextActionBody}>
            <span className={styles.nextActionKicker}>הפעולה הבאה</span>
            <strong>{loading ? "טוען תמונת מצב" : nextAction.label}</strong>
            <span>{loading ? "בודק מה דורש טיפול" : nextAction.description}</span>
          </span>
          <span className={styles.nextActionArrow}>
            <ArrowUpRight size={18} />
          </span>
        </Link>

        <div className={styles.flowCard}>
          <div className={styles.flowHeader}>
            <Activity size={18} />
            <span>זרימת תפעול</span>
          </div>
          <div className={styles.flowSteps}>
            <span className={totalAttention > 0 ? styles.flowStepActive : styles.flowStepDone}>טיפול</span>
            <span>בנייה</span>
            <span>בדיקה</span>
          </div>
        </div>

        <div className={styles.healthCard}>
          <div className={styles.healthHeader}>
            <Radio size={18} />
            <span>{totalAttention > 0 ? "יש עומס פתוח" : "שגרה תקינה"}</span>
          </div>
          <div className={styles.healthMeter} aria-hidden="true">
            <span style={{ width: `${totalAttention > 0 ? Math.min(100, totalAttention * 14) : 100}%` }} />
          </div>
          <div className={styles.healthMeta}>{totalAttention.toLocaleString("he-IL")} פריטים פתוחים</div>
        </div>
      </section>

      {error ? <div className={styles.errorState}>{error}</div> : null}

      <section className={styles.attentionPanel} aria-label="מה דורש טיפול">
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>מה דורש תשומת לב</h2>
            <p className={styles.panelCaption}>
              {loading
                ? "טוען..."
                : totalAttention > 0
                  ? `${totalAttention.toLocaleString("he-IL")} פתוחים`
                  : "אין דחופים"}
            </p>
          </div>
          <span className={totalAttention > 0 ? styles.priorityPillWarning : styles.priorityPillOk}>
            {totalAttention > 0 ? "דורש מעבר" : "תקין"}
          </span>
        </div>

        <div className={styles.attentionGrid}>
          {attentionItems.map((item) => {
            const Icon = item.icon;
            const value = loading ? "..." : item.value.toLocaleString("he-IL");
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`${styles.attentionCard} ${
                  item.value > 0 && item.tone === "critical"
                    ? styles.attentionCritical
                    : item.value > 0 && item.tone === "warning"
                      ? styles.attentionWarning
                      : ""
                }`}
                title={item.description}
              >
                <span className={styles.attentionTopline}>
                  <span className={styles.attentionIcon}>
                    <Icon size={18} />
                  </span>
                  <span className={item.value > 0 ? styles.attentionStatusOpen : styles.attentionStatusQuiet}>
                    {item.value > 0 ? "לטיפול" : "נקי"}
                  </span>
                </span>
                <span className={styles.attentionValue}>{value}</span>
                <span className={styles.attentionLabel}>{item.label}</span>
                <span className={styles.attentionDescription}>{item.description}</span>
              </Link>
            );
          })}
        </div>
      </section>

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
                <span className={styles.systemDescription}>נראות יתרות לסטודנטים</span>
              </span>
              <span className={overview?.statuses.coinsVisible ? styles.statusOn : styles.statusOff}>
                {overview?.statuses.coinsVisible ? "מוצג" : "מוסתר"}
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
            <h2 className={styles.panelTitle}>המשך עבודה</h2>
            <p className={styles.panelCaption}>קיצורים קבועים ופעילות אחרונה.</p>
          </div>
        </div>

        <div className={styles.miniRouteGrid}>
          {pinnedRoutes.map((route) => {
            const Icon = route.icon;
            return (
              <Link key={route.id} href={route.href} className={styles.miniRoute} title={route.whyOpen}>
                <span className={styles.miniRouteIcon}>
                  <Icon size={16} />
                </span>
                <span className={styles.miniRouteBody}>
                  <span className={styles.miniRouteLabel}>{route.label}</span>
                  <span className={styles.miniRouteMeta}>קבוע</span>
                </span>
                <ArrowUpRight size={15} className={styles.miniRouteArrow} />
              </Link>
            );
          })}

          {recentRouteConfigs.map(({ route, at }) => {
            const Icon = route.icon;
            return (
              <Link
                key={`${route.id}-${at}`}
                href={route.href}
                className={styles.miniRoute}
                title={`נפתח לאחרונה: ${formatFreshness(at)}`}
              >
                <span className={styles.miniRouteIcon}>
                  <Icon size={16} />
                </span>
                <span className={styles.miniRouteBody}>
                  <span className={styles.miniRouteLabel}>{route.label}</span>
                  <span className={styles.miniRouteMeta}>{formatFreshness(at)}</span>
                </span>
                <ArrowUpRight size={15} className={styles.miniRouteArrow} />
              </Link>
            );
          })}

          {activityItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className={styles.miniActivity}>
                <span className={item.tone === "critical" ? styles.miniActivityAlert : styles.miniActivityIcon}>
                  <Icon size={16} />
                </span>
                <span className={styles.miniRouteBody}>
                  <span className={styles.miniRouteLabel}>{item.label}</span>
                  <span className={styles.miniRouteMeta}>{item.meta}</span>
                </span>
              </div>
            );
          })}

          {!loading && recentRouteConfigs.length === 0 && activityItems.length === 0 ? (
            <div className={styles.emptyActivity}>
              <CheckCircle2 size={18} />
              אין עבודה אחרונה להצגה.
            </div>
          ) : null}
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
