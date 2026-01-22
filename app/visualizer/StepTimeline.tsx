'use client';

import React from 'react';
import styles from './visualizer.module.css';
import { QueryStep } from './types';

type StepTimelineProps = {
  steps: QueryStep[];
  activeStepId: string;
  onSelect: (stepId: string) => void;
};

const StepTimeline = ({ steps, activeStepId, onSelect }: StepTimelineProps) => {
  return (
    <nav className={styles.timeline} aria-label="Query execution steps">
      <div className={styles.timelineHeader}>
        <h2 className={styles.timelineHeading}>Execution steps</h2>
        <p className={styles.timelineSubheading}>Click a step to preview its animation.</p>
      </div>
      <ol className={styles.timelineList}>
        {steps.map((step) => {
          const isActive = step.id === activeStepId;
          return (
            <li key={step.id} className={styles.timelineItem}>
              <button
                type="button"
                className={isActive ? styles.timelineButtonActive : styles.timelineButton}
                onClick={() => onSelect(step.id)}
                aria-current={isActive ? 'step' : undefined}
              >
                <span className={styles.timelineTitle}>{step.title}</span>
                <span className={styles.timelineSummary}>{step.summary}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default React.memo(StepTimeline);
