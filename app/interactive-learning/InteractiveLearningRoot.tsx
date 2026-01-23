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
type PdfStatus = 'idle' | 'loading' | 'ready' | 'error';
type PdfSummaryMode = 'full' | 'highlights';
type PdfSummaryStatus = 'idle' | 'loading' | 'ready' | 'error';
type AnnotationTool = 'draw' | 'highlight' | 'eraser';
type AnnotationStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

type LearningAnnotationPoint = {
  x: number;
  y: number;
};

type LearningAnnotation = {
  id: string;
  page: number;
  type: 'draw' | 'highlight';
  color: string;
  thickness: number;
  points: LearningAnnotationPoint[];
  createdAt: string;
};

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
const SUMMARY_MODE_STORAGE_KEY = 'interactive-learning-summary-mode';

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
  const [annotationTool, setAnnotationTool] = useState<AnnotationTool>('draw');
  const [annotationColor, setAnnotationColor] = useState('#1e3a8a');
  const [annotationThickness, setAnnotationThickness] = useState(4);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [annotations, setAnnotations] = useState<LearningAnnotation[]>([]);
  const [annotationStatus, setAnnotationStatus] = useState<AnnotationStatus>('idle');
  const [annotationMessage, setAnnotationMessage] = useState<string>('');
  const [annotationPages, setAnnotationPages] = useState<
    Array<{ pageNumber: number; width: number; height: number; page: any }>
  >([]);
  const [annotationUndoStack, setAnnotationUndoStack] = useState<LearningAnnotation[][]>(
    []
  );
  const [annotationRedoStack, setAnnotationRedoStack] = useState<LearningAnnotation[][]>(
    []
  );

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasInitialized = useRef(false);
  const annotationSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedAnnotations = useRef<string>('');

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

  useEffect(() => {
    if (!pdfUrl) {
      setPdfStatus('idle');
      setPdfAvailable(false);
      setAnnotationPages([]);
      return;
    }

    let isActive = true;
    setPdfStatus('loading');
    setPdfAvailable(false);
    setAnnotationPages([]);

    const loadPdf = async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist/build/pdf');
        const version = (pdfjsLib as { version?: string }).version ?? '4.2.67';
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;

        const loadingTask = pdfjsLib.getDocument({ url: pdfUrl, withCredentials: true });
        const pdf = await loadingTask.promise;

        const pages = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1 });
          pages.push({
            pageNumber,
            width: viewport.width,
            height: viewport.height,
            page,
          });
        }

        if (!isActive) {
          return;
        }

        setAnnotationPages(pages);
        setPdfAvailable(true);
        setPdfStatus('ready');
      } catch (error) {
        if (!isActive) {
          return;
        }
        console.error('Failed to load PDF for annotations:', error);
        setPdfStatus('error');
        setPdfAvailable(false);
      }
    };

    loadPdf();

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

  const loadAnnotations = useCallback(async () => {
    if (!userId || !selectedAsset) {
      setAnnotations([]);
      setAnnotationStatus('idle');
      return;
    }

    setAnnotationStatus('loading');
    setAnnotationMessage('');

    try {
      const response = await fetch(
        `/api/learning/annotations?userId=${encodeURIComponent(userId)}&pdfId=${encodeURIComponent(
          selectedAsset.id
        )}`,
        {
          headers: { 'x-user-id': userId },
          credentials: 'same-origin',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load annotations');
      }

      const data = await response.json();
      const fetchedAnnotations = Array.isArray(data?.annotations) ? data.annotations : [];
      setAnnotations(fetchedAnnotations);
      lastSavedAnnotations.current = JSON.stringify(fetchedAnnotations);
      setAnnotationStatus('idle');
    } catch (error) {
      console.error('Failed to load annotations:', error);
      setAnnotationStatus('error');
      setAnnotationMessage('לא הצלחנו לטעון את ההערות על גבי ה-PDF.');
    }
  }, [selectedAsset, userId]);

  useEffect(() => {
    let isActive = true;
    loadAnnotations().catch(() => {
      if (isActive) {
        setAnnotationStatus('error');
      }
    });

    return () => {
      isActive = false;
    };
  }, [loadAnnotations]);

  useEffect(() => {
    if (!userId || !selectedAsset) {
      return;
    }

    const serialized = JSON.stringify(annotations);
    if (serialized === lastSavedAnnotations.current) {
      return;
    }

    if (annotationSaveTimeout.current) {
      clearTimeout(annotationSaveTimeout.current);
    }

    annotationSaveTimeout.current = setTimeout(async () => {
      try {
        setAnnotationStatus('saving');
        const response = await fetch('/api/learning/annotations', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
          credentials: 'same-origin',
          body: JSON.stringify({
            userId,
            pdfId: selectedAsset.id,
            annotations,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save annotations');
        }

        lastSavedAnnotations.current = serialized;
        setAnnotationStatus('saved');
        setAnnotationMessage('ההערות נשמרו.');
      } catch (error) {
        console.error('Failed to save annotations:', error);
        setAnnotationStatus('error');
        setAnnotationMessage('אירעה שגיאה בשמירת ההערות.');
      }
    }, 800);

    return () => {
      if (annotationSaveTimeout.current) {
        clearTimeout(annotationSaveTimeout.current);
      }
    };
  }, [annotations, selectedAsset, userId]);

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

  const handleAddAnnotation = useCallback(
    (annotation: LearningAnnotation) => {
      setAnnotationUndoStack((stack) => [...stack, annotations]);
      setAnnotationRedoStack([]);
      setAnnotations((prev) => [...prev, annotation]);
    },
    [annotations]
  );

  const handleRemoveAnnotation = useCallback(
    (annotationId: string) => {
      setAnnotationUndoStack((stack) => [...stack, annotations]);
      setAnnotationRedoStack([]);
      setAnnotations((prev) => prev.filter((item) => item.id !== annotationId));
    },
    [annotations]
  );

  const handleUndoAnnotation = useCallback(() => {
    setAnnotationUndoStack((stack) => {
      if (stack.length === 0) {
        return stack;
      }
      const previous = stack[stack.length - 1];
      setAnnotationRedoStack((redo) => [...redo, annotations]);
      setAnnotations(previous);
      return stack.slice(0, -1);
    });
  }, [annotations]);

  const handleRedoAnnotation = useCallback(() => {
    setAnnotationRedoStack((stack) => {
      if (stack.length === 0) {
        return stack;
      }
      const next = stack[stack.length - 1];
      setAnnotationUndoStack((undo) => [...undo, annotations]);
      setAnnotations(next);
      return stack.slice(0, -1);
    });
  }, [annotations]);

  const handleClearAnnotations = useCallback(() => {
    if (!annotations.length) {
      return;
    }
    if (!window.confirm('לנקות את כל ההערות על גבי ה-PDF?')) {
      return;
    }
    setAnnotationUndoStack((stack) => [...stack, annotations]);
    setAnnotationRedoStack([]);
    setAnnotations([]);
    setAnnotationMessage('ההערות נוקו.');
  }, [annotations]);

  const handleExportAnnotations = useCallback(() => {
    if (!selectedAsset || !annotations.length) {
      setAnnotationMessage('אין הערות לייצוא.');
      return;
    }

    const payload = {
      pdfId: selectedAsset.id,
      exportedAt: new Date().toISOString(),
      annotations,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const downloadUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = `interactive-learning-annotations-${selectedAsset.id}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(downloadUrl);
    setAnnotationMessage('הקובץ ירד למחשב.');
  }, [annotations, selectedAsset]);

  const annotationSummary = useMemo(() => {
    if (!annotations.length) {
      return '';
    }

    const recent = annotations.slice(-5).map((item) => {
      const typeLabel = item.type === 'highlight' ? 'הדגשה' : 'שרטוט';
      return `${typeLabel} בעמוד ${item.page}`;
    });

    return recent.join(', ');
  }, [annotations]);

  const annotationMichaelUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('context', 'interactive-learning-annotations');
    if (selectedAsset) {
      params.set('source', selectedAsset.id);
    }
    if (annotationSummary) {
      params.set('annotations', annotationSummary);
    }
    const query = params.toString();
    return query ? `/entities/basic-chat?${query}` : '/entities/basic-chat';
  }, [annotationSummary, selectedAsset]);

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
        return 'בחרו מצב סיכום ולחצו על יצירה.';
    }
  }, [pdfSummaryError, pdfSummaryMeta?.maxChars, pdfSummaryMeta?.truncated, pdfSummaryStatus, userId]);

  const isNoteDirty = noteContent !== lastSavedContent;

  const PdfPageCanvas = ({
    page,
    pageNumber,
    width,
    height,
    annotations: pageAnnotations,
    tool,
    color,
    thickness,
    show,
    onAdd,
    onRemove,
  }: {
    page: any;
    pageNumber: number;
    width: number;
    height: number;
    annotations: LearningAnnotation[];
    tool: AnnotationTool;
    color: string;
    thickness: number;
    show: boolean;
    onAdd: (annotation: LearningAnnotation) => void;
    onRemove: (annotationId: string) => void;
  }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const pageCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const annotationCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const [scale, setScale] = useState(1);
    const [draftPoints, setDraftPoints] = useState<LearningAnnotationPoint[]>([]);
    const drawingRef = useRef<LearningAnnotation | null>(null);

    useEffect(() => {
      if (!containerRef.current) {
        return;
      }

      const updateScale = () => {
        const containerWidth = containerRef.current?.clientWidth ?? 0;
        if (!containerWidth) {
          return;
        }
        setScale(containerWidth / width);
      };

      updateScale();

      const observer = new ResizeObserver(updateScale);
      observer.observe(containerRef.current);

      return () => {
        observer.disconnect();
      };
    }, [width]);

    useEffect(() => {
      if (!pageCanvasRef.current) {
        return;
      }

      const renderPage = async () => {
        const viewport = page.getViewport({ scale });
        const canvas = pageCanvasRef.current;
        if (!canvas) {
          return;
        }
        const context = canvas.getContext('2d');
        if (!context) {
          return;
        }
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context, viewport }).promise;
      };

      renderPage();
    }, [page, scale]);

    useEffect(() => {
      const canvas = annotationCanvasRef.current;
      if (!canvas) {
        return;
      }

      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }

      const displayWidth = width * scale;
      const displayHeight = height * scale;
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      context.clearRect(0, 0, displayWidth, displayHeight);

      if (!show) {
        return;
      }

      const drawStroke = (
        points: LearningAnnotationPoint[],
        strokeColor: string,
        strokeWidth: number,
        isHighlight: boolean
      ) => {
        if (points.length === 0) {
          return;
        }

        context.save();
        context.beginPath();
        points.forEach((point, index) => {
          const x = point.x * displayWidth;
          const y = point.y * displayHeight;
          if (index === 0) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        });
        context.strokeStyle = strokeColor;
        context.lineWidth = strokeWidth * scale;
        context.lineJoin = 'round';
        context.lineCap = 'round';
        context.globalAlpha = isHighlight ? 0.35 : 0.95;
        context.stroke();
        context.restore();
      };

      pageAnnotations
        .filter((item) => item.page === pageNumber)
        .forEach((annotation) => {
          drawStroke(
            annotation.points,
            annotation.color,
            annotation.thickness,
            annotation.type === 'highlight'
          );
        });

      if (draftPoints.length > 0 && (tool === 'draw' || tool === 'highlight')) {
        drawStroke(draftPoints, color, thickness, tool === 'highlight');
      }
    }, [color, draftPoints, height, pageAnnotations, pageNumber, scale, show, thickness, tool, width]);

    const getNormalizedPoint = useCallback(
      (event: React.PointerEvent<HTMLCanvasElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        return {
          x: Math.min(Math.max(x, 0), 1),
          y: Math.min(Math.max(y, 0), 1),
        };
      },
      []
    );

    const handlePointerDown = useCallback(
      (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!show) {
          return;
        }

        if (tool === 'eraser') {
          const point = getNormalizedPoint(event);
          const displayWidth = width * scale;
          const displayHeight = height * scale;
          const threshold = 12;
          const target = pageAnnotations.find((annotation) =>
            annotation.points.some((pt) => {
              const dx = pt.x * displayWidth - point.x * displayWidth;
              const dy = pt.y * displayHeight - point.y * displayHeight;
              return Math.hypot(dx, dy) <= threshold;
            })
          );
          if (target) {
            onRemove(target.id);
          }
          return;
        }

        const point = getNormalizedPoint(event);
        const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `annotation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        drawingRef.current = {
          id,
          page: pageNumber,
          type: tool === 'highlight' ? 'highlight' : 'draw',
          color,
          thickness,
          points: [point],
          createdAt: new Date().toISOString(),
        };
        setDraftPoints([point]);
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      [color, getNormalizedPoint, height, onRemove, pageAnnotations, pageNumber, scale, show, thickness, tool, width]
    );

    const handlePointerMove = useCallback(
      (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawingRef.current || tool === 'eraser' || !show) {
          return;
        }
        const point = getNormalizedPoint(event);
        drawingRef.current.points = [...drawingRef.current.points, point];
        setDraftPoints([...drawingRef.current.points]);
      },
      [getNormalizedPoint, show, tool]
    );

    const handlePointerUp = useCallback(() => {
      if (!drawingRef.current) {
        return;
      }
      const annotation = drawingRef.current;
      drawingRef.current = null;
      setDraftPoints([]);
      if (annotation.points.length > 1) {
        onAdd(annotation);
      }
    }, [onAdd]);

    return (
      <div className={styles.pdfPage} ref={containerRef}>
        <canvas ref={pageCanvasRef} className={styles.pdfCanvas} />
        <canvas
          ref={annotationCanvasRef}
          className={
            show ? styles.annotationCanvas : `${styles.annotationCanvas} ${styles.annotationHidden}`
          }
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        <span className={styles.pageNumber}>עמוד {pageNumber}</span>
      </div>
    );
  };

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

          <section className={styles.summaryToolbar} aria-label="סיכום עם מייקל">
            <div>
              <p className={styles.summaryEyebrow}>סיכום עם מייקל</p>
              <h3 className={styles.summaryTitle}>בחרו מצב סיכום</h3>
            </div>
            <div className={styles.summaryControls}>
              <div className={styles.summaryToggle} role="group" aria-label="מצב סיכום">
                <button
                  type="button"
                  className={
                    summaryMode === 'full'
                      ? `${styles.summaryModeButton} ${styles.summaryModeButtonActive}`
                      : styles.summaryModeButton
                  }
                  onClick={() => setSummaryMode('full')}
                  aria-pressed={summaryMode === 'full'}
                >
                  סיכום מלא
                </button>
                <button
                  type="button"
                  className={
                    summaryMode === 'highlights'
                      ? `${styles.summaryModeButton} ${styles.summaryModeButtonActive}`
                      : styles.summaryModeButton
                  }
                  onClick={() => setSummaryMode('highlights')}
                  aria-pressed={summaryMode === 'highlights'}
                >
                  Highlights
                </button>
              </div>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleGenerateSummary}
                disabled={!userId || !selectedAsset || pdfSummaryStatus === 'loading'}
              >
                צור סיכום
              </button>
            </div>
          </section>

          <section className={styles.annotationToolbar} aria-label="כלי סימון על גבי PDF">
            <div>
              <p className={styles.summaryEyebrow}>הערות על גבי PDF</p>
              <h3 className={styles.summaryTitle}>כלי סימון ושרטוט</h3>
            </div>
            <div className={styles.annotationControls}>
              <div className={styles.annotationTools} role="group" aria-label="כלי עריכה">
                <button
                  type="button"
                  className={
                    annotationTool === 'draw'
                      ? `${styles.annotationButton} ${styles.annotationButtonActive}`
                      : styles.annotationButton
                  }
                  onClick={() => setAnnotationTool('draw')}
                  aria-pressed={annotationTool === 'draw'}
                >
                  שרטוט
                </button>
                <button
                  type="button"
                  className={
                    annotationTool === 'highlight'
                      ? `${styles.annotationButton} ${styles.annotationButtonActive}`
                      : styles.annotationButton
                  }
                  onClick={() => setAnnotationTool('highlight')}
                  aria-pressed={annotationTool === 'highlight'}
                >
                  הדגשה
                </button>
                <button
                  type="button"
                  className={
                    annotationTool === 'eraser'
                      ? `${styles.annotationButton} ${styles.annotationButtonActive}`
                      : styles.annotationButton
                  }
                  onClick={() => setAnnotationTool('eraser')}
                  aria-pressed={annotationTool === 'eraser'}
                >
                  מחק
                </button>
              </div>
              <div className={styles.annotationOptions}>
                <label className={styles.annotationLabel}>
                  צבע
                  <input
                    type="color"
                    value={annotationColor}
                    onChange={(event) => setAnnotationColor(event.target.value)}
                    className={styles.colorPicker}
                    aria-label="בחירת צבע"
                  />
                </label>
                <label className={styles.annotationLabel}>
                  עובי
                  <input
                    type="range"
                    min={2}
                    max={10}
                    value={annotationThickness}
                    onChange={(event) => setAnnotationThickness(Number(event.target.value))}
                    className={styles.thicknessSlider}
                    aria-label="בחירת עובי"
                  />
                </label>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setShowAnnotations((prev) => !prev)}
                >
                  {showAnnotations ? 'הסתר הערות' : 'הצג הערות'}
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleUndoAnnotation}
                  disabled={annotationUndoStack.length === 0}
                >
                  בטל
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleRedoAnnotation}
                  disabled={annotationRedoStack.length === 0}
                >
                  חזור
                </button>
              </div>
              <div className={styles.annotationActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleExportAnnotations}
                  disabled={!annotations.length}
                >
                  ייצא הערות
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleClearAnnotations}
                  disabled={!annotations.length}
                >
                  נקה הערות
                </button>
                <a className={styles.secondaryButton} href={annotationMichaelUrl}>
                  שאל את מייקל על ההערות
                </a>
              </div>
            </div>
          </section>

          <div
            className={styles.viewerCard}
            aria-busy={pdfStatus === 'loading'}
          >
            {pdfUrl ? (
              <>
                {pdfAvailable && pdfStatus === 'ready' && annotationPages.length > 0 && (
                  <div className={styles.pdfPages}>
                    {annotationPages.map((pageData) => (
                      <PdfPageCanvas
                        key={`page-${pageData.pageNumber}`}
                        page={pageData.page}
                        pageNumber={pageData.pageNumber}
                        width={pageData.width}
                        height={pageData.height}
                        annotations={annotations}
                        tool={annotationTool}
                        color={annotationColor}
                        thickness={annotationThickness}
                        show={showAnnotations}
                        onAdd={handleAddAnnotation}
                        onRemove={handleRemoveAnnotation}
                      />
                    ))}
                  </div>
                )}
                {pdfStatus === 'loading' && (
                  <div className={styles.viewerOverlay} aria-live="polite">
                    <div className={styles.spinner} aria-hidden="true" />
                    <p className={styles.viewerMessage}>
                      טוען את ה-PDF...
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

          <div className={styles.annotationStatus} role="status" aria-live="polite">
            <span className={styles.annotationStatusText}>
              {annotationStatus === 'loading' && 'טוענים הערות על גבי ה-PDF...'}
              {annotationStatus === 'saving' && 'שומרים הערות...'}
              {annotationStatus === 'saved' && annotationMessage}
              {annotationStatus === 'error' && (annotationMessage || 'אירעה שגיאה בהערות.')}
              {annotationStatus === 'idle' && annotationMessage}
            </span>
          </div>

          <section
            className={styles.summaryCard}
            aria-label="סיכום PDF"
            aria-busy={pdfSummaryStatus === 'loading'}
          >
            <div className={styles.summaryHeaderRow}>
              <div>
                <p className={styles.summaryEyebrow}>סיכום מייקל</p>
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
              <div className={styles.summaryPanelActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleCopySummary}
                  disabled={!pdfSummary}
                >
                  העתק
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleSaveSummaryToNotes}
                  disabled={!pdfSummary || !noteTarget}
                >
                  שמור להערות
                </button>
                <a className={styles.secondaryButton} href={summaryMichaelUrl}>
                  שאל את מייקל על הסיכום
                </a>
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
                <p className={styles.helperText}>
                  {userId
                    ? 'בחרו מצב סיכום ולחצו על צור סיכום.'
                    : 'התחברו כדי ליצור סיכום.'}
                </p>
              )}
            </div>

            <div className={styles.summaryFooter} aria-live="polite">
              <span className={styles.summaryStatusText}>{pdfSummaryStatusLabel}</span>
              {pdfSummaryFeedback && (
                <span className={styles.summaryStatusText}>{pdfSummaryFeedback}</span>
              )}
            </div>
          </section>

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
