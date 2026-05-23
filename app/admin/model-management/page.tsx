"use client";

import { useEffect, useState } from "react";

import AdminShell, { useAdminShell } from "@/app/components/admin/AdminShell";
import { RECOMMENDED_RUNTIME_MODEL } from "@/lib/openai/model-registry";
import styles from "./ModelManagement.module.css";

interface RuntimeConfig {
  model: string;
  toolsCount: number;
  enabledToolNames?: string[];
  updatedAt?: string | null;
  source?: string;
}

interface FeatureFlagDiagnostic {
  name: string;
  enabled: boolean;
  defaultValue: boolean;
  description: string;
}

interface ToolBoundary {
  purpose: string;
  webSearchAllowed: boolean;
  notes: string[];
}

interface ToolMatrixEntry {
  name: string;
  lifecycle: string;
  rolloutPhase: string;
  allowedRoles: string[];
  loggingSensitivity: string;
  runtimeEnabled: boolean;
  featureFlag?: string | null;
  featureFlagEnabled?: boolean;
}

interface ToolMatrixRow {
  context: string;
  boundary: ToolBoundary;
  tools: ToolMatrixEntry[];
}

interface AvailableTool {
  name: string;
  description: string;
  enabled: boolean;
  lifecycle: string;
  enabledContexts: string[];
  allowedRoles: string[];
  rolloutPhase: string;
  loggingSensitivity: string;
  runtimeEnabled: boolean;
  featureFlag?: string | null;
  featureFlagEnabled?: boolean;
  statusNote?: string | null;
}

interface ConnectorCapability {
  id: string;
  label: string;
  delivery: string;
  connectorId?: string;
  enabled: boolean;
  featureFlagEnabled: boolean;
  authConfigured: boolean;
  status: string;
  statusDetail: string;
  allowedTools: string[];
  useCases: string[];
  oauthScopes: string[];
  implementationDecision: string;
}

interface RuntimeConfigResponse {
  success?: boolean;
  mode?: string;
  config?: RuntimeConfig;
  availableTools?: AvailableTool[];
  featureFlags?: FeatureFlagDiagnostic[];
  instructorConnectorCapabilities?: ConnectorCapability[];
  toolRolloutMatrix?: ToolMatrixRow[];
  toolUsageLoggingPlan?: {
    destination: string;
    notes: string[];
  };
  error?: string;
}

interface TestResult {
  success: boolean;
  model: string;
  testType: string;
  executionTimeMs: number;
  results: {
    success: boolean;
    responseQuality: string;
    languageSupport: string;
    functionCalling: string;
    functionCallsCount: number;
    responseLength: number;
    containsExample: boolean;
    containsHebrew: boolean;
    issues: string[];
  };
  preview?: string;
}

interface UsageAnalytics {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  averageTokensPerRequest: number;
  averageCostPerRequest: number;
  modelBreakdown: Record<string, any>;
}

const FEATURE_FLAG_LABELS: Record<string, string> = {
  FEATURE_OPENAI_WEB_SEARCH: "חיפוש ווב של OpenAI",
  FEATURE_OPENAI_CONNECTORS: "קונקטורים של OpenAI",
  FEATURE_RESPONSES_BACKGROUND: "משימות רקע של Responses",
  FEATURE_PERSONALIZATION_TOOLS: "כלי פרסונליזציה",
  FF_FILE_SEARCH: "חיפוש קבצים",
  FF_TOOL_SEARCH_MCP: "Tool Search + MCP",
  FF_REALTIME_VOICE: "קול בזמן אמת",
  FF_BACKGROUND_MODE: "מצב רקע",
  FF_BATCH_JOBS: "משימות אצווה",
  FF_SKILL_SQL_DEBUGGER: "SQL Debugger",
  FF_SKILL_RUBRIC_GRADER: "Rubric Grader",
  FF_SKILL_MISCONCEPTION_COACH: "Misconception Coach",
  FF_SKILL_OFFICE_HOURS_SIMULATOR: "Office Hours Simulator",
  FF_SKILL_ASSESSMENT_AUDITOR: "Assessment Auditor",
  FF_SKILL_STUDENT_PROGRESS_ANALYST: "Student Progress Analyst",
};

const FEATURE_FLAG_DESCRIPTIONS_HE: Record<string, string> = {
  FEATURE_OPENAI_WEB_SEARCH: "מפעיל חיפוש ווב מובנה של OpenAI עבור זרימות אדמין בלבד.",
  FEATURE_OPENAI_CONNECTORS: "מפעיל שכבת קונקטורים וכלי MCP עבור תרחישי מדריך ואדמין.",
  FEATURE_RESPONSES_BACKGROUND: "מפעיל הרצת משימות רקע עבור בקשות ב-Responses API.",
  FEATURE_PERSONALIZATION_TOOLS: "משאיר את כלי הפרסונליזציה לסטודנטים פעילים עד להקשחת rollout עתידית.",
  FF_FILE_SEARCH: "דגל rollout ראשוני עבור File Search מבוסס retrieval.",
  FF_TOOL_SEARCH_MCP: "דגל rollout ראשוני עבור חיפוש כלים דינמי וניתוב ל-remote MCP.",
  FF_REALTIME_VOICE: "דגל rollout ראשוני עבור חוויית קול בזמן אמת.",
  FF_BACKGROUND_MODE: "דגל rollout ראשוני עבור טיפול אסינכרוני ובקשות רקע.",
  FF_BATCH_JOBS: "דגל rollout ראשוני עבור משימות AI לא דחופות באצווה.",
  FF_SKILL_SQL_DEBUGGER: "דגל rollout ראשוני עבור יכולת sql-debugger.",
  FF_SKILL_RUBRIC_GRADER: "דגל rollout ראשוני עבור יכולת rubric-grader.",
  FF_SKILL_MISCONCEPTION_COACH: "דגל rollout ראשוני עבור יכולת misconception-coach.",
  FF_SKILL_OFFICE_HOURS_SIMULATOR: "דגל rollout ראשוני עבור יכולת office-hours-simulator.",
  FF_SKILL_ASSESSMENT_AUDITOR: "דגל rollout ראשוני עבור יכולת assessment-auditor.",
  FF_SKILL_STUDENT_PROGRESS_ANALYST: "דגל rollout ראשוני עבור יכולת student-progress-analyst.",
};

