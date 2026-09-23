import { getDefaultTutorModel } from "@/lib/openai/model-registry";
import {
  MichaelToolDefinition,
  MichaelToolContext,
  ToolCatalogEntry,
  getToolCatalog,
  getToolSchemas,
} from "@/lib/openai/tools";

const DEFAULT_MODEL = getDefaultTutorModel();

export type AgentConfig = {
  model: string;
  instructions: string;
  tools: MichaelToolDefinition[];
  featureFlags: {
    apiMode: "assistants" | "responses";
    useHomeworkSqlMode: boolean;
  };
  compatibility: {
    assistantId: string;
    assistantIdGpt5: string;
    useGpt5Assistant: boolean;
  };
};

const assistantIdFromEnv = process.env.OPENAI_ASSISTANT_ID || "asst_9bDfXIUHAqyYGa6SZgzBjE87";
const assistantIdGpt5 = process.env.OPENAI_ASSISTANT_ID_GPT5 || "";
const useGpt5Assistant = process.env.USE_GPT5_ASSISTANT === "true";

export const agentConfig: AgentConfig = {
  model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
  instructions: `You are Michael, a SQL teaching assistant for academic courses. 
Always keep explanations clear, practical, and student-friendly.
When SQL curriculum timing matters, use get_course_week_context before giving SQL examples.
Prefer safe educational examples and avoid destructive SQL.`,
  tools: getToolSchemas({ context: "main_chat" }),
  featureFlags: {
    apiMode: process.env.OPENAI_API_MODE === "assistants" ? "assistants" : "responses",
    useHomeworkSqlMode: process.env.HOMEWORK_SQL_MODE === "true",
  },
  compatibility: {
    assistantId: assistantIdFromEnv,
    assistantIdGpt5,
    useGpt5Assistant,
  },
};

export function getAgentModel(): string {
  return agentConfig.model || DEFAULT_MODEL;
}

export function getAgentInstructions(): string {
  return agentConfig.instructions;
}

export function getAgentTools() {
  return agentConfig.tools;
}

export function getAgentToolsForContext(context: MichaelToolContext) {
  return getToolSchemas({ context });
}

export function getAgentToolCatalog(context?: MichaelToolContext): ToolCatalogEntry[] {
  return getToolCatalog({
    context,
    includeExperimental: true,
    includeDisabled: true,
  });
}

export function getCompatibilityAssistantId(): string {
  if (agentConfig.compatibility.useGpt5Assistant && agentConfig.compatibility.assistantIdGpt5) {
    return agentConfig.compatibility.assistantIdGpt5;
  }
  return agentConfig.compatibility.assistantId;
}
