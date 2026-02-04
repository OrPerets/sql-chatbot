import { getAgentInstructions, getAgentModel, getAgentTools } from "@/app/agent-config";
import { getOpenAIApiMode } from "@/lib/openai/api-mode";
import { getRuntimeAgentConfig, updateRuntimeAgentConfig } from "@/lib/openai/runtime-config";

export const runtime = "nodejs";

const RECOMMENDED_MODEL = "gpt-4.1-mini";

type UpdatePayload = {
  model?: string;
  instructions?: string;
  enabledToolNames?: string[];
  reason?: string;
};

export async function POST(request: Request) {
  try {
    const body = ((await request.json().catch(() => ({}))) || {}) as UpdatePayload;
    const defaultTools = getAgentTools();
    const fallbackToolNames = defaultTools.map((tool) => tool.name);

    const nextConfig = await updateRuntimeAgentConfig({
      model: (body.model || RECOMMENDED_MODEL).trim(),
      instructions: body.instructions || getAgentInstructions(),
      enabledToolNames: body.enabledToolNames || fallbackToolNames,
      updatedBy: "admin-model-management",
      reason: body.reason || "manual model config update",
    });

    return Response.json({
      success: true,
      mode: getOpenAIApiMode(),
      config: {
        model: nextConfig.model,
        enabledToolNames: nextConfig.enabledToolNames,
        toolsCount: nextConfig.tools.length,
        updatedAt: nextConfig.updatedAt || new Date().toISOString(),
      },
      message: `Model configuration updated to ${nextConfig.model}`,
      compatibility: {
        route: "/api/assistants/update",
        apiLifecycle: "responses_runtime_config",
      },
    });
  } catch (error: any) {
    console.error("Model config update error:", error);
    return Response.json(
      {
        success: false,
        mode: getOpenAIApiMode(),
        error: error?.message || "Failed to update runtime model config.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const runtimeConfig = await getRuntimeAgentConfig();
    const availableTools = getAgentTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      enabled: runtimeConfig.enabledToolNames.includes(tool.name),
    }));

    return Response.json({
      success: true,
      mode: getOpenAIApiMode(),
      config: {
        model: runtimeConfig.model,
        instructions: runtimeConfig.instructions,
        enabledToolNames: runtimeConfig.enabledToolNames,
        toolsCount: runtimeConfig.tools.length,
        updatedAt: runtimeConfig.updatedAt || null,
        source: runtimeConfig.source,
      },
      defaults: {
        model: getAgentModel(),
        toolsCount: getAgentTools().length,
      },
      availableTools,
      compatibility: {
        route: "/api/assistants/update",
        apiLifecycle: "responses_runtime_config",
      },
    });
  } catch (error: any) {
    return Response.json(
      {
        success: false,
        mode: getOpenAIApiMode(),
        error: error?.message || "Failed to load model configuration.",
      },
      { status: 500 }
    );
  }
}
