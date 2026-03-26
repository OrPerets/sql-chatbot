'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './visualizer.module.css';
import StepTimeline from './StepTimeline';
import TableView from './TableView';
import JoinAnimator from './JoinAnimator';
import PlaceholderCard from './PlaceholderCard';
import { mockSteps } from './mock-steps';
import { generateStepsFromSql } from './step-generator';
import { demoDatabase } from './mock-schema';
import type { VisualizationNode } from './types';

const defaultQuery = `SELECT customers.full_name, products.name, orders.quantity, orders.order_date
FROM customers
INNER JOIN orders ON customers.id = orders.customer_id
INNER JOIN products ON orders.product_id = products.id
WHERE orders.status = 'delivered'
ORDER BY orders.order_date DESC
LIMIT 4;`;

const VALIDATION_DEBOUNCE_MS = 350;

type QueryValidation = {
  isValid: boolean;
  message: string;
};

const validateQuery = (query: string): QueryValidation => {
  const trimmed = query.trim();

  if (!trimmed) {
    return {
      isValid: false,
      message: 'יש להזין שאילתה לפני ההרצה.'
    };
  }

  try {
    generateStepsFromSql(trimmed);
    return {
      isValid: true,
      message: ''
    };
  } catch (error) {
    return {
      isValid: false,
      message: error instanceof Error ? error.message : 'השאילתה אינה נתמכת כרגע.'
    };
  }
};

const getStepTypeLabel = (step: { nodes: Array<{ kind: string }> }) => {
  const kinds = step.nodes.map(n => n.kind);
  if (kinds.includes('join')) return 'חיבור';
  if (kinds.includes('filter')) return 'סינון';
  if (kinds.includes('sort')) return 'מיון';
  if (kinds.includes('limit')) return 'הגבלה';
  if (kinds.includes('projection')) return 'הקרנה';
  if (kinds.includes('aggregation')) return 'קיבוץ';
  if (kinds.includes('table')) return 'טבלה';
  return 'פעולה';
};

const formatSqlQuery = (query: string): string => {
  // Split by lines and process
  const lines = query.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const formatted: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upperLine = line.toUpperCase();
    
    // Check if this is a FROM line
    if (upperLine.startsWith('FROM ')) {
      let combinedLine = line;
      
      // Look ahead for JOIN clauses and combine them
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j];
        const upperNext = nextLine.toUpperCase();
        
        // Check if next line is a JOIN clause
        if (
          upperNext.startsWith('INNER JOIN ') ||
          upperNext.startsWith('LEFT JOIN ') ||
          upperNext.startsWith('RIGHT JOIN ') ||
          upperNext.startsWith('FULL JOIN ') ||
          upperNext.startsWith('CROSS JOIN ') ||
          upperNext.startsWith('JOIN ')
        ) {
          combinedLine += ' ' + nextLine;
          j++;
        } else {
          break;
        }
      }
      
      formatted.push(combinedLine);
      i = j - 1; // Skip the JOIN lines we've already processed
    } else {
      formatted.push(line);
    }
  }
  
  return formatted.join('\n');
};