const TOOL_DESCRIPTIONS_HE: Record<string, string> = {
  get_course_week_context: "מחזיר את הקשר שבוע הלימוד הפעיל, כולל מושגי SQL מותרים ואסורים.",
  get_database_schema: "מחזיר סכמת מסד נתונים לתרגול, דוגמאות או שיעורי בית.",
  execute_sql_query: "מריץ שאילתת SQL לקריאה בלבד בסביבת הלימוד הבטוחה של הסטודנטים.",
  validate_sql_answer: "בודק את תשובת ה-SQL של הסטודנט מול אילוצים צפויים לפני מתן הסבר.",
  compare_sql_queries: "משווה בין שתי שאילתות SQL ומסביר הבדלי נכונות, קריאות ויעילות.",
  get_homework_context: "מחזיר הקשר של שיעורי הבית, כולל שאלה, מטלה ומגבלות רלוונטיות.",
  get_student_learning_profile: "מחזיר פרופיל למידה של הסטודנט לצורך התאמה אישית.",
  get_student_progress_snapshot: "מחזיר תמונת מצב עדכנית של התקדמות הסטודנט.",
  get_recent_submission_attempts: "מחזיר ניסיונות הגשה אחרונים של הסטודנט.",
  get_deadline_and_schedule_context: "מחזיר דדליינים, לוח זמנים והקשר תפעולי רלוונטי.",
  recommend_next_learning_step: "מציע את צעד הלמידה הבא לפי התקדמות ודפוסי טעויות.",
  generate_personalized_quiz_from_mistakes: "יוצר חידון אישי על בסיס טעויות קודמות של הסטודנט.",
  remember_student_preference: "שומר העדפת למידה של הסטודנט לשיחות עתידיות.",
  generate_next_practice_step: "מייצר את צעד התרגול הבא בהתאם למצב הלמידה.",
  analyze_query_performance: "מנתח ביצועים של שאילתה ומסביר צווארי בקבוק אפשריים.",
  render_sql_visualization: "יוצר המחשה ויזואלית של שאילתת SQL או שלבי עיבוד.",
  explain_relational_algebra_step: "מסביר שלב באלגברה יחסית ובהמרה בין SQL ל-RA.",
  grade_with_rubric: "מבצע הערכה מובנית באמצעות רובריקה עבור תהליכי בדיקה באדמין.",
  list_instructor_mcp_capabilities: "מחזיר רשימת יכולות MCP פוטנציאליות לתרחישי מדריך.",
  code_interpreter: "כלי ניתוח מובנה לאדמין בלבד עבור חישובים ובדיקות מתקדמות.",
  web_search: "חיפוש ווב מובנה עבור עובדות עדכניות ותיעוד חיצוני.",
};

const TOOL_STATUS_NOTES_HE: Record<string, string> = {
  get_database_schema: "משתמש במטא-דאטה אמיתי של תרגול ושיעורי בית כאשר יש הקשר מתאים.",
  execute_sql_query: "סביבת sandbox בטוחה בלבד. נאכפות שאילתות קריאה, הגבלת שורות, תחימה לסכמות ושגיאות ידידותיות ללמידה.",
  explain_relational_algebra_step: "מיועד להדרכת אלגברה יחסית ומיפוי SQL ל-RA. לא זמין במצב קול כדי לשמור על לטנטיות נמוכה.",
  grade_with_rubric: "בדיקה מובנית עם רובריקה עבור תהליכי סקירה, עם escalation לפי רמת ביטחון.",
  list_instructor_mcp_capabilities: "מניפסט חקירה לקראת אינטגרציות remote MCP בתרחישים למדריכים.",
  code_interpreter: "כלי ניתוח מובנה לאדמין בלבד. לא נחשף כברירת מחדל בצ'אט הסטודנטיאלי.",
  web_search: "חיפוש ווב מובנה עבור מידע חיצוני עדכני ותיעוד. צריך להישאר כבוי מחוץ לזרימות אדמין.",
};

const CONNECTOR_LABELS_HE: Record<string, string> = {
  gradebook: "מתאם גיליון ציונים פנימי",
  lms_exports: "מתאם ייצוא LMS",
  content_registry: "מתאם רשם תוכן",
  google_drive: "Google Drive",
  gmail: "Gmail",
  google_calendar: "Google Calendar",
  google_sheets_tabular: "Google Sheets / קבצים טבלאיים מ-Drive",
};

function sortByEnabledThenName<T extends { enabled: boolean; name?: string; label?: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const enabledDelta = Number(right.enabled) - Number(left.enabled);
    if (enabledDelta !== 0) {
      return enabledDelta;
    }

    const leftName = left.name || left.label || "";
    const rightName = right.name || right.label || "";
    return leftName.localeCompare(rightName);
  });
}

