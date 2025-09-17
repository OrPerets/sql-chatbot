"use client";

import React, { useState, useEffect } from 'react';
import styles from './PracticeModal.module.css';
import Editor from '@monaco-editor/react';
import config from '../config';

const SERVER_BASE = config.serverUrl;

interface PracticeTable {
  id: string;
  table: string;
  columns: Array<{
    name: string;
    type: string;
  }>;
  constraints: string[];
  fullSql: string;
}

interface PracticeQuery {
  _id: string;
  practiceId: string;
  table: string;
  question: string;
  answerSql: string;
  difficulty: string;
}

interface PracticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

const PracticeModal: React.FC<PracticeModalProps> = ({ isOpen, onClose, userId }) => {
  const [practiceTables, setPracticeTables] = useState<Record<string, PracticeTable[]>>({});
  const [selectedPracticeId, setSelectedPracticeId] = useState<string | null>(null);
  const [currentQueries, setCurrentQueries] = useState<PracticeQuery[]>([]);
  const [currentQueryIndex, setCurrentQueryIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [detailedFeedback, setDetailedFeedback] = useState('');
  const [feedbackLevel, setFeedbackLevel] = useState<'correct' | 'partially_correct' | 'wrong' | null>(null);
  const [similarity, setSimilarity] = useState<number | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'select' | 'practice'>('select');

  // Load practice tables on mount
  useEffect(() => {
    if (isOpen) {
      loadPracticeTables();
    }
  }, [isOpen]);

  const loadPracticeTables = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${SERVER_BASE}/practice/tables`);
      if (response.ok) {
        const tables = await response.json();
        setPracticeTables(tables);
      } else {
        console.error('Failed to load practice tables');
      }
    } catch (error) {
      console.error('Error loading practice tables:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePracticeSelection = async (practiceId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${SERVER_BASE}/practice/queries/${practiceId}`);
      if (response.ok) {
        const queries = await response.json();
        setCurrentQueries(queries);
        setSelectedPracticeId(practiceId);
        setCurrentQueryIndex(0);
        setUserAnswer('');
        setFeedback('');
        setDetailedFeedback('');
        setFeedbackLevel(null);
        setSimilarity(null);
        setShowSolution(false);
        setStep('practice');
      } else {
        console.error('Failed to load practice queries');
      }
    } catch (error) {
      console.error('Error loading practice queries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim() || !currentQueries[currentQueryIndex]) return;

    try {
      setLoading(true);
      const timestamp = Date.now();
      console.log('Making request to:', `${SERVER_BASE}/practice/submit?t=${timestamp}`);
      
      const response = await fetch(`${SERVER_BASE}/practice/submit?t=${timestamp}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          queryId: currentQueries[currentQueryIndex]._id,
          answer: userAnswer,
          question: currentQueries[currentQueryIndex].question
        })
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      if (response.ok) {
        const result = await response.json();
        setFeedback(result.feedback);
        setDetailedFeedback(result.detailedFeedback || '');
        setFeedbackLevel(result.feedbackLevel);
        setSimilarity(result.similarity);
        if (result.correctAnswer) {
          setShowSolution(true);
        }
      } else {
        console.error('Failed to submit answer');
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNextQuestion = () => {
    if (currentQueryIndex < currentQueries.length - 1) {
      setCurrentQueryIndex(currentQueryIndex + 1);
      setUserAnswer('');
      setFeedback('');
      setDetailedFeedback('');
      setFeedbackLevel(null);
      setSimilarity(null);
      setShowSolution(false);
    } else {
      // Practice completed
      onClose();
    }
  };

  const handleBackToSelection = () => {
    setStep('select');
    setSelectedPracticeId(null);
    setCurrentQueries([]);
    setCurrentQueryIndex(0);
    setUserAnswer('');
    setFeedback('');
    setDetailedFeedback('');
    setFeedbackLevel(null);
    setSimilarity(null);
    setShowSolution(false);
  };

  // Get current practice tables for schema display
  const getCurrentPracticeTables = () => {
    if (!selectedPracticeId || !practiceTables[selectedPracticeId]) {
      return [];
    }
    return practiceTables[selectedPracticeId];
  };

  // Get feedback icon based on level
  const getFeedbackIcon = () => {
    switch (feedbackLevel) {
      case 'correct':
        return '✅';
      case 'partially_correct':
        return '⚠️';
      case 'wrong':
        return '❌';
      default:
        return '';
    }
  };

  // Get feedback class based on level
  const getFeedbackClass = () => {
    switch (feedbackLevel) {
      case 'correct':
        return styles.correct;
      case 'partially_correct':
        return styles.partiallyCorrect;
      case 'wrong':
        return styles.incorrect;
      default:
        return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {step === 'select' ? 'בחר טבלאות לתרגול' : 'תרגול SQL'}
          </h2>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          {loading && (
            <div className={styles.loadingContainer}>
              <div className={styles.loadingSpinner}></div>
              <p>טוען...</p>
            </div>
          )}

          {step === 'select' && !loading && (
            <div className={styles.selectionStep}>
              <p className={styles.selectionDescription}>
                בחר את הטבלאות שברצונך לתרגל איתן. תקבל 2-3 שאלות לתרגול.
              </p>
              
              <div className={styles.tablesGrid}>
                {Object.entries(practiceTables).map(([practiceId, tables]) => (
                  <div key={practiceId} className={styles.tableGroup}>
                    <h3 className={styles.groupTitle}>קבוצת טבלאות {practiceId}</h3>
                    <div className={styles.tablesList}>
                      {tables.map((table) => (
                        <div key={table.id} className={styles.tableItem}>
                          <span className={styles.tableName}>{table.table}</span>
                          <span className={styles.tableColumns}>
                            {table.columns.length} עמודות
                          </span>
                        </div>
                      ))}
                    </div>
                    <button
                      className={styles.selectButton}
                      onClick={() => handlePracticeSelection(practiceId)}
                    >
                      בחר לתרגול
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'practice' && !loading && currentQueries[currentQueryIndex] && (
            <div className={styles.practiceStep}>
              <div className={styles.progressIndicator}>
                שאלה {currentQueryIndex + 1} מתוך {currentQueries.length}
              </div>

              <div className={styles.practiceLayout}>
                {/* Schema Sidebar */}
                <div className={styles.schemaSidebar}>
                  <h3 className={styles.schemaTitle}>מבנה הטבלאות</h3>
                  <div className={styles.schemaContent}>
                    {getCurrentPracticeTables().map((table) => (
                      <div key={table.id} className={styles.tableSchema}>
                        <h4 className={styles.tableSchemaName}>{table.table}</h4>
                        <div className={styles.columnsList}>
                          {table.columns.map((column, index) => (
                            <div key={index} className={styles.columnItem}>
                              <span className={styles.columnName}>{column.name}</span>
                              <span className={styles.columnType}>{column.type}</span>
                            </div>
                          ))}
                        </div>
                        {table.constraints && table.constraints.length > 0 && (
                          <div className={styles.constraintsList}>
                            <h5 className={styles.constraintsTitle}>אילוצים:</h5>
                            {table.constraints.map((constraint, index) => (
                              <div key={index} className={styles.constraintItem}>
                                {constraint}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Main Practice Content */}
                <div className={styles.practiceContent}>
                  <div className={styles.questionSection}>
                    <h3 className={styles.questionTitle}>שאלה:</h3>
                    <p className={styles.questionText}>
                      {currentQueries[currentQueryIndex].question}
                    </p>
                  </div>

                  <div className={styles.answerSection}>
                    <label className={styles.answerLabel}>התשובה שלך ב-SQL:</label>
                    <div className={styles.sqlEditorContainer}>
                      <Editor
                        height="200px"
                        defaultLanguage="sql"
                        value={userAnswer}
                        onChange={(value) => setUserAnswer(value || '')}
                        options={{
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          fontSize: 14,
                          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                          theme: 'vs-dark',
                          wordWrap: 'on',
                          lineNumbers: 'on',
                          folding: false,
                          lineDecorationsWidth: 0,
                          lineNumbersMinChars: 3,
                          renderLineHighlight: 'all',
                          selectOnLineNumbers: true,
                          roundedSelection: false,
                          scrollbar: {
                            vertical: 'visible',
                            horizontal: 'visible',
                            verticalScrollbarSize: 8,
                            horizontalScrollbarSize: 8,
                          },
                          contextmenu: false,
                          quickSuggestions: false,
                          suggestOnTriggerCharacters: false,
                          acceptSuggestionOnCommitCharacter: false,
                          acceptSuggestionOnEnter: 'off',
                          tabCompletion: 'off',
                          wordBasedSuggestions: false,
                          parameterHints: {
                            enabled: false,
                          },
                          hover: {
                            enabled: false,
                          },
                          links: false,
                          colorDecorators: false,
                          lightbulb: {
                            enabled: false,
                          },
                          codeActionsOnSave: {},
                          codeActions: {
                            enabled: false,
                          },
                          find: {
                            addExtraSpaceOnTop: false,
                            autoFindInSelection: 'never',
                            seedSearchStringFromSelection: 'never',
                          },
                          selectionHighlight: false,
                          occurrencesHighlight: false,
                        }}
                      />
                    </div>
                  </div>

                  {feedback && (
                    <div className={`${styles.feedback} ${getFeedbackClass()}`}>
                      <div className={styles.feedbackHeader}>
                        <span className={styles.feedbackIcon}>{getFeedbackIcon()}</span>
                        <span className={styles.feedbackText}>{feedback}</span>
                      </div>
                      
                      {/* {similarity !== null && feedbackLevel !== 'correct' && (
                        <div className={styles.similarityScore}>
                          דמיון לתשובה הנכונה: {similarity}%
                        </div>
                      )} */}
                      
                      {detailedFeedback && (
                        <div className={styles.detailedFeedback}>
                          <h4>פירוט:</h4>
                          <p>{detailedFeedback}</p>
                        </div>
                      )}
                      
                      {showSolution && (
                        <div className={styles.solution}>
                          <h4>פתרון נכון:</h4>
                          <pre className={styles.solutionCode}>
                            {(() => {
                              const sql = currentQueries[currentQueryIndex].answerSql;
                              // Format SQL with proper line breaks and indentation
                              return sql
                                .replace(/SELECT/gi, '\nSELECT')
                                .replace(/FROM/gi, '\nFROM')
                                .replace(/WHERE/gi, '\nWHERE')
                                .replace(/ORDER BY/gi, '\nORDER BY')
                                .replace(/GROUP BY/gi, '\nGROUP BY')
                                .replace(/HAVING/gi, '\nHAVING')
                                .replace(/JOIN/gi, '\nJOIN')
                                .replace(/LEFT JOIN/gi, '\nLEFT JOIN')
                                .replace(/RIGHT JOIN/gi, '\nRIGHT JOIN')
                                .replace(/INNER JOIN/gi, '\nINNER JOIN')
                                .replace(/OUTER JOIN/gi, '\nOUTER JOIN')
                                .replace(/UNION/gi, '\nUNION')
                                .replace(/INSERT/gi, '\nINSERT')
                                .replace(/UPDATE/gi, '\nUPDATE')
                                .replace(/DELETE/gi, '\nDELETE')
                                .replace(/;/g, '')
                                .trim()
                                .split('\n')
                                .map((line, index) => {
                                  if (index === 0) return line;
                                  return '  ' + line.trim();
                                })
                                .join('\n');
                            })()}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  <div className={styles.actionButtons}>
                    <button
                      className={styles.submitButton}
                      onClick={handleSubmitAnswer}
                      disabled={!userAnswer.trim() || loading}
                    >
                      {loading ? 'שולח...' : 'שלח תשובה'}
                    </button>
                    
                    {feedback && (
                      <button
                        className={styles.nextButton}
                        onClick={handleNextQuestion}
                      >
                        {currentQueryIndex < currentQueries.length - 1 ? 'שאלה הבאה' : 'סיים תרגול'}
                      </button>
                    )}
                    
                    <button
                      className={styles.backButton}
                      onClick={handleBackToSelection}
                    >
                      חזור לבחירה
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PracticeModal;
