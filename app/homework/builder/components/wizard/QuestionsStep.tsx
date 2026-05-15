"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./Wizard.module.css";
import { createQuestionDraft } from "./defaults";
import type { QuestionDraft, WizardStepId } from "./types";
import { useHomeworkLocale } from "@/app/homework/context/HomeworkLocaleProvider";
import type {
  Question,
  QuestionParameterDefinition,
  QuestionParameterSourceField,
  QuestionTemplate,
  VariableType,
} from "@/app/homework/types";
import {
  buildInlineQuestionPreviews,
  collectQuestionParameterTokens,
  syncQuestionParameters,
  validateQuestionParameters,
} from "@/app/homework/utils/inline-question-parameters";

interface QuestionsStepProps {
  questions: QuestionDraft[];
  onChange: (questions: QuestionDraft[]) => void;
  onBack: (step: WizardStepId) => void;
  onNext: (step: WizardStepId) => void;
  primaryDatasetId?: string;
  setId?: string;
}

interface PreviewEntry {
  question: Question;
  variables: Array<{ variableId: string; value: unknown; generatedAt: string }>;
}

const NEXT_STEP: WizardStepId = "rubric";
const PREV_STEP: WizardStepId = "dataset";
const MAX_QUESTIONS = 25;
const PREVIEW_STUDENT_ID = "__builder_preview__";

const VARIABLE_TYPE_OPTIONS: Array<{ value: VariableType; label: string }> = [
  { value: "number", label: "מספר" },
  { value: "string", label: "טקסט" },
  { value: "date", label: "תאריך" },
  { value: "list", label: "רשימה" },
  { value: "range", label: "טווח" },
  { value: "sql_value", label: "ערך SQL" },
  { value: "table_name", label: "שם טבלה" },
  { value: "column_name", label: "שם עמודה" },
];

function toSchemaInput(schema?: Array<{ column: string; type: string }>) {
  return JSON.stringify(schema ?? [], null, 2);
}

function getParameterExample(parameter: QuestionParameterDefinition) {
  const constraints = parameter.constraints ?? {};
  switch (parameter.type) {
    case "number":
      return `דוגמה: ${constraints.min ?? 1} עד ${constraints.max ?? 100}${constraints.step ? `, קפיצות של ${constraints.step}` : ""}`;
    case "string":
      return `דוגמה: ${constraints.minLength ?? 1}-${constraints.maxLength ?? 12} תווים`;
    case "list":
      return `אפשרויות: ${(constraints.options ?? []).filter(Boolean).join(", ") || "הגדירו רשימה"}`;
    case "date":
      return `דוגמה: ${constraints.minDate ?? "2024-01-01"} עד ${constraints.maxDate ?? "2026-12-31"}`;
    case "table_name":
      return `טבלאות: ${(constraints.tableNames ?? []).filter(Boolean).join(", ") || "הגדירו טבלאות"}`;
    case "column_name":
      return `עמודות: ${(constraints.columnNames ?? []).filter(Boolean).join(", ") || "הגדירו עמודות"}`;
    case "sql_value":
      return `סוגי ערכים: ${(constraints.dataTypes ?? []).filter(Boolean).join(", ") || "VARCHAR, INTEGER, DATE"}`;
    case "range":
      return `דוגמה: ${constraints.start ?? 1} עד ${constraints.end ?? 10}`;
    default:
      return "";
  }
}

function sourceFieldLabel(field: QuestionParameterSourceField) {
  switch (field) {
    case "prompt":
      return "ניסוח";
    case "instructions":
      return "הנחיות";
    case "starterSql":
      return "SQL";
    default:
      return field;
  }
}

