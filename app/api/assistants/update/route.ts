import { openai } from "@/app/openai";
import { assistantId } from "@/app/assistant-config";

export const runtime = "nodejs";

// Update existing assistant with enhanced model and tools
export async function POST() {
  try {
    const updatedAssistant = await openai.beta.assistants.update(assistantId, {
        model: "gpt-4.1-mini", // Supported by Assistants API
      // Keep existing instructions but enhance them
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
      
      Always be encouraging and focus on learning outcomes. If an image doesn't contain SQL/database content, politely explain what you can see and ask how you can help with their SQL learning.
      
      When using SQL execution functions, always explain the query logic and results to help students learn. Provide optimization suggestions when appropriate.

      Weekly course context:
      - For any question about "what we learn this week", syllabus focus, class topics, or weekly material, call the function get_course_week_context before answering.
      - If the user asks about a specific week, pass { week: <number> }.
      - Cite the returned fields (weekNumber, dateRange) explicitly in your response and weave the content naturally in Hebrew.
      - Do not invent content if the function returns null; explain that the weekly context is not configured yet and ask the user to clarify.
      - Do not rely on prior prompt injection. Always prefer the function for up-to-date context.
      `,
      tools: [
        { type: "code_interpreter" },
        { type: "file_search" },
        {
          type: "function",
          function: {
            name: "get_course_week_context",
            description:
              "Fetch the syllabus focus for the current or requested week to ground tutoring responses.",
            parameters: {
              type: "object",
              properties: {
                week: {
                  type: "integer",
                  minimum: 1,
                  maximum: 14,
                  description:
                    "Optional explicit week number; omit to use the current academic week.",
                },
              },
            },
          },
        },
        // Enhanced SQL-specific function calling
        {
          type: "function",
          function: {
            name: "execute_sql_query",
            description: "Execute SQL queries on practice databases safely with educational context",
            parameters: {
              type: "object",
              properties: {
                query: { 
                  type: "string", 
                  description: "SQL query to execute" 
                },
                database: { 
                  type: "string", 
                  description: "Target database name", 
                  enum: ["practice", "examples", "homework"] 
                },
                explain_plan: { 
                  type: "boolean", 
                  description: "Include execution plan analysis for learning purposes",
                  default: false
                },
                educational_context: {
                  type: "string",
                  description: "Context about what the student is trying to learn from this query"
                }
              },
              required: ["query", "database"]
            }
          }
        },
        {
          type: "function", 
          function: {
            name: "get_database_schema",
            description: "Retrieve table structures and relationships to help students understand database design",
            parameters: {
              type: "object",
              properties: {
                database: { 
                  type: "string",
                  description: "Database name to inspect"
                },
                table_pattern: { 
                  type: "string", 
                  description: "Filter tables by pattern (optional)"
                },
                include_relationships: {
                  type: "boolean",
                  description: "Include foreign key relationships",
                  default: true
                }
              },
              required: ["database"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "analyze_query_performance", 
            description: "Analyze SQL query performance and suggest optimizations for educational purposes",
            parameters: {
              type: "object",
              properties: {
                query: { 
                  type: "string",
                  description: "SQL query to analyze"
                },
                database_context: { 
                  type: "object",
                  description: "Database statistics and table information",
                  properties: {
                    table_sizes: { type: "object" },
                    index_info: { type: "object" },
                    query_complexity: { type: "string", enum: ["simple", "moderate", "complex"] }
                  }
                },
                learning_level: {
                  type: "string",
                  enum: ["beginner", "intermediate", "advanced"],
                  description: "Student's learning level to tailor explanations"
                }
              },
              required: ["query"]
            }
          }
        },
        // Keep the weather function for backward compatibility
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
    
    return Response.json({ 
      success: true, 
      assistantId: updatedAssistant.id,
      model: updatedAssistant.model,
      message: `Assistant successfully upgraded to ${updatedAssistant.model}`,
      tools: updatedAssistant.tools?.length || 0,
      updatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Assistant update error:", error);
    return Response.json({ 
      success: false, 
      error: error.message,
      assistantId: assistantId
    }, { status: 500 });
  }
}

// Get current assistant info
export async function GET() {
  try {
    const assistant = await openai.beta.assistants.retrieve(assistantId);
    return Response.json({
      assistantId: assistant.id,
      model: assistant.model,
      name: assistant.name,
      tools: assistant.tools?.length || 0,
      createdAt: assistant.created_at,
      instructions: assistant.instructions?.substring(0, 200) + "..."
    });
  } catch (error: any) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
}
