import { NextRequest } from "next/server";
import { openai } from "@/app/openai";
import { getAssistantId, getCurrentModel, assistantConfig } from "@/app/assistant-config";

export const runtime = "nodejs";

// Test endpoint to verify model compatibility and functionality
export async function POST(req: NextRequest) {
  try {
    const { testQuery, testType } = await req.json();
    
    const currentAssistantId = getAssistantId();
    const currentModel = getCurrentModel();
    
    console.log(`Testing ${currentModel} with assistant ${currentAssistantId}`);
    
    // Create a test thread
    const thread = await openai.beta.threads.create({
      metadata: {
        purpose: "model_compatibility_test",
        model: currentModel,
        timestamp: new Date().toISOString()
      }
    });

    const testMessage = testQuery || getDefaultTestQuery(testType);
    
    // Add test message
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: testMessage
    });

    // Run the assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: currentAssistantId,
      metadata: {
        test_type: testType || "basic",
        model: currentModel
      }
    });

    // Wait for completion with timeout
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    
    while (runStatus.status === "in_progress" || runStatus.status === "queued") {
      if (Date.now() - startTime > maxWaitTime) {
        throw new Error("Test timeout: Assistant took too long to respond");
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    // Get the response
    const messages = await openai.beta.threads.messages.list(thread.id);
    const assistantMessage = messages.data.find(msg => msg.role === "assistant");
    
    // Cleanup test thread
    await openai.beta.threads.del(thread.id);

    // Analyze test results
    const testResults = analyzeTestResults(runStatus, assistantMessage, testType);

    return Response.json({
      success: true,
      model: currentModel,
      assistantId: currentAssistantId,
      testType: testType || "basic",
      testQuery: testMessage,
      runStatus: runStatus.status,
      executionTime: `${(Date.now() - startTime) / 1000}s`,
      results: testResults,
      configuration: {
        isUsingLatestModel: assistantConfig.isUsingLatestModel,
        isUsingGPT5: assistantConfig.isUsingGPT5
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Model test error:", error);
    return Response.json({
      success: false,
      error: error.message,
      model: getCurrentModel(),
      assistantId: getAssistantId(),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Get test status and available test types
export async function GET() {
  try {
    const currentAssistantId = getAssistantId();
    const assistant = await openai.beta.assistants.retrieve(currentAssistantId);
    
    return Response.json({
      assistantId: currentAssistantId,
      model: assistant.model,
      name: assistant.name,
      toolsCount: assistant.tools?.length || 0,
      configuration: assistantConfig,
      availableTests: [
        {
          type: "basic",
          description: "Test basic SQL explanation capabilities"
        },
        {
          type: "hebrew",
          description: "Test Hebrew language support for SQL education"
        },
        {
          type: "function_calling",
          description: "Test SQL function calling capabilities"
        },
        {
          type: "course_context",
          description: "Test course week context function calling"
        },
        {
          type: "image_analysis",
          description: "Test image analysis for SQL content"
        },
        {
          type: "complex_query",
          description: "Test complex SQL query analysis and optimization"
        }
      ],
      status: "ready",
      lastChecked: new Date().toISOString()
    });

  } catch (error: any) {
    return Response.json({
      error: error.message,
      status: "error"
    }, { status: 500 });
  }
}

function getDefaultTestQuery(testType?: string): string {
  switch (testType) {
    case "course_context":
      return "What is the focus of this week's course material?";
    case "hebrew":
      return "בבקשה הסבר מה זה JOIN בSQL ותן דוגמה פשוטה";
    
    case "function_calling":
      return "Can you analyze this SQL query for performance: SELECT * FROM students WHERE name LIKE '%John%'";
    
    case "complex_query":
      return `Analyze and optimize this query:
        SELECT s.name, c.title, e.grade 
        FROM students s 
        JOIN enrollments e ON s.id = e.student_id 
        JOIN courses c ON e.course_id = c.id 
        WHERE s.created_at > '2024-01-01' 
        ORDER BY e.grade DESC`;
    
    case "image_analysis":
      return "I will upload an image with SQL content. Please analyze it for database design patterns.";
    
    default:
      return "Explain the difference between INNER JOIN and LEFT JOIN in SQL with a simple example.";
  }
}

function analyzeTestResults(runStatus: any, assistantMessage: any, testType?: string) {
  const results = {
    success: false,
    responseQuality: "unknown",
    languageSupport: "unknown",
    functionCalling: "not_tested",
    responseLength: 0,
    containsExample: false,
    containsHebrew: false,
    issues: [] as string[]
  };

  if (runStatus.status === "completed" && assistantMessage) {
    results.success = true;
    
    const responseText = assistantMessage.content?.[0]?.text?.value || "";
    results.responseLength = responseText.length;
    
    // Check for Hebrew content
    results.containsHebrew = /[\u0590-\u05FF]/.test(responseText);
    
    // Check for SQL examples
    results.containsExample = /SELECT|FROM|WHERE|JOIN/i.test(responseText);
    
    // Assess response quality
    if (results.responseLength > 100) {
      results.responseQuality = "good";
    } else if (results.responseLength > 50) {
      results.responseQuality = "acceptable";
    } else {
      results.responseQuality = "poor";
      results.issues.push("Response too short");
    }
    
    // Test-specific analysis
    if (testType === "hebrew" && !results.containsHebrew) {
      results.issues.push("Hebrew language test failed - no Hebrew content detected");
    }
    
    if (testType === "function_calling" && runStatus.required_action) {
      results.functionCalling = "attempted";
    } else if (testType === "function_calling") {
      results.functionCalling = "not_triggered";
      results.issues.push("Function calling not triggered for SQL analysis");
    }
    
  } else {
    results.issues.push(`Run failed with status: ${runStatus.status}`);
    
    if (runStatus.last_error) {
      results.issues.push(`Error: ${runStatus.last_error.message}`);
    }
  }

  return results;
}
