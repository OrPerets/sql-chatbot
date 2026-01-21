'use client';

import React from 'react';
import styles from './visualizer.module.css';
import { VisualizationNode } from './types';

type JoinAnimatorProps = {
  node: VisualizationNode;
};

const JoinAnimator = ({ node }: JoinAnimatorProps) => {
  return (
    <div className={styles.joinCard} role="region" aria-label="Join animation mock">
      <div className={styles.joinHeader}>
        <span className={styles.tableTitle}>{node.label}</span>
        <span className={styles.tableKind}>JOIN</span>
      </div>
      <p className={styles.joinDetail}>{node.detail}</p>
      <div className={styles.joinPairs}>
        <div className={styles.joinPair}>
          <span>Students.id = 1</span>
          <span className={styles.joinArrow}>➜</span>
          <span>Enrollments.student_id = 1</span>
        </div>
        <div className={styles.joinPair}>
          <span>Students.id = 2</span>
          <span className={styles.joinArrow}>➜</span>
          <span>Enrollments.student_id = 2</span>
        </div>
        <div className={styles.joinPairMuted}>
          <span>Students.id = 3</span>
          <span className={styles.joinArrow}>✕</span>
          <span>No matching row</span>
        </div>
      </div>
    </div>
  );
};

export default JoinAnimator;