const VisualizerRoot = () => {
  const [sqlQuery, setSqlQuery] = useState(defaultQuery);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);
  const [editedQuery, setEditedQuery] = useState('');
  const [validationTargetQuery, setValidationTargetQuery] = useState(sqlQuery);
  const [isValidationPending, setIsValidationPending] = useState(false);
  const [liveValidation, setLiveValidation] = useState<QueryValidation>(() => validateQuery(sqlQuery));
  const [appliedValidation, setAppliedValidation] = useState<QueryValidation>(() => validateQuery(sqlQuery));

  const steps = useMemo(
    () => (appliedValidation.isValid ? generateStepsFromSql(sqlQuery) : mockSteps),
    [appliedValidation.isValid, sqlQuery]
  );
  const errorMessage = appliedValidation.isValid ? '' : appliedValidation.message;

  const [activeStepId, setActiveStepId] = useState(steps[0]?.id ?? '');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [learningMode, setLearningMode] = useState(false);
  const [revealAnswer, setRevealAnswer] = useState(false);

  const openEditModal = useCallback(() => {
    setEditedQuery(sqlQuery);
    setValidationTargetQuery(sqlQuery);
    setLiveValidation(validateQuery(sqlQuery));
    setIsValidationPending(false);
    setIsEditModalOpen(true);
  }, [sqlQuery]);

  const closeEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setEditedQuery('');
  }, []);

  const handleSaveQuery = useCallback(() => {
    const validation = validateQuery(editedQuery);
    setLiveValidation(validation);
    setIsValidationPending(false);

    if (!validation.isValid) {
      return;
    }

    const trimmed = editedQuery.trim();
    setSqlQuery(trimmed);
    setAppliedValidation(validation);
    closeEditModal();
  }, [editedQuery, closeEditModal]);

  useEffect(() => {
    if (!isEditModalOpen) {
      return;
    }

    setIsValidationPending(true);
    const timer = window.setTimeout(() => {
      const validation = validateQuery(validationTargetQuery);
      setLiveValidation(validation);
      setIsValidationPending(false);
    }, VALIDATION_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [validationTargetQuery, isEditModalOpen]);

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
      // Handle Escape key to close modal
      if (event.key === 'Escape' && isEditModalOpen) {
        event.preventDefault();
        closeEditModal();
        return;
      }

      // Handle Ctrl/Cmd + Enter to save in modal
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && isEditModalOpen) {
        event.preventDefault();
        if (liveValidation.isValid && !isValidationPending) {
          handleSaveQuery();
        }
        return;
      }

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
  }, [handleNext, handlePrevious, isEditModalOpen, closeEditModal, handleSaveQuery, liveValidation.isValid, isValidationPending]);

  const activeStep = stepMap.get(activeStepId) ?? steps[0];

  // Collect all steps up to and including the current step
  const cumulativeSteps = useMemo(() => {
    return steps.slice(0, activeStepIndex + 1).map((step, index) => ({
      ...step,
      stepIndex: index,
      isCurrentStep: index === activeStepIndex
    }));
  }, [steps, activeStepIndex]);

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
          {errorMessage && (
            <div className={styles.queryErrorPanel}>
              <p className={styles.queryError} role="alert" aria-live="polite">
                {errorMessage}
              </p>
            </div>
          )}

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
              {/* Left side - Step Explanation */}
              <div className={styles.stepBannerExplanation}>
                <div className={styles.stepProgress}>
                  <span className={styles.stepNumber}>{activeStepIndex + 1}</span>
                  <span className={styles.stepType}>{getStepTypeLabel(activeStep)}</span>
                </div>
                <h2 className={styles.stepBannerTitle}>{activeStep.title}</h2>
                <p className={styles.stepBannerSummary}>{activeStep.narration ?? activeStep.summary}</p>
              </div>

              {/* Right side - SQL Query */}
              <div className={styles.stepBannerQuery}>
                <div className={styles.stepBannerQueryHeader}>
                  <span className={styles.stepBannerQueryLabel}>שאילתת SQL</span>
                  <div className={styles.queryActions}>
                    <button
                      type="button"
                      className={styles.databaseInfoButton}
                      onClick={() => setIsDatabaseModalOpen(true)}
                    >
                      הצג בסיס נתונים
                    </button>
                    <button
                      type="button"
                      className={styles.queryEditButton}
                      onClick={openEditModal}
                      title="ערוך שאילתה"
                    >
                      ✏️
                    </button>
                  </div>
                </div>
                <pre className={styles.stepBannerQueryCode}>
                  <code>{formatSqlQuery(sqlQuery)}</code>
                </pre>
              </div>
            </div>
          </div>

          <div className={styles.flowContainer}>
            {cumulativeSteps.map((step, stepIdx) => {
              const isCurrentStep = step.isCurrentStep;
              const isPreviousStep = !isCurrentStep;
              
              return (
                <div key={`step-${step.id}`} className={styles.flowSection}>
                  {/* Show step separator between steps */}
                  {stepIdx > 0 && (
                    <div className={styles.flowSeparator}>
                      <div className={styles.flowArrow}>⬇</div>
                      <div className={styles.flowStepLabel}>
                        {step.title}
                      </div>
                    </div>
                  )}
                  
                  <div 
                    className={`${styles.nodeGrid} ${
                      isPreviousStep ? styles.nodeGridPrevious : ''
                    } ${
                      isCurrentStep ? styles.nodeGridCurrent : ''
                    }`}
                  >
                    {step.nodes.map((node) => {
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
              );
            })}
          </div>
        </div>
      </div>

      {/* SQL Editor Modal */}
      {isEditModalOpen && (
        <div className={styles.sqlEditorOverlay} onClick={closeEditModal}>
          <div 
            className={styles.sqlEditorModal} 
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sql-editor-title"
          >
            <div className={styles.sqlEditorHeader}>
              <h2 id="sql-editor-title" className={styles.sqlEditorTitle}>
                <span className={styles.sqlEditorIcon}>✏️</span>
                עריכת שאילתת SQL
              </h2>
              <button
                type="button"
                className={styles.sqlEditorCloseButton}
                onClick={closeEditModal}
                aria-label="סגור"
              >
                ✕
              </button>
            </div>
            
            <div className={styles.sqlEditorBody}>
              <label htmlFor="sql-editor-textarea" className={styles.sqlEditorLabel}>
                הכנס את שאילתת ה-SQL שלך:
              </label>
              <textarea
                id="sql-editor-textarea"
                className={styles.sqlEditorTextarea}
                value={editedQuery}
                onChange={(e) => {
                  const nextQuery = e.target.value;
                  setEditedQuery(nextQuery);
                  setValidationTargetQuery(nextQuery);
                }}
                placeholder="SELECT * FROM table_name..."
                autoFocus
                spellCheck={false}
                dir="ltr"
              />
              {isValidationPending ? (
                <p className={styles.sqlValidationState}>בודק תקינות שאילתה...</p>
              ) : null}
              {!isValidationPending && !liveValidation.isValid ? (
                <p className={styles.sqlValidationError} role="alert" aria-live="polite">
                  {liveValidation.message}
                </p>
              ) : null}
              <div className={styles.sqlEditorHint}>
                <span className={styles.sqlEditorHintIcon}>💡</span>
                טיפ: ניתן לכתוב שאילתות מרובות שורות עם JOIN, WHERE, ORDER BY ועוד
              </div>
            </div>

            <div className={styles.sqlEditorFooter}>
              <button
                type="button"
                className={styles.sqlEditorCancelButton}
                onClick={closeEditModal}
              >
                ביטול
              </button>
              <button
                type="button"
                className={styles.sqlEditorSaveButton}
                onClick={handleSaveQuery}
                disabled={!liveValidation.isValid || isValidationPending}
              >
                שמור והפעל
              </button>
              <span className={styles.sqlEditorShortcut}>
                Ctrl+Enter לשמירה מהירה
              </span>
            </div>
          </div>
        </div>
      )}

      {isDatabaseModalOpen && (
        <div className={styles.sqlEditorOverlay} onClick={() => setIsDatabaseModalOpen(false)}>
          <div
            className={styles.databaseModal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="database-schema-title"
          >
            <div className={styles.databaseModalHeader}>
              <h2 id="database-schema-title" className={styles.databaseModalTitle}>
                בסיס נתונים לדמו
              </h2>
              <button
                type="button"
                className={styles.sqlEditorCloseButton}
                onClick={() => setIsDatabaseModalOpen(false)}
                aria-label="סגור"
              >
                ✕
              </button>
            </div>
            <div className={styles.databaseModalBody}>
              <p className={styles.databaseName}>שם בסיס הנתונים: {demoDatabase.name}</p>
              <div className={styles.databaseTableList}>
                {demoDatabase.tables.map((table) => (
                  <article key={table.name} className={styles.databaseTableCard}>
                    <h3 className={styles.databaseTableTitle}>{table.name}</h3>
                    <p className={styles.databaseTableSubtitle}>עמודות: {table.columns.join(', ')}</p>
                    <div className={styles.databaseSampleWrapper}>
                      <table className={styles.databaseSampleTable}>
                        <thead>
                          <tr>
                            {table.columns.map((column) => (
                              <th key={`${table.name}-${column}`}>{column}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {table.rows.slice(0, 4).map((row, rowIndex) => (
                            <tr key={`${table.name}-row-${rowIndex}`}>
                              {table.columns.map((column) => (
                                <td key={`${table.name}-row-${rowIndex}-${column}`}>{row[column]}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default VisualizerRoot;
