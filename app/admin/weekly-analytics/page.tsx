"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Clock,
  Download,
  Layers,
  MessageCircle,
  MessageSquare,
  Repeat,
  ShieldAlert,
  Timer,
  UserCheck,
  Users
} from 'lucide-react';
import AdminLayout from '@/app/components/admin/AdminLayout';
import StatsCard from '@/app/components/admin/StatsCard';
import SkeletonCard from '@/app/components/admin/SkeletonCard';
import ErrorBanner from '@/app/components/admin/ErrorBanner';
import styles from './page.module.css';

interface WeeklyChatReport {
  period: {
    startDate: string;
    endDate: string;
    days: number;
  };
  summary: {
    totalUsersWithSessions: number;
    totalSessions: number;
    totalMessages: number;
    averageMessagesPerUser: number;
    averageMessagesPerSession: number;
    averageSessionDuration: number;
    medianSessionDuration: number;
    averageUserDuration: number;
    returningUsersPercentage: number;
  };
  relationalAlgebra: {
    topTopics: Array<{
      topic: string;
      count: number;
    }>;
    sampleQuestions: Array<{
      userId: string;
      userEmail?: string;
      message: string;
      timestamp: string;
      sessionId: string;
    }>;
  };
  dailyBreakdown: Array<{
    date: string;
    sessions: number;
    messages: number;
    uniqueUsers: number;
  }>;
  exportedAt: string;
}

interface StudentAnalytics {
  totalStudents: number;
  scoreDistribution: {
    empty: number;
    good: number;
    needs_attention: number;
    struggling: number;
  };
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
  };
  averageGrade: number;
  averageEngagement: number;
  topChallenges: string[];
}

interface TopicListProps {
  title: string;
  description: string;
  topics: WeeklyChatReport['relationalAlgebra']['topTopics'];
  isLoading: boolean;
  emptyMessage: string;
}

