'use client';

import React, { useMemo, useState } from 'react';

import { LEARNING_PDFS } from '@/lib/learning-content';

import styles from './interactive-learning.module.css';

const InteractiveLearningRoot = () => {
  const lectures = useMemo(
    () => LEARNING_PDFS.filter((asset) => asset.type === 'lecture'),
    []
  );
  const practices = useMemo(
    () => LEARNING_PDFS.filter((asset) => asset.type === 'practice'),
    []
  );

  const [selectedId, setSelectedId] = useState<string | null>(
    lectures[0]?.id ?? practices[0]?.id ?? null
  );

  const selectedAsset = useMemo(
    () => LEARNING_PDFS.find((asset) => asset.id === selectedId) ?? null,
    [selectedId]
  );

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
        </aside>

        <main className={styles.mainArea}>
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
