import { getAgentInstructions, getAgentModel, getAgentTools } from "@/app/agent-config";
import { COLLECTIONS, executeWithRetry } from "@/lib/database";
import { ResponsesToolDefinition } from "@/lib/openai/tools";

const RUNTIME_CONFIG_KEY = "responses_runtime_model_config";
const MAX_HISTORY_ITEMS = 10;

type RuntimeConfigDoc = {
  key: string;
  value: {
    model: string;
    instructions: string;
    enabledToolNames: string[];
  };
  history?: Array<{
    model: string;
    instructions: string;
    enabledToolNames: string[];
    updatedAt: string;
    reason?: string;
  }>;
  updatedAt?: Date;
  updatedBy?: string;
};

export type RuntimeAgentConfig = {
  model: string;
  instructions: string;
  tools: ResponsesToolDefinition[];
  enabledToolNames: string[];
  updatedAt?: string;
  source: "default" | "db";
  history: Array<{
    model: string;
    instructions: string;
    enabledToolNames: string[];
    updatedAt: string;
    reason?: string;
  }>;
};

declare global {
  // eslint-disable-next-line no-var
  var _runtimeAgentConfigCache:
    | { value: RuntimeAgentConfig; expiresAt: number }
    | undefined;
}

function normalizeToolNames(toolNames: string[] | undefined, availableTools: ResponsesToolDefinition[]) {
  const availableNames = new Set(availableTools.map((tool) => tool.name));
  const names = (toolNames || [])
    .map((name) => String(name || "").trim())
    .filter((name) => name.length > 0 && availableNames.has(name));

  return names.length ? names : availableTools.map((tool) => tool.name);
}

function resolveToolsFromNames(
  availableTools: ResponsesToolDefinition[],
  enabledToolNames: string[]
): ResponsesToolDefinition[] {
  const enabled = new Set(enabledToolNames);
  return availableTools.filter((tool) => enabled.has(tool.name));
}

function getDefaultConfig(): RuntimeAgentConfig {
  const defaultTools = getAgentTools();
  const enabledToolNames = defaultTools.map((tool) => tool.name);
  return {
    model: getAgentModel(),
    instructions: getAgentInstructions(),
    tools: defaultTools,
    enabledToolNames,
    source: "default",
    history: [],
  };
}

function clearRuntimeConfigCache() {
  globalThis._runtimeAgentConfigCache = undefined;
}

async function readConfigDoc(): Promise<RuntimeConfigDoc | null> {
  return executeWithRetry(async (db) => {
    const doc = await db.collection(COLLECTIONS.SEMESTER_CONFIG).findOne({
      key: RUNTIME_CONFIG_KEY,
    });
    return (doc as unknown as RuntimeConfigDoc | null) || null;
  });
}

function toRuntimeAgentConfig(doc: RuntimeConfigDoc | null): RuntimeAgentConfig {
  const defaults = getDefaultConfig();
  if (!doc?.value) {
    return defaults;
  }

  const enabledToolNames = normalizeToolNames(doc.value.enabledToolNames, defaults.tools);
  const tools = resolveToolsFromNames(defaults.tools, enabledToolNames);
  return {
    model: doc.value.model || defaults.model,
    instructions: doc.value.instructions || defaults.instructions,
    enabledToolNames,
    tools,
    updatedAt: doc.updatedAt?.toISOString(),
    source: "db",
    history: Array.isArray(doc.history) ? doc.history : [],
  };
}

export async function getRuntimeAgentConfig(forceRefresh = false): Promise<RuntimeAgentConfig> {
  if (process.env.NODE_ENV === "test") {
    return getDefaultConfig();
  }

  const cached = globalThis._runtimeAgentConfigCache;
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const doc = await readConfigDoc();
    const runtimeConfig = toRuntimeAgentConfig(doc);
    globalThis._runtimeAgentConfigCache = {
      value: runtimeConfig,
      expiresAt: Date.now() + 30_000,
    };
    return runtimeConfig;
  } catch (error: any) {
    console.warn("[runtime-config] failed to read runtime config, using defaults:", error?.message || error);
    const defaults = getDefaultConfig();
    globalThis._runtimeAgentConfigCache = {
      value: defaults,
      expiresAt: Date.now() + 10_000,
    };
    return defaults;
  }
}

type UpdateRuntimeConfigInput = {
  model?: string;
  instructions?: string;
  enabledToolNames?: string[];
  updatedBy?: string;
  reason?: string;
};

export async function updateRuntimeAgentConfig(input: UpdateRuntimeConfigInput) {
  const defaults = getDefaultConfig();

  const config = await executeWithRetry(async (db) => {
    const collection = db.collection(COLLECTIONS.SEMESTER_CONFIG);
    const currentDoc = (await collection.findOne({
      key: RUNTIME_CONFIG_KEY,
    })) as unknown as RuntimeConfigDoc | null;
    const current = toRuntimeAgentConfig(currentDoc);
    const nowIso = new Date().toISOString();

    const enabledToolNames = normalizeToolNames(
      input.enabledToolNames || current.enabledToolNames,
      defaults.tools
    );

    const nextValue = {
      model: (input.model || current.model || defaults.model).trim(),
      instructions: (input.instructions || current.instructions || defaults.instructions).trim(),
      enabledToolNames,
    };

    const priorSnapshot = {
      model: current.model,
      instructions: current.instructions,
      enabledToolNames: current.enabledToolNames,
      updatedAt: nowIso,
      reason: input.reason || "runtime config update",
    };

    const history = [...(current.history || []), priorSnapshot].slice(-MAX_HISTORY_ITEMS);

    await collection.updateOne(
      { key: RUNTIME_CONFIG_KEY },
      {
        $set: {
          key: RUNTIME_CONFIG_KEY,
          value: nextValue,
          history,
          updatedAt: new Date(),
          updatedBy: input.updatedBy || "admin",
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    const updatedDoc = (await collection.findOne({
      key: RUNTIME_CONFIG_KEY,
    })) as unknown as RuntimeConfigDoc | null;
    return toRuntimeAgentConfig(updatedDoc);
  });

  clearRuntimeConfigCache();
  return config;
}

export async function rollbackRuntimeAgentConfig(targetModel?: string, reason?: string) {
  const current = await getRuntimeAgentConfig(true);

  if (targetModel && targetModel !== "previous-stable") {
    return updateRuntimeAgentConfig({
      model: targetModel,
      reason: reason || `rollback to ${targetModel}`,
      updatedBy: "admin-rollback",
    });
  }

  const lastConfig = [...current.history].pop();
  if (!lastConfig) {
    return current;
  }

  return updateRuntimeAgentConfig({
    model: lastConfig.model,
    instructions: lastConfig.instructions,
    enabledToolNames: lastConfig.enabledToolNames,
    reason: reason || "rollback to previous stable config",
    updatedBy: "admin-rollback",
  });
}
