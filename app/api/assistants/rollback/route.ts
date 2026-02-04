import { createResponse, extractOutputText } from "@/lib/openai/responses-client";
import { getOpenAIApiMode } from "@/lib/openai/api-mode";
import {
  getRuntimeAgentConfig,
  rollbackRuntimeAgentConfig,
} from "@/lib/openai/runtime-config";

export const runtime = "nodejs";

const DEFAULT_ROLLBACK_TARGET = "gpt-4.1-mini";
const VALID_TARGETS = ["gpt-4.1-mini", "gpt-4o-mini", "gpt-4o", "previous-stable"];

type RollbackPayload = {
  reason?: string;
  rollbackTo?: string;
};

export async function POST(req: Request) {
  try {
    const body = ((await req.json().catch(() => ({}))) || {}) as RollbackPayload;
    const rollbackTo = body.rollbackTo || DEFAULT_ROLLBACK_TARGET;

    if (!VALID_TARGETS.includes(rollbackTo)) {
      return Response.json(
        {
          success: false,
          mode: getOpenAIApiMode(),
          error: `Invalid rollback target. Valid options: ${VALID_TARGETS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const before = await getRuntimeAgentConfig();
    const after = await rollbackRuntimeAgentConfig(
      rollbackTo === "previous-stable" ? "previous-stable" : rollbackTo,
      body.reason || "manual rollback from admin panel"
    );

    return Response.json({
      success: true,
      mode: getOpenAIApiMode(),
      message: `Runtime config rolled back to ${after.model}`,
      rollback: {
        reason: body.reason || "manual rollback",
        previousModel: before.model,
        rolledBackTo: after.model,
        timestamp: new Date().toISOString(),
      },
      config: {
        model: after.model,
        toolsCount: after.tools.length,
        updatedAt: after.updatedAt || new Date().toISOString(),
      },
      compatibility: {
        route: "/api/assistants/rollback",
        apiLifecycle: "responses_runtime_rollback",
      },
    });
  } catch (error: any) {
    console.error("Runtime rollback failed:", error);
    return Response.json(
      {
        success: false,
        mode: getOpenAIApiMode(),
        error: error?.message || "Rollback failed.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const current = await getRuntimeAgentConfig();

    return Response.json({
      success: true,
      mode: getOpenAIApiMode(),
      status: "ready",
      config: {
        model: current.model,
        toolsCount: current.tools.length,
        updatedAt: current.updatedAt || null,
      },
      rollbackOptions: {
        available: true,
        targets: VALID_TARGETS,
        recommendedTarget: DEFAULT_ROLLBACK_TARGET,
      },
      historyDepth: current.history.length,
      compatibility: {
        route: "/api/assistants/rollback",
        apiLifecycle: "responses_runtime_rollback",
      },
    });
  } catch (error: any) {
    return Response.json(
      {
        success: false,
        mode: getOpenAIApiMode(),
        error: error?.message || "Failed to read rollback status.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH() {
  const checks = {
    runtimeConfigReadable: false,
    responsesCreateCall: false,
    overall: "unhealthy" as "healthy" | "unhealthy",
  };

  try {
    const config = await getRuntimeAgentConfig();
    checks.runtimeConfigReadable = Boolean(config.model);

    const response = await createResponse({
      model: config.model,
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: "Health check: respond with one short sentence." }],
        },
      ],
      metadata: {
        route: "/api/assistants/rollback",
        check: "health",
      },
    });

    checks.responsesCreateCall = Boolean(extractOutputText(response));
    checks.overall = checks.runtimeConfigReadable && checks.responsesCreateCall ? "healthy" : "unhealthy";

    return Response.json({
      success: true,
      mode: getOpenAIApiMode(),
      systemHealth: checks,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return Response.json(
      {
        success: false,
        mode: getOpenAIApiMode(),
        systemHealth: checks,
        error: error?.message || "Health check failed.",
      },
      { status: 500 }
    );
  }
}
