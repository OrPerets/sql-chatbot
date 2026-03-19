'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { LEARNING_PDFS } from '@/lib/learning-content';
import { getAllowedConceptsForWeek, SQL_CURRICULUM_MAP } from '@/lib/sql-curriculum';

import styles from './interactive-learning.module.css';

type ViewMode = 'list' | 'topic';
type NoteStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';
type ConversationSummaryStatus = 'idle' | 'loading' | 'ready' | 'error';
type PdfStatus = 'idle' | 'checking' | 'loading' | 'ready' | 'error';
type PdfSummaryMode = 'full' | 'highlights';
type PdfSummaryStatus = 'idle' | 'loading' | 'ready' | 'error';
type QuizStatus = 'idle' | 'loading' | 'ready' | 'error';
type QuizAttemptStatus = 'idle' | 'saving' | 'saved' | 'error';

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

type LearningQuizQuestion =
  | {
      id: string;
      type: 'mcq';
      prompt: string;
      choices: string[];
      correctIndex: number;
      hint?: string;
      explanation?: string;
    }
  | {
      id: string;
      type: 'sql';
      prompt: string;
      starterSql?: string;
      expectedSql?: string;
      hint?: string;
      explanation?: string;
      runnerConfig?: {
        setId: string;
        questionId: string;
      };
    };

type LearningQuiz = {
  quizId: string;
  targetType: 'lecture' | 'practice';
  targetId: string;
  title: string;
  createdBy: 'michael';
  questions: LearningQuizQuestion[];
  createdAt: string;
  updatedAt: string;
};

type QuizFeedback = {
  correct: boolean;
  message: string;
  explanation?: string;
};

const VIEW_MODE_STORAGE_KEY = 'interactive-learning-view';
const SUMMARY_MODE_STORAGE_KEY = 'interactive-learning-summary-mode';

type ActionItem = {
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  download?: boolean;
};

const ActionMenu = ({
  label,
  items,
  tone = 'light',
}: {
  label: string;
  items: ActionItem[];
  tone?: 'light' | 'dark';
}) => (
  <details className={styles.actionMenu} data-tone={tone}>
    <summary className={styles.actionMenuTrigger} aria-label={label}>
      <span>{label}</span>
      <span aria-hidden="true" className={styles.actionMenuIcon}>
        ⋮
      </span>
    </summary>
    <div className={styles.actionMenuList} role="menu">
      {items.map((item) =>
        item.href ? (
          <a
            key={item.label}
            className={`${styles.actionMenuItem} ${item.disabled ? styles.actionMenuItemDisabled : ''}`}
            href={item.href}
            target="_blank"
            rel="noreferrer"
            download={item.download ? '' : undefined}
            aria-disabled={item.disabled}
            role="menuitem"
            tabIndex={item.disabled ? -1 : 0}
          >
            {item.label}
          </a>
        ) : (
          <button
            key={item.label}
            type="button"
            className={styles.actionMenuItem}
            onClick={item.onClick}
            disabled={item.disabled}
            role="menuitem"
          >
            {item.label}
          </button>
        )
      )}
    </div>
  </details>
);

const normalizeSql = (sql: string) =>
  sql
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\'"]/g, "'")
    .replace(/;/g, '')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s*=\s*/g, ' = ')
    .replace(/\s*>\s*/g, ' > ')
    .replace(/\s*<\s*/g, ' < ')
    .replace(/\s*!=\s*/g, ' != ')
    .replace(/\s*<=\s*/g, ' <= ')
    .replace(/\s*>=\s*/g, ' >= ')
    .replace(/\s*like\s*/gi, ' like ')
    .replace(/\s*is\s+not\s+null\s*/gi, ' is not null ')
    .replace(/\s*is\s+null\s*/gi, ' is null ')
    .replace(/\s*order\s+by\s*/gi, ' order by ')
    .replace(/\s*group\s+by\s*/gi, ' group by ')
    .trim();

