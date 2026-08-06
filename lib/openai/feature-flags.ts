export type OpenAIFeatureFlagName =
  | "FEATURE_OPENAI_WEB_SEARCH"
  | "FEATURE_OPENAI_CONNECTORS"
  | "FEATURE_RESPONSES_BACKGROUND"
  | "FEATURE_PERSONALIZATION_TOOLS"
  | "FF_FILE_SEARCH"
  | "FF_TOOL_SEARCH_MCP"
  | "FF_REALTIME_VOICE"
  | "FF_BACKGROUND_MODE"
  | "FF_BATCH_JOBS"
  | "FF_SKILL_SQL_DEBUGGER"
  | "FF_SKILL_RUBRIC_GRADER"
  | "FF_SKILL_MISCONCEPTION_COACH"
  | "FF_SKILL_OFFICE_HOURS_SIMULATOR"
  | "FF_SKILL_ASSESSMENT_AUDITOR"
  | "FF_SKILL_STUDENT_PROGRESS_ANALYST";

type FeatureFlagDefinition = {
  name: OpenAIFeatureFlagName;
  defaultValue: boolean;
  description: string;
};

const FEATURE_FLAG_DEFINITIONS: FeatureFlagDefinition[] = [
  {
    name: "FEATURE_OPENAI_WEB_SEARCH",
    defaultValue: false,
    description: "Enables hosted OpenAI web search for admin-only Responses API flows.",
  },
  {
    name: "FEATURE_OPENAI_CONNECTORS",
    defaultValue: false,
    description: "Enables instructor-facing connector and MCP preparation surfaces.",
  },
  {
    name: "FEATURE_RESPONSES_BACKGROUND",
    defaultValue: false,
    description: "Enables background Responses API job execution paths.",
  },
  {
    name: "FEATURE_PERSONALIZATION_TOOLS",
    defaultValue: true,
    description: "Keeps student personalization tools available while future rollout controls are added.",
  },
  {
    name: "FF_FILE_SEARCH",
    defaultValue: true,
    description: "Sprint 0 rollout flag for retrieval-native File Search.",
  },
  {
    name: "FF_TOOL_SEARCH_MCP",
    defaultValue: false,
    description: "Sprint 0 rollout flag for dynamic tool search and remote MCP routing.",
  },
  {
    name: "FF_REALTIME_VOICE",
    defaultValue: false,
    description: "Sprint 0 rollout flag for realtime voice tutoring surfaces.",
  },
  {
    name: "FF_BACKGROUND_MODE",
    defaultValue: false,
    description: "Sprint 0 rollout flag for asynchronous/background request handling.",
  },
  {
    name: "FF_BATCH_JOBS",
    defaultValue: false,
    description: "Sprint 0 rollout flag for batched non-urgent AI workloads.",
  },
  {
    name: "FF_SKILL_SQL_DEBUGGER",
    defaultValue: false,
    description: "Sprint 0 rollout flag for the sql-debugger skill.",
  },
  {
    name: "FF_SKILL_RUBRIC_GRADER",
    defaultValue: false,
    description: "Sprint 0 rollout flag for the rubric-grader skill.",
  },
  {
    name: "FF_SKILL_MISCONCEPTION_COACH",
    defaultValue: false,
    description: "Sprint 0 rollout flag for the misconception-coach skill.",
  },
  {
    name: "FF_SKILL_OFFICE_HOURS_SIMULATOR",
    defaultValue: false,
    description: "Sprint 0 rollout flag for the office-hours-simulator skill.",
  },
  {
    name: "FF_SKILL_ASSESSMENT_AUDITOR",
    defaultValue: false,
    description: "Sprint 0 rollout flag for the assessment-auditor skill.",
  },
  {
    name: "FF_SKILL_STUDENT_PROGRESS_ANALYST",
    defaultValue: false,
    description: "Sprint 0 rollout flag for the student-progress-analyst skill.",
  },
];

function parseBooleanFlag(rawValue: string | undefined, defaultValue: boolean): boolean {
  if (!rawValue) {
    return defaultValue;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

export function getOpenAIFeatureFlag(flagName: OpenAIFeatureFlagName): boolean {
  const definition = FEATURE_FLAG_DEFINITIONS.find((entry) => entry.name === flagName);
  if (!definition) {
    return false;
  }

  return parseBooleanFlag(process.env[flagName], definition.defaultValue);
}

export function getOpenAIFeatureFlags() {
  return FEATURE_FLAG_DEFINITIONS.map((definition) => ({
    ...definition,
    enabled: getOpenAIFeatureFlag(definition.name),
  }));
}
