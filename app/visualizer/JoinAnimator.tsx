'use client';

import React from 'react';
import styles from './visualizer.module.css';
import { VisualizationNode } from './types';

type JoinAnimatorProps = {
  node: VisualizationNode;
};

const JoinAnimator = ({ node }: JoinAnimatorProps) => {
  const pairs = node.pairs?.length
    ? node.pairs
    : [
        {
          id: 'pair-1',
          left: 'Students.id = 1',
          right: 'Enrollments.student_id = 1',
          matched: true
        },
        {
          id: 'pair-2',
          left: 'Students.id = 2',
          right: 'Enrollments.student_id = 2',
          matched: true
        },
        {
          id: 'pair-3',
          left: 'Students.id = 3',
          right: 'No matching row',
          matched: false
        }
      ];

  return (
    <div className={styles.joinCard} role="region" aria-label="Join animation mock">
      <div className={styles.joinHeader}>
        <span className={styles.tableTitle}>{node.label}</span>
        <span className={styles.tableKind}>JOIN</span>
      </div>
      {node.detail && <p className={styles.joinDetail}>{node.detail}</p>}
      <div className={styles.joinPairs}>
        {pairs.map((pair) => (
          <div
            key={pair.id}
            className={pair.matched ? styles.joinPair : styles.joinPairMuted}
          >
            <span>{pair.left}</span>
            <span className={styles.joinArrow}>{pair.matched ? '➜' : '✕'}</span>
            <span>{pair.right}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default JoinAnimator;