const matchesSql = (left: string, right: string) =>
  Boolean(left && right && normalizeSql(left) === normalizeSql(right));

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
  const [conversationSummaryStatus, setConversationSummaryStatus] =
    useState<ConversationSummaryStatus>('idle');
  const [pdfStatus, setPdfStatus] = useState<PdfStatus>('idle');
  const [pdfAvailable, setPdfAvailable] = useState(false);
  const [summaryMode, setSummaryMode] = useState<PdfSummaryMode>('full');
  const [pdfSummaryStatus, setPdfSummaryStatus] = useState<PdfSummaryStatus>('idle');
  const [pdfSummary, setPdfSummary] = useState('');
  const [pdfSummaryUpdatedAt, setPdfSummaryUpdatedAt] = useState<string | null>(null);
  const [pdfSummaryMeta, setPdfSummaryMeta] = useState<{
    truncated: boolean;
    maxChars: number;
  } | null>(null);
  const [pdfSummaryError, setPdfSummaryError] = useState<string | null>(null);
  const [pdfSummaryFeedback, setPdfSummaryFeedback] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>(
    'idle'
  );
  const [exportMessage, setExportMessage] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportReadyUrl, setExportReadyUrl] = useState<string | null>(null);
  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const [quizStatus, setQuizStatus] = useState<QuizStatus>('idle');
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<LearningQuiz | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string | number | null>>({});
  const [quizFeedback, setQuizFeedback] = useState<Record<string, QuizFeedback>>({});
  const [quizHints, setQuizHints] = useState<Record<string, boolean>>({});
  const [quizAttemptStatus, setQuizAttemptStatus] = useState<QuizAttemptStatus>('idle');
  const [quizAttemptMessage, setQuizAttemptMessage] = useState<string | null>(null);
  const quizStartedAtRef = useRef<string | null>(null);
  const [isLecturesExpanded, setIsLecturesExpanded] = useState(true);
  const [isPracticesExpanded, setIsPracticesExpanded] = useState(true);

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
    const storedSummaryMode = window.localStorage.getItem(SUMMARY_MODE_STORAGE_KEY);

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

    if (storedSummaryMode === 'full' || storedSummaryMode === 'highlights') {
      setSummaryMode(storedSummaryMode);
    }

    hasInitialized.current = true;
  }, [searchParams, weeks]);

  useEffect(() => {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    window.localStorage.setItem(SUMMARY_MODE_STORAGE_KEY, summaryMode);
  }, [summaryMode]);

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
  const quizTarget = useMemo(() => {
    if (!selectedAsset) {
      return null;
    }

    return {
      type: selectedAsset.type === 'lecture' ? 'lecture' : 'practice',
      id: selectedAsset.id,
    };
  }, [selectedAsset]);
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

  useEffect(() => {
    setIsPdfOpen(false);
  }, [selectedId]);

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

  const summaryMichaelUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('context', 'interactive-learning-summary');

    if (selectedAsset) {
      params.set('source', selectedAsset.id);
    }

    params.set('summaryMode', summaryMode);

    const query = params.toString();
    return query ? `/entities/basic-chat?${query}` : '/entities/basic-chat';
  }, [selectedAsset, summaryMode]);

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
      setConversationSummaryStatus('idle');
      return;
    }

    setConversationSummaryStatus('loading');

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
      setConversationSummaryStatus('ready');
    } catch (error) {
      console.error('Failed to load conversation summaries:', error);
      setConversationSummaryStatus('error');
    }
  }, [userId]);

  useEffect(() => {
    let isActive = true;
    loadSummaries().catch(() => {
      if (isActive) {
        setConversationSummaryStatus('error');
      }
    });

    return () => {
      isActive = false;
    };
  }, [loadSummaries]);

  const loadPdfSummary = useCallback(async () => {
    if (!userId || !selectedAsset) {
      setPdfSummary('');
      setPdfSummaryUpdatedAt(null);
      setPdfSummaryStatus('idle');
      setPdfSummaryMeta(null);
      setPdfSummaryError(null);
      setPdfSummaryFeedback(null);
      return;
    }

    setPdfSummaryStatus('loading');
    setPdfSummaryError(null);
    setPdfSummaryFeedback(null);

    try {
      const response = await fetch(
        `/api/learning/summaries?userId=${encodeURIComponent(userId)}&pdfId=${encodeURIComponent(
          selectedAsset.id
        )}&summaryMode=${summaryMode}`,
        {
          headers: { 'x-user-id': userId },
          credentials: 'same-origin',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load PDF summary');
      }

      const data = await response.json();
      const summary = data?.summary?.content ?? '';
      const updatedAt = data?.summary?.updatedAt ?? null;

      setPdfSummary(summary);
      setPdfSummaryUpdatedAt(updatedAt);
      setPdfSummaryStatus(summary ? 'ready' : 'idle');
      setPdfSummaryMeta(null);
    } catch (error) {
      console.error('Failed to load PDF summary:', error);
      setPdfSummaryStatus('error');
      setPdfSummaryError('לא הצלחנו לטעון את הסיכום. נסו שוב.');
    }
  }, [selectedAsset, summaryMode, userId]);

  useEffect(() => {
    let isActive = true;
    loadPdfSummary().catch(() => {
      if (isActive) {
        setPdfSummaryStatus('error');
      }
    });

    return () => {
      isActive = false;
    };
  }, [loadPdfSummary]);

  const resetQuizState = useCallback(() => {
    setQuizAnswers({});
    setQuizFeedback({});
    setQuizHints({});
    setQuizAttemptStatus('idle');
    setQuizAttemptMessage(null);
    quizStartedAtRef.current = new Date().toISOString();
  }, []);

  const loadQuiz = useCallback(async () => {
    if (!quizTarget) {
      setQuiz(null);
      setQuizStatus('idle');
      setQuizError(null);
      return;
    }

    if (!userId) {
      setQuiz(null);
      setQuizStatus('idle');
      setQuizError('נדרשת התחברות כדי לראות חידונים.');
      return;
    }

    setQuizStatus('loading');
    setQuizError(null);

    try {
      const response = await fetch(
        `/api/learning/quizzes?targetType=${quizTarget.type}&targetId=${encodeURIComponent(
          quizTarget.id
        )}`,
        {
          headers: { 'x-user-id': userId },
          credentials: 'same-origin',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load quiz');
      }

      const data = await response.json();
      setQuiz(data?.quiz ?? null);
      setQuizStatus('ready');
      resetQuizState();
    } catch (error) {
      console.error('Failed to load quiz:', error);
      setQuizStatus('error');
      setQuizError('לא הצלחנו לטעון את החידון.');
    }
  }, [quizTarget, resetQuizState, userId]);

  useEffect(() => {
    let isActive = true;
    loadQuiz().catch(() => {
      if (isActive) {
        setQuizStatus('error');
      }
    });

    return () => {
      isActive = false;
    };
  }, [loadQuiz]);

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

  const handleGenerateSummary = useCallback(async () => {
    if (!userId || !selectedAsset || pdfSummaryStatus === 'loading') {
      return;
    }

    setPdfSummaryStatus('loading');
    setPdfSummaryError(null);
    setPdfSummaryFeedback(null);

    try {
      const response = await fetch('/api/learning/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        credentials: 'same-origin',
        body: JSON.stringify({
          userId,
          pdfId: selectedAsset.id,
          summaryMode,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }

      const data = await response.json();
      const summaryText = data?.summary?.content ?? '';

      if (!summaryText) {
        throw new Error('No summary returned');
      }

      setPdfSummary(summaryText);
      setPdfSummaryUpdatedAt(data?.summary?.updatedAt ?? new Date().toISOString());
      setPdfSummaryMeta(data?.meta ?? null);
      setPdfSummaryStatus('ready');
      setPdfSummaryFeedback('הסיכום מוכן.');
    } catch (error) {
      console.error('Failed to generate summary:', error);
      setPdfSummaryStatus('error');
      setPdfSummaryError('לא הצלחנו ליצור סיכום. נסו שוב.');
    }
  }, [pdfSummaryStatus, selectedAsset, summaryMode, userId]);

  const handleCopySummary = useCallback(async () => {
    if (!pdfSummary) {
      return;
    }

    try {
      await navigator.clipboard.writeText(pdfSummary);
      setPdfSummaryFeedback('הסיכום הועתק ללוח.');
    } catch (error) {
      console.error('Failed to copy summary:', error);
      setPdfSummaryError('לא הצלחנו להעתיק ללוח.');
    }
  }, [pdfSummary]);

  const handleSaveSummaryToNotes = useCallback(() => {
    if (!pdfSummary || !noteTarget) {
      return;
    }

    const modeLabel = summaryMode === 'full' ? 'סיכום מלא' : 'Highlights';
    const timestamp = new Date().toLocaleDateString('he-IL');
    const nextContent = [
      noteContent.trim(),
      `${modeLabel} (${timestamp})`,
      pdfSummary.trim(),
    ]
      .filter(Boolean)
      .join('\n\n');

    setNoteContent(nextContent);
    handleSaveNote(nextContent);
    setPdfSummaryFeedback('הסיכום נשמר בהערות.');
  }, [handleSaveNote, noteContent, noteTarget, pdfSummary, summaryMode]);

  const handleQuizAnswerChange = useCallback(
    (questionId: string, response: string | number | null) => {
      setQuizAnswers((prev) => ({ ...prev, [questionId]: response }));
      setQuizFeedback((prev) => {
        if (!prev[questionId]) {
          return prev;
        }
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
      setQuizAttemptStatus('idle');
      setQuizAttemptMessage(null);
    },
    []
  );

  const handleToggleQuizHint = useCallback((questionId: string) => {
    setQuizHints((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  }, []);

  const evaluateQuizQuestion = useCallback(
    (question: LearningQuizQuestion, response: string | number | null): QuizFeedback => {
      if (question.type === 'mcq') {
        const responseIndex =
          typeof response === 'number'
            ? response
            : response === null
              ? null
              : Number.isNaN(Number(response))
                ? null
                : Number(response);

        if (responseIndex === null) {
          return { correct: false, message: 'בחרו תשובה כדי לקבל משוב.' };
        }

        const correct = responseIndex === question.correctIndex;
        return {
          correct,
          message: correct ? 'תשובה נכונה!' : 'התשובה אינה נכונה.',
          explanation: question.explanation,
        };
      }

      const responseSql = typeof response === 'string' ? response.trim() : '';
      if (!responseSql) {
        return { correct: false, message: 'הזינו שאילתה כדי לבדוק אותה.' };
      }

      if (!question.expectedSql) {
        return { correct: false, message: 'אין עדיין בדיקה אוטומטית לשאלה הזו.' };
      }

      const correct = matchesSql(responseSql, question.expectedSql);
      return {
        correct,
        message: correct ? 'השאילתה נראית נכונה!' : 'השאילתה לא תואמת לתשובה הצפויה.',
        explanation: question.explanation,
      };
    },
    []
  );

  const handleCheckQuizQuestion = useCallback(
    (questionId: string) => {
      if (!quiz) {
        return;
      }
      const question = quiz.questions.find((item) => item.id === questionId);
      if (!question) {
        return;
      }
      const response = quizAnswers[questionId] ?? null;
      const feedback = evaluateQuizQuestion(question, response);
      setQuizFeedback((prev) => ({ ...prev, [questionId]: feedback }));
    },
    [evaluateQuizQuestion, quiz, quizAnswers]
  );

  const handleGenerateQuiz = useCallback(async () => {
    if (!userId || !quizTarget || quizStatus === 'loading') {
      return;
    }

    setQuizStatus('loading');
    setQuizError(null);

    try {
      const response = await fetch('/api/learning/quizzes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        credentials: 'same-origin',
        body: JSON.stringify({
          userId,
          targetType: quizTarget.type,
          targetId: quizTarget.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate quiz');
      }

      const data = await response.json();
      setQuiz(data?.quiz ?? null);
      setQuizStatus('ready');
      resetQuizState();
    } catch (error) {
      console.error('Failed to generate quiz:', error);
      setQuizStatus('error');
      setQuizError('לא הצלחנו ליצור חידון חדש.');
    }
  }, [quizStatus, quizTarget, resetQuizState, userId]);

  const handleSubmitQuizAttempt = useCallback(async () => {
    if (!userId || !quiz || quizAttemptStatus === 'saving') {
      return;
    }

    setQuizAttemptStatus('saving');
    setQuizAttemptMessage(null);

    try {
      const response = await fetch('/api/learning/quizzes/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        credentials: 'same-origin',
        body: JSON.stringify({
          userId,
          quizId: quiz.quizId,
          answers: quiz.questions.map((question) => ({
            questionId: question.id,
            response: quizAnswers[question.id] ?? null,
          })),
          startedAt: quizStartedAtRef.current ?? undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save quiz attempt');
      }

      const data = await response.json();
      setQuizAttemptStatus('saved');
      setQuizAttemptMessage(`נשמר ניסיון. ציון ${data?.attempt?.score ?? 0}%.`);
    } catch (error) {
      console.error('Failed to save quiz attempt:', error);
      setQuizAttemptStatus('error');
      setQuizAttemptMessage('לא הצלחנו לשמור את הניסיון.');
    }
  }, [quiz, quizAnswers, quizAttemptStatus, userId]);

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

  const isNoteDirty = noteContent !== lastSavedContent;

  const noteStateLabel = useMemo(() => {
    if (!userId) {
      return 'נדרשת התחברות כדי לשמור.';
    }

    if (isNoteDirty) {
      return 'טיוטה לא נשמרה';
    }

    if (noteStatus === 'saved') {
      return 'נשמר ✓';
    }

    return 'מעודכן';
  }, [isNoteDirty, noteStatus, userId]);

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

    switch (conversationSummaryStatus) {
      case 'loading':
        return 'טוען סיכומים...';
      case 'error':
        return 'אירעה שגיאה בטעינת הסיכומים.';
      default:
        return summaries.length === 0
          ? 'אין עדיין סיכומים זמינים.'
          : `נמצאו ${summaries.length} סיכומים אחרונים.`;
    }
  }, [conversationSummaryStatus, summaries.length, userId]);

  const pdfSummaryStatusLabel = useMemo(() => {
    if (!userId) {
      return 'התחברו כדי לסכם עם מייקל.';
    }

    switch (pdfSummaryStatus) {
      case 'loading':
        return 'מייקל עובד על הסיכום...';
      case 'error':
        return pdfSummaryError ?? 'אירעה שגיאה בסיכום.';
      case 'ready':
        return pdfSummaryMeta?.truncated
          ? `הסיכום נוצר מתוך ${pdfSummaryMeta.maxChars} תווים ראשונים של הקובץ.`
          : 'הסיכום מוכן.';
      default:
        return '';
    }
  }, [pdfSummaryError, pdfSummaryMeta?.maxChars, pdfSummaryMeta?.truncated, pdfSummaryStatus, userId]);

  const quizProgress = useMemo(() => {
    if (!quiz) {
      return { answered: 0, total: 0 };
    }

    const answered = quiz.questions.filter((question) => quizFeedback[question.id]).length;
    return { answered, total: quiz.questions.length };
  }, [quiz, quizFeedback]);

  const quizStatusLabel = useMemo(() => {
    if (!userId) {
      return 'התחברו כדי לעבוד עם החידון.';
    }

    switch (quizStatus) {
      case 'loading':
        return 'טוען חידון...';
      case 'error':
        return quizError ?? 'אירעה שגיאה בטעינת החידון.';
      case 'ready':
        return quiz
          ? `חידון פעיל · ${quizProgress.answered}/${quizProgress.total}`
          : 'עדיין אין חידון.';
      default:
        return 'בחרו מסמך כדי להתחיל.';
    }
  }, [quiz, quizError, quizProgress.answered, quizProgress.total, quizStatus, userId]);

  const quizAttemptStatusLabel = useMemo(() => {
    if (!userId) {
      return 'נדרשת התחברות כדי לשמור תוצאות.';
    }

    switch (quizAttemptStatus) {
      case 'saving':
        return 'שומרים ניסיון...';
      case 'saved':
        return quizAttemptMessage ?? 'הניסיון נשמר.';
      case 'error':
        return quizAttemptMessage ?? 'לא הצלחנו לשמור.';
      default:
        return quizAttemptMessage ?? '';
    }
  }, [quizAttemptMessage, quizAttemptStatus, userId]);


  const pdfStatusLabel = useMemo(() => {
    if (!selectedAsset) {
      return 'לא נבחר קובץ';
    }

    switch (pdfStatus) {
      case 'checking':
        return 'בודק זמינות';
      case 'loading':
        return 'זמין לצפייה';
      case 'ready':
        return 'פתוח';
      case 'error':
        return 'שגיאת טעינה';
      default:
        return pdfAvailable ? 'זמין לצפייה' : 'לא זמין';
    }
  }, [pdfAvailable, pdfStatus, selectedAsset]);

  const pdfActionItems = useMemo<ActionItem[]>(() => {
    if (!pdfUrl) {
      return [
        { label: 'פתיחה בחלון חדש', disabled: true },
        { label: 'הורדה', disabled: true, download: true },
      ];
    }

    return [
      { label: 'פתיחה בחלון חדש', href: pdfUrl },
      { label: 'הורדה', href: pdfUrl, download: true },
    ];
  }, [pdfUrl]);

  return (
    <div className={styles.interactiveLearning}>
      <header className={styles.compactHeader}>
        <div className={styles.headerTitleBlock}>
          <p className={styles.headerEyebrow}>למידה אינטראקטיבית</p>
          <h1 className={styles.compactTitle}>
            {selectedAsset ? selectedAsset.label : 'בחרו מסמך להתחיל'}
          </h1>
          {selectedAsset && (
            <span className={styles.headerMeta}>שבוע {selectedAsset.week}</span>
          )}
        </div>
        <ActionMenu label="פעולות" items={pdfActionItems} tone="dark" />
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
            <h2 className={styles.sectionTitle}>מעקב חידונים</h2>
            <a className={styles.secondaryLink} href="/interactive-learning/progress">
              לוח התקדמות חידונים
            </a>
            <p className={styles.helperText}>בדקו ציונים אחרונים ונושאים לחזרה.</p>
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
            aria-busy={conversationSummaryStatus === 'loading'}
            aria-live="polite"
          >
            <div className={styles.sectionHeaderRow}>
              <h2 className={styles.sectionTitle}>סיכומי שיחות עם מייקל</h2>
              <span className={styles.sectionMeta}>{summaryStatusLabel}</span>
            </div>

            {conversationSummaryStatus === 'loading' && (
              <div className={styles.summaryList}>
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`summary-skeleton-${index}`} className={styles.skeletonCard} />
                ))}
              </div>
            )}

            {conversationSummaryStatus === 'ready' && summaries.length > 0 && (
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

            {conversationSummaryStatus === 'ready' && summaries.length === 0 && (
              <p className={styles.helperText}>אין עדיין סיכומים עבור החשבון שלכם.</p>
            )}

            {conversationSummaryStatus === 'error' && (
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

          {insights && conversationSummaryStatus === 'ready' && (
            <div className={styles.sidebarSection}>
              <h2 className={styles.sectionTitle}>תובנות למידה</h2>
              <div className={styles.insightCard}>
                <div className={styles.insightRow}>
                  <span className={styles.insightLabel}>סה״כ מפגשים</span>
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
                <button
                  type="button"
                  className={styles.collapsibleHeader}
                  onClick={() => setIsLecturesExpanded(!isLecturesExpanded)}
                  aria-expanded={isLecturesExpanded}
                >
                  <h2 className={styles.sectionTitle}>הרצאות</h2>
                  <span className={styles.collapseIcon} aria-hidden="true">
                    {isLecturesExpanded ? '−' : '+'}
                  </span>
                </button>
                {isLecturesExpanded && (
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
                )}
              </div>

              <div className={styles.sidebarSection}>
                <button
                  type="button"
                  className={styles.collapsibleHeader}
                  onClick={() => setIsPracticesExpanded(!isPracticesExpanded)}
                  aria-expanded={isPracticesExpanded}
                >
                  <h2 className={styles.sectionTitle}>תרגולים</h2>
                  <span className={styles.collapseIcon} aria-hidden="true">
                    {isPracticesExpanded ? '−' : '+'}
                  </span>
                </button>
                {isPracticesExpanded && (
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
                )}
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

          <div
            className={styles.viewerCard}
            aria-busy={pdfStatus === 'loading' || pdfStatus === 'checking'}
          >
            <div className={styles.viewerHeader}>
              <div>
                <p className={styles.contentEyebrow}>שלב 1 · צפייה בקובץ</p>
                <h2 className={styles.contentTitle}>
                  {selectedAsset ? selectedAsset.label : 'בחרו מסמך'}
                </h2>
                <span className={styles.statusPill} data-tone={pdfStatus}>
                  {pdfStatusLabel}
                </span>
              </div>
              {selectedAsset && !isPdfOpen && (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => setIsPdfOpen(true)}
                  disabled={!pdfAvailable || pdfStatus === 'checking' || pdfStatus === 'error'}
                >
                  פתח/י PDF
                </button>
              )}
            </div>

            {pdfUrl ? (
              <>
                {isPdfOpen && pdfAvailable && (
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
                {!isPdfOpen && (
                  <div className={styles.viewerPlaceholder}>
                    <p className={styles.viewerMessage}>
                      {pdfAvailable
                        ? 'הקובץ מוכן לצפייה. לחצו לפתיחה.'
                        : 'בחרו מסמך כדי לצפות ב-PDF.'}
                    </p>
                  </div>
                )}
                {isPdfOpen && (pdfStatus === 'loading' || pdfStatus === 'checking') && (
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
            className={styles.summaryCard}
            aria-label="סיכום PDF"
            aria-busy={pdfSummaryStatus === 'loading'}
          >
            <div className={styles.summaryHeaderRow}>
              <div className={styles.summaryHeaderContent}>
                <p className={styles.summaryEyebrow}>שלב 2 · סיכום עם מייקל</p>
                <h3 className={styles.summaryPanelTitle}>
                  {selectedAsset
                    ? `סיכום עבור ${selectedAsset.label}`
                    : 'בחרו מסמך כדי לסכם'}
                </h3>
                {pdfSummaryUpdatedAt && (
                  <p className={styles.summaryUpdatedAt}>
                    עודכן: {new Date(pdfSummaryUpdatedAt).toLocaleString('he-IL')}
                  </p>
                )}
              </div>
              <div className={styles.summaryHeaderActions}>
                <div className={styles.segmentedControl} role="tablist" aria-label="מצב סיכום">
                  <button
                    type="button"
                    className={
                      summaryMode === 'full'
                        ? `${styles.segmentedButton} ${styles.segmentedButtonActive}`
                        : styles.segmentedButton
                    }
                    onClick={() => setSummaryMode('full')}
                    aria-pressed={summaryMode === 'full'}
                    role="tab"
                  >
                    סיכום מלא
                  </button>
                  <button
                    type="button"
                    className={
                      summaryMode === 'highlights'
                        ? `${styles.segmentedButton} ${styles.segmentedButtonActive}`
                        : styles.segmentedButton
                    }
                    onClick={() => setSummaryMode('highlights')}
                    aria-pressed={summaryMode === 'highlights'}
                    role="tab"
                  >
                    Highlights
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.summaryBody} aria-live="polite">
              {pdfSummaryStatus === 'loading' && (
                <div className={styles.summaryLoading}>
                  <div className={styles.spinner} aria-hidden="true" />
                  <p className={styles.viewerMessage}>מכינים סיכום...</p>
                </div>
              )}
              {pdfSummaryStatus === 'error' && (
                <div className={styles.errorBanner} role="alert">
                  <p className={styles.errorText}>{pdfSummaryError}</p>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={handleGenerateSummary}
                    disabled={!userId || !selectedAsset}
                  >
                    נסו שוב
                  </button>
                </div>
              )}
              {pdfSummaryStatus === 'ready' && pdfSummary && (
                <div className={styles.summaryContent}>
                  <Markdown>{pdfSummary}</Markdown>
                </div>
              )}
              {pdfSummaryStatus === 'idle' && (
                <div className={styles.summaryEmptyState}>
                  <p className={styles.helperText}>
                    {userId
                      ? 'בחרו מצב סיכום ולחצו על "צור סיכום" כדי להתחיל.'
                      : 'התחברו כדי ליצור סיכום.'}
                  </p>
                  {userId && selectedAsset && (
                    <button
                      type="button"
                      className={`${styles.primaryButton} ${styles.summaryGenerateButton}`}
                      onClick={handleGenerateSummary}
                    >
                      צור סיכום
                    </button>
                  )}
                </div>
              )}
            </div>

            {pdfSummaryStatus === 'ready' && pdfSummary && (
              <div className={styles.summaryFooterActions}>
                <div className={styles.summaryPanelActions}>
                  <a className={styles.primaryButton} href={summaryMichaelUrl}>
                    שאל את מייקל
                  </a>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={handleSaveSummaryToNotes}
                    disabled={!noteTarget}
                  >
                    שמור להערות
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={handleCopySummary}
                    disabled={!pdfSummary}
                    aria-label="העתקת הסיכום"
                    title="העתק סיכום"
                  >
                    ⧉
                  </button>
                </div>
                {(pdfSummaryFeedback || pdfSummaryStatusLabel) && (
                  <div className={styles.summaryStatusRow} aria-live="polite">
                    {pdfSummaryFeedback && (
                      <span className={styles.summaryFeedback}>{pdfSummaryFeedback}</span>
                    )}
                    {pdfSummaryStatusLabel && !pdfSummaryFeedback && (
                      <span className={styles.summaryStatusText}>{pdfSummaryStatusLabel}</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          <section
            className={styles.quizCard}
            aria-label="מיקרו-חידון"
            aria-busy={quizStatus === 'loading'}
          >
            <div className={styles.quizHeader}>
              <div>
                <p className={styles.quizEyebrow}>שלב 3 · מיקרו-חידון</p>
                <h3 className={styles.quizTitle}>
                  {selectedAsset ? `מיקרו-חידון עבור ${selectedAsset.label}` : 'בחרו מסמך לחידון'}
                </h3>
                <span className={styles.statusPill} data-tone={quizStatus}>
                  {quizStatusLabel}
                </span>
              </div>
              {quiz && (
                <div className={styles.quizMeta}>
                  <span className={styles.quizProgress}>
                    {quizProgress.answered}/{quizProgress.total}
                  </span>
                  <span className={styles.quizMetaLabel}>{quiz.title}</span>
                </div>
              )}
            </div>

            <div className={styles.quizBody} aria-live="polite">
              {!userId && quizStatus !== 'loading' && (
                <p className={styles.helperText}>
                  התחברו כדי לצפות בחידונים ולשמור תוצאות.
                </p>
              )}
              {quizStatus === 'loading' && (
                <div className={styles.summaryLoading}>
                  <div className={styles.spinner} aria-hidden="true" />
                  <p className={styles.viewerMessage}>טוענים חידון...</p>
                </div>
              )}

              {quizStatus === 'error' && (
                <div className={styles.errorBanner} role="alert">
                  <p className={styles.errorText}>{quizError}</p>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={loadQuiz}
                    disabled={!userId || !quizTarget}
                  >
                    נסו שוב
                  </button>
                </div>
              )}

              {quizStatus === 'ready' && !quiz && (
                <div className={styles.quizEmptyState}>
                  <p className={styles.helperText}>
                    {userId
                      ? 'אין עדיין חידון עבור המסמך הזה. אפשר לבקש ממייקל ליצור אחד.'
                      : 'התחברו כדי ליצור חידון.'}
                  </p>
                  {userId && quizTarget && (
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={handleGenerateQuiz}
                    >
                      צור חידון עם מייקל
                    </button>
                  )}
                </div>
              )}

              {quizStatus === 'ready' && quiz && (
                <div className={styles.quizList}>
                  {quiz.questions.map((question, index) => {
                    const feedback = quizFeedback[question.id];
                    const response = quizAnswers[question.id];
                    const showHint = quizHints[question.id];
                    return (
                      <div key={question.id} className={styles.quizQuestionCard}>
                        <div className={styles.quizQuestionHeader}>
                          <span className={styles.quizQuestionIndex}>שאלה {index + 1}</span>
                          <span className={styles.quizQuestionType}>
                            {question.type === 'mcq' ? 'בחירה מרובה' : 'SQL'}
                          </span>
                        </div>
                        <p className={styles.quizPrompt}>{question.prompt}</p>

                        {question.type === 'mcq' ? (
                          <div className={styles.quizChoices} role="radiogroup">
                            {question.choices.map((choice, choiceIndex) => (
                              <label key={choice} className={styles.quizChoice}>
                                <input
                                  type="radio"
                                  name={`quiz-${question.id}`}
                                  checked={response === choiceIndex}
                                  onChange={() =>
                                    handleQuizAnswerChange(question.id, choiceIndex)
                                  }
                                />
                                <span>{choice}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <textarea
                            className={styles.quizSqlInput}
                            value={
                              typeof response === 'string'
                                ? response
                                : question.starterSql ?? ''
                            }
                            placeholder="כתבו כאן את שאילתת ה-SQL שלכם..."
                            onChange={(event) =>
                              handleQuizAnswerChange(question.id, event.target.value)
                            }
                          />
                        )}

                        {question.hint && (
                          <button
                            type="button"
                            className={styles.quizHintButton}
                            onClick={() => handleToggleQuizHint(question.id)}
                          >
                            {showHint ? 'הסתר רמז' : 'הצג רמז'}
                          </button>
                        )}

                        {showHint && question.hint && (
                          <p className={styles.quizHint}>רמז: {question.hint}</p>
                        )}

                        <div className={styles.quizQuestionActions}>
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => handleCheckQuizQuestion(question.id)}
                            disabled={!userId}
                          >
                            בדוק תשובה
                          </button>
                          {question.type === 'sql' && question.runnerConfig && userId && (
                            <a
                              className={styles.actionLink}
                              href={`/homework/runner/${question.runnerConfig.setId}?studentId=${encodeURIComponent(
                                userId
                              )}&questionId=${encodeURIComponent(question.runnerConfig.questionId)}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              פתח בסביבת הרצה
                            </a>
                          )}
                        </div>

                        {feedback && (
                          <div
                            className={styles.quizFeedback}
                            data-tone={feedback.correct ? 'success' : 'error'}
                            aria-live="polite"
                          >
                            <p className={styles.quizFeedbackText}>{feedback.message}</p>
                            {feedback.explanation && (
                              <p className={styles.quizExplanation}>{feedback.explanation}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {quiz && (
              <div className={styles.quizFooter}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={handleSubmitQuizAttempt}
                  disabled={
                    !userId ||
                    quizProgress.total === 0 ||
                    quizProgress.answered < quizProgress.total ||
                    quizAttemptStatus === 'saving'
                  }
                >
                  {quizAttemptStatus === 'saving' ? 'שומר ניסיון...' : 'סיום חידון'}
                </button>
                {quizAttemptStatusLabel && (
                  <span className={styles.quizAttemptStatus} role="status" aria-live="polite">
                    {quizAttemptStatusLabel}
                  </span>
                )}
              </div>
            )}
          </section>

          <section
            className={styles.notesCard}
            aria-label="הערות ללמידה"
            aria-busy={noteStatus === 'loading' || noteStatus === 'saving'}
          >
            <div className={styles.notesHeader}>
              <div className={styles.notesHeaderContent}>
                <p className={styles.notesEyebrow}>שלב 4 · הערות אישיות</p>
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
                    {noteStatus === 'saving' ? 'שומר...' : 'שמור'}
                  </button>
                  <ActionMenu
                    label="אפשרויות"
                    items={[
                      {
                        label: 'ייצוא כל ההערות',
                        onClick: handleExportNotes,
                        disabled: !userId || isExporting,
                      },
                      ...(noteStatus === 'error'
                        ? [
                            {
                              label: 'טען מחדש',
                              onClick: loadNote,
                              disabled: !userId || !noteTarget,
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
                <div className={styles.notesStatusRow}>
                  <span className={styles.statusPill} data-tone={isNoteDirty ? 'warning' : noteStatus}>
                    {noteStateLabel}
                  </span>
                  {(exportStatus !== 'idle' || !userId) && (
                    <span className={styles.exportStatus} role="status" aria-live="polite">
                      {exportStatusLabel}
                    </span>
                  )}
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
