'use client';

import React, { useEffect, useMemo, useState } from 'react';

import { LEARNING_PDFS } from '@/lib/learning-content';
import { getAllowedConceptsForWeek, SQL_CURRICULUM_MAP } from '@/lib/sql-curriculum';

import styles from './interactive-learning.module.css';

type ViewMode = 'list' | 'topic';

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

  useEffect(() => {
    const storedView = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (storedView === 'list' || storedView === 'topic') {
      setViewMode(storedView);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

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

  return (
    <div className={styles.interactiveLearning}>
      <header className={styles.compactHeader}>
        <h1 className={styles.compactTitle}>למידה אינטראקטיבית</h1>
        <span className={styles.featureBadge}>חדש</span>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label="ניווט קבצי לימוד">
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

          <div className={styles.viewerCard}>
            {pdfUrl ? (
              <iframe
                className={styles.viewerFrame}
                src={pdfUrl}
                title={selectedAsset?.label ?? 'PDF'}
              />
            ) : (
              <div className={styles.placeholder}>בחרו מסמך כדי להתחיל</div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default InteractiveLearningRoot;
