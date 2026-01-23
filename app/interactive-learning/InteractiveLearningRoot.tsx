'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { LEARNING_PDFS } from '@/lib/learning-content';
import { getAllowedConceptsForWeek, SQL_CURRICULUM_MAP } from '@/lib/sql-curriculum';

import styles from './interactive-learning.module.css';

type ViewMode = 'list' | 'topic';
type NoteStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';
type SummaryStatus = 'idle' | 'loading' | 'ready' | 'error';
type PdfStatus = 'idle' | 'checking' | 'loading' | 'ready' | 'error';

type ConversationSummary = {
  sessionId: string;
  sessionTitle: string;
  summaryPoints: string[];
  keyTopics: string[];
  createdAt: string;
};

type ConversationInsights = {
  totalSessions: number;
  averageSessionDuration: number;
  mostCommonTopics: string[];
  learningTrend: 'improving' | 'stable' | 'declining';
  commonChallenges: string[];
  overallEngagement: 'low' | 'medium' | 'high';
};

const VIEW_MODE_STORAGE_KEY = 'interactive-learning-view';

const InteractiveLearningRoot = () => {
  const lectures = useMemo(
    () => LEARNING_PDFS.filter((asset) => asset.type === 'lecture'),
    []
  );
  const practices = useMemo(
    () => LEARNING_PDFS.filter((asset) => asset.type === 'practice'),
    []
  );
  const weeks = useMemo(() => {
    const weekNumbers = Array.from(
      new Set(LEARNING_PDFS.map((asset) => asset.week))
    ).sort((a, b) => a - b);

    return weekNumbers.map((week) => ({
      week,
      concepts: SQL_CURRICULUM_MAP[week]?.concepts ?? getAllowedConceptsForWeek(week),
      assets: LEARNING_PDFS.filter((asset) => asset.week === week),
    }));
  }, []);

  const [selectedId, setSelectedId] = useState<string | null>(
    lectures[0]?.id ?? practices[0]?.id ?? null
  );
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedWeek, setSelectedWeek] = useState<number | null>(weeks[0]?.week ?? null);
  const [userId, setUserId] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [noteStatus, setNoteStatus] = useState<NoteStatus>('idle');
  const [lastSavedContent, setLastSavedContent] = useState('');
  const [summaries, setSummaries] = useState<ConversationSummary[]>([]);
  const [insights, setInsights] = useState<ConversationInsights | null>(null);
  const [summaryStatus, setSummaryStatus] = useState<SummaryStatus>('idle');
  const [pdfStatus, setPdfStatus] = useState<PdfStatus>('idle');
  const [pdfAvailable, setPdfAvailable] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>(
    'idle'
  );
  const [exportMessage, setExportMessage] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportReadyUrl, setExportReadyUrl] = useState<string | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }

    const queryView = searchParams.get('view');
    const queryPdf = searchParams.get('pdf');
    const queryWeek = searchParams.get('week');
    const storedView = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);

    if (queryView === 'list' || queryView === 'topic') {
      setViewMode(queryView);
    } else if (storedView === 'list' || storedView === 'topic') {
      setViewMode(storedView);
    }

    if (queryPdf && LEARNING_PDFS.some((asset) => asset.id === queryPdf)) {
      setSelectedId(queryPdf);
    }

    if (queryWeek) {
      const weekValue = Number(queryWeek);
      if (!Number.isNaN(weekValue) && weeks.some((week) => week.week === weekValue)) {
        setSelectedWeek(weekValue);
      }
    }

    hasInitialized.current = true;
  }, [searchParams, weeks]);

  useEffect(() => {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

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
    } catch (error) {
      console.error('Failed to parse currentUser for notes:', error);
    }
  }, []);

  const selectedAsset = useMemo(
    () => LEARNING_PDFS.find((asset) => asset.id === selectedId) ?? null,
    [selectedId]
  );
  const selectedWeekData = useMemo(() => {
    if (selectedWeek === null) {
      return null;
    }
    return weeks.find((week) => week.week === selectedWeek) ?? null;
  }, [selectedWeek, weeks]);

  const weekAssets = useMemo(
    () => (selectedWeekData ? selectedWeekData.assets : []),
    [selectedWeekData]
  );

  const noteTarget = useMemo(() => {
    if (viewMode === 'topic' && selectedWeekData) {
      return {
        type: 'topic' as const,
        id: `week-${selectedWeekData.week}`,
        label: `שבוע ${selectedWeekData.week}`,
      };
    }

    if (selectedAsset) {
      return {
        type: 'pdf' as const,
        id: selectedAsset.id,
        label: selectedAsset.label,
      };
    }

    return null;
  }, [selectedAsset, selectedWeekData, viewMode]);

  useEffect(() => {
    if (viewMode !== 'topic') {
      return;
    }

    const fallbackWeek = selectedAsset?.week ?? weeks[0]?.week ?? null;
    if (fallbackWeek !== null && selectedWeek !== fallbackWeek) {
      setSelectedWeek(fallbackWeek);
    }
  }, [selectedAsset, selectedWeek, viewMode, weeks]);

  useEffect(() => {
    if (viewMode !== 'topic' || !selectedWeekData) {
      return;
    }

    if (!selectedAsset || selectedAsset.week !== selectedWeekData.week) {
      if (selectedWeekData.assets[0]) {
        setSelectedId(selectedWeekData.assets[0].id);
      }
    }
  }, [selectedAsset, selectedWeekData, viewMode]);

  const pdfUrl = selectedAsset
    ? `/api/learning/pdfs/${encodeURIComponent(selectedAsset.filename)}`
    : null;

  useEffect(() => {
    if (!hasInitialized.current) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());

    if (selectedId) {
      nextParams.set('pdf', selectedId);
    } else {
      nextParams.delete('pdf');
    }

    nextParams.set('view', viewMode);

    if (viewMode === 'topic' && selectedWeek) {
      nextParams.set('week', String(selectedWeek));
    } else {
      nextParams.delete('week');
    }

    const nextQuery = nextParams.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery !== currentQuery) {
      const url = nextQuery ? `${pathname}?${nextQuery}` : pathname;
      router.replace(url, { scroll: false });
    }
  }, [pathname, router, searchParams, selectedId, selectedWeek, viewMode]);

  const michaelUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('context', 'interactive-learning');

    if (selectedAsset) {
      params.set('source', selectedAsset.id);
    }

    if (selectedWeekData) {
      params.set('week', String(selectedWeekData.week));
    }

    const query = params.toString();
    return query ? `/entities/basic-chat?${query}` : '/entities/basic-chat';
  }, [selectedAsset, selectedWeekData]);

  const loadNote = useCallback(async () => {
    if (!userId || !noteTarget) {
      setNoteContent('');
      setLastSavedContent('');
      setNoteStatus('idle');
      return;
    }

    setNoteStatus('loading');

    try {
      const response = await fetch(
        `/api/learning/notes?userId=${encodeURIComponent(userId)}&targetType=${noteTarget.type}&targetId=${encodeURIComponent(noteTarget.id)}`,
        {
          headers: { 'x-user-id': userId },
          credentials: 'same-origin',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load note');
      }

      const data = await response.json();
      const content = data?.note?.content ?? '';
      setNoteContent(content);
      setLastSavedContent(content);
      setNoteStatus('idle');
    } catch (error) {
      console.error('Failed to load note:', error);
      setNoteStatus('error');
    }
  }, [noteTarget, userId]);

  useEffect(() => {
    let isActive = true;
    loadNote().catch(() => {
      if (isActive) {
        setNoteStatus('error');
      }
    });

    return () => {
      isActive = false;
    };
  }, [loadNote]);

  const loadSummaries = useCallback(async () => {
    if (!userId) {
      setSummaries([]);
      setInsights(null);
      setSummaryStatus('idle');
      return;
    }

    setSummaryStatus('loading');

    try {
      const response = await fetch(
        `/api/conversation-summary/student/${encodeURIComponent(userId)}?limit=10&insights=true`,
        {
          headers: { 'x-user-id': userId },
          credentials: 'same-origin',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load conversation summaries');
      }

      const data = await response.json();
      const fetchedSummaries = data?.data?.summaries ?? [];
      const fetchedInsights = data?.data?.insights ?? null;

      setSummaries(fetchedSummaries);
      setInsights(fetchedInsights);
      setSummaryStatus('ready');
    } catch (error) {
      console.error('Failed to load conversation summaries:', error);
      setSummaryStatus('error');
    }
  }, [userId]);

  useEffect(() => {
    let isActive = true;
    loadSummaries().catch(() => {
      if (isActive) {
        setSummaryStatus('error');
      }
    });

    return () => {
      isActive = false;
    };
  }, [loadSummaries]);

  useEffect(() => {
    if (!pdfUrl) {
      setPdfStatus('idle');
      setPdfAvailable(false);
      return;
    }

    let isActive = true;
    setPdfStatus('checking');
    setPdfAvailable(false);

    fetch(pdfUrl, { method: 'HEAD', credentials: 'same-origin' })
      .then((response) => {
        if (!isActive) {
          return;
        }
        if (!response.ok) {
          setPdfStatus('error');
          setPdfAvailable(false);
          return;
        }
        setPdfAvailable(true);
        setPdfStatus('loading');
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }
        console.error('Failed to check PDF availability:', error);
        setPdfStatus('error');
        setPdfAvailable(false);
      });

    return () => {
      isActive = false;
    };
  }, [pdfUrl]);

  const handleSaveNote = useCallback(
    async (content: string) => {
      if (!userId || !noteTarget || content === lastSavedContent) {
        return;
      }

      setNoteStatus('saving');

      try {
        const response = await fetch('/api/learning/notes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
          credentials: 'same-origin',
          body: JSON.stringify({
            userId,
            targetType: noteTarget.type,
            targetId: noteTarget.id,
            content,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save note');
        }

        setLastSavedContent(content);
        setNoteStatus('saved');
      } catch (error) {
        console.error('Failed to save note:', error);
        setNoteStatus('error');
      }
    },
    [lastSavedContent, noteTarget, userId]
  );

  const handleExportNotes = useCallback(async () => {
    if (!userId || isExporting) {
      return;
    }

    setIsExporting(true);
    setExportStatus('loading');
    setExportMessage('');

    try {
      if (exportReadyUrl) {
        window.URL.revokeObjectURL(exportReadyUrl);
        setExportReadyUrl(null);
      }

      const response = await fetch(
        `/api/learning/notes/export?userId=${encodeURIComponent(userId)}`,
        {
          headers: { 'x-user-id': userId },
          credentials: 'same-origin',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to export notes');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `interactive-learning-notes-${userId}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      setExportReadyUrl(downloadUrl);
      setExportStatus('ready');
      setExportMessage('הקובץ מוכן להורדה.');
    } catch (error) {
      console.error('Failed to export notes:', error);
      setExportStatus('error');
      setExportMessage('אירעה שגיאה בייצוא ההערות.');
    } finally {
      setIsExporting(false);
    }
  }, [exportReadyUrl, isExporting, userId]);

  useEffect(() => {
    return () => {
      if (exportReadyUrl) {
        window.URL.revokeObjectURL(exportReadyUrl);
      }
    };
  }, [exportReadyUrl]);

  const noteStatusLabel = useMemo(() => {
    if (!userId) {
      return 'התחברו כדי לשמור הערות.';
    }

    switch (noteStatus) {
      case 'loading':
        return 'טוען הערות...';
      case 'saving':
        return 'שומר...';
      case 'saved':
        return 'נשמר';
      case 'error':
        return 'אירעה שגיאה בשמירת ההערות.';
      default:
        return 'הערות נשמרות לחשבון שלכם.';
    }
  }, [noteStatus, userId]);

  const exportStatusLabel = useMemo(() => {
    if (!userId) {
      return 'ייצוא זמין למשתמשים מחוברים בלבד.';
    }

    switch (exportStatus) {
      case 'loading':
        return 'מכינים את הקובץ...';
      case 'error':
        return exportMessage || 'אירעה שגיאה בייצוא.';
      case 'ready':
        return exportMessage || 'הקובץ מוכן.';
      default:
        return 'ייצוא כל ההערות לקובץ JSON.';
    }
  }, [exportMessage, exportStatus, userId]);

  const summaryStatusLabel = useMemo(() => {
    if (!userId) {
      return 'התחברו כדי לראות סיכומים.';
    }

    switch (summaryStatus) {
      case 'loading':
        return 'טוען סיכומים...';
      case 'error':
        return 'אירעה שגיאה בטעינת הסיכומים.';
      default:
        return summaries.length === 0
          ? 'אין עדיין סיכומים זמינים.'
          : `נמצאו ${summaries.length} סיכומים אחרונים.`;
    }
  }, [summaries.length, summaryStatus, userId]);

  const isNoteDirty = noteContent !== lastSavedContent;

  return (
    <div className={styles.interactiveLearning}>
      <header className={styles.compactHeader}>
        <h1 className={styles.compactTitle}>למידה אינטראקטיבית</h1>
        <span className={styles.featureBadge}>חדש</span>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label="ניווט קבצי לימוד">
          <div className={styles.sidebarSection}>
            <h2 className={styles.sectionTitle}>מייקל</h2>
            <a className={styles.primaryLink} href={michaelUrl}>
              שאל את מייקל
            </a>
            <p className={styles.helperText}>פתחו שיחה חדשה עם ההקשר הנוכחי.</p>
          </div>

          <div className={styles.sidebarSection}>
            <h2 className={styles.sectionTitle}>תצוגה</h2>
            <div className={styles.viewToggle} role="group" aria-label="מצב תצוגה">
              <button
                type="button"
                className={
                  viewMode === 'list'
                    ? `${styles.viewButton} ${styles.viewButtonActive}`
                    : styles.viewButton
                }
                onClick={() => setViewMode('list')}
                aria-pressed={viewMode === 'list'}
              >
                לפי רשימה
              </button>
              <button
                type="button"
                className={
                  viewMode === 'topic'
                    ? `${styles.viewButton} ${styles.viewButtonActive}`
                    : styles.viewButton
                }
                onClick={() => setViewMode('topic')}
                aria-pressed={viewMode === 'topic'}
              >
                לפי נושא
              </button>
            </div>
          </div>

          {viewMode === 'topic' && (
            <div className={styles.sidebarSection}>
              <h2 className={styles.sectionTitle}>נושאים לפי שבוע</h2>
              <div className={styles.topicList}>
                {weeks.map((week) => (
                  <button
                    key={week.week}
                    type="button"
                    className={
                      week.week === selectedWeek
                        ? `${styles.topicRow} ${styles.topicRowActive}`
                        : styles.topicRow
                    }
                    onClick={() => setSelectedWeek(week.week)}
                    aria-pressed={week.week === selectedWeek}
                  >
                    <span className={styles.topicTitle}>שבוע {week.week}</span>
                    <span className={styles.topicMeta}>
                      {week.assets.length} קבצים
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div
            className={styles.sidebarSection}
            aria-busy={summaryStatus === 'loading'}
            aria-live="polite"
          >
            <div className={styles.sectionHeaderRow}>
              <h2 className={styles.sectionTitle}>סיכומי שיחות עם מייקל</h2>
              <span className={styles.sectionMeta}>{summaryStatusLabel}</span>
            </div>

            {summaryStatus === 'loading' && (
              <div className={styles.summaryList}>
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`summary-skeleton-${index}`} className={styles.skeletonCard} />
                ))}
              </div>
            )}

            {summaryStatus === 'ready' && summaries.length > 0 && (
              <div className={styles.summaryList} aria-live="polite">
                {summaries.map((summary) => (
                  <div key={summary.sessionId} className={styles.summaryCard}>
                    <div className={styles.summaryHeader}>
                      <h3 className={styles.summaryTitle}>{summary.sessionTitle}</h3>
                      <span className={styles.summaryDate}>
                        {new Date(summary.createdAt).toLocaleDateString('he-IL')}
                      </span>
                    </div>
                    <ul className={styles.summaryPoints}>
                      {summary.summaryPoints.map((point) => (
                        <li key={point} className={styles.summaryPoint}>
                          {point}
                        </li>
                      ))}
                    </ul>
                    {summary.keyTopics.length > 0 && (
                      <div className={styles.summaryTags}>
                        {summary.keyTopics.map((topic) => (
                          <span key={topic} className={styles.tag}>
                            {topic}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {summaryStatus === 'ready' && summaries.length === 0 && (
              <p className={styles.helperText}>אין עדיין סיכומים עבור החשבון שלכם.</p>
            )}

            {summaryStatus === 'error' && (
              <div className={styles.errorBanner} role="alert">
                <p className={styles.errorText}>
                  לא הצלחנו לטעון את הסיכומים. נסו שוב מאוחר יותר.
                </p>
                <button type="button" className={styles.secondaryButton} onClick={loadSummaries}>
                  נסו שוב
                </button>
              </div>
            )}
          </div>

          {insights && summaryStatus === 'ready' && (
            <div className={styles.sidebarSection}>
              <h2 className={styles.sectionTitle}>תובנות למידה</h2>
              <div className={styles.insightCard}>
                <div className={styles.insightRow}>
                  <span className={styles.insightLabel}>סה"כ מפגשים</span>
                  <span className={styles.insightValue}>{insights.totalSessions}</span>
                </div>
                <div className={styles.insightRow}>
                  <span className={styles.insightLabel}>משך ממוצע</span>
                  <span className={styles.insightValue}>
                    {Math.round(insights.averageSessionDuration)} דקות
                  </span>
                </div>
                <div className={styles.insightRow}>
                  <span className={styles.insightLabel}>מגמת למידה</span>
                  <span className={styles.insightValue}>{insights.learningTrend}</span>
                </div>
                <div className={styles.insightRow}>
                  <span className={styles.insightLabel}>מעורבות</span>
                  <span className={styles.insightValue}>{insights.overallEngagement}</span>
                </div>
                {insights.mostCommonTopics.length > 0 && (
                  <div className={styles.insightBlock}>
                    <p className={styles.insightLabel}>נושאים נפוצים</p>
                    <div className={styles.insightTags}>
                      {insights.mostCommonTopics.map((topic) => (
                        <span key={topic} className={styles.tag}>
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {insights.commonChallenges.length > 0 && (
                  <div className={styles.insightBlock}>
                    <p className={styles.insightLabel}>אתגרים מרכזיים</p>
                    <ul className={styles.insightList}>
                      {insights.commonChallenges.map((challenge) => (
                        <li key={challenge}>{challenge}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {viewMode === 'list' && (
            <>
              <div className={styles.sidebarSection}>
                <h2 className={styles.sectionTitle}>הרצאות</h2>
                <div className={styles.list}>
                  {lectures.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      className={
                        asset.id === selectedId
                          ? `${styles.listItem} ${styles.listItemActive}`
                          : styles.listItem
                      }
                      onClick={() => setSelectedId(asset.id)}
                      aria-pressed={asset.id === selectedId}
                    >
                      <span className={styles.listItemLabel}>{asset.label}</span>
                      <span className={styles.listItemMeta}>שבוע {asset.week}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.sidebarSection}>
                <h2 className={styles.sectionTitle}>תרגולים</h2>
                <div className={styles.list}>
                  {practices.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      className={
                        asset.id === selectedId
                          ? `${styles.listItem} ${styles.listItemActive}`
                          : styles.listItem
                      }
                      onClick={() => setSelectedId(asset.id)}
                      aria-pressed={asset.id === selectedId}
                    >
                      <span className={styles.listItemLabel}>{asset.label}</span>
                      <span className={styles.listItemMeta}>שבוע {asset.week}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </aside>

        <main className={styles.mainArea}>
          {viewMode === 'topic' && selectedWeekData && (
            <div className={styles.topicCard}>
              <div className={styles.topicHeader}>
                <div>
                  <p className={styles.topicEyebrow}>למידה לפי נושא</p>
                  <h2 className={styles.topicCardTitle}>שבוע {selectedWeekData.week}</h2>
                </div>
                <span className={styles.topicCount}>
                  {selectedWeekData.assets.length} קבצים
                </span>
              </div>
              {selectedWeekData.concepts.length > 0 ? (
                <div className={styles.topicTags}>
                  {selectedWeekData.concepts.map((concept) => (
                    <span key={concept} className={styles.tag}>
                      {concept}
                    </span>
                  ))}
                </div>
              ) : (
                <p className={styles.topicEmpty}>אין נושאים משויכים לשבוע זה.</p>
              )}
              <div className={styles.topicAssets}>
                {weekAssets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    className={
                      asset.id === selectedId
                        ? `${styles.topicAssetButton} ${styles.topicAssetActive}`
                        : styles.topicAssetButton
                    }
                    onClick={() => setSelectedId(asset.id)}
                  >
                    <span>{asset.label}</span>
                    <span className={styles.topicAssetMeta}>
                      {asset.type === 'lecture' ? 'הרצאה' : 'תרגול'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={styles.contentHeader}>
            <div>
              <p className={styles.contentEyebrow}>מסמך נבחר</p>
              <h2 className={styles.contentTitle}>
                {selectedAsset ? selectedAsset.label : 'בחרו מסמך' }
              </h2>
              {selectedAsset && (
                <p className={styles.contentMeta}>שבוע {selectedAsset.week}</p>
              )}
            </div>
            {selectedAsset && pdfUrl && (
              <div className={styles.contentActions}>
                <a
                  className={styles.actionLink}
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  פתיחה בחלון חדש
                </a>
                <a className={styles.actionLink} href={pdfUrl} download>
                  הורדה
                </a>
              </div>
            )}
          </div>

          <div
            className={styles.viewerCard}
            aria-busy={pdfStatus === 'loading' || pdfStatus === 'checking'}
          >
            {pdfUrl ? (
              <>
                {pdfAvailable && (
                  <iframe
                    className={
                      pdfStatus === 'ready'
                        ? `${styles.viewerFrame} ${styles.viewerFrameReady}`
                        : styles.viewerFrame
                    }
                    src={pdfUrl}
                    title={selectedAsset?.label ?? 'PDF'}
                    onLoad={() => setPdfStatus('ready')}
                    onError={() => setPdfStatus('error')}
                  />
                )}
                {(pdfStatus === 'loading' || pdfStatus === 'checking') && (
                  <div className={styles.viewerOverlay} aria-live="polite">
                    <div className={styles.spinner} aria-hidden="true" />
                    <p className={styles.viewerMessage}>
                      {pdfStatus === 'checking' ? 'בודקים את הקובץ...' : 'טוען את ה-PDF...'}
                    </p>
                  </div>
                )}
                {pdfStatus === 'error' && (
                  <div className={styles.viewerOverlay} role="alert">
                    <p className={styles.errorText}>
                      לא הצלחנו לטעון את הקובץ. אפשר לפתוח או להוריד אותו ישירות.
                    </p>
                    <div className={styles.viewerActions}>
                      <a
                        className={styles.actionLink}
                        href={pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        פתיחה בחלון חדש
                      </a>
                      <a className={styles.actionLink} href={pdfUrl} download>
                        הורדה
                      </a>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.placeholder}>בחרו מסמך כדי להתחיל</div>
            )}
          </div>

          <section
            className={styles.notesCard}
            aria-label="הערות ללמידה"
            aria-busy={noteStatus === 'loading' || noteStatus === 'saving'}
          >
            <div className={styles.notesHeader}>
              <div>
                <p className={styles.notesEyebrow}>הערות</p>
                <h3 className={styles.notesTitle}>
                  {noteTarget
                    ? `הערות עבור ${noteTarget.label}`
                    : 'בחרו מסמך או נושא כדי להוסיף הערות'}
                </h3>
              </div>
              <div className={styles.notesActions}>
                <div className={styles.notesActionRow}>
                  <button
                    type="button"
                    className={styles.saveButton}
                    onClick={() => handleSaveNote(noteContent)}
                    disabled={!userId || !noteTarget || noteStatus === 'saving' || !isNoteDirty}
                  >
                    שמור
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={handleExportNotes}
                    disabled={!userId || isExporting}
                  >
                    ייצא הערות
                  </button>
                  {noteStatus === 'error' && (
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={loadNote}
                      disabled={!userId || !noteTarget}
                    >
                      נסו שוב
                    </button>
                  )}
                </div>
                <div className={styles.notesStatusRow}>
                  <span className={styles.saveStatus} role="status" aria-live="polite">
                    {noteStatusLabel}
                  </span>
                  <span className={styles.exportStatus} role="status" aria-live="polite">
                    {exportStatusLabel}
                  </span>
                </div>
              </div>
            </div>
            <textarea
              className={styles.notesInput}
              value={noteContent}
              placeholder={
                userId
                  ? 'כתבו כאן את ההערות שלכם...'
                  : 'התחברו כדי לשמור הערות אישיות.'
              }
              onChange={(event) => setNoteContent(event.target.value)}
              onBlur={() => handleSaveNote(noteContent)}
              disabled={!userId || !noteTarget || noteStatus === 'loading'}
            />
            {noteStatus === 'loading' && (
              <div className={styles.skeletonBlock} aria-hidden="true" />
            )}
          </section>
        </main>
      </div>
    </div>
  );
};

export default InteractiveLearningRoot;
