"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, BarChart3, Users, MessageSquare, TrendingUp, FileText } from 'lucide-react';
import AdminLayout from '@/app/components/admin/AdminLayout';
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
    usersAskingAboutRA: number;
    totalRAMessages: number;
    percentageOfAllMessages: number;
    sampleQuestions: Array<{
      userId: string;
      userEmail?: string;
      message: string;
      timestamp: Date;
      sessionId: string;
    }>;
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
  userDetails: Array<{
    userId: string;
    userEmail?: string;
    sessionCount: number;
    messageCount: number;
    hasRelationalAlgebraQuestions: boolean;
  }>;
  exportedAt: string;
}

const ChatReportPage: React.FC = () => {
  const router = useRouter();
  const [report, setReport] = useState<WeeklyChatReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [includeDetails, setIncludeDetails] = useState(true);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/chat-report?days=${days}&format=json&includeDetails=${includeDetails}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch report');
      }
      const data = await response.json();
      if (data.success && data.data) {
        setReport(data.data);
      } else {
        throw new Error(data.error || 'Failed to load report');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching report:', err);
    } finally {
      setIsLoading(false);
    }
  }, [days, includeDetails]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const downloadReport = () => {
    if (!report) return;

    const dataStr = JSON.stringify(report, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chat-report-${new Date(report.period.startDate).toISOString().split('T')[0]}-to-${new Date(report.period.endDate).toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  return (
    <AdminLayout
      activeTab="reports"
      onTabChange={() => {}}
      currentUser={null}
      onLogout={() => {}}
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <button 
            onClick={() => router.back()}
            className={styles.backButton}
          >
            <ArrowLeft size={20} />
            חזור
          </button>
          <div className={styles.titleSection}>
            <BarChart3 size={32} />
            <h1>דוח שיחות שבועי</h1>
          </div>
        </div>

        <div className={styles.controls}>
          <div className={styles.controlGroup}>
            <label htmlFor="days">מספר ימים:</label>
            <select
              id="days"
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className={styles.select}
            >
              <option value={7}>7 ימים</option>
              <option value={14}>14 ימים</option>
              <option value={30}>30 ימים</option>
            </select>
          </div>
          <div className={styles.controlGroup}>
            <label>
              <input
                type="checkbox"
                checked={includeDetails}
                onChange={(e) => setIncludeDetails(e.target.checked)}
                className={styles.checkbox}
              />
              כלול פרטים מלאים
            </label>
          </div>
          <button
            onClick={fetchReport}
            disabled={isLoading}
            className={styles.refreshButton}
          >
            {isLoading ? 'טוען...' : 'רענן דוח'}
          </button>
          {report && (
            <button
              onClick={downloadReport}
              className={styles.downloadButton}
            >
              <Download size={16} />
              הורד דוח
            </button>
          )}
        </div>

        {error && (
          <div className={styles.error}>
            שגיאה: {error}
          </div>
        )}

        {isLoading && (
          <div className={styles.loading}>
            טוען דוח...
          </div>
        )}

        {report && !isLoading && (
          <div className={styles.content}>
            {/* Period Info */}
            <div className={styles.periodInfo}>
              <p>
                תקופה: {formatDate(report.period.startDate)} - {formatDate(report.period.endDate)} 
                ({report.period.days} ימים)
              </p>
              <p className={styles.timestamp}>
                נוצר ב: {new Date(report.exportedAt).toLocaleString('he-IL')}
              </p>
            </div>

            {/* Summary Cards */}
            <div className={styles.summaryGrid}>
              <div className={styles.summaryCard}>
                <Users size={24} />
                <div className={styles.summaryContent}>
                  <h3>משתמשים עם שיחות</h3>
                  <p className={styles.summaryNumber}>{report.summary.totalUsersWithSessions}</p>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <MessageSquare size={24} />
                <div className={styles.summaryContent}>
                  <h3>סה&quot;כ שיחות</h3>
                  <p className={styles.summaryNumber}>{report.summary.totalSessions}</p>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <FileText size={24} />
                <div className={styles.summaryContent}>
                  <h3>סה&quot;כ הודעות</h3>
                  <p className={styles.summaryNumber}>{report.summary.totalMessages}</p>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <TrendingUp size={24} />
                <div className={styles.summaryContent}>
                  <h3>ממוצע הודעות למשתמש</h3>
                  <p className={styles.summaryNumber}>{report.summary.averageMessagesPerUser.toFixed(1)}</p>
                </div>
              </div>
            </div>

            {/* Relational Algebra Section */}
            <div className={styles.section}>
              <h2>ניתוח אלגברה יחסית</h2>
              <div className={styles.raStats}>
                <div className={styles.raStatCard}>
                  <h3>משתמשים ששאלו על אלגברה יחסית</h3>
                  <p className={styles.raNumber}>{report.relationalAlgebra.usersAskingAboutRA}</p>
                  <p className={styles.raPercentage}>
                    {report.summary.totalUsersWithSessions > 0
                      ? ((report.relationalAlgebra.usersAskingAboutRA / report.summary.totalUsersWithSessions) * 100).toFixed(1)
                      : 0}% מהמשתמשים
                  </p>
                </div>
                <div className={styles.raStatCard}>
                  <h3>הודעות על אלגברה יחסית</h3>
                  <p className={styles.raNumber}>{report.relationalAlgebra.totalRAMessages}</p>
                  <p className={styles.raPercentage}>
                    {report.relationalAlgebra.percentageOfAllMessages}% מכלל ההודעות
                  </p>
                </div>
              </div>

              {report.relationalAlgebra.topTopics.length > 0 && (
                <div className={styles.topicsSection}>
                  <h3>נושאים נפוצים באלגברה יחסית</h3>
                  <div className={styles.topicsList}>
                    {report.relationalAlgebra.topTopics.map((topic, index) => (
                      <div key={index} className={styles.topicItem}>
                        <span className={styles.topicName}>{topic.topic}</span>
                        <span className={styles.topicCount}>{topic.count} הודעות</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {report.relationalAlgebra.sampleQuestions.length > 0 && (
                <div className={styles.sampleQuestions}>
                  <h3>דוגמאות שאלות על אלגברה יחסית</h3>
                  <div className={styles.questionsList}>
                    {report.relationalAlgebra.sampleQuestions.map((q, index) => (
                      <div key={index} className={styles.questionItem}>
                        <div className={styles.questionHeader}>
                          <span className={styles.questionUser}>
                            {q.userEmail || q.userId}
                          </span>
                          <span className={styles.questionDate}>
                            {formatDate(q.timestamp.toString())}
                          </span>
                        </div>
                        <p className={styles.questionText}>{q.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Daily Breakdown */}
            {report.dailyBreakdown.length > 0 && (
              <div className={styles.section}>
                <h2>פירוט יומי</h2>
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>תאריך</th>
                        <th>שיחות</th>
                        <th>הודעות</th>
                        <th>משתמשים ייחודיים</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.dailyBreakdown.map((day, index) => (
                        <tr key={index}>
                          <td>{formatDate(day.date)}</td>
                          <td>{day.sessions}</td>
                          <td>{day.messages}</td>
                          <td>{day.uniqueUsers}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* User Details */}
            {report.userDetails.length > 0 && (
              <div className={styles.section}>
                <h2>פירוט לפי משתמש</h2>
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>משתמש</th>
                        <th>שיחות</th>
                        <th>הודעות</th>
                        <th>שאלות על אלגברה יחסית</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.userDetails.map((user, index) => (
                        <tr key={index}>
                          <td>{user.userEmail || user.userId}</td>
                          <td>{user.sessionCount}</td>
                          <td>{user.messageCount}</td>
                          <td>
                            {user.hasRelationalAlgebraQuestions ? (
                              <span className={styles.yes}>כן</span>
                            ) : (
                              <span className={styles.no}>לא</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default ChatReportPage;