function formatDefaultValue(value: boolean) {
  return value ? "פעיל" : "כבוי";
}

function translateApiMode(mode: string) {
  if (mode === "responses") return "Responses";
  if (mode === "assistants") return "Assistants";
  return mode;
}

function translateLifecycle(value: string) {
  const map: Record<string, string> = {
    production: "פרודקשן",
    experimental: "ניסיוני",
    disabled: "מושבת",
  };
  return map[value] || value;
}

function translateRolloutPhase(value: string) {
  const map: Record<string, string> = {
    general_availability: "זמינות כללית",
    admin_only: "אדמין בלבד",
    internal: "פנימי",
  };
  return map[value] || value;
}

function translateLoggingSensitivity(value: string) {
  const map: Record<string, string> = {
    standard: "רגיל",
    sensitive: "רגיש",
    restricted: "מוגבל",
  };
  return map[value] || value;
}

function translateContextName(value: string) {
  const map: Record<string, string> = {
    main_chat: "צ'אט ראשי",
    homework_runner: "מריץ שיעורי בית",
    admin: "אדמין",
    voice: "קול",
  };
  return map[value] || value;
}

function translateRole(value: string) {
  const map: Record<string, string> = {
    student: "סטודנט",
    instructor: "מדריך",
    admin: "אדמין",
  };
  return map[value] || value;
}

function translateConnectorStatus(value: string) {
  const map: Record<string, string> = {
    ready: "מוכן",
    missing_authorization: "חסרה הרשאה",
    disabled: "כבוי",
    feature_flag_disabled: 'כבוי ע"י feature flag',
  };
  return map[value] || value;
}

function translateConnectorStatusDetail(value: string) {
  const map: Record<string, string> = {
    "Connector rollout is disabled by FEATURE_OPENAI_CONNECTORS.": 'ה-rollout של הקונקטורים כבוי על ידי FEATURE_OPENAI_CONNECTORS.',
    "Connector is disabled in the instructor integration manifest.": "הקונקטור כבוי במניפסט האינטגרציות של המדריך.",
    "OAuth access token is not configured for this connector.": "לא מוגדר OAuth access token עבור הקונקטור הזה.",
    "Ready for read-only instructor/admin use.": "מוכן לשימוש קריאה בלבד עבור מדריך או אדמין.",
  };
  return map[value] || value;
}

function translateBoundaryPurpose(value: string) {
  const map: Record<string, string> = {
    "Student-facing tutoring and SQL explanation.": "סיוע לסטודנטים והסבר על SQL בצד המשתמש.",
    "Hint-first homework guidance inside the runner.": "הכוונת שיעורי בית בגישת hint-first בתוך הרנר.",
    "Instructor and admin diagnostics, ops, and grounded research workflows.": "דיאגנוסטיקה, תפעול וזרימות מחקר מבוססות עבור מדריך ואדמין.",
    "Low-latency voice interaction with tightly-scoped educational tooling.": "אינטראקציית קול עם לטנטיות נמוכה וכלים לימודיים מצומצמים.",
  };
  return map[value] || value;
}

function translateBoundaryNote(value: string) {
  const map: Record<string, string> = {
    "Prefer course files, SQL tools, and retrieval over external sources.": "העדף קבצי קורס, כלי SQL ו-retrieval על פני מקורות חיצוניים.",
    "Keep answers scoped to safe educational guidance.": "השאר את התשובות בגבולות הדרכה לימודית בטוחה.",
    "Never introduce web-connected tools into grading or homework solving flows.": "לעולם אל תכניס כלים מחוברים לווב לתהליכי בדיקה או פתרון שיעורי בית.",
    "Guide students without bypassing assignment constraints.": "הנחה את הסטודנטים בלי לעקוף את מגבלות המטלה.",
    "Prefer internal files for course truth and canonical policy answers.": "העדף קבצים פנימיים כמקור אמת קורסי ולתשובות מדיניות רשמיות.",
    "Allow web search only for fresh, external, or documentation-style questions.": "אפשר חיפוש ווב רק עבור שאלות עדכניות, חיצוניות או דוקומנטריות.",
    "Keep tool usage narrow to preserve latency and avoid noisy multimodal side effects.": "שמור על שימוש צר בכלים כדי לשמר לטנטיות נמוכה ולהימנע מתופעות לוואי מולטימודליות.",
  };
  return map[value] || value;
}

function translateToolDescription(toolName: string, fallback: string) {
  return TOOL_DESCRIPTIONS_HE[toolName] || fallback;
}

function translateToolStatusNote(toolName: string, fallback?: string | null) {
  if (!fallback) return fallback;
  return TOOL_STATUS_NOTES_HE[toolName] || fallback;
}

function translateFeatureFlagDescription(flagName: string, fallback: string) {
  return FEATURE_FLAG_DESCRIPTIONS_HE[flagName] || fallback;
}

function translateFeatureFlagLabel(flagName: string) {
  return FEATURE_FLAG_LABELS[flagName] || flagName;
}

function translateConnectorLabel(connectorId: string, fallback: string) {
  return CONNECTOR_LABELS_HE[connectorId] || fallback;
}

function buildAllFlagsOnEnvBlock(flags: FeatureFlagDiagnostic[]) {
  return flags.map((flag) => `${flag.name}=1`).join("\n");
}

