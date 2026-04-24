"use client";

import React, { useEffect, useMemo, useState } from "react";
import Editor from "@monaco-editor/react";

import styles from "./PracticeModal.module.css";

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
  openCost?: number;
}

const formatSolutionSql = (sql: string) =>
  sql
    .replace(/SELECT/gi, "\nSELECT")
    .replace(/FROM/gi, "\nFROM")
    .replace(/WHERE/gi, "\nWHERE")
    .replace(/ORDER BY/gi, "\nORDER BY")
    .replace(/GROUP BY/gi, "\nGROUP BY")
    .replace(/HAVING/gi, "\nHAVING")
    .replace(/JOIN/gi, "\nJOIN")
    .replace(/LEFT JOIN/gi, "\nLEFT JOIN")
    .replace(/RIGHT JOIN/gi, "\nRIGHT JOIN")
    .replace(/INNER JOIN/gi, "\nINNER JOIN")
    .replace(/OUTER JOIN/gi, "\nOUTER JOIN")
    .replace(/UNION/gi, "\nUNION")
    .replace(/INSERT/gi, "\nINSERT")
    .replace(/UPDATE/gi, "\nUPDATE")
    .replace(/DELETE/gi, "\nDELETE")
    .replace(/;/g, "")
    .trim()
    .split("\n")
    .map((line, index) => (index === 0 ? line : `  ${line.trim()}`))
    .join("\n");

const editorOptions = {
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontSize: 14,
  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
  theme: "vs-dark",
  wordWrap: "on",
  lineNumbers: "on" as const,
  folding: false,
  lineDecorationsWidth: 0,
  lineNumbersMinChars: 3,
  renderLineHighlight: "all" as const,
  selectOnLineNumbers: true,
  roundedSelection: false,
  scrollbar: {
    vertical: "visible" as const,
    horizontal: "visible" as const,
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8,
  },
  contextmenu: false,
  quickSuggestions: false,
  suggestOnTriggerCharacters: false,
  acceptSuggestionOnCommitCharacter: false,
  acceptSuggestionOnEnter: "off" as const,
  tabCompletion: "off" as const,
  wordBasedSuggestions: "off" as const,
  parameterHints: {
    enabled: false,
  },
  hover: {
    enabled: false,
  },
  links: false,
  colorDecorators: false,
  lightbulb: {
    enabled: "off" as const,
  },
  codeActionsOnSave: {},
  codeActions: {
    enabled: false,
  },
  find: {
    addExtraSpaceOnTop: false,
    autoFindInSelection: "never" as const,
    seedSearchStringFromSelection: "never" as const,
  },
  selectionHighlight: false,
  occurrencesHighlight: "off" as const,
};

