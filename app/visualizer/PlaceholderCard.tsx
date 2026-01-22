'use client';

import React from 'react';
import styles from './visualizer.module.css';
import { VisualizationNode } from './types';

type PlaceholderCardProps = {
  node: VisualizationNode;
};

const PlaceholderCard = ({ node }: PlaceholderCardProps) => {
  return (
    <div className={styles.placeholderCard} role="region" aria-label={node.label}>
      <div className={styles.placeholderHeader}>
        <span className={styles.tableTitle}>{node.label}</span>
        <span className={styles.placeholderBadge}>Placeholder</span>
      </div>
      {node.detail && <p className={styles.placeholderDetail}>{node.detail}</p>}
      {node.notes && node.notes.length > 0 ? (
        <ul className={styles.placeholderList}>
          {node.notes.map((note, index) => (
            <li key={`${node.id}-note-${index}`} className={styles.placeholderItem}>
              {note}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.tableHint}>No keyword gaps detected for this query.</p>
      )}
    </div>
  );
};

export default React.memo(PlaceholderCard);
