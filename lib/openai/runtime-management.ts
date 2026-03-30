import {
  getAgentInstructions,
  getAgentModel,
  getAgentToolCatalog,
  getAgentTools,
} from "@/app/agent-config";
import { getOpenAIApiMode } from "@/lib/openai/api-mode";
import {
  RECOMMENDED_RUNTIME_MODEL,
  RUNTIME_ROLLBACK_TARGETS,
} from "@/lib/openai/model-registry";
import { createResponse, extractOutputText, runToolLoop } from "@/lib/openai/responses-client";
import {
  getRuntimeAgentConfig,
  rollbackRuntimeAgentConfig,
  updateRuntimeAgentConfig,
} from "@/lib/openai/runtime-config";

type RuntimeRouteFlavor = "canonical" | "assistants_alias";

type UpdatePayload = {
  model?: string;
  instructions?: string;
  enabledToolNames?: string[];
  reason?: string;
};

type RollbackPayload = {
  reason?: string;
  rollbackTo?: string;
};

type TestPayload = {
  testQuery?: string;
  testType?: string;
  model?: string;
};

type ToolCallOutput = {
  type?: string;
  name?: string;
};

function getRouteMetadata(flavor: RuntimeRouteFlavor, capability: "config" | "validate" | "rollback") {
  const canonicalRoute =
    capability === "config"
      ? "/api/responses/runtime"
      : capability === "validate"
        ? "/api/responses/runtime/validate"
        : "/api/responses/runtime/rollback";

  const route =
    flavor === "canonical"
      ? canonicalRoute
      : capability === "config"
        ? "/api/assistants/update"
        : capability === "validate"
          ? "/api/assistants/test"
          : "/api/assistants/rollback";

  return {
    route,
    canonicalRoute,
    deprecatedAlias: flavor !== "canonical",
    apiLifecycle: `responses_runtime_${capability}`,
  };
}

function logDeprecatedAlias(flavor: RuntimeRouteFlavor, route: string) {
  if (flavor !== "canonical") {
    console.warn(`[deprecated-openai-route] ${route} called. Use /api/responses/runtime routes instead.`);
  }
}

function getDefaultTestQuery(testType?: string): string {
  switch (testType) {
    case "course_context":
      return "מה המיקוד של חומר הלימוד בשבוע הנוכחי?";
    case "hebrew":
      return "בבקשה הסבר מה זה JOIN בSQL ותן דוגמה פשוטה.";
    case "function_calling":
      return "Please run get_course_week_context and summarize allowed SQL concepts for this week.";
    case "complex_query":
      return "Analyze and optimize this query: SELECT s.name, c.title FROM students s JOIN courses c ON c.id = s.course_id;";
    case "image_analysis":
      return "I uploaded SQL screenshots. Explain how you would analyze schema and errors.";
    default:
      return "Explain the difference between INNER JOIN and LEFT JOIN in SQL with a simple example.";
  }
}

function analyzeTestResults(responseText: string, outputs: ToolCallOutput[], testType?: string) {
  const containsHebrew = /[\u0590-\u05FF]/.test(responseText);
  const containsExample = /SELECT|FROM|WHERE|JOIN/i.test(responseText);
  const responseLength = responseText.length;
  const functionCallsCount = outputs.filter((item) => item?.type === "function_call").length;

  const issues: string[] = [];
  if (responseLength < 60) {
    issues.push("Response is shorter than expected.");
  }
  if (testType === "hebrew" && !containsHebrew) {
    issues.push("Hebrew language test failed: no Hebrew text detected.");
  }
  if (testType === "function_calling" && functionCallsCount === 0) {
    issues.push("No function call was emitted during function_calling test.");
  }

  return {
    success: issues.length === 0,
    responseQuality: responseLength > 140 ? "good" : responseLength > 80 ? "acceptable" : "poor",
    languageSupport: containsHebrew ? "hebrew-detected" : "english-only",
    functionCalling:
      functionCallsCount > 0 ? "triggered" : testType === "function_calling" ? "not_triggered" : "not_tested",
    functionCallsCount,
    responseLength,
    containsExample,
    containsHebrew,
    issues,
  };
}

