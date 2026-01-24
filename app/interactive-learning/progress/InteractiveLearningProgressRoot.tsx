'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import styles from './progress.module.css';

type ProgressItem = {
  targetType: 'lecture' | 'practice';
  targetId: string;
  label: string;
  week: number;
  attemptCount: number;
  bestScore: number | null;
  lastScore: number | null;
  lastAttemptAt: string | null;
  accuracy: number | null;
};

type ProgressSummary = {
  totalTargets: number;
  attemptedTargets: number;
  completionRate: number;
  totalAttempts: number;
};

type RecentAttempt = {
  quizId: string;
  targetType: 'lecture' | 'practice';
  targetId: string;
  label: string;
  score: number;
  completedAt: string;
};

type ProgressResponse = {
  summary: ProgressSummary;
  progressItems: ProgressItem[];
  recentAttempts: RecentAttempt[];
  insights: {
    topicsToRevisit: string[];
  };
};

type ProgressStatus = 'idle' | 'loading' | 'ready' | 'error';

const buildAssetLink = (targetId: string) =>
  targetId ? `/interactive-learning?pdf=${encodeURIComponent(targetId)}&view=list` : '/interactive-learning';

const formatDate = (value: string | null) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('he-IL');
};

const formatScore = (value: number | null) => (value === null ? '—' : `${value}%`);