const PracticeModal: React.FC<PracticeModalProps> = ({ isOpen, onClose, userId, openCost = 1 }) => {
  const [practiceTables, setPracticeTables] = useState<Record<string, PracticeTable[]>>({});
  const [selectedPracticeId, setSelectedPracticeId] = useState<string | null>(null);
  const [currentQueries, setCurrentQueries] = useState<PracticeQuery[]>([]);
  const [currentQueryIndex, setCurrentQueryIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [detailedFeedback, setDetailedFeedback] = useState("");
  const [feedbackLevel, setFeedbackLevel] = useState<"correct" | "partially_correct" | "wrong" | null>(null);
  const [similarity, setSimilarity] = useState<number | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("טוען...");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<"select" | "practice">("select");

  const resetPracticeState = () => {
    setSelectedPracticeId(null);
    setCurrentQueries([]);
    setCurrentQueryIndex(0);
    setUserAnswer("");
    setFeedback("");
    setDetailedFeedback("");
    setFeedbackLevel(null);
    setSimilarity(null);
    setShowSolution(false);
    setLoadError(null);
    setStep("select");
  };

  useEffect(() => {
    if (!isOpen) {
      resetPracticeState();
      setPracticeTables({});
      setLoading(false);
      return;
    }

    const loadPracticeTables = async () => {
      try {
        setLoading(true);
        setLoadingMessage("טוען ערכות תרגול...");
        setLoadError(null);

        const response = await fetch("/api/practice/tables");
        if (!response.ok) {
          throw new Error("Failed to load practice tables");
        }

        const tables = await response.json();
        setPracticeTables(tables);
      } catch (error) {
        console.error("Error loading practice tables:", error);
        setLoadError("לא הצלחנו לטעון את ערכות התרגול. נסו שוב בעוד רגע.");
      } finally {
        setLoading(false);
      }
    };

    void loadPracticeTables();
  }, [isOpen]);

  const currentPracticeTables = useMemo(() => {
    if (!selectedPracticeId || !practiceTables[selectedPracticeId]) {
      return [];
    }

    return practiceTables[selectedPracticeId];
  }, [practiceTables, selectedPracticeId]);

  const currentQuery = currentQueries[currentQueryIndex] ?? null;
  const practiceGroups = Object.entries(practiceTables);

  const handlePracticeSelection = async (practiceId: string) => {
    try {
      setLoading(true);
      setLoadingMessage("טוען שאלות...");
      setLoadError(null);

      const response = await fetch(`/api/practice/queries/${practiceId}`);
      if (!response.ok) {
        throw new Error("Failed to load practice queries");
      }

      const queries = await response.json();
      setCurrentQueries(queries);
      setSelectedPracticeId(practiceId);
      setCurrentQueryIndex(0);
      setUserAnswer("");
      setFeedback("");
      setDetailedFeedback("");
      setFeedbackLevel(null);
      setSimilarity(null);
      setShowSolution(false);
      setStep("practice");
    } catch (error) {
      console.error("Error loading practice queries:", error);
      setLoadError("לא הצלחנו לטעון את שאלות התרגול. נסו לבחור ערכה אחרת.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim() || !currentQuery) {
      return;
    }

    try {
      setLoading(true);
      setLoadingMessage("בודק תשובה...");
      const timestamp = Date.now();
      const response = await fetch(`/api/practice/submit?t=${timestamp}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          queryId: currentQuery._id,
          answer: userAnswer,
          question: currentQuery.question,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit practice answer");
      }

      const result = await response.json();
      setFeedback(result.feedback);
      setDetailedFeedback(result.detailedFeedback || "");
      setFeedbackLevel(result.feedbackLevel);
      setSimilarity(result.similarity);
      setShowSolution(Boolean(result.correctAnswer));
    } catch (error) {
      console.error("Error submitting answer:", error);
      setLoadError("לא הצלחנו לבדוק את התשובה. נסו שוב.");
    } finally {
      setLoading(false);
    }
  };

  const handleNextQuestion = () => {
    if (currentQueryIndex < currentQueries.length - 1) {
      setCurrentQueryIndex((prev) => prev + 1);
      setUserAnswer("");
      setFeedback("");
      setDetailedFeedback("");
      setFeedbackLevel(null);
      setSimilarity(null);
      setShowSolution(false);
      setLoadError(null);
      return;
    }

    onClose();
  };

  const handleBackdropClose = () => {
    if (loading) {
      return;
    }

    onClose();
  };

  const feedbackClassName =
    feedbackLevel === "correct"
      ? styles.correct
      : feedbackLevel === "partially_correct"
        ? styles.partiallyCorrect
        : feedbackLevel === "wrong"
          ? styles.incorrect
          : "";

  const feedbackIcon =
    feedbackLevel === "correct" ? "✓" : feedbackLevel === "partially_correct" ? "!" : feedbackLevel === "wrong" ? "×" : "";

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.modalOverlay} onClick={handleBackdropClose}>
      <div className={styles.modalContent} onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.headerCopy}>
            <span className={styles.headerEyebrow}>תרגול מונחה</span>
            <h2 className={styles.modalTitle}>{step === "select" ? "תרגול SQL" : "סטודיו לתרגול SQL"}</h2>
            <p className={styles.modalSubtitle}>
              {step === "select"
                ? "בחרו ערכת טבלאות, פתחו שאלה, ותרגלו בלי לצאת מהשיחה."
                : "עבדו מול סכמת הנתונים, כתבו SQL, וקבלו משוב מיידי על כל תשובה."}
            </p>
          </div>
          <button className={styles.closeButton} onClick={handleBackdropClose} disabled={loading} aria-label="סגירה">
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.heroStrip}>
            <div className={styles.heroMetric}>
              <span className={styles.heroMetricLabel}>עלות פתיחה</span>
              <strong className={styles.heroMetricValue}>{openCost} מטבע</strong>
            </div>
            <div className={styles.heroMetric}>
              <span className={styles.heroMetricLabel}>מצב</span>
              <strong className={styles.heroMetricValue}>{step === "select" ? "בחירת ערכה" : `שאלה ${currentQueryIndex + 1} מתוך ${currentQueries.length}`}</strong>
            </div>
            <div className={styles.heroMetric}>
              <span className={styles.heroMetricLabel}>משתמש</span>
              <strong className={styles.heroMetricValue}>{userId === "anonymous" ? "אורח" : "מחובר"}</strong>
            </div>
          </div>

          {loadError && (
            <div className={styles.errorBanner} role="alert">
              {loadError}
            </div>
          )}

          {loading && (
            <div className={styles.loadingContainer}>
              <div className={styles.loadingSpinner}></div>
              <p>{loadingMessage}</p>
            </div>
          )}

          {step === "select" && !loading && (
            <div className={styles.selectionStep}>
              <div className={styles.selectionIntro}>
                <p className={styles.selectionDescription}>
                  כל ערכה כוללת מספר טבלאות קשורות ו-2 עד 3 שאלות שנבנו סביבן. בחרו את הקבוצה שנוחה לכם והתחילו לפתור.
                </p>
              </div>

              {practiceGroups.length === 0 ? (
                <div className={styles.emptyState}>
                  <h3>עדיין אין ערכות תרגול זמינות</h3>
                  <p>נסו שוב בעוד כמה דקות או פנו למרצה אם הבעיה נמשכת.</p>
                </div>
              ) : (
                <div className={styles.tablesGrid}>
                  {practiceGroups.map(([practiceId, tables]) => (
                    <article key={practiceId} className={styles.tableGroup}>
                      <div className={styles.groupBadge}>ערכת תרגול {practiceId}</div>
                      <h3 className={styles.groupTitle}>{tables.map((table) => table.table).join(" · ")}</h3>
                      <p className={styles.groupDescription}>
                        {tables.length} טבלאות, {tables.reduce((sum, table) => sum + table.columns.length, 0)} עמודות, וסט שאלות אחד ממוקד.
                      </p>
                      <div className={styles.tablesList}>
                        {tables.map((table) => (
                          <div key={table.id} className={styles.tableItem}>
                            <span className={styles.tableName}>{table.table}</span>
                            <span className={styles.tableColumns}>{table.columns.length} עמודות</span>
                          </div>
                        ))}
                      </div>
                      <button className={styles.selectButton} onClick={() => void handlePracticeSelection(practiceId)} disabled={loading}>
                        התחל תרגול
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "practice" && !loading && currentQuery && (
            <div className={styles.practiceStep}>
              <div className={styles.progressIndicator}>שאלה {currentQueryIndex + 1} מתוך {currentQueries.length}</div>

              <div className={styles.practiceLayout}>
                <aside className={styles.schemaSidebar}>
                  <div className={styles.schemaHeader}>
                    <h3 className={styles.schemaTitle}>מבנה הטבלאות</h3>
                    <p className={styles.schemaSubtitle}>עברו על השדות והאילוצים לפני כתיבת השאילתה.</p>
                  </div>
                  <div className={styles.schemaContent}>
                    {currentPracticeTables.map((table) => (
                      <section key={table.id} className={styles.tableSchema}>
                        <h4 className={styles.tableSchemaName}>{table.table}</h4>
                        <div className={styles.columnsList}>
                          {table.columns.map((column) => (
                            <div key={`${table.id}-${column.name}`} className={styles.columnItem}>
                              <span className={styles.columnName}>{column.name}</span>
                              <span className={styles.columnType}>{column.type}</span>
                            </div>
                          ))}
                        </div>
                        {table.constraints?.length > 0 && (
                          <div className={styles.constraintsList}>
                            <h5 className={styles.constraintsTitle}>אילוצים</h5>
                            {table.constraints.map((constraint, index) => (
                              <div key={`${table.id}-constraint-${index}`} className={styles.constraintItem}>
                                {constraint}
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    ))}
                  </div>
                </aside>

                <section className={styles.practiceContent}>
                  <div className={styles.questionSection}>
                    <span className={styles.questionEyebrow}>משימה נוכחית</span>
                    <h3 className={styles.questionTitle}>נסחו שאילתת SQL שעונה על הדרישה</h3>
                    <p className={styles.questionText}>{currentQuery.question}</p>
                  </div>

                  <div className={styles.answerSection}>
                    <div className={styles.answerHeader}>
                      <label className={styles.answerLabel}>התשובה שלך ב-SQL</label>
                      <span className={styles.answerHint}>אפשר להשתמש ב-`SELECT`, `JOIN`, `GROUP BY` וכל מה שנדרש לפתרון.</span>
                    </div>
                    <div className={styles.sqlEditorContainer}>
                      <Editor
                        height="220px"
                        defaultLanguage="sql"
                        value={userAnswer}
                        onChange={(value) => setUserAnswer(value || "")}
                        options={editorOptions}
                      />
                    </div>
                  </div>

                  {feedback && (
                    <div className={`${styles.feedback} ${feedbackClassName}`}>
                      <div className={styles.feedbackHeader}>
                        <span className={styles.feedbackIcon}>{feedbackIcon}</span>
                        <span className={styles.feedbackText}>{feedback}</span>
                      </div>

                      {similarity !== null && feedbackLevel !== "correct" && (
                        <div className={styles.similarityScore}>דמיון לתשובה הצפויה: {similarity}%</div>
                      )}

                      {detailedFeedback && (
                        <div className={styles.detailedFeedback}>
                          <h4>פירוט</h4>
                          <p>{detailedFeedback}</p>
                        </div>
                      )}

                      {showSolution && (
                        <div className={styles.solution}>
                          <h4>פתרון לדוגמה</h4>
                          <pre className={styles.solutionCode}>{formatSolutionSql(currentQuery.answerSql)}</pre>
                        </div>
                      )}
                    </div>
                  )}

                  <div className={styles.actionButtons}>
                    <button className={styles.submitButton} onClick={() => void handleSubmitAnswer()} disabled={!userAnswer.trim() || loading}>
                      {loading ? "שולח..." : "בדוק תשובה"}
                    </button>

                    {feedback && (
                      <button className={styles.nextButton} onClick={handleNextQuestion}>
                        {currentQueryIndex < currentQueries.length - 1 ? "שאלה הבאה" : "סיים תרגול"}
                      </button>
                    )}

                    <button className={styles.backButton} onClick={resetPracticeState} disabled={loading}>
                      חזור לבחירת ערכה
                    </button>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PracticeModal;