export async function handleRuntimeConfigPost(request: Request, flavor: RuntimeRouteFlavor) {
  const metadata = getRouteMetadata(flavor, "config");
  logDeprecatedAlias(flavor, metadata.route);

  try {
    const body = ((await request.json().catch(() => ({}))) || {}) as UpdatePayload;
    const defaultTools = getAgentTools();
    const fallbackToolNames = defaultTools.map((tool) => tool.name);

    const nextConfig = await updateRuntimeAgentConfig({
      model: (body.model || RECOMMENDED_RUNTIME_MODEL).trim(),
      instructions: body.instructions || getAgentInstructions(),
      enabledToolNames: body.enabledToolNames || fallbackToolNames,
      updatedBy: "admin-model-management",
      reason: body.reason || "manual model config update",
    });

    return Response.json({
      success: true,
      mode: getOpenAIApiMode(),
      label: "OpenAI runtime config",
      config: {
        model: nextConfig.model,
        enabledToolNames: nextConfig.enabledToolNames,
        toolsCount: nextConfig.tools.length,
        updatedAt: nextConfig.updatedAt || new Date().toISOString(),
      },
      message: `Runtime configuration updated to ${nextConfig.model}`,
      compatibility: metadata,
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

export async function handleRuntimeConfigGet(flavor: RuntimeRouteFlavor) {
  const metadata = getRouteMetadata(flavor, "config");
  logDeprecatedAlias(flavor, metadata.route);

  try {
    const runtimeConfig = await getRuntimeAgentConfig();
    const availableTools = getAgentToolCatalog("main_chat").map((entry) => ({
      name: entry.schema.name,
      description: entry.schema.description,
      enabled: runtimeConfig.enabledToolNames.includes(entry.schema.name),
      lifecycle: entry.lifecycle,
      enabledContexts: entry.enabledContexts,
      statusNote: entry.statusNote || null,
    }));

    return Response.json({
      success: true,
      mode: getOpenAIApiMode(),
      label: "OpenAI runtime config",
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
      compatibility: metadata,
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

export async function handleRuntimeRollbackPost(request: Request, flavor: RuntimeRouteFlavor) {
  const metadata = getRouteMetadata(flavor, "rollback");
  logDeprecatedAlias(flavor, metadata.route);

  try {
    const body = ((await request.json().catch(() => ({}))) || {}) as RollbackPayload;
    const rollbackTo = body.rollbackTo || "previous-stable";

    if (!RUNTIME_ROLLBACK_TARGETS.includes(rollbackTo as (typeof RUNTIME_ROLLBACK_TARGETS)[number])) {
      return Response.json(
        {
          success: false,
          mode: getOpenAIApiMode(),
          error: `Invalid rollback target. Valid options: ${RUNTIME_ROLLBACK_TARGETS.join(", ")}`,
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
      label: "OpenAI runtime rollback",
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
      compatibility: metadata,
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

export async function handleRuntimeRollbackGet(flavor: RuntimeRouteFlavor) {
  const metadata = getRouteMetadata(flavor, "rollback");
  logDeprecatedAlias(flavor, metadata.route);

  try {
    const current = await getRuntimeAgentConfig();

    return Response.json({
      success: true,
      mode: getOpenAIApiMode(),
      label: "OpenAI runtime rollback",
      status: "ready",
      config: {
        model: current.model,
        toolsCount: current.tools.length,
        updatedAt: current.updatedAt || null,
      },
      rollbackOptions: {
        available: true,
        targets: RUNTIME_ROLLBACK_TARGETS,
        recommendedTarget: "previous-stable",
      },
      historyDepth: current.history.length,
      compatibility: metadata,
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

export async function handleRuntimeRollbackHealth(flavor: RuntimeRouteFlavor) {
  const metadata = getRouteMetadata(flavor, "rollback");
  logDeprecatedAlias(flavor, metadata.route);

  const checks = {
    runtimeConfigReadable: false,
    responsesCreateCall: false,
    overall: "unhealthy" as "healthy" | "unhealthy",
  };

  try {
    const config = await getRuntimeAgentConfig(true);
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
        route: metadata.route,
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
      compatibility: metadata,
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

export async function handleRuntimeValidatePost(request: Request, flavor: RuntimeRouteFlavor) {
  const metadata = getRouteMetadata(flavor, "validate");
  logDeprecatedAlias(flavor, metadata.route);
  const startedAt = Date.now();

  try {
    const body = ((await request.json().catch(() => ({}))) || {}) as TestPayload;
    const testType = body.testType || "basic";
    const testQuery = body.testQuery || getDefaultTestQuery(testType);
    const runtimeConfig = await getRuntimeAgentConfig();
    const model = body.model || runtimeConfig.model;

    const input = [
      {
        role: "user",
        content: [{ type: "input_text", text: testQuery }],
      },
    ];

    const response =
      testType === "function_calling" || testType === "course_context"
        ? await runToolLoop({ input, model, maxIterations: 6 })
        : await createResponse({ input, model });

    const outputText = extractOutputText(response);
    const outputs = Array.isArray(response?.output) ? response.output : [];
    const results = analyzeTestResults(outputText, outputs, testType);

    return Response.json({
      success: true,
      mode: getOpenAIApiMode(),
      label: "OpenAI runtime validation",
      testType,
      testQuery,
      model,
      responseId: response?.id || null,
      executionTimeMs: Date.now() - startedAt,
      results,
      preview: outputText.slice(0, 500),
      timestamp: new Date().toISOString(),
      compatibility: metadata,
    });
  } catch (error: any) {
    console.error("Model config test error:", error);
    return Response.json(
      {
        success: false,
        mode: getOpenAIApiMode(),
        error: error?.message || "Model test failed.",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function handleRuntimeValidateGet(flavor: RuntimeRouteFlavor) {
  const metadata = getRouteMetadata(flavor, "validate");
  logDeprecatedAlias(flavor, metadata.route);

  try {
    const runtimeConfig = await getRuntimeAgentConfig();

    return Response.json({
      success: true,
      mode: getOpenAIApiMode(),
      label: "OpenAI runtime validation",
      config: {
        model: runtimeConfig.model,
        toolsCount: runtimeConfig.tools.length,
        updatedAt: runtimeConfig.updatedAt || null,
      },
      availableTests: [
        { type: "basic", description: "Basic SQL tutoring response quality." },
        { type: "hebrew", description: "Hebrew language support." },
        { type: "function_calling", description: "Tool-loop/function calling behavior." },
        { type: "course_context", description: "Course-week context tool usage." },
        { type: "complex_query", description: "Complex SQL explanation quality." },
      ],
      status: "ready",
      compatibility: metadata,
    });
  } catch (error: any) {
    return Response.json(
      {
        success: false,
        mode: getOpenAIApiMode(),
        error: error?.message || "Failed to fetch test status.",
      },
      { status: 500 }
    );
  }
}