function ModelManagementContent() {
  const { currentAdminEmail } = useAdminShell();
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig | null>(null);
  const [apiMode, setApiMode] = useState<string>("unknown");
  const [availableTools, setAvailableTools] = useState<AvailableTool[]>([]);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlagDiagnostic[]>([]);
  const [instructorConnectorCapabilities, setInstructorConnectorCapabilities] = useState<ConnectorCapability[]>([]);
  const [toolRolloutMatrix, setToolRolloutMatrix] = useState<ToolMatrixRow[]>([]);
  const [toolUsageLoggingPlan, setToolUsageLoggingPlan] = useState<RuntimeConfigResponse["toolUsageLoggingPlan"] | null>(null);
  const [testResults, setTestResults] = useState<TestResult | null>(null);
  const [usageAnalytics, setUsageAnalytics] = useState<UsageAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingToolName, setSavingToolName] = useState<string | null>(null);
  const [savingConnectorId, setSavingConnectorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestHeaders = {
    ...(currentAdminEmail ? { "x-user-email": currentAdminEmail } : {}),
  };

  const requestJsonHeaders = {
    "Content-Type": "application/json",
    ...requestHeaders,
  };

  const runtimeStatusItems = runtimeConfig
    ? [
        { label: "מצב API", value: translateApiMode(apiMode) },
        { label: "מודל פעיל", value: runtimeConfig.model },
        { label: "כלים פעילים בצ'אט", value: String(availableTools.filter((tool) => tool.enabled).length) },
        { label: "מקור קונפיגורציה", value: runtimeConfig.source === "db" ? "מסד נתונים" : "ברירת מחדל" },
      ]
    : [];

  const sortedFeatureFlags = sortByEnabledThenName(featureFlags.map((flag) => ({ ...flag, label: flag.name })));
  const sortedAvailableTools = [...availableTools].sort((left, right) => {
    const enabledDelta = Number(right.enabled) - Number(left.enabled);
    if (enabledDelta !== 0) return enabledDelta;

    const gatedDelta = Number(left.runtimeEnabled) - Number(right.runtimeEnabled);
    if (gatedDelta !== 0) return gatedDelta;

    return left.name.localeCompare(right.name);
  });
  const sortedConnectors = [...instructorConnectorCapabilities].sort((left, right) => {
    const statusRank = (status: string) => {
      switch (status) {
        case "ready":
          return 0;
        case "missing_authorization":
          return 1;
        case "disabled":
          return 2;
        case "feature_flag_disabled":
          return 3;
        default:
          return 4;
      }
    };

    const rankDelta = statusRank(left.status) - statusRank(right.status);
    if (rankDelta !== 0) return rankDelta;

    return left.label.localeCompare(right.label);
  });

  const enabledFeatureFlagCount = featureFlags.filter((flag) => flag.enabled).length;
  const enabledRuntimeToolCount = availableTools.filter((tool) => tool.enabled).length;
  const blockedRuntimeToolCount = availableTools.filter((tool) => tool.featureFlag && !tool.featureFlagEnabled).length;
  const readyConnectorCount = instructorConnectorCapabilities.filter((connector) => connector.status === "ready").length;
  const connectorFlag = featureFlags.find((flag) => flag.name === "FEATURE_OPENAI_CONNECTORS");
  const allFlagsOnEnvBlock = buildAllFlagsOnEnvBlock(featureFlags);

  useEffect(() => {
    if (!currentAdminEmail) return;

    void loadRuntimeConfig();
    void loadUsageAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAdminEmail]);

  const loadRuntimeConfig = async () => {
    try {
      const response = await fetch("/api/responses/runtime", {
        headers: requestHeaders,
      });
      if (!response.ok) {
        throw new Error("טעינת קונפיגורציית runtime נכשלה.");
      }

      const data = (await response.json()) as RuntimeConfigResponse;
      if (!data.success || !data.config) {
        throw new Error(data.error || "טעינת קונפיגורציית runtime נכשלה.");
      }

      setRuntimeConfig(data.config);
      setApiMode(data.mode || "unknown");
      setAvailableTools(Array.isArray(data.availableTools) ? data.availableTools : []);
      setFeatureFlags(Array.isArray(data.featureFlags) ? data.featureFlags : []);
      setInstructorConnectorCapabilities(Array.isArray(data.instructorConnectorCapabilities) ? data.instructorConnectorCapabilities : []);
      setToolRolloutMatrix(Array.isArray(data.toolRolloutMatrix) ? data.toolRolloutMatrix : []);
      setToolUsageLoggingPlan(data.toolUsageLoggingPlan || null);
    } catch (err: any) {
      setError(err.message || "טעינת קונפיגורציית runtime נכשלה.");
    }
  };

  const loadUsageAnalytics = async () => {
    try {
      const response = await fetch("/api/analytics/model-usage?timeRange=24h", {
        headers: requestHeaders,
      });
      if (response.ok) {
        const data = await response.json();
        setUsageAnalytics(data.analytics);
      }
    } catch (err) {
      console.error("Failed to load usage analytics:", err);
    }
  };

  const applyRecommendedConfig = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/responses/runtime", {
        method: "POST",
        headers: requestJsonHeaders,
        body: JSON.stringify({
          model: RECOMMENDED_RUNTIME_MODEL,
          reason: "admin recommended config",
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "עדכון הקונפיגורציה נכשל.");
      }

      await loadRuntimeConfig();
      alert(`קונפיגורציית ה-runtime עודכנה ל-${data?.config?.model || RECOMMENDED_RUNTIME_MODEL}`);
    } catch (err: any) {
      setError(err.message || "עדכון הקונפיגורציה נכשל.");
    } finally {
      setLoading(false);
    }
  };

  const runTest = async (testType: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/responses/runtime/validate", {
        method: "POST",
        headers: requestJsonHeaders,
        body: JSON.stringify({ testType }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "הבדיקה נכשלה.");
      }

      setTestResults(data as TestResult);
    } catch (err: any) {
      setError(err.message || "הבדיקה נכשלה.");
    } finally {
      setLoading(false);
    }
  };

  const rollbackConfig = async (reason: string) => {
    if (!confirm(`לבצע rollback לקונפיגורציית ה-runtime?\nסיבה: ${reason}`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/responses/runtime/rollback", {
        method: "POST",
        headers: requestJsonHeaders,
        body: JSON.stringify({ reason, rollbackTo: "previous-stable" }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "ה-rollback נכשל.");
      }

      await loadRuntimeConfig();
      alert(`ה-rollback הושלם: ${data.message}`);
    } catch (err: any) {
      setError(err.message || "ה-rollback נכשל.");
    } finally {
      setLoading(false);
    }
  };

  const toggleRuntimeTool = async (toolName: string, nextEnabled: boolean) => {
    if (!runtimeConfig) return;

    const activeToolNames = new Set(runtimeConfig.enabledToolNames || []);
    if (nextEnabled) activeToolNames.add(toolName);
    else activeToolNames.delete(toolName);

    setSavingToolName(toolName);
    setError(null);

    try {
      const response = await fetch("/api/responses/runtime", {
        method: "POST",
        headers: requestJsonHeaders,
        body: JSON.stringify({
          enabledToolNames: Array.from(activeToolNames),
          reason: `${nextEnabled ? "enabled" : "disabled"} tool ${toolName} from admin panel`,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "עדכון בחירת הכלי נכשל.");
      }

      await loadRuntimeConfig();
    } catch (err: any) {
      setError(err.message || "עדכון בחירת הכלי נכשל.");
    } finally {
      setSavingToolName(null);
    }
  };

  const toggleConnector = async (connectorId: string, nextEnabled: boolean) => {
    setSavingConnectorId(connectorId);
    setError(null);

    try {
      const response = await fetch("/api/responses/runtime/connectors", {
        method: "PATCH",
        headers: requestJsonHeaders,
        body: JSON.stringify({
          connectorId,
          enabled: nextEnabled,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "עדכון הקונקטור נכשל.");
      }

      setInstructorConnectorCapabilities(Array.isArray(data.capabilities) ? data.capabilities : instructorConnectorCapabilities);
    } catch (err: any) {
      setError(err.message || "עדכון הקונקטור נכשל.");
    } finally {
      setSavingConnectorId(null);
    }
  };

  const copyAllFlagsOnBlock = async () => {
    if (!allFlagsOnEnvBlock) return;

    try {
      await navigator.clipboard.writeText(allFlagsOnEnvBlock);
      alert("כל משתני הסביבה הועתקו ללוח.");
    } catch (err: any) {
      setError(err?.message || "העתקת משתני הסביבה נכשלה.");
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.navigation}>
        <button onClick={() => (window.location.href = "/admin")} className={styles.backButton}>
          ← חזור לדשבורד ניהול
        </button>
      </div>

      <div className={styles.header}>
        <h1>מרכז בקרת Runtime</h1>
        <p>מסך אחד שמבהיר מה נשלט על ידי runtime config, מה נשלט על ידי feature flags, ומה תלוי גם בקונקטורים ובהרשאות.</p>
      </div>

      {error ? <div className={styles.error}>שגיאה: {error}</div> : null}

      {runtimeConfig ? (
        <section className={styles.overviewSection}>
          <div className={styles.sectionHeading}>
            <div>
              <h2>תמונת מצב</h2>
              <p>תמונת מצב מהירה של המודל, הכלים והגייטים הפעילים כרגע.</p>
            </div>
          </div>
          <div className={styles.overviewGrid}>
            {runtimeStatusItems.map((item) => (
              <div key={item.label} className={styles.overviewCard}>
                <span className={styles.overviewLabel}>{item.label}</span>
                <strong className={styles.overviewValue}>{item.value}</strong>
              </div>
            ))}
            <div className={styles.overviewCard}>
              <span className={styles.overviewLabel}>פיצ&apos;רים פעילים</span>
              <strong className={styles.overviewValue}>{enabledFeatureFlagCount}/{featureFlags.length}</strong>
            </div>
            <div className={styles.overviewCard}>
              <span className={styles.overviewLabel}>קונקטורים מוכנים</span>
              <strong className={styles.overviewValue}>{readyConnectorCount}/{instructorConnectorCapabilities.length}</strong>
            </div>
            <div className={styles.overviewCard}>
              <span className={styles.overviewLabel}>כלים חסומים ע&quot;י flag</span>
              <strong className={styles.overviewValue}>{blockedRuntimeToolCount}</strong>
            </div>
          </div>
          <p className={styles.helperText}>עדכון אחרון: {runtimeConfig.updatedAt || "לא זמין"} · מודל מומלץ כעת: {RECOMMENDED_RUNTIME_MODEL}</p>
        </section>
      ) : null}

      <section className={styles.guideSection}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>איך שולטים בכל שכבה?</h2>
            <p>החלוקה הזו היא המפתח להבין למה משהו מסומן פעיל או כבוי.</p>
          </div>
        </div>
        <div className={styles.guideGrid}>
          <div className={styles.guideCard}>
            <strong>כלי Runtime</strong>
            <p>נשלטים מתוך runtime config ונשמרים במסד הנתונים. כאן אפשר להדליק או לכבות כלי ברמת הצ&apos;אט הראשי.</p>
          </div>
          <div className={styles.guideCard}>
            <strong>Feature flags</strong>
            <p>כרגע נשלטים דרך משתני סביבה. שינוי דורש עדכון env והפעלה מחדש של השרת או deployment.</p>
          </div>
          <div className={styles.guideCard}>
            <strong>קונקטורים למדריך</strong>
            <p>נשלטים בשתי שכבות: FEATURE_OPENAI_CONNECTORS חייב להיות פעיל, ואז אפשר להדליק או לכבות כל קונקטור במניפסט.</p>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>קונפיגורציית Runtime</h2>
            <p>מודל, מקור קונפיגורציה ופעולות rollback/update כלליות.</p>
          </div>
        </div>
        {runtimeConfig ? (
          <div className={styles.infoPanel}>
            <div className={styles.infoRow}>
              <span>מצב API</span>
              <strong>{translateApiMode(apiMode)}</strong>
            </div>
            <div className={styles.infoRow}>
              <span>מודל</span>
              <strong>{runtimeConfig.model}</strong>
            </div>
            <div className={styles.infoRow}>
              <span>כלים פעילים</span>
              <strong>{enabledRuntimeToolCount}</strong>
            </div>
            <div className={styles.infoRow}>
              <span>מקור קונפיגורציה</span>
              <strong>{runtimeConfig.source === "db" ? "מסד נתונים" : "ברירת מחדל"}</strong>
            </div>
            <div className={styles.infoRow}>
              <span>עודכן בתאריך</span>
              <strong>{runtimeConfig.updatedAt || "לא זמין"}</strong>
            </div>
          </div>
        ) : (
          <p>טוען קונפיגורציה...</p>
        )}

        <div className={styles.actions}>
          <button onClick={applyRecommendedConfig} disabled={loading} className={styles.primaryButton}>
            {loading ? "מעדכן..." : `החל קונפיגורציה מומלצת (${RECOMMENDED_RUNTIME_MODEL})`}
          </button>
          <button onClick={() => rollbackConfig("Manual rollback from admin panel")} disabled={loading} className={styles.secondaryDangerButton}>
            {loading ? "מחזיר..." : "חזור לגרסה היציבה הקודמת"}
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>כלי Runtime של הצ&apos;אט הראשי</h2>
            <p>כאן שולטים בפועל על הכלים שנכנסים ל-runtime של `main_chat`.</p>
          </div>
          <span className={styles.inlineSummary}>{enabledRuntimeToolCount}/{availableTools.length} פעילים</span>
        </div>
        <p className={styles.sectionHint}>אם כלי חסום על ידי feature flag, קודם מפעילים את ה-flag בשכבת ה-env ורק אחר כך מפעילים אותו כאן.</p>
        {sortedAvailableTools.length ? (
          <div className={styles.controlGrid}>
            {sortedAvailableTools.map((tool) => {
              const canToggle = tool.runtimeEnabled;
              const isSaving = savingToolName === tool.name;

              return (
                <div key={tool.name} className={styles.controlCard}>
                  <div className={styles.cardHeader}>
                    <div>
                      <strong>{tool.name}</strong>
                      <p className={styles.cardDescription}>{translateToolDescription(tool.name, tool.description)}</p>
                    </div>
                    <span className={tool.enabled ? styles.badgeSuccess : styles.badgeNeutral}>
                      {tool.enabled ? "פעיל ב-runtime" : "כבוי ב-runtime"}
                    </span>
                  </div>

                  <div className={styles.badgeRow}>
                    <span className={styles.metaBadge}>{translateLifecycle(tool.lifecycle)}</span>
                    <span className={styles.metaBadge}>{translateRolloutPhase(tool.rolloutPhase)}</span>
                    <span className={styles.metaBadge}>תפקידים: {tool.allowedRoles.map(translateRole).join(", ")}</span>
                    <span className={styles.metaBadge}>לוגים: {translateLoggingSensitivity(tool.loggingSensitivity)}</span>
                  </div>

                  <div className={styles.cardMetaStack}>
                    <p>
                      שער הפעלה:{" "}
                      {tool.featureFlag ? (
                        <>
                          <code>{tool.featureFlag}</code> {tool.featureFlagEnabled ? "פעיל" : "כבוי"}
                        </>
                      ) : (
                        "ללא feature flag"
                      )}
                    </p>
                    {tool.statusNote ? <p>{translateToolStatusNote(tool.name, tool.statusNote)}</p> : null}
                    {!canToggle ? (
                      <p className={styles.warningText}>
                        צריך להפעיל קודם את <code>{tool.featureFlag}</code> כדי שהכלי יהיה ניתן לבחירה.
                      </p>
                    ) : null}
                  </div>

                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      disabled={!canToggle || isSaving}
                      onClick={() => toggleRuntimeTool(tool.name, !tool.enabled)}
                      className={tool.enabled ? styles.secondaryButton : styles.primaryButton}
                    >
                      {isSaving ? "שומר..." : tool.enabled ? "כבה מה-runtime" : "הפעל ב-runtime"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p>לא נמצאו כלים לניהול runtime.</p>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>Feature Flags</h2>
            <p>שכבת gating גלובלית. כרגע לקריאה בלבד מתוך המסך הזה.</p>
          </div>
        </div>
        <div className={styles.callout}>
          <strong>איך מחליפים:</strong> עדכנו את משתנה הסביבה המתאים, למשל <code>FEATURE_OPENAI_CONNECTORS=1</code>, ואז בצעו הפעלה מחדש לשרת או redeploy.
        </div>
        {featureFlags.length ? (
          <div className={styles.envBlockCard}>
            <div className={styles.cardHeader}>
              <div>
                <strong>כל משתני הסביבה כ-ON</strong>
                <p className={styles.cardDescription}>אפשר להעתיק את כל הדגלים הפעילים במכה אחת ולהדביק ל-<code>.env.local</code>.</p>
              </div>
            </div>
            <textarea
              className={styles.envTextarea}
              readOnly
              value={allFlagsOnEnvBlock}
              aria-label="All feature flags enabled env block"
            />
            <div className={styles.cardActions}>
              <button type="button" onClick={copyAllFlagsOnBlock} className={styles.primaryButton}>
                העתק את כל הבלוק
              </button>
            </div>
          </div>
        ) : null}
        {sortedFeatureFlags.length ? (
          <div className={styles.controlGrid}>
            {sortedFeatureFlags.map((flag) => (
              <div key={flag.name} className={styles.controlCard}>
                <div className={styles.cardHeader}>
                  <div>
                    <strong>{translateFeatureFlagLabel(flag.name)}</strong>
                    <p className={styles.cardDescription}>{translateFeatureFlagDescription(flag.name, flag.description)}</p>
                  </div>
                  <span className={flag.enabled ? styles.badgeSuccess : styles.badgeNeutral}>
                    {flag.enabled ? "פעיל" : "כבוי"}
                  </span>
                </div>

                <div className={styles.cardMetaStack}>
                  <p>ברירת מחדל: {formatDefaultValue(flag.defaultValue)}</p>
                  <p>שינוי דרך: <code>{flag.name}={flag.enabled ? "0" : "1"}</code></p>
                  <p>מקור: משתנה סביבה או ברירת מחדל</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>לא נמצאו feature flags.</p>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>קונקטורים למדריך</h2>
            <p>כאן רואים גם את הסטטוס האמיתי וגם את המניפסט ברמת כל קונקטור.</p>
          </div>
          <span className={styles.inlineSummary}>{readyConnectorCount}/{instructorConnectorCapabilities.length} מוכנים</span>
        </div>
        {!connectorFlag?.enabled ? (
          <div className={styles.calloutWarning}>
            <strong>FEATURE_OPENAI_CONNECTORS</strong> כבוי, ולכן אף קונקטור לא יכול להיות מוכן גם אם הוא מסומן כפעיל במניפסט.
          </div>
        ) : null}
        {sortedConnectors.length ? (
          <div className={styles.controlGrid}>
            {sortedConnectors.map((connector) => {
              const isSaving = savingConnectorId === connector.id;
              const statusClass =
                connector.status === "ready"
                  ? styles.badgeSuccess
                  : connector.status === "missing_authorization"
                    ? styles.badgeWarning
                    : styles.badgeNeutral;

              return (
                <div key={connector.id} className={styles.controlCard}>
                  <div className={styles.cardHeader}>
                    <div>
                      <strong>{translateConnectorLabel(connector.id, connector.label)}</strong>
                      <p className={styles.cardDescription}>{translateConnectorStatusDetail(connector.statusDetail)}</p>
                    </div>
                    <span className={statusClass}>{translateConnectorStatus(connector.status)}</span>
                  </div>

                  <div className={styles.badgeRow}>
                    <span className={styles.metaBadge}>{connector.delivery}</span>
                    <span className={styles.metaBadge}>מניפסט: {connector.enabled ? "פעיל" : "כבוי"}</span>
                    <span className={styles.metaBadge}>הרשאה: {connector.authConfigured ? "מוגדרת" : "חסרה"}</span>
                  </div>

                  <div className={styles.cardMetaStack}>
                    <p>כלים מותרים: {connector.allowedTools.join(", ")}</p>
                    <p>מקרי שימוש: {connector.useCases.join(", ")}</p>
                    <p>Scopes: {connector.oauthScopes.join(", ")}</p>
                    <p>{connector.implementationDecision}</p>
                  </div>

                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => toggleConnector(connector.id, !connector.enabled)}
                      className={connector.enabled ? styles.secondaryButton : styles.primaryButton}
                    >
                      {isSaving ? "שומר..." : connector.enabled ? "כבה במניפסט" : "הפעל במניפסט"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p>נתוני הדיאגנוסטיקה של הקונקטורים אינם זמינים.</p>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>סקירת Contexts</h2>
            <p>תצוגה קומפקטית יותר של ה-rollout matrix לפי context, בלי קירות של כרטיסים.</p>
          </div>
        </div>
        {toolRolloutMatrix.length ? (
          <div className={styles.contextGrid}>
            {toolRolloutMatrix.map((row) => {
              const runtimeOnCount = row.tools.filter((tool) => tool.runtimeEnabled).length;
              const gatedCount = row.tools.filter((tool) => tool.featureFlag && !tool.featureFlagEnabled).length;

              return (
                <div key={row.context} className={styles.contextCard}>
                  <div className={styles.cardHeader}>
                    <div>
                      <strong>{translateContextName(row.context)}</strong>
                      <p className={styles.cardDescription}>{translateBoundaryPurpose(row.boundary.purpose)}</p>
                    </div>
                    <span className={row.boundary.webSearchAllowed ? styles.badgeSuccess : styles.badgeNeutral}>
                      חיפוש ווב {row.boundary.webSearchAllowed ? "מותר" : "חסום"}
                    </span>
                  </div>

                  <div className={styles.contextStats}>
                    <div>
                      <span>סה&quot;כ כלים</span>
                      <strong>{row.tools.length}</strong>
                    </div>
                    <div>
                      <span>שער פתוח</span>
                      <strong>{runtimeOnCount}</strong>
                    </div>
                    <div>
                      <span>חסומים ע&quot;י flag</span>
                      <strong>{gatedCount}</strong>
                    </div>
                  </div>

                  <ul className={styles.boundaryNotes}>
                    {row.boundary.notes.map((note) => (
                      <li key={note}>{translateBoundaryNote(note)}</li>
                    ))}
                  </ul>

                  <div className={styles.toolChipWrap}>
                    {row.tools.map((tool) => (
                      <span key={`${row.context}-${tool.name}`} className={tool.runtimeEnabled ? styles.toolChipOn : styles.toolChipOff}>
                        {tool.name}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p>נתוני rollout של הכלים אינם זמינים.</p>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>תוכנית לוגים</h2>
            <p>לאן נשלחים לוגים של כלי runtime ו-hosted tools.</p>
          </div>
        </div>
        {toolUsageLoggingPlan ? (
          <div className={styles.infoPanel}>
            <div className={styles.infoRow}>
              <span>יעד</span>
              <strong>{toolUsageLoggingPlan.destination}</strong>
            </div>
            <ul className={styles.boundaryNotes}>
              {toolUsageLoggingPlan.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p>תוכנית הלוגים אינה זמינה.</p>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>בדיקות Runtime</h2>
            <p>בדיקות מהירות לאיכות תשובה, עברית והפעלת כלים.</p>
          </div>
        </div>
        <div className={styles.testButtons}>
          <button onClick={() => runTest("basic")} disabled={loading}>בדיקה בסיסית</button>
          <button onClick={() => runTest("hebrew")} disabled={loading}>בדיקת עברית</button>
          <button onClick={() => runTest("function_calling")} disabled={loading}>בדיקת כלים</button>
          <button onClick={() => runTest("complex_query")} disabled={loading}>בדיקת שאילתות מורכבות</button>
        </div>

        {testResults ? (
          <div className={styles.testResults}>
            <div className={`${styles.result} ${testResults.success ? styles.success : styles.failure}`}>
              <p><strong>סוג בדיקה:</strong> {testResults.testType}</p>
              <p><strong>מודל:</strong> {testResults.model}</p>
              <p><strong>זמן ריצה:</strong> {testResults.executionTimeMs}ms</p>
              <p><strong>איכות תגובה:</strong> {testResults.results.responseQuality}</p>
              <p><strong>הפעלת כלים:</strong> {testResults.results.functionCalling}</p>
              <p><strong>אורך תגובה:</strong> {testResults.results.responseLength} תווים</p>
              {testResults.preview ? (
                <p><strong>תצוגה מקדימה:</strong> {testResults.preview}</p>
              ) : null}

              {testResults.results.issues.length > 0 ? (
                <div className={styles.issues}>
                  <strong>בעיות:</strong>
                  <ul>
                    {testResults.results.issues.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>ניתוח שימוש (24 שעות אחרונות)</h2>
            <p>תמונה מהירה של נפח שימוש, טוקנים ועלות.</p>
          </div>
        </div>
        {usageAnalytics ? (
          <div className={styles.analyticsGrid}>
            <div className={styles.overviewCard}>
              <span className={styles.overviewLabel}>סה&quot;כ בקשות</span>
              <strong className={styles.overviewValue}>{usageAnalytics.totalRequests}</strong>
            </div>
            <div className={styles.overviewCard}>
              <span className={styles.overviewLabel}>סה&quot;כ טוקנים</span>
              <strong className={styles.overviewValue}>{usageAnalytics.totalTokens.toLocaleString()}</strong>
            </div>
            <div className={styles.overviewCard}>
              <span className={styles.overviewLabel}>עלות כוללת</span>
              <strong className={styles.overviewValue}>${usageAnalytics.totalCost.toFixed(4)}</strong>
            </div>
            <div className={styles.overviewCard}>
              <span className={styles.overviewLabel}>ממוצע טוקנים לבקשה</span>
              <strong className={styles.overviewValue}>{usageAnalytics.averageTokensPerRequest}</strong>
            </div>
            <div className={styles.overviewCard}>
              <span className={styles.overviewLabel}>ממוצע עלות לבקשה</span>
              <strong className={styles.overviewValue}>${usageAnalytics.averageCostPerRequest.toFixed(4)}</strong>
            </div>
          </div>
        ) : (
          <p>טוען נתוני שימוש...</p>
        )}

        {usageAnalytics && Object.keys(usageAnalytics.modelBreakdown).length > 0 ? (
          <div className={styles.modelBreakdown}>
            <h4>פירוט לפי מודל</h4>
            <div className={styles.modelBreakdownGrid}>
              {Object.entries(usageAnalytics.modelBreakdown).map(([model, stats]: [string, any]) => (
                <div key={model} className={styles.modelBreakdownCard}>
                  <strong>{model}</strong>
                  <p>{stats.requests} בקשות</p>
                  <p>{stats.tokens} טוקנים</p>
                  <p>${stats.cost.toFixed(4)}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default function ModelManagement() {
  return (
    <AdminShell>
      <ModelManagementContent />
    </AdminShell>
  );
}
