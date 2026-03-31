export type OpenAIFeatureFlagName =
  | "FEATURE_OPENAI_WEB_SEARCH"
  | "FEATURE_OPENAI_CONNECTORS"
  | "FEATURE_RESPONSES_BACKGROUND"
  | "FEATURE_PERSONALIZATION_TOOLS";

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