const InteractiveLearningProgressRoot = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<ProgressStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProgressResponse | null>(null);

  useEffect(() => {
    const storedUser = window.localStorage.getItem('currentUser');
    if (!storedUser) {
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      const resolvedId = parsedUser.id || parsedUser._id || parsedUser.email;
      if (resolvedId) {
        setUserId(String(resolvedId));
      }
    } catch (parseError) {
      console.error('Failed to parse currentUser for progress:', parseError);
    }
  }, []);

  const loadProgress = useCallback(async () => {
    if (!userId) {
      return;
    }

    setStatus('loading');
    setError(null);

    try {
      const response = await fetch('/api/learning/quizzes/progress', {
        headers: { 'x-user-id': userId },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to load progress');
      }

      const payload = (await response.json()) as ProgressResponse;
      setData(payload);
      setStatus('ready');
    } catch (fetchError: any) {
      console.error('Failed to fetch quiz progress:', fetchError);
      setError(fetchError.message || 'שגיאה בטעינת ההתקדמות.');
      setStatus('error');
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    loadProgress();
  }, [loadProgress, userId]);

  const completionLabel = useMemo(() => {
    if (!data) {
      return '—';
    }

    return `${data.summary.attemptedTargets}/${data.summary.totalTargets}`;
  }, [data]);

  const showEmptyState =
    status === 'ready' && data && data.summary.attemptedTargets === 0;

  return (
    <div className={styles.progressPage}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>למידה אינטראקטיבית</p>
          <h1 className={styles.title}>לוח התקדמות חידונים</h1>
          <p className={styles.subtitle}>
            עקבו אחרי הביצועים שלכם, ציונים אחרונים והמלצות לחזרה.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.primaryButton} href="/interactive-learning">
            חזרה ללמידה
          </Link>
        </div>
      </header>

      <main className={styles.layout}>
        <section className={styles.mainColumn} aria-live="polite">
          <div className={styles.sectionHeader}>
            <h2>סטטוס חידונים לפי שיעור</h2>
            <span className={styles.sectionMeta}>
              {status === 'loading' && 'טוען נתונים...'}
              {status === 'error' && 'שגיאה'}
              {status === 'ready' && 'מעודכן'}
            </span>
          </div>

          {status === 'error' && (
            <div className={styles.errorCard} role="alert">
              <p>{error ?? 'שגיאה בטעינת ההתקדמות.'}</p>
              <button type="button" onClick={loadProgress} className={styles.secondaryButton}>
                נסו שוב
              </button>
            </div>
          )}

          {status === 'loading' && (
            <div className={styles.progressGrid}>
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={`progress-skeleton-${index}`} className={styles.skeletonCard} />
              ))}
            </div>
          )}

          {status === 'ready' && data && (
            <>
              {showEmptyState && (
                <div className={styles.emptyState}>
                  <h3>עוד לא התנסיתם בחידונים</h3>
                  <p>בחרו הרצאה או תרגול והתחילו עם מיקרו-חידון קצר.</p>
                  <Link className={styles.secondaryButton} href="/interactive-learning">
                    התחילו עכשיו
                  </Link>
                </div>
              )}

              <div className={styles.progressGrid}>
                {data.progressItems.map((item) => (
                  <div key={item.targetId} className={styles.progressCard}>
                    <div className={styles.progressCardHeader}>
                      <div>
                        <h3>{item.label}</h3>
                        <span className={styles.progressMeta}>שבוע {item.week}</span>
                      </div>
                      <span
                        className={
                          item.attemptCount > 0
                            ? styles.statusBadge
                            : `${styles.statusBadge} ${styles.statusBadgeMuted}`
                        }
                      >
                        {item.attemptCount > 0 ? 'בוצע' : 'לא התחיל'}
                      </span>
                    </div>
                    <div className={styles.progressDetails}>
                      <div>
                        <span className={styles.detailLabel}>ניסיונות</span>
                        <span className={styles.detailValue}>{item.attemptCount}</span>
                      </div>
                      <div>
                        <span className={styles.detailLabel}>ציון אחרון</span>
                        <span className={styles.detailValue}>{formatScore(item.lastScore)}</span>
                      </div>
                      <div>
                        <span className={styles.detailLabel}>ציון מיטבי</span>
                        <span className={styles.detailValue}>{formatScore(item.bestScore)}</span>
                      </div>
                      <div>
                        <span className={styles.detailLabel}>דיוק</span>
                        <span className={styles.detailValue}>
                          {item.accuracy === null ? '—' : `${item.accuracy}%`}
                        </span>
                      </div>
                    </div>
                    <div className={styles.progressFooter}>
                      <span className={styles.progressMeta}>
                        נסיון אחרון: {formatDate(item.lastAttemptAt)}
                      </span>
                      <Link className={styles.inlineLink} href={buildAssetLink(item.targetId)}>
                        פתחו תוכן
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <aside className={styles.sideColumn}>
          <div className={styles.card} aria-live="polite">
            <h3>התקדמות כללית</h3>
            <p className={styles.metricValue}>{completionLabel}</p>
            <p className={styles.metricLabel}>חידונים עם ניסיון מתוך כלל התרגולים</p>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${data?.summary.completionRate ?? 0}%` }}
                aria-hidden="true"
              />
            </div>
            <div className={styles.metricRow}>
              <span>אחוז השלמה</span>
              <strong>{data ? `${data.summary.completionRate}%` : '—'}</strong>
            </div>
            <div className={styles.metricRow}>
              <span>סך ניסיונות</span>
              <strong>{data ? data.summary.totalAttempts : '—'}</strong>
            </div>
          </div>

          <div className={styles.card}>
            <h3>פעילות אחרונה</h3>
            {status === 'ready' && data && data.recentAttempts.length === 0 && (
              <p className={styles.mutedText}>עוד אין ניסיונות אחרונים להצגה.</p>
            )}
            <ul className={styles.activityList}>
              {(data?.recentAttempts ?? []).map((attempt) => (
                <li key={`${attempt.quizId}-${attempt.completedAt}`} className={styles.activityItem}>
                  <div>
                    <Link className={styles.inlineLink} href={buildAssetLink(attempt.targetId)}>
                      {attempt.label}
                    </Link>
                    <span className={styles.activityMeta}>
                      {formatDate(attempt.completedAt)}
                    </span>
                  </div>
                  <span className={styles.activityScore}>{attempt.score}%</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.card}>
            <h3>נושאים לחזרה</h3>
            {status === 'ready' && data && data.insights.topicsToRevisit.length === 0 && (
              <p className={styles.mutedText}>אין מספיק נתונים להצעות חזרה כרגע.</p>
            )}
            <ul className={styles.insightList}>
              {(data?.insights.topicsToRevisit ?? []).map((topic) => (
                <li key={topic}>{topic}</li>
              ))}
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default InteractiveLearningProgressRoot;