export function QuestionsStep({
  questions,
  onChange,
  onBack,
  onNext,
  primaryDatasetId,
  setId,
}: QuestionsStepProps) {
  const { t } = useHomeworkLocale();
  const [templates, setTemplates] = useState<QuestionTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [activeQuestionId, setActiveQuestionId] = useState<string>(questions[0]?.id ?? "");
  const [templateImportId, setTemplateImportId] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewsByQuestion, setPreviewsByQuestion] = useState<Record<string, PreviewEntry[]>>({});

  useEffect(() => {
    if (!questions.some((question) => question.id === activeQuestionId)) {
      setActiveQuestionId(questions[0]?.id ?? "");
    }
  }, [activeQuestionId, questions]);

  useEffect(() => {
    const loadTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const response = await fetch("/api/templates");
        const data = await response.json();
        if (data.success) {
          setTemplates(data.data);
        }
      } catch (error) {
        console.error("Failed to load templates:", error);
      } finally {
        setLoadingTemplates(false);
      }
    };

    loadTemplates();
  }, []);

  const activeQuestion = useMemo(
    () => questions.find((question) => question.id === activeQuestionId) ?? questions[0],
    [activeQuestionId, questions],
  );

  const currentQuestionPreviews = activeQuestion ? previewsByQuestion[activeQuestion.id] ?? [] : [];
  const detectedTokens = activeQuestion
    ? collectQuestionParameterTokens({
        prompt: activeQuestion.prompt,
        instructions: activeQuestion.instructions,
        starterSql: activeQuestion.starterSql,
      })
    : [];

  const canContinue =
    questions.length > 0 &&
    questions.length <= MAX_QUESTIONS &&
    questions.every((question) => {
      const parameterErrors = validateQuestionParameters(question);
      return (
        question.prompt.trim().length > 0 &&
        question.expectedOutputDescription.trim().length > 0 &&
        parameterErrors.length === 0
      );
    });

  const updateQuestion = (questionId: string, updater: (question: QuestionDraft) => QuestionDraft) => {
    onChange(
      questions.map((question) => {
        if (question.id !== questionId) return question;
        return updater(question);
      }),
    );
  };

  const handleQuestionFieldChange = (
    questionId: string,
    field: keyof Pick<QuestionDraft, "prompt" | "instructions" | "starterSql" | "expectedOutputDescription" | "expectedResultSchema" | "datasetId" | "points" | "maxAttempts" | "evaluationMode">,
    value: string | number,
  ) => {
    updateQuestion(questionId, (question) =>
      syncQuestionParameters({
        ...question,
        [field]: value,
      }),
    );
  };

  const handleQuestionModeChange = (questionId: string, mode: "static" | "parameterized") => {
    updateQuestion(questionId, (question) =>
      syncQuestionParameters({
        ...question,
        parameterMode: mode,
        isParametric: mode === "parameterized",
      }, {
        forceParameterized: mode === "parameterized",
      }),
    );
  };

  const handleParameterChange = (
    questionId: string,
    parameterId: string,
    updater: (parameter: QuestionParameterDefinition) => QuestionParameterDefinition,
  ) => {
    updateQuestion(questionId, (question) => ({
      ...question,
      parameters: (question.parameters ?? []).map((parameter) =>
        parameter.id === parameterId ? updater(parameter) : parameter,
      ),
    }));
  };

  const handleRemove = (id: string) => {
    if (questions.length === 1) return;
    const nextQuestions = questions.filter((question) => question.id !== id);
    onChange(nextQuestions);
    setPreviewsByQuestion((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    if (activeQuestionId === id) {
      setActiveQuestionId(nextQuestions[0]?.id ?? "");
    }
  };

  const handleAdd = () => {
    if (questions.length >= MAX_QUESTIONS) return;
    const nextQuestion = createQuestionDraft({ datasetId: primaryDatasetId });
    onChange([...questions, nextQuestion]);
    setActiveQuestionId(nextQuestion.id);
  };

  const handleImportTemplate = () => {
    if (!activeQuestion || !templateImportId) return;
    const template = templates.find((entry) => entry.id === templateImportId);
    if (!template) return;

    const sourceFieldsByName = new Map(
      collectQuestionParameterTokens({
        prompt: template.template,
        instructions: template.instructions,
        starterSql: template.starterSql,
      }).map((token) => [token.name, token.sourceFields]),
    );

    updateQuestion(activeQuestion.id, () =>
      syncQuestionParameters({
        ...activeQuestion,
        prompt: template.template,
        instructions: template.instructions ?? "",
        starterSql: template.starterSql ?? "",
        expectedOutputDescription: activeQuestion.expectedOutputDescription,
        expectedResultSchema: toSchemaInput(template.expectedResultSchema),
        rubric: template.gradingRubric?.length ? template.gradingRubric : activeQuestion.rubric,
        datasetId: template.datasetId ?? activeQuestion.datasetId,
        maxAttempts: template.maxAttempts ?? activeQuestion.maxAttempts,
        points: template.points ?? activeQuestion.points,
        evaluationMode: template.evaluationMode ?? activeQuestion.evaluationMode,
        parameterMode: template.variables.length > 0 ? "parameterized" : "static",
        isParametric: template.variables.length > 0,
        templateId: template.id,
        parameters: template.variables.map((variable) => ({
          ...variable,
          sourceFields: sourceFieldsByName.get(variable.name) ?? ["prompt"],
        })),
      }, {
        forceParameterized: template.variables.length > 0,
      }),
    );

    setTemplateImportId("");
    setPreviewError(null);
  };

  const handlePreview = async () => {
    if (!activeQuestion) return;
    setPreviewLoading(true);
    setPreviewError(null);

    try {
      if (!setId) {
        const previews = buildInlineQuestionPreviews({
          id: activeQuestion.id,
          prompt: activeQuestion.prompt,
          instructions: activeQuestion.instructions,
          starterSql: activeQuestion.starterSql,
          expectedOutputDescription: activeQuestion.expectedOutputDescription,
          expectedResultSchema: JSON.parse(activeQuestion.expectedResultSchema || "[]"),
          gradingRubric: activeQuestion.rubric,
          datasetId: activeQuestion.datasetId ?? primaryDatasetId,
          maxAttempts: activeQuestion.maxAttempts,
          points: activeQuestion.points,
          evaluationMode: activeQuestion.evaluationMode,
          templateId: activeQuestion.templateId,
          parameterMode: activeQuestion.parameterMode,
          parameters: activeQuestion.parameters ?? [],
        }, {
          homeworkSetId: "builder-preview",
          studentId: PREVIEW_STUDENT_ID,
          sampleCount: 3,
        });
        setPreviewsByQuestion((current) => ({ ...current, [activeQuestion.id]: previews }));
        return;
      }

      const response = await fetch(`/api/homework/${setId}/students/${PREVIEW_STUDENT_ID}/preview-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sampleCount: 3,
          inlineQuestions: [
            {
              id: activeQuestion.id,
              prompt: activeQuestion.prompt,
              instructions: activeQuestion.instructions,
              starterSql: activeQuestion.starterSql,
              expectedOutputDescription: activeQuestion.expectedOutputDescription,
              expectedResultSchema: JSON.parse(activeQuestion.expectedResultSchema || "[]"),
              gradingRubric: activeQuestion.rubric,
              datasetId: activeQuestion.datasetId ?? primaryDatasetId,
              maxAttempts: activeQuestion.maxAttempts,
              points: activeQuestion.points,
              evaluationMode: activeQuestion.evaluationMode,
              parameterMode: activeQuestion.parameterMode,
              parameters: activeQuestion.parameters ?? [],
            },
          ],
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Preview failed");
      }

      const previews = (data.data as Array<{ questionId?: string; question: Question; variables: PreviewEntry["variables"] }>)
        .filter((entry) => (entry.questionId ?? activeQuestion.id) === activeQuestion.id)
        .map((entry) => ({
          question: entry.question,
          variables: entry.variables,
        }));

      setPreviewsByQuestion((current) => ({ ...current, [activeQuestion.id]: previews }));
    } catch (error) {
      console.error("Failed to preview question:", error);
      setPreviewError("לא ניתן לייצר תצוגה מקדימה כרגע.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const activeQuestionParameterErrors = activeQuestion ? validateQuestionParameters(activeQuestion) : [];

  if (!activeQuestion) {
    return null;
  }

  return (
    <div className={styles.stepContainer}>
      <section className={styles.section}>
        <header className={styles.questionSectionHeader}>
          <div>
            <h3>{t("builder.questions.title")}</h3>
            <p className={styles.mutedText}>
              כתבו את השאלה, סמנו פרמטרים עם <code>{"{{token}}"}</code>, והגדירו את טווחי הערכים בלי לצאת מה-builder.
            </p>
          </div>
          <div className={styles.questionHeaderActions}>
            <div className={styles.inlineActionGroup}>
              <select
                className={styles.compactSelect}
                value={templateImportId}
                onChange={(event) => setTemplateImportId(event.target.value)}
                disabled={loadingTemplates}
              >
                <option value="">ייבוא מתבנית קיימת</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              <button type="button" className={styles.secondaryButton} onClick={handleImportTemplate} disabled={!templateImportId}>
                ייבוא
              </button>
            </div>
            <Link href="/admin/templates/new" target="_blank" className={styles.ghostLink}>
              ניהול ספריית תבניות
            </Link>
          </div>
        </header>

        <div className={styles.questionWorkbench}>
          <aside className={styles.questionNavigator}>
            <div className={styles.navigatorHeader}>
              <strong>רשימת שאלות</strong>
              <span className={styles.mutedText}>{questions.length}/{MAX_QUESTIONS}</span>
            </div>
            <div className={styles.navigatorList}>
              {questions.map((question, index) => {
                const parameterized = (question.parameterMode ?? (question.parameters?.length ? "parameterized" : "static")) === "parameterized";
                const isActive = question.id === activeQuestion.id;
                return (
                  <button
                    key={question.id}
                    type="button"
                    className={`${styles.navigatorItem} ${isActive ? styles.navigatorItemActive : ""}`}
                    onClick={() => setActiveQuestionId(question.id)}
                  >
                    <span className={styles.navigatorIndex}>{index + 1}</span>
                    <span className={styles.navigatorContent}>
                      <strong>{question.prompt.trim() || `שאלה ${index + 1}`}</strong>
                      <span className={styles.navigatorMeta}>
                        {parameterized ? `פרמטרית • ${(question.parameters ?? []).length} פרמטרים` : "רגילה"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className={styles.navigatorFooter}>
              <button
                type="button"
                className={`${styles.secondaryButton} ${questions.length >= MAX_QUESTIONS ? styles.disabled : ""}`}
                onClick={handleAdd}
                disabled={questions.length >= MAX_QUESTIONS}
              >
                הוספת שאלה
              </button>
              {questions.length > 1 && (
                <button type="button" className={styles.smallButton} onClick={() => handleRemove(activeQuestion.id)}>
                  מחיקת שאלה זו
                </button>
              )}
            </div>
          </aside>

          <div className={styles.questionWorkspace}>
            <div className={styles.modeSwitch}>
              <button
                type="button"
                className={`${styles.modeButton} ${activeQuestion.parameterMode !== "parameterized" ? styles.modeButtonActive : ""}`}
                onClick={() => handleQuestionModeChange(activeQuestion.id, "static")}
              >
                שאלה רגילה
              </button>
              <button
                type="button"
                className={`${styles.modeButton} ${activeQuestion.parameterMode === "parameterized" ? styles.modeButtonActive : ""}`}
                onClick={() => handleQuestionModeChange(activeQuestion.id, "parameterized")}
              >
                שאלה עם פרמטרים
              </button>
            </div>

            <div className={styles.editorInspectorGrid}>
              <div className={styles.workspaceMain}>
                <div className={styles.workspacePanel}>
                  <div className={styles.field}>
                    <label htmlFor={`instructions-${activeQuestion.id}`}>{t("builder.questions.instructions")}</label>
                    <textarea
                      id={`instructions-${activeQuestion.id}`}
                      value={activeQuestion.instructions}
                      onChange={(event) => handleQuestionFieldChange(activeQuestion.id, "instructions", event.target.value)}
                      placeholder="רמזים, מגבלות, או הבהרות נוספות. גם כאן אפשר להשתמש ב-{{token}}."
                      rows={4}
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor={`expected-output-${activeQuestion.id}`}>תיאור הפלט הצפוי</label>
                    <textarea
                      id={`expected-output-${activeQuestion.id}`}
                      value={activeQuestion.expectedOutputDescription}
                      onChange={(event) => handleQuestionFieldChange(activeQuestion.id, "expectedOutputDescription", event.target.value)}
                      placeholder="מה הסטודנט אמור לראות: עמודות, סדר, הגיון התוצאה."
                      rows={4}
                    />
                  </div>
                </div>

                <div className={styles.workspacePanel}>
                  <div className={styles.field}>
                    <label htmlFor={`prompt-${activeQuestion.id}`}>{t("builder.questions.prompt")}</label>
                    <textarea
                      id={`prompt-${activeQuestion.id}`}
                      value={activeQuestion.prompt}
                      onChange={(event) => handleQuestionFieldChange(activeQuestion.id, "prompt", event.target.value)}
                      placeholder="כתבו את ניסוח השאלה. כדי להגדיר פרמטר, השתמשו למשל ב-{{min_age}}."
                      rows={5}
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor={`starter-${activeQuestion.id}`}>{t("builder.questions.starterSql")}</label>
                    <textarea
                      id={`starter-${activeQuestion.id}`}
                      value={activeQuestion.starterSql}
                      onChange={(event) => handleQuestionFieldChange(activeQuestion.id, "starterSql", event.target.value)}
                      placeholder="SELECT * FROM employees WHERE age > {{min_age}};"
                      rows={6}
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor={`schema-${activeQuestion.id}`}>{t("builder.questions.expectedSchema")}</label>
                    <textarea
                      id={`schema-${activeQuestion.id}`}
                      value={activeQuestion.expectedResultSchema}
                      onChange={(event) => handleQuestionFieldChange(activeQuestion.id, "expectedResultSchema", event.target.value)}
                      placeholder={t("builder.questions.expectedSchemaPlaceholder")}
                      rows={5}
                    />
                  </div>
                </div>
              </div>

              <aside className={styles.workspaceInspector}>
                <div className={styles.workspacePanel}>
                  <div className={styles.inspectorHeader}>
                    <div>
                      <h4>פרמטרים מזוהים</h4>
                      <p className={styles.mutedText}>כתבו <code>{"{{token}}"}</code> בניסוח או ב-SQL כדי להפעיל את אזור ההגדרה.</p>
                    </div>
                    <span className={styles.badge}>{detectedTokens.length}</span>
                  </div>

                  {detectedTokens.length === 0 ? (
                    <div className={styles.emptyInlineState}>
                      <strong>אין עדיין פרמטרים.</strong>
                      <p className={styles.mutedText}>אפשר להשאיר את השאלה רגילה, או להוסיף token כמו <code>{"{{limit_value}}"}</code>.</p>
                    </div>
                  ) : (
                    <div className={styles.parameterStack}>
                      {(activeQuestion.parameters ?? []).map((parameter) => (
                        <div key={parameter.id} className={styles.parameterCard}>
                          <div className={styles.parameterHeader}>
                            <div>
                              <strong>{parameter.name}</strong>
                              <div className={styles.parameterSources}>
                                {parameter.sourceFields.map((field) => (
                                  <span key={field} className={styles.subtleBadge}>
                                    {sourceFieldLabel(field)}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <select
                              className={styles.compactSelect}
                              value={parameter.type}
                              onChange={(event) =>
                                handleParameterChange(activeQuestion.id, parameter.id, (current) => ({
                                  ...current,
                                  type: event.target.value as VariableType,
                                }))
                              }
                            >
                              {VARIABLE_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className={styles.field}>
                            <label>תיאור קצר</label>
                            <input
                              value={parameter.description ?? ""}
                              onChange={(event) =>
                                handleParameterChange(activeQuestion.id, parameter.id, (current) => ({
                                  ...current,
                                  description: event.target.value,
                                }))
                              }
                              placeholder="למשל: גיל מינימלי לסינון"
                            />
                          </div>

                          {(parameter.type === "number" || parameter.type === "range") && (
                            <div className={styles.compactFieldRow}>
                              <div className={styles.field}>
                                <label>{parameter.type === "number" ? "מינימום" : "התחלה"}</label>
                                <input
                                  type="number"
                                  value={parameter.type === "number" ? parameter.constraints?.min ?? "" : parameter.constraints?.start ?? ""}
                                  onChange={(event) =>
                                    handleParameterChange(activeQuestion.id, parameter.id, (current) => ({
                                      ...current,
                                      constraints: {
                                        ...current.constraints,
                                        [parameter.type === "number" ? "min" : "start"]: Number(event.target.value),
                                      },
                                    }))
                                  }
                                />
                              </div>
                              <div className={styles.field}>
                                <label>{parameter.type === "number" ? "מקסימום" : "סיום"}</label>
                                <input
                                  type="number"
                                  value={parameter.type === "number" ? parameter.constraints?.max ?? "" : parameter.constraints?.end ?? ""}
                                  onChange={(event) =>
                                    handleParameterChange(activeQuestion.id, parameter.id, (current) => ({
                                      ...current,
                                      constraints: {
                                        ...current.constraints,
                                        [parameter.type === "number" ? "max" : "end"]: Number(event.target.value),
                                      },
                                    }))
                                  }
                                />
                              </div>
                              {parameter.type === "number" && (
                                <div className={`${styles.field} ${styles.fieldFull}`}>
                                  <label>צעד</label>
                                  <input
                                    type="number"
                                    value={parameter.constraints?.step ?? ""}
                                    onChange={(event) =>
                                      handleParameterChange(activeQuestion.id, parameter.id, (current) => ({
                                        ...current,
                                        constraints: {
                                          ...current.constraints,
                                          step: Number(event.target.value),
                                        },
                                      }))
                                    }
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {parameter.type === "string" && (
                            <div className={styles.compactFieldRow}>
                              <div className={styles.field}>
                                <label>אורך מינימלי</label>
                                <input
                                  type="number"
                                  value={parameter.constraints?.minLength ?? ""}
                                  onChange={(event) =>
                                    handleParameterChange(activeQuestion.id, parameter.id, (current) => ({
                                      ...current,
                                      constraints: {
                                        ...current.constraints,
                                        minLength: Number(event.target.value),
                                      },
                                    }))
                                  }
                                />
                              </div>
                              <div className={styles.field}>
                                <label>אורך מקסימלי</label>
                                <input
                                  type="number"
                                  value={parameter.constraints?.maxLength ?? ""}
                                  onChange={(event) =>
                                    handleParameterChange(activeQuestion.id, parameter.id, (current) => ({
                                      ...current,
                                      constraints: {
                                        ...current.constraints,
                                        maxLength: Number(event.target.value),
                                      },
                                    }))
                                  }
                                />
                              </div>
                            </div>
                          )}

                          {parameter.type === "date" && (
                            <div className={styles.compactFieldRow}>
                              <div className={styles.field}>
                                <label>מתאריך</label>
                                <input
                                  type="date"
                                  value={parameter.constraints?.minDate ?? ""}
                                  onChange={(event) =>
                                    handleParameterChange(activeQuestion.id, parameter.id, (current) => ({
                                      ...current,
                                      constraints: {
                                        ...current.constraints,
                                        minDate: event.target.value,
                                      },
                                    }))
                                  }
                                />
                              </div>
                              <div className={styles.field}>
                                <label>עד תאריך</label>
                                <input
                                  type="date"
                                  value={parameter.constraints?.maxDate ?? ""}
                                  onChange={(event) =>
                                    handleParameterChange(activeQuestion.id, parameter.id, (current) => ({
                                      ...current,
                                      constraints: {
                                        ...current.constraints,
                                        maxDate: event.target.value,
                                      },
                                    }))
                                  }
                                />
                              </div>
                            </div>
                          )}

                          {(parameter.type === "list" || parameter.type === "table_name" || parameter.type === "column_name" || parameter.type === "sql_value") && (
                            <div className={styles.field}>
                              <label>
                                {parameter.type === "list" && "אפשרויות"}
                                {parameter.type === "table_name" && "רשימת טבלאות"}
                                {parameter.type === "column_name" && "רשימת עמודות"}
                                {parameter.type === "sql_value" && "סוגי ערכים"}
                              </label>
                              <textarea
                                value={
                                  parameter.type === "list"
                                    ? (parameter.constraints?.options ?? []).join(", ")
                                    : parameter.type === "table_name"
                                      ? (parameter.constraints?.tableNames ?? []).join(", ")
                                      : parameter.type === "column_name"
                                        ? (parameter.constraints?.columnNames ?? []).join(", ")
                                        : (parameter.constraints?.dataTypes ?? []).join(", ")
                                }
                                onChange={(event) => {
                                  const values = event.target.value.split(",").map((entry) => entry.trim()).filter(Boolean);
                                  handleParameterChange(activeQuestion.id, parameter.id, (current) => ({
                                    ...current,
                                    constraints: {
                                      ...current.constraints,
                                      ...(parameter.type === "list" ? { options: values } : {}),
                                      ...(parameter.type === "table_name" ? { tableNames: values } : {}),
                                      ...(parameter.type === "column_name" ? { columnNames: values } : {}),
                                      ...(parameter.type === "sql_value" ? { dataTypes: values } : {}),
                                    },
                                  }));
                                }}
                                rows={3}
                                placeholder="הפרידו בפסיקים"
                              />
                            </div>
                          )}

                          <div className={styles.parameterFooter}>
                            <span className={styles.mutedText}>{getParameterExample(parameter)}</span>
                            <label className={styles.checkboxLabel}>
                              <input
                                type="checkbox"
                                checked={parameter.required ?? true}
                                onChange={(event) =>
                                  handleParameterChange(activeQuestion.id, parameter.id, (current) => ({
                                    ...current,
                                    required: event.target.checked,
                                  }))
                                }
                              />
                              חובה
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeQuestionParameterErrors.length > 0 && (
                    <div className={styles.inlineErrorList}>
                      {activeQuestionParameterErrors.map((issue) => (
                        <p key={issue}>{issue}</p>
                      ))}
                    </div>
                  )}
                </div>

                <div className={styles.workspacePanel}>
                  <h4>הגדרות שאלה</h4>
                  <div className={styles.field}>
                    <label htmlFor={`dataset-${activeQuestion.id}`}>{t("builder.questions.datasetOverride")}</label>
                    <input
                      id={`dataset-${activeQuestion.id}`}
                      value={activeQuestion.datasetId ?? ""}
                      onChange={(event) => handleQuestionFieldChange(activeQuestion.id, "datasetId", event.target.value)}
                      placeholder={
                        primaryDatasetId
                          ? t("builder.questions.defaultDataset", { id: primaryDatasetId })
                          : t("builder.questions.useDefaultDataset")
                      }
                    />
                    <p className={styles.mutedText}>{t("builder.questions.datasetHint")}</p>
                  </div>

                  <div className={styles.compactFieldRow}>
                    <div className={styles.field}>
                      <label htmlFor={`points-${activeQuestion.id}`}>{t("builder.questions.points")}</label>
                      <input
                        id={`points-${activeQuestion.id}`}
                        type="number"
                        min={0}
                        value={activeQuestion.points}
                        onChange={(event) => handleQuestionFieldChange(activeQuestion.id, "points", Number(event.target.value))}
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor={`attempts-${activeQuestion.id}`}>{t("builder.questions.maxAttempts")}</label>
                      <input
                        id={`attempts-${activeQuestion.id}`}
                        type="number"
                        min={1}
                        value={activeQuestion.maxAttempts}
                        onChange={(event) => handleQuestionFieldChange(activeQuestion.id, "maxAttempts", Number(event.target.value))}
                      />
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label htmlFor={`evaluation-${activeQuestion.id}`}>{t("builder.questions.evaluationMode")}</label>
                    <select
                      id={`evaluation-${activeQuestion.id}`}
                      value={activeQuestion.evaluationMode}
                      onChange={(event) => handleQuestionFieldChange(activeQuestion.id, "evaluationMode", event.target.value)}
                    >
                      <option value="auto">{t("builder.questions.eval.auto")}</option>
                      <option value="manual">{t("builder.questions.eval.manual")}</option>
                      <option value="custom">{t("builder.questions.eval.custom")}</option>
                    </select>
                  </div>

                  <div className={styles.inspectorSummary}>
                    <div>
                      <strong>שדות עם tokens</strong>
                      <p className={styles.mutedText}>
                        {detectedTokens.length > 0
                          ? detectedTokens.map((token) => token.name).join(", ")
                          : "אין tokens כרגע"}
                      </p>
                    </div>
                    <div>
                      <strong>מקור נתונים</strong>
                      <p className={styles.mutedText}>{activeQuestion.datasetId || primaryDatasetId || "ברירת מחדל של המטלה"}</p>
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            <div className={styles.previewSection}>
              <div className={styles.previewHeader}>
                <div>
                  <h4>תצוגה מקדימה לסטודנטים</h4>
                  <p className={styles.mutedText}>שלוש וריאציות לדוגמה של אותה שאלה, כדי לאמת ניסוח, SQL וערכי פרמטרים.</p>
                </div>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={handlePreview}
                  disabled={previewLoading || activeQuestionParameterErrors.length > 0}
                >
                  {previewLoading ? "מייצר תצוגה..." : "Preview 3 variants"}
                </button>
              </div>

              {previewError && <p className={styles.inlineErrorText}>{previewError}</p>}

              {currentQuestionPreviews.length === 0 ? (
                <div className={styles.emptyInlineState}>
                  <strong>אין עדיין תצוגה מקדימה.</strong>
                  <p className={styles.mutedText}>אחרי שמגדירים פרמטרים וטווחים, הפעילו preview כדי לראות ניסוחים אמיתיים לסטודנטים.</p>
                </div>
              ) : (
                <div className={styles.previewGrid}>
                  {currentQuestionPreviews.map((preview, index) => (
                    <article key={`${preview.question.id}-${index}`} className={styles.previewCard}>
                      <div className={styles.previewCardHeader}>
                        <strong>וריאציה {index + 1}</strong>
                        <span className={styles.subtleBadge}>{preview.variables.length} ערכים</span>
                      </div>
                      <p>{preview.question.prompt}</p>
                      {preview.question.starterSql ? (
                        <pre className={styles.previewCode}>{preview.question.starterSql}</pre>
                      ) : null}
                      <p className={styles.mutedText}>
                        {preview.question.expectedOutputDescription || "אין תיאור פלט צפוי"}
                      </p>
                      {preview.question.instructions ? (
                        <p className={styles.mutedText}>{preview.question.instructions}</p>
                      ) : null}
                      <div className={styles.previewVariables}>
                        {preview.variables.map((variable) => {
                          const parameter = activeQuestion.parameters?.find((entry) => entry.id === variable.variableId);
                          return (
                            <span key={variable.variableId} className={styles.variablePill}>
                              {parameter?.name ?? variable.variableId}: {String(variable.value)}
                            </span>
                          );
                        })}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className={styles.actions}>
        <button type="button" className={styles.secondaryButton} onClick={() => onBack(PREV_STEP)}>
          {t("builder.dataset.actions.back")}
        </button>
        <button
          type="button"
          className={`${styles.primaryButton} ${!canContinue ? styles.disabled : ""}`}
          disabled={!canContinue}
          onClick={() => onNext(NEXT_STEP)}
        >
          {t("builder.questions.continueToRubric")}
        </button>
      </div>
    </div>
  );
}
