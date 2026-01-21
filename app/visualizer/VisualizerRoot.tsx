'use client';

import React, { useEffect, useMemo, useState } from 'react';
import styles from './visualizer.module.css';
import StepTimeline from './StepTimeline';
import TableView from './TableView';
import JoinAnimator from './JoinAnimator';
import { mockSteps } from './mock-steps';
import { generateStepsFromSql } from './step-generator';

const defaultQuery = `SELECT Students.name, Enrollments.course
FROM Students
INNER JOIN Enrollments ON Students.id = Enrollments.student_id
WHERE Enrollments.status = 'active'
ORDER BY Students.name
LIMIT 3;`;

const VisualizerRoot = () => {
  const [sqlQuery, setSqlQuery] = useState(defaultQuery);
  const { steps, errorMessage } = useMemo(() => {
    try {
      return {
        steps: generateStepsFromSql(sqlQuery),
        errorMessage: ''
      };
    } catch (error) {
      return {
        steps: mockSteps,
        errorMessage: error instanceof Error ? error.message : 'Unable to parse query.'
      };
    }
  }, [sqlQuery]);

  const [activeStepId, setActiveStepId] = useState(steps[0]?.id ?? '');

  useEffect(() => {
    setActiveStepId(steps[0]?.id ?? '');
  }, [steps]);

  const activeStep = steps.find((step) => step.id === activeStepId) ?? steps[0];

  return (
    <section className={styles.visualizer} aria-label="SQL Query Visualizer">
      <header className={styles.visualizerHeader}>
        <div>
          <h1 className={styles.visualizerTitle}>Query Visualizer</h1>
          <p className={styles.visualizerSubtitle}>
            Walk through a query step-by-step with mock data and animations.
          </p>
        </div>
        <div className={styles.featureBadge} aria-label="Feature flag: preview">
          Preview
        </div>
      </header>

      <div className={styles.queryPanel}>
        <label className={styles.queryLabel} htmlFor="visualizer-query">
          SQL input
        </label>
        <textarea
          id="visualizer-query"
          className={styles.queryInput}
          value={sqlQuery}
          onChange={(event) => setSqlQuery(event.target.value)}
          rows={6}
          spellCheck={false}
        />
        {errorMessage && <p className={styles.queryError}>{errorMessage}</p>}
      </div>

      <div className={styles.visualizerLayout}>
        <StepTimeline
          steps={steps}
          activeStepId={activeStepId}
          onSelect={setActiveStepId}
        />

        <div className={styles.stepPanel}>
          <div className={styles.stepHeader}>
            <h2 className={styles.stepTitle}>{activeStep.title}</h2>
            <p className={styles.stepSummary}>{activeStep.summary}</p>
          </div>

          <div className={styles.nodeGrid}>
            {activeStep.nodes.map((node) => {
              if (node.kind === 'join') {
                return <JoinAnimator key={node.id} node={node} />;
              }

              return <TableView key={node.id} node={node} />;
            })}
          </div>

          <div className={styles.animationList}>
            <h3 className={styles.animationTitle}>Animation cues</h3>
            <ul>
              {activeStep.animations.map((animation) => (
                <li key={animation.id}>
                  <strong>{animation.label}</strong> · {animation.style} · {animation.durationMs}ms
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VisualizerRoot;
