'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [learningMode, setLearningMode] = useState(false);
  const [revealAnswer, setRevealAnswer] = useState(false);

  useEffect(() => {
    setActiveStepId(steps[0]?.id ?? '');
    setIsPlaying(false);
  }, [steps]);

  const activeStepIndex = useMemo(
    () => Math.max(0, steps.findIndex((step) => step.id === activeStepId)),
    [steps, activeStepId]
  );

  const selectStepByIndex = useCallback(
    (index: number) => {
      const nextStep = steps[index];
      if (nextStep) {
        setActiveStepId(nextStep.id);
      }
    },
    [steps]
  );

  const handlePrevious = useCallback(() => {
    selectStepByIndex(Math.max(0, activeStepIndex - 1));
  }, [activeStepIndex, selectStepByIndex]);

  const handleNext = useCallback(() => {
    selectStepByIndex(Math.min(steps.length - 1, activeStepIndex + 1));
  }, [activeStepIndex, selectStepByIndex, steps.length]);

  const playbackIntervalMs = useMemo(() => 1600 / playbackSpeed, [playbackSpeed]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveStepId((currentStepId) => {
        const currentIndex = steps.findIndex((step) => step.id === currentStepId);
        const nextIndex = currentIndex + 1;

        if (nextIndex >= steps.length) {
          setIsPlaying(false);
          return currentStepId;
        }

        return steps[nextIndex]?.id ?? currentStepId;
      });
    }, playbackIntervalMs);

    return () => window.clearInterval(timer);
  }, [isPlaying, playbackIntervalMs, steps]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();

      if (tagName === 'textarea' || tagName === 'input' || target?.isContentEditable) {
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleNext();
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handlePrevious();
      }

      if (event.key === ' ') {
        event.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrevious]);

  const activeStep = steps.find((step) => step.id === activeStepId) ?? steps[0];

  useEffect(() => {
    setRevealAnswer(false);
  }, [activeStepId, learningMode]);

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
            {activeStep.caption && (
              <p className={styles.stepCaption} aria-live="polite">
                {activeStep.caption}
              </p>
            )}
          </div>

          <div className={styles.narrationCard} aria-live="polite">
            <h3 className={styles.narrationTitle}>Narration</h3>
            <p className={styles.narrationText}>{activeStep.narration ?? activeStep.summary}</p>
          </div>

          <div className={styles.stepControls} aria-label="Visualizer playback controls">
            <div className={styles.controlGroup}>
              <button
                type="button"
                className={styles.controlButton}
                onClick={handlePrevious}
                disabled={activeStepIndex === 0}
              >
                Previous
              </button>
              <button
                type="button"
                className={styles.controlButtonPrimary}
                onClick={() => setIsPlaying((prev) => !prev)}
                aria-pressed={isPlaying}
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button
                type="button"
                className={styles.controlButton}
                onClick={handleNext}
                disabled={activeStepIndex === steps.length - 1}
              >
                Next
              </button>
            </div>
            <div className={styles.controlScrubber}>
              <label className={styles.controlLabel} htmlFor="visualizer-scrub">
                Scrub timeline
              </label>
              <input
                id="visualizer-scrub"
                className={styles.controlRange}
                type="range"
                min={0}
                max={Math.max(0, steps.length - 1)}
                value={activeStepIndex}
                onChange={(event) => {
                  setIsPlaying(false);
                  selectStepByIndex(Number(event.target.value));
                }}
                aria-valuetext={`Step ${activeStepIndex + 1} of ${steps.length}`}
              />
            </div>
            <div className={styles.controlOptions}>
              <label className={styles.controlLabel} htmlFor="visualizer-speed">
                Speed
              </label>
              <select
                id="visualizer-speed"
                className={styles.controlSelect}
                value={playbackSpeed}
                onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
              >
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                  <option key={speed} value={speed}>
                    {speed}x
                  </option>
                ))}
              </select>
              <label className={styles.controlToggle}>
                <input
                  type="checkbox"
                  checked={learningMode}
                  onChange={(event) => setLearningMode(event.target.checked)}
                />
                <span>Learning mode</span>
              </label>
            </div>
            <div className={styles.controlMeta}>
              <span className={styles.controlStepCount}>
                Step {activeStepIndex + 1} of {steps.length}
              </span>
              <span className={styles.controlHint}>Use ← → to step, space to play.</span>
            </div>
          </div>

          {activeStep.glossary && activeStep.glossary.length > 0 && (
            <aside className={styles.glossaryCard} aria-label="Glossary hints">
              <h3 className={styles.glossaryTitle}>Glossary hints</h3>
              <ul className={styles.glossaryList}>
                {activeStep.glossary.map((hint) => (
                  <li key={hint.term} className={styles.glossaryItem}>
                    <strong>{hint.term}</strong>
                    <span>{hint.definition}</span>
                  </li>
                ))}
              </ul>
            </aside>
          )}

          {learningMode && activeStep.quiz && (
            <section className={styles.learningCard} aria-label="Learning mode prompt">
              <h3 className={styles.learningTitle}>Check your understanding</h3>
              <p className={styles.learningQuestion}>{activeStep.quiz.question}</p>
              {activeStep.quiz.hint && <p className={styles.learningHint}>Hint: {activeStep.quiz.hint}</p>}
              <button
                type="button"
                className={styles.learningButton}
                onClick={() => setRevealAnswer((prev) => !prev)}
                aria-pressed={revealAnswer}
              >
                {revealAnswer ? 'Hide answer' : 'Reveal answer'}
              </button>
              {revealAnswer && <p className={styles.learningAnswer}>{activeStep.quiz.answer}</p>}
            </section>
          )}

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
