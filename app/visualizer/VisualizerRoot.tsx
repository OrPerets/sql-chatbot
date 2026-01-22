'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './visualizer.module.css';
import StepTimeline from './StepTimeline';
import TableView from './TableView';
import JoinAnimator from './JoinAnimator';
import PlaceholderCard from './PlaceholderCard';
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
        errorMessage: error instanceof Error ? error.message : 'לא ניתן לנתח את השאילתה.'
      };
    }
  }, [sqlQuery]);

  const [activeStepId, setActiveStepId] = useState(steps[0]?.id ?? '');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [learningMode, setLearningMode] = useState(false);
  const [revealAnswer, setRevealAnswer] = useState(false);

  const stepIndexMap = useMemo(
    () => new Map(steps.map((step, index) => [step.id, index])),
    [steps]
  );
  const stepMap = useMemo(() => new Map(steps.map((step) => [step.id, step])), [steps]);

  useEffect(() => {
    setActiveStepId(steps[0]?.id ?? '');
    setIsPlaying(false);
  }, [steps]);

  const activeStepIndex = Math.max(0, stepIndexMap.get(activeStepId) ?? 0);

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
        const currentIndex = stepIndexMap.get(currentStepId) ?? 0;
        const nextIndex = currentIndex + 1;

        if (nextIndex >= steps.length) {
          setIsPlaying(false);
          return currentStepId;
        }

        return steps[nextIndex]?.id ?? currentStepId;
      });
    }, playbackIntervalMs);

    return () => window.clearInterval(timer);
  }, [isPlaying, playbackIntervalMs, steps, stepIndexMap]);

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

  const activeStep = stepMap.get(activeStepId) ?? steps[0];

  useEffect(() => {
    setRevealAnswer(false);
  }, [activeStepId, learningMode]);

  return (
    <section className={styles.visualizer} aria-label="מדמה שאילתות SQL">
      <div className={styles.compactHeader}>
        <h1 className={styles.compactTitle}>מדמה SQL</h1>
        <div className={styles.featureBadge} aria-label="תכונה בפיתוח">
          תצוגה מקדימה
        </div>
      </div>

      <div className={styles.visualizerLayout}>
        <div className={styles.sidebar}>
          <div className={styles.queryPanel}>
            <label className={styles.queryLabel} htmlFor="visualizer-query">
              שאילתת SQL
            </label>
            <textarea
              id="visualizer-query"
              className={styles.queryInput}
              value={sqlQuery}
              onChange={(event) => setSqlQuery(event.target.value)}
              rows={3}
              spellCheck={false}
            />
            {errorMessage && (
              <p className={styles.queryError} role="alert" aria-live="polite">
                {errorMessage}
              </p>
            )}
          </div>

          <div className={styles.compactControls}>
            <div className={styles.playbackRow}>
              <button
                type="button"
                className={styles.miniButton}
                onClick={handlePrevious}
                disabled={activeStepIndex === 0}
                title="קודם"
              >
                ←
              </button>
              <button
                type="button"
                className={styles.playButton}
                onClick={() => setIsPlaying((prev) => !prev)}
                aria-pressed={isPlaying}
                title={isPlaying ? 'השהה' : 'הפעל'}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
              <button
                type="button"
                className={styles.miniButton}
                onClick={handleNext}
                disabled={activeStepIndex === steps.length - 1}
                title="הבא"
              >
                →
              </button>
              <select
                id="visualizer-speed"
                className={styles.miniSelect}
                value={playbackSpeed}
                onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
                title="מהירות"
              >
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                  <option key={speed} value={speed}>
                    {speed}x
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.scrubberRow}>
              <input
                id="visualizer-scrub"
                className={styles.compactRange}
                type="range"
                min={0}
                max={Math.max(0, steps.length - 1)}
                value={activeStepIndex}
                onChange={(event) => {
                  setIsPlaying(false);
                  selectStepByIndex(Number(event.target.value));
                }}
                aria-valuetext={`שלב ${activeStepIndex + 1} מתוך ${steps.length}`}
                title="ניווט בציר הזמן"
              />
              <span className={styles.stepIndicator}>
                {activeStepIndex + 1}/{steps.length}
              </span>
            </div>
            <label className={styles.learningToggle}>
              <input
                type="checkbox"
                checked={learningMode}
                onChange={(event) => setLearningMode(event.target.checked)}
              />
              <span>מצב לימוד</span>
            </label>
          </div>

          <StepTimeline
            steps={steps}
            activeStepId={activeStepId}
            onSelect={setActiveStepId}
          />

          {activeStep.glossary && activeStep.glossary.length > 0 && (
            <aside className={styles.sidebarGlossary} aria-label="מילון מושגים">
              <h3 className={styles.sidebarGlossaryTitle}>מילון מושגים</h3>
              <ul className={styles.sidebarGlossaryList}>
                {activeStep.glossary.map((hint) => (
                  <li key={hint.term} className={styles.sidebarGlossaryItem}>
                    <strong>{hint.term}</strong>
                    <span>{hint.definition}</span>
                  </li>
                ))}
              </ul>
            </aside>
          )}

          {learningMode && activeStep.quiz && (
            <section className={styles.sidebarQuiz} aria-label="בדיקת הבנה">
              <h3 className={styles.sidebarQuizTitle}>בדוק את ההבנה שלך</h3>
              <p className={styles.sidebarQuizQuestion}>{activeStep.quiz.question}</p>
              {activeStep.quiz.hint && <p className={styles.sidebarQuizHint}>רמז: {activeStep.quiz.hint}</p>}
              <button
                type="button"
                className={styles.sidebarQuizButton}
                onClick={() => setRevealAnswer((prev) => !prev)}
                aria-pressed={revealAnswer}
              >
                {revealAnswer ? 'הסתר תשובה' : 'הצג תשובה'}
              </button>
              {revealAnswer && <p className={styles.sidebarQuizAnswer}>{activeStep.quiz.answer}</p>}
            </section>
          )}
        </div>

        <div className={styles.mainVisualizerArea}>
          <div className={styles.stepBanner}>
            <div className={styles.stepBannerContent}>
              <h2 className={styles.stepBannerTitle}>{activeStep.title}</h2>
              <p className={styles.stepBannerSummary}>{activeStep.narration ?? activeStep.summary}</p>
            </div>
          </div>

          <div className={styles.nodeGrid}>
            {activeStep.nodes.map((node) => {
              if (node.kind === 'join') {
                return <JoinAnimator key={node.id} node={node} />;
              }

              if (node.kind === 'placeholder') {
                return <PlaceholderCard key={node.id} node={node} />;
              }

              return <TableView key={node.id} node={node} />;
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default VisualizerRoot;
