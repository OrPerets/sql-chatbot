import { agentConfig, getAgentModel, getCompatibilityAssistantId } from "@/app/agent-config";

// Legacy compatibility exports used by Assistants API routes.
export let assistantId = agentConfig.compatibility.assistantId;
export let assistantIdGPT5 = agentConfig.compatibility.assistantIdGpt5;

export const useLatestModel = process.env.USE_LATEST_MODEL === "true";
export const useGPT5 = agentConfig.compatibility.useGpt5Assistant;

export const getAssistantId = (): string => getCompatibilityAssistantId();
export const getCurrentModel = (): string => getAgentModel();

export const assistantConfig = {
  getCurrentAssistantId: getAssistantId,
  getCurrentModel,
  isUsingLatestModel: useLatestModel,
  isUsingGPT5: useGPT5 && !!assistantIdGPT5,
};
