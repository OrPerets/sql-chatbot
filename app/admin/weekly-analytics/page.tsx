"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BarChart3,
  Layers,
  MessageCircle,
  MessageSquare,
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
  };
  relationalAlgebra: {
    topTopics: Array<{
      topic: string;
      count: number;
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

const WeeklyAnalyticsPage: React.FC = () => {
  const router = useRouter();
  const [report, setReport] = useState<WeeklyChatReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/chat-report?days=7&format=json&includeDetails=true');
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
      setError(err instanceof Error ? err.message : 'אירעה שגיאה בלתי צפויה');
      console.error('Error fetching weekly analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const formatNumber = (value: number) => value.toLocaleString('he-IL');

  const formatAverage = (value: number) => value.toFixed(1);

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
          <button
            className={styles.refreshButton}
            onClick={fetchReport}
            disabled={isLoading}
          >
            {isLoading ? 'טוען נתונים...' : 'רענן נתונים'}
          </button>
        </div>

        {error && (
          <ErrorBanner
            message="טעינת הדוח נכשלה"
            details={error}
            retryable
            onRetry={fetchReport}
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
            {isLoading &&
              Array.from({ length: 5 }).map((_, index) => (
                <SkeletonCard key={`kpi-skeleton-${index}`} />
              ))}
            {!isLoading &&
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
            {!isLoading && report?.dailyBreakdown.length === 0 && (
              <div className={styles.emptyState}>אין נתונים להצגה בטווח הנבחר.</div>
            )}
          </div>
        </section>

        <section className={styles.sectionGrid}>
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2>נושאים מובילים</h2>
              <span className={styles.sectionMeta}>נושאים שחזרו בשיחות</span>
            </div>
            <ul className={styles.topicList}>
              {report?.relationalAlgebra.topTopics.map((topic) => (
                <li key={topic.topic}>
                  <span className={styles.topicName}>{topic.topic}</span>
                  <span className={styles.topicCount}>{formatNumber(topic.count)}</span>
                </li>
              ))}
            </ul>
            {!isLoading && report?.relationalAlgebra.topTopics.length === 0 && (
              <div className={styles.emptyState}>לא נמצאו נושאים מובילים לשבוע הנוכחי.</div>
            )}
          </div>

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
                <p className={styles.statusValue}>chat-report</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
};

export default WeeklyAnalyticsPage;
