import { createResponse, extractOutputText, runToolLoop } from "@/lib/openai/responses-client";
import { getOpenAIApiMode } from "@/lib/openai/api-mode";
import { getRuntimeAgentConfig } from "@/lib/openai/runtime-config";

export const runtime = "nodejs";

type TestPayload = {
  testQuery?: string;
  testType?: string;
  model?: string;
};

type ToolCallOutput = {
  type?: string;
  name?: string;
};

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

export async function POST(req: Request) {
  const startedAt = Date.now();

  try {
    const body = ((await req.json().catch(() => ({}))) || {}) as TestPayload;
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
      testType,
      testQuery,
      model,
      responseId: response?.id || null,
      executionTimeMs: Date.now() - startedAt,
      results,
      preview: outputText.slice(0, 500),
      timestamp: new Date().toISOString(),
      compatibility: {
        route: "/api/assistants/test",
        apiLifecycle: "responses_runtime_validation",
      },
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

export async function GET() {
  try {
    const runtimeConfig = await getRuntimeAgentConfig();

    return Response.json({
      success: true,
      mode: getOpenAIApiMode(),
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
      compatibility: {
        route: "/api/assistants/test",
        apiLifecycle: "responses_runtime_validation",
      },
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
