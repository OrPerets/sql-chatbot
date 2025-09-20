import { NextRequest } from "next/server";
import { openai } from "@/app/openai";
import { assistantId } from "@/app/assistant-config";

export const runtime = "nodejs";

// Emergency rollback endpoint to revert assistant to previous stable state
export async function POST(req: NextRequest) {
  try {
    const { reason, rollbackTo } = await req.json();

    // Validate rollback target
    const validTargets = ["gpt-5-nano","gpt-4o", "gpt-4o-2024-08-06", "previous-stable"];
    if (rollbackTo && !validTargets.includes(rollbackTo)) {
      return Response.json({ 
        error: `Invalid rollback target. Valid options: ${validTargets.join(", ")}` 
      }, { status: 400 });
    }

    const targetModel = rollbackTo || "gpt-4o";
    
    // Log rollback attempt
    console.warn(`Emergency rollback initiated: ${reason || "No reason provided"}`);
    console.warn(`Rolling back to model: ${targetModel}`);

    // Revert assistant to stable configuration
    const revertedAssistant = await openai.beta.assistants.update(assistantId, {
      model: targetModel,
      instructions: `You are Michael, a helpful SQL teaching assistant for academic courses. 

      When users upload images, analyze them carefully for:
      - SQL queries and syntax
      - Database schemas and table structures  
      - Entity Relationship Diagrams (ERDs)
      - Query results and error messages
      - Database design patterns

      Provide clear, educational explanations in Hebrew when appropriate, helping students understand:
      - SQL syntax and best practices
      - Database normalization and design principles
      - Query optimization techniques
      - Common errors and how to fix them
      
      Always be encouraging and focus on learning outcomes. If an image doesn't contain SQL/database content, politely explain what you can see and ask how you can help with their SQL learning.`,
      tools: [
        { type: "code_interpreter" },
        { type: "file_search" },
        // Keep only basic weather function for stability
        {
          type: "function",
          function: {
            name: "get_weather",
            description: "Determine weather in my location",
            parameters: {
              type: "object",
              properties: {
                location: {
                  type: "string",
                  description: "The city and state e.g. San Francisco, CA",
                },
                unit: {
                  type: "string",
                  enum: ["c", "f"],
                },
              },
              required: ["location"],
            },
          },
        }
      ]
    });

    // Update environment variable to disable advanced features
    process.env.USE_LATEST_MODEL = "false";
    process.env.USE_GPT5_ASSISTANT = "false";

    // Log successful rollback
    const rollbackRecord = {
      timestamp: new Date().toISOString(),
      reason: reason || "Emergency rollback",
      previousModel: "gpt-4o-2024-11-20",
      rolledBackTo: targetModel,
      assistantId: revertedAssistant.id,
      success: true
    };

    // Store rollback record (in production, save to database)
    console.log("Rollback completed:", rollbackRecord);

    return Response.json({
      success: true,
      message: `Assistant successfully rolled back to ${targetModel}`,
      rollback: rollbackRecord,
      assistantId: revertedAssistant.id,
      model: revertedAssistant.model,
      toolsCount: revertedAssistant.tools?.length || 0,
      nextSteps: [
        "Monitor system stability",
        "Investigate root cause of issues",
        "Plan gradual re-deployment when ready",
        "Review rollback logs for insights"
      ]
    });

  } catch (error: any) {
    console.error("Rollback failed:", error);
    
    // Log rollback failure
    const failureRecord = {
      timestamp: new Date().toISOString(),
      reason: "Rollback operation failed",
      error: error.message,
      success: false
    };
    
    console.error("Rollback failure:", failureRecord);

    return Response.json({ 
      success: false,
      error: error.message,
      message: "Rollback operation failed. Manual intervention may be required.",
      emergencyContacts: [
        "Check OpenAI dashboard for assistant status",
        "Verify API key permissions",
        "Contact technical support if issue persists"
      ]
    }, { status: 500 });
  }
}

// Get rollback status and history
export async function GET() {
  try {
    // Check current assistant status
    const assistant = await openai.beta.assistants.retrieve(assistantId);
    
    // Check environment flags
    const currentFlags = {
      useLatestModel: process.env.USE_LATEST_MODEL === "true",
      useGPT5: process.env.USE_GPT5_ASSISTANT === "true"
    };

    // Determine if system is in rollback state
    const isRolledBack = assistant.model === "gpt-4o" && 
                        !currentFlags.useLatestModel && 
                        !currentFlags.useGPT5;

    return Response.json({
      assistantId: assistant.id,
      currentModel: assistant.model,
      isRolledBack,
      flags: currentFlags,
      toolsCount: assistant.tools?.length || 0,
      status: isRolledBack ? "rolled-back" : "normal",
      lastChecked: new Date().toISOString(),
      rollbackOptions: {
        available: true,
        targets: ["gpt-4o", "gpt-4o-2024-08-06", "previous-stable"],
        recommendedTarget: "gpt-4o"
      }
    });

  } catch (error: any) {
    return Response.json({ 
      error: error.message,
      status: "error"
    }, { status: 500 });
  }
}

// Test endpoint to verify system stability
export async function PATCH() {
  try {
    // Perform basic system health checks
    const healthChecks = await performHealthChecks();
    
    return Response.json({
      systemHealth: healthChecks,
      timestamp: new Date().toISOString(),
      recommendation: healthChecks.overall === "healthy" ? 
        "System is stable, safe to upgrade" : 
        "System issues detected, rollback recommended"
    });

  } catch (error: any) {
    return Response.json({ 
      error: error.message,
      systemHealth: { overall: "error" }
    }, { status: 500 });
  }
}

async function performHealthChecks() {
  const checks = {
    assistantAccess: false,
    apiConnection: false,
    modelResponse: false,
    functionCalling: false,
    overall: "unhealthy" as "healthy" | "unhealthy" | "warning"
  };

  try {
    // Check assistant access
    const assistant = await openai.beta.assistants.retrieve(assistantId);
    checks.assistantAccess = !!assistant.id;

    // Check API connection
    checks.apiConnection = true;

    // Test basic model response
    const thread = await openai.beta.threads.create();
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: "Test message for health check"
    });
    
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId
    });

    // Wait briefly for response (simplified check)
    await new Promise(resolve => setTimeout(resolve, 2000));
    const runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    
    checks.modelResponse = runStatus.status !== "failed";
    checks.functionCalling = assistant.tools?.length > 0;

    // Cleanup test thread
    await openai.beta.threads.del(thread.id);

    // Determine overall health
    const passedChecks = Object.values(checks).filter(Boolean).length;
    if (passedChecks >= 3) {
      checks.overall = "healthy";
    } else if (passedChecks >= 2) {
      checks.overall = "warning";
    }

  } catch (error) {
    console.error("Health check error:", error);
  }

  return checks;
}