const TopicList: React.FC<TopicListProps> = ({
  title,
  description,
  topics,
  isLoading,
  emptyMessage
}) => {
  if (isLoading) {
    return (
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2>{title}</h2>
          <span className={styles.sectionMeta}>{description}</span>
        </div>
        <div className={styles.loadingStack}>
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={`topic-skeleton-${index}`} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <h2>{title}</h2>
        <span className={styles.sectionMeta}>{description}</span>
      </div>
      <ul className={styles.topicList}>
        {topics.map((topic) => (
          <li key={topic.topic}>
            <span className={styles.topicName}>{topic.topic}</span>
            <span className={styles.topicCount}>{topic.count.toLocaleString('he-IL')}</span>
          </li>
        ))}
      </ul>
      {topics.length === 0 && <div className={styles.emptyState}>{emptyMessage}</div>}
    </div>
  );
};

interface PerformanceSummaryProps {
  analytics: StudentAnalytics;
}

const PerformanceSummary: React.FC<PerformanceSummaryProps> = ({ analytics }) => {
  const totalScores = Object.values(analytics.scoreDistribution).reduce((sum, value) => sum + value, 0);
  const totalRisks = Object.values(analytics.riskDistribution).reduce((sum, value) => sum + value, 0);

  const scoreItems = [
    { key: 'good', label: 'במצב טוב', value: analytics.scoreDistribution.good, tone: styles.goodTone },
    { key: 'needs_attention', label: 'דורש תשומת לב', value: analytics.scoreDistribution.needs_attention, tone: styles.warnTone },
    { key: 'struggling', label: 'בסיכון גבוה', value: analytics.scoreDistribution.struggling, tone: styles.dangerTone },
    { key: 'empty', label: 'ללא ציון', value: analytics.scoreDistribution.empty, tone: styles.neutralTone }
  ];

  const riskItems = [
    { key: 'low', label: 'סיכון נמוך', value: analytics.riskDistribution.low, tone: styles.goodTone },
    { key: 'medium', label: 'סיכון בינוני', value: analytics.riskDistribution.medium, tone: styles.warnTone },
    { key: 'high', label: 'סיכון גבוה', value: analytics.riskDistribution.high, tone: styles.dangerTone }
  ];

  const formatPercent = (value: number, total: number) =>
    total > 0 ? `${Math.round((value / total) * 100)}%` : '—';

  return (
    <div className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <h2>סיכום ביצועי סטודנטים</h2>
        <span className={styles.sectionMeta}>התפלגות ציונים וסיכון</span>
      </div>
      <div className={styles.performanceGrid}>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>ממוצע ציון</p>
          <p className={styles.metricValue}>{analytics.averageGrade.toFixed(1)}</p>
        </div>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>ממוצע מעורבות</p>
          <p className={styles.metricValue}>{analytics.averageEngagement.toFixed(1)}</p>
        </div>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>סה"כ סטודנטים</p>
          <p className={styles.metricValue}>{analytics.totalStudents.toLocaleString('he-IL')}</p>
        </div>
      </div>
      <div className={styles.distributionGrid}>
        <div>
          <h3 className={styles.distributionTitle}>התפלגות ציונים</h3>
          <ul className={styles.distributionList}>
            {scoreItems.map((item) => (
              <li key={item.key} className={styles.distributionItem}>
                <span>{item.label}</span>
                <div className={styles.distributionMeta}>
                  <span className={item.tone}>{item.value.toLocaleString('he-IL')}</span>
                  <span className={styles.distributionPercent}>{formatPercent(item.value, totalScores)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className={styles.distributionTitle}>התפלגות סיכון</h3>
          <ul className={styles.distributionList}>
            {riskItems.map((item) => (
              <li key={item.key} className={styles.distributionItem}>
                <span>{item.label}</span>
                <div className={styles.distributionMeta}>
                  <span className={item.tone}>{item.value.toLocaleString('he-IL')}</span>
                  <span className={styles.distributionPercent}>{formatPercent(item.value, totalRisks)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

const WeeklyAnalyticsPage: React.FC = () => {
  const router = useRouter();
  const [report, setReport] = useState<WeeklyChatReport | null>(null);
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(true);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState('7');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedSemester, setSelectedSemester] = useState('all');

  const filters = useMemo(
    () => ({
      days: selectedDays,
      classId: selectedClass !== 'all' ? selectedClass : undefined,
      semester: selectedSemester !== 'all' ? selectedSemester : undefined
    }),
    [selectedClass, selectedDays, selectedSemester]
  );

  const filterOptions = {
    days: [
      { value: '7', label: '7 ימים אחרונים' },
      { value: '14', label: '14 ימים אחרונים' },
      { value: '30', label: '30 ימים אחרונים' }
    ],
    classes: [
      { value: 'all', label: 'כל הכיתות' },
      { value: 'class-a', label: 'כיתה א׳' },
      { value: 'class-b', label: 'כיתה ב׳' },
      { value: 'class-c', label: 'כיתה ג׳' }
    ],
    semesters: [
      { value: 'all', label: 'כל הסמסטרים' },
      { value: 'fall-2024', label: 'סתיו 2024' },
      { value: 'spring-2025', label: 'אביב 2025' }
    ]
  };

  const buildQueryString = (params: Record<string, string | undefined>) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        searchParams.set(key, value);
      }
    });
    return searchParams.toString();
  };

  const fetchReport = async () => {
    setIsReportLoading(true);
    setReportError(null);

    try {
      const query = buildQueryString({
        days: filters.days,
        format: 'json',
        includeDetails: 'true',
        classId: filters.classId,
        semester: filters.semester
      });
      const response = await fetch(query ? `/api/admin/chat-report?${query}` : '/api/admin/chat-report');
      if (!response.ok) {
        throw new Error('לא ניתן לטעון את הדוח השבועי');
      }

      const data = await response.json();
      if (data.success && data.data) {
        setReport(data.data);
      } else {
        throw new Error(data.error || 'אין נתונים זמינים');
      }
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'אירעה שגיאה בלתי צפויה');
      console.error('Error fetching weekly analytics:', err);
    } finally {
      setIsReportLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setIsAnalyticsLoading(true);
    setAnalyticsError(null);

    try {
      const query = buildQueryString({
        classId: filters.classId,
        semester: filters.semester
      });
      const response = await fetch(query ? `/api/admin/students/analytics?${query}` : '/api/admin/students/analytics');
      if (!response.ok) {
        throw new Error('לא ניתן לטעון נתוני סטודנטים');
      }

      const data = await response.json();
      if (data.success && data.data) {
        setAnalytics(data.data);
      } else {
        throw new Error(data.error || 'אין נתוני סטודנטים זמינים');
      }
    } catch (err) {
      setAnalyticsError(err instanceof Error ? err.message : 'אירעה שגיאה בלתי צפויה');
      console.error('Error fetching student analytics:', err);
    } finally {
      setIsAnalyticsLoading(false);
    }
  };

  const refreshData = () => {
    fetchReport();
    fetchAnalytics();
  };

  useEffect(() => {
    refreshData();
  }, [filters]);

  const formatNumber = (value: number) => value.toLocaleString('he-IL');

  const formatAverage = (value: number) => value.toFixed(1);

  const formatDuration = (value: number) => {
    if (!value || value <= 0) return '—';
    const totalSeconds = Math.round(value / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
      return `${hours} ש׳ ${minutes} ד׳`;
    }
    if (minutes > 0) {
      return `${minutes} ד׳`;
    }
    return `${totalSeconds} שנ׳`;
  };

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('he-IL', {
      weekday: 'short',
      month: '2-digit',
      day: '2-digit'
    });

  const kpiCards = useMemo(() => {
    if (!report) return [];

    return [
      {
        icon: Users,
        title: 'משתמשים מחוברים',
        value: formatNumber(report.summary.totalUsersWithSessions),
        description: 'סה"כ משתמשים בשבוע האחרון'
      },
      {
        icon: Layers,
        title: 'סשנים פעילים',
        value: formatNumber(report.summary.totalSessions),
        description: 'מספר סשנים שנפתחו'
      },
      {
        icon: MessageCircle,
        title: 'סה"כ הודעות',
        value: formatNumber(report.summary.totalMessages),
        description: 'הודעות שנשלחו לשבוע'
      },
      {
        icon: MessageSquare,
        title: 'הודעות למשתמש',
        value: formatAverage(report.summary.averageMessagesPerUser),
        description: 'ממוצע למשתמש'
      },
      {
        icon: BarChart3,
        title: 'הודעות לסשן',
        value: formatAverage(report.summary.averageMessagesPerSession),
        description: 'ממוצע לסשן'
      }
    ];
  }, [report]);

  const engagementCards = useMemo(() => {
    if (!report) return [];

    return [
      {
        icon: Clock,
        title: 'משך סשן ממוצע',
        value: formatDuration(report.summary.averageSessionDuration),
        description: 'זמן שיחה ממוצע'
      },
      {
        icon: Timer,
        title: 'חציון משך סשן',
        value: formatDuration(report.summary.medianSessionDuration),
        description: 'משך סשן טיפוסי'
      },
      {
        icon: UserCheck,
        title: 'זמן משתמש ממוצע',
        value: formatDuration(report.summary.averageUserDuration),
        description: 'משך כולל למשתמש'
      },
      {
        icon: Repeat,
        title: 'משתמשים חוזרים',
        value: formatPercentage(report.summary.returningUsersPercentage),
        description: 'יחס משתמשים שחזרו'
      }
    ];
  }, [report]);

  const alertItems = useMemo(() => {
    if (!report || !analytics) return [];

    const totalRisk = Object.values(analytics.riskDistribution).reduce((sum, value) => sum + value, 0);
    const highRiskShare = totalRisk > 0 ? analytics.riskDistribution.high / totalRisk : 0;
    const lowEngagement = analytics.averageEngagement < 65;
    const lowReturning = report.summary.returningUsersPercentage < 25;
    const shortSessions = report.summary.averageSessionDuration < 2 * 60 * 1000;

    const alerts = [];

    if (highRiskShare > 0.2) {
      alerts.push({
        tone: 'danger',
        icon: ShieldAlert,
        title: 'עלייה בסטודנטים בסיכון גבוה',
        description: `שיעור סיכון גבוה עומד על ${formatPercentage(highRiskShare * 100)} — מומלץ לבדוק קורסים חלשים.`
      });
    }

    if (lowEngagement) {
      alerts.push({
        tone: 'warning',
        icon: AlertTriangle,
        title: 'מעורבות סטודנטים נמוכה מהצפוי',
        description: `ממוצע המעורבות עומד על ${analytics.averageEngagement.toFixed(1)} — כדאי לשקול פעילות חיזוק.`
      });
    }

    if (lowReturning) {
      alerts.push({
        tone: 'warning',
        icon: AlertTriangle,
        title: 'שיעור משתמשים חוזרים נמוך',
        description: `רק ${formatPercentage(report.summary.returningUsersPercentage)} חזרו השבוע. שלחו תזכורת או משימה נוספת.`
      });
    }

    if (shortSessions) {
      alerts.push({
        tone: 'info',
        icon: AlertTriangle,
        title: 'סשנים קצרים במיוחד',
        description: `משך סשן ממוצע של ${formatDuration(report.summary.averageSessionDuration)} — ייתכן שהסטודנטים מתקשים להתעמק.`
      });
    }

    return alerts;
  }, [analytics, report]);

  const handleExportCsv = () => {
    if (!report) return;
    const rows: string[][] = [
      ['Weekly Analytics Export'],
      ['Period', `${report.period.startDate} - ${report.period.endDate}`],
      ['Total users', report.summary.totalUsersWithSessions.toString()],
      ['Total sessions', report.summary.totalSessions.toString()],
      ['Total messages', report.summary.totalMessages.toString()],
      ['Avg messages per user', report.summary.averageMessagesPerUser.toFixed(2)],
      ['Avg messages per session', report.summary.averageMessagesPerSession.toFixed(2)],
      ['Avg session duration (ms)', report.summary.averageSessionDuration.toString()],
      ['Median session duration (ms)', report.summary.medianSessionDuration.toString()],
      ['Avg user duration (ms)', report.summary.averageUserDuration.toString()],
      ['Returning users %', report.summary.returningUsersPercentage.toFixed(1)],
      [],
      ['Daily breakdown'],
      ['Date', 'Sessions', 'Messages', 'Unique users'],
      ...report.dailyBreakdown.map((day) => [
        day.date,
        day.sessions.toString(),
        day.messages.toString(),
        day.uniqueUsers.toString()
      ])
    ];

    if (analytics) {
      rows.push([]);
      rows.push(['Student analytics']);
      rows.push(['Total students', analytics.totalStudents.toString()]);
      rows.push(['Average grade', analytics.averageGrade.toFixed(1)]);
      rows.push(['Average engagement', analytics.averageEngagement.toFixed(1)]);
      rows.push(['Risk distribution - low', analytics.riskDistribution.low.toString()]);
      rows.push(['Risk distribution - medium', analytics.riskDistribution.medium.toString()]);
      rows.push(['Risk distribution - high', analytics.riskDistribution.high.toString()]);
      rows.push(['Score distribution - good', analytics.scoreDistribution.good.toString()]);
      rows.push(['Score distribution - needs attention', analytics.scoreDistribution.needs_attention.toString()]);
      rows.push(['Score distribution - struggling', analytics.scoreDistribution.struggling.toString()]);
      rows.push(['Score distribution - empty', analytics.scoreDistribution.empty.toString()]);
      rows.push([]);
      rows.push(['Top challenges', analytics.topChallenges.join(' | ') || '—']);
    }

    const csvContent = rows
      .map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `weekly-analytics-${report.period.endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout
      activeTab="weekly-analytics"
      onTabChange={() => {}}
      currentUser={null}
      onLogout={() => {}}
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <button onClick={() => router.back()} className={styles.backButton}>
            <ArrowLeft size={20} />
            חזור
          </button>
          <div className={styles.titleSection}>
            <BarChart3 size={32} />
            <div>
              <h1>אנליטיקה שבועית</h1>
              <p>סקירת שימוש, סשנים ונושאים מובילים לשבוע האחרון</p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.secondaryButton}
              onClick={handleExportCsv}
              disabled={!report}
            >
              <Download size={18} />
              יצוא CSV
            </button>
            <button
              className={styles.refreshButton}
              onClick={refreshData}
              disabled={isReportLoading || isAnalyticsLoading}
            >
              {isReportLoading || isAnalyticsLoading ? 'טוען נתונים...' : 'רענן נתונים'}
            </button>
          </div>
        </div>

        <section className={styles.filterBar}>
          <div className={styles.filterGroup}>
            <label htmlFor="weekRange">טווח שבועי</label>
            <select
              id="weekRange"
              value={selectedDays}
              onChange={(event) => setSelectedDays(event.target.value)}
            >
              {filterOptions.days.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label htmlFor="classFilter">כיתה</label>
            <select
              id="classFilter"
              value={selectedClass}
              onChange={(event) => setSelectedClass(event.target.value)}
            >
              {filterOptions.classes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label htmlFor="semesterFilter">סמסטר</label>
            <select
              id="semesterFilter"
              value={selectedSemester}
              onChange={(event) => setSelectedSemester(event.target.value)}
            >
              {filterOptions.semesters.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        {reportError && (
          <ErrorBanner
            message="טעינת הדוח נכשלה"
            details={reportError}
            retryable
            onRetry={fetchReport}
          />
        )}

        {analyticsError && (
          <ErrorBanner
            message="טעינת נתוני הסטודנטים נכשלה"
            details={analyticsError}
            retryable
            onRetry={fetchAnalytics}
          />
        )}

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>מדדי ביצוע מרכזיים</h2>
            {report && (
              <span className={styles.sectionMeta}>
                {formatDate(report.period.startDate)} - {formatDate(report.period.endDate)}
              </span>
            )}
          </div>
          <div className={styles.kpiGrid}>
            {isReportLoading &&
              Array.from({ length: 5 }).map((_, index) => (
                <SkeletonCard key={`kpi-skeleton-${index}`} />
              ))}
            {!isReportLoading &&
              kpiCards.map((card) => (
                <StatsCard
                  key={card.title}
                  icon={card.icon}
                  title={card.title}
                  value={card.value}
                  description={card.description}
                />
              ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>מדדי זמן ומעורבות</h2>
            <span className={styles.sectionMeta}>ממוצעי זמן ושיעור משתמשים חוזרים</span>
          </div>
          <div className={styles.kpiGrid}>
            {isReportLoading &&
              Array.from({ length: 4 }).map((_, index) => (
                <SkeletonCard key={`engagement-skeleton-${index}`} />
              ))}
            {!isReportLoading &&
              engagementCards.map((card) => (
                <StatsCard
                  key={card.title}
                  icon={card.icon}
                  title={card.title}
                  value={card.value}
                  description={card.description}
                />
              ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>פירוט יומי</h2>
            <span className={styles.sectionMeta}>סשנים, הודעות ומשתמשים ייחודיים</span>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>תאריך</th>
                  <th>סשנים</th>
                  <th>הודעות</th>
                  <th>משתמשים ייחודיים</th>
                </tr>
              </thead>
              <tbody>
                {report?.dailyBreakdown.map((day) => (
                  <tr key={day.date}>
                    <td>{formatDate(day.date)}</td>
                    <td>{formatNumber(day.sessions)}</td>
                    <td>{formatNumber(day.messages)}</td>
                    <td>{formatNumber(day.uniqueUsers)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!isReportLoading && report?.dailyBreakdown.length === 0 && (
              <div className={styles.emptyState}>אין נתונים להצגה בטווח הנבחר.</div>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>תובנות נושאים ושאלות</h2>
            <span className={styles.sectionMeta}>נושאים חמים ושאלות לדוגמה</span>
          </div>
          <div className={styles.sectionGrid}>
            <TopicList
              title="נושאים מובילים"
              description="נושאים שחזרו בשיחות"
              topics={report?.relationalAlgebra.topTopics ?? []}
              isLoading={isReportLoading}
              emptyMessage="לא נמצאו נושאים מובילים לשבוע הנוכחי."
            />
            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <h2>שאלות לדוגמה</h2>
                <span className={styles.sectionMeta}>דוגמאות לשאלות חוזרות</span>
              </div>
              {isReportLoading && (
                <div className={styles.loadingStack}>
                  {Array.from({ length: 3 }).map((_, index) => (
                    <SkeletonCard key={`question-skeleton-${index}`} />
                  ))}
                </div>
              )}
              {!isReportLoading && (
                <ul className={styles.questionList}>
                  {report?.relationalAlgebra.sampleQuestions.map((question, index) => (
                    <li key={`${question.sessionId}-${index}`}>
                      <div className={styles.questionHeader}>
                        <span>{question.userEmail || question.userId}</span>
                        <span>{new Date(question.timestamp).toLocaleString('he-IL')}</span>
                      </div>
                      <p>{question.message}</p>
                    </li>
                  ))}
                </ul>
              )}
              {!isReportLoading && report?.relationalAlgebra.sampleQuestions.length === 0 && (
                <div className={styles.emptyState}>אין שאלות לדוגמה לשבוע הנוכחי.</div>
              )}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>סיכום ביצועי סטודנטים</h2>
            <span className={styles.sectionMeta}>ציונים, סיכונים ואתגרים מובילים</span>
          </div>
          <div className={styles.sectionGrid}>
            {isAnalyticsLoading && (
              <div className={styles.sectionCard}>
                <div className={styles.loadingStack}>
                  {Array.from({ length: 4 }).map((_, index) => (
                    <SkeletonCard key={`performance-skeleton-${index}`} />
                  ))}
                </div>
              </div>
            )}
            {!isAnalyticsLoading && analytics && <PerformanceSummary analytics={analytics} />}
            {!isAnalyticsLoading && !analytics && (
              <div className={styles.sectionCard}>
                <div className={styles.emptyState}>אין נתוני סטודנטים להצגה כעת.</div>
              </div>
            )}
            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <h2>אתגרים בולטים</h2>
                <span className={styles.sectionMeta}>הנושאים שמקשים על הסטודנטים</span>
              </div>
              {isAnalyticsLoading && (
                <div className={styles.loadingStack}>
                  {Array.from({ length: 3 }).map((_, index) => (
                    <SkeletonCard key={`challenge-skeleton-${index}`} />
                  ))}
                </div>
              )}
              {!isAnalyticsLoading && (
                <ul className={styles.challengeList}>
                  {analytics?.topChallenges.map((challenge) => (
                    <li key={challenge}>{challenge}</li>
                  ))}
                </ul>
              )}
              {!isAnalyticsLoading && analytics?.topChallenges.length === 0 && (
                <div className={styles.emptyState}>לא זוהו אתגרים מובילים לשבוע הנוכחי.</div>
              )}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>התראות ומסקנות למרצים</h2>
            <span className={styles.sectionMeta}>איתור חריגות והמלצות לפעולה</span>
          </div>
          <div className={styles.alertGrid}>
            {isAnalyticsLoading || isReportLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <SkeletonCard key={`alert-skeleton-${index}`} />
              ))
            ) : alertItems.length > 0 ? (
              alertItems.map((alert) => {
                const Icon = alert.icon;
                return (
                  <div key={alert.title} className={`${styles.alertCard} ${styles[alert.tone]}`}>
                    <div className={styles.alertIcon}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <p className={styles.alertTitle}>{alert.title}</p>
                      <p className={styles.alertDescription}>{alert.description}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className={styles.sectionCard}>
                <div className={styles.emptyState}>לא זוהו חריגות משמעותיות השבוע.</div>
              </div>
            )}
          </div>
        </section>

        <section className={styles.sectionGrid}>
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2>סטטוס הדוח</h2>
            </div>
            <div className={styles.statusCard}>
              <div>
                <p className={styles.statusLabel}>משך התקופה</p>
                <p className={styles.statusValue}>{report?.period.days ?? 7} ימים</p>
              </div>
              <div>
                <p className={styles.statusLabel}>עודכן לאחרונה</p>
                <p className={styles.statusValue}>
                  {report ? new Date(report.exportedAt).toLocaleString('he-IL') : '—'}
                </p>
              </div>
              <div>
                <p className={styles.statusLabel}>מקור נתונים</p>
                <p className={styles.statusValue}>chat-report + students/analytics</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
};

export default WeeklyAnalyticsPage;
