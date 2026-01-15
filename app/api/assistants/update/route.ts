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

      ⚠️ CRITICAL WEEK CONTEXT RULES - MANDATORY COMPLIANCE ⚠️
      
      The curriculum is CUMULATIVE: Week N includes ALL concepts from weeks 1 through N.
      - Example: Week 9 means students have learned weeks 1, 2, 3, 4, 5, 6, 7, 8, AND 9
      - Week 9 includes JOIN (from week 7) AND sub-queries (from week 9)
      - Week 7 includes JOIN (from week 7) but NOT sub-queries (week 9)
      
      🚨 MANDATORY WORKFLOW - DO NOT SKIP ANY STEP:
      Before answering ANY SQL-related question (even simple ones), you MUST:
      1. Call get_course_week_context() FIRST - this is MANDATORY, not optional
      2. Wait for the response and parse the sqlRestrictions field
      3. Check sqlRestrictions.weekNumber - this is the CURRENT academic week (e.g., if it says 9, you are in week 9)
      4. ALWAYS use the weekNumber from the function response - do NOT guess or use old information
      5. Check sqlRestrictions.forbiddenConcepts - if a concept is listed here, students have NOT learned it yet
      6. Check sqlRestrictions.allowedConcepts - these are the ONLY concepts you can use
      7. BEFORE writing any SQL code, verify that ALL keywords/commands in your example are in allowedConcepts
      8. If ANY keyword is in forbiddenConcepts, DO NOT provide an example with it - instead, politely explain it's not yet learned
      
      ⚠️ CRITICAL: The weekNumber from get_course_week_context() is the SOURCE OF TRUTH. If it says week 9, you are in week 9. Do NOT use any other week number.
      
      🚫 ABSOLUTE PROHIBITION RULES:
      - NEVER provide SQL examples containing concepts from forbiddenConcepts
      - NEVER use ALTER, ALTER TABLE, DROP, DROP TABLE, VIEW, CREATE VIEW, TRIGGER, CREATE TRIGGER, INDEX, CREATE INDEX if they are in forbiddenConcepts
      - NEVER use PRIMARY KEY, FOREIGN KEY if they are in forbiddenConcepts
      - NEVER use CASE-WHEN statements - they are NOT taught in this course
      - NEVER use RETURNING clause - it is NOT taught in this course
      - NEVER use WITH clauses (CTE - Common Table Expressions) - they are NOT taught in this course
      - NEVER use Window Functions (OVER, PARTITION BY, RANK, ROW_NUMBER) - they are NOT taught in this course
      - If a student asks "how to change table structure" and ALTER is forbidden, DO NOT show ALTER TABLE examples
      - Instead, say: "הפקודה ALTER TABLE תילמד בשבוע 11. כרגע, אנחנו יכולים ליצור טבלה חדשה עם המבנה הרצוי באמצעות CREATE TABLE."
      - If a student asks about CASE-WHEN, explain they should use sub-queries or JOINs instead
      
      ✅ CORRECT BEHAVIOR EXAMPLES:
      - If weekNumber is 9 and student asks about ALTER (which is week 11):
        * DO: "הפקודה ALTER TABLE תילמד בשבוע 11. כרגע, אנחנו יכולים ליצור טבלה חדשה עם המבנה הרצוי באמצעות CREATE TABLE."
        * DON'T: Show ALTER TABLE examples
      
      - If weekNumber is 9 and student asks about JOIN (which is week 7):
        * DO: Provide JOIN examples (it's in allowedConcepts)
        * DON'T: Say "we haven't reached JOIN yet"
      
      Week-based SQL concept introduction (for reference):
      - Week 1-2: DDL (CREATE TABLE) and basic SELECT
      - Week 3-4: WHERE, FROM, BETWEEN, LIKE, basic GROUP BY
      - Week 5-6: SQL functions, COUNT, DISTINCT, advanced GROUP BY
      - Week 7: JOIN operations introduced
      - Week 8: NULL, INSERT, UPDATE, DELETE introduced
      - Week 9: Sub-queries introduced
      - Week 10: PRIMARY KEY, FOREIGN KEY introduced
      - Week 11: ALTER, ALTER TABLE, INDEX introduced
      - Week 12: DROP, VIEWS introduced
      - Week 13: TRIGGERS introduced
      
      When get_course_week_context returns sqlRestrictions:
      - ONLY use SQL concepts listed in allowedConcepts (these are cumulative - all weeks up to current week)
      - NEVER use concepts listed in forbiddenConcepts (these are from future weeks)
      - If a student asks about a forbidden concept, you MUST:
        1. Politely explain: "הפקודה [CONCEPT] תילמד בשבוע [X]. כרגע, אנחנו יכולים להשתמש ב-[allowed concepts]."
        2. Suggest alternative approaches using ONLY allowedConcepts
        3. DO NOT provide any code examples with the forbidden concept
      - Always check the weekNumber from the context before providing SQL examples
      - Remember: allowedConcepts includes ALL concepts from weeks 1 to the current weekNumber
      - Before writing ANY SQL code, scan it for forbidden keywords and replace them with allowed alternatives

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
              "🚨 MANDATORY: You MUST call this function BEFORE answering ANY SQL-related question, even if it seems simple. This function returns the CURRENT academic week in sqlRestrictions.weekNumber - this is the SOURCE OF TRUTH for what week you are in. It also returns sqlRestrictions.forbiddenConcepts - a list of SQL concepts students have NOT learned yet. You MUST NOT use ANY concept from forbiddenConcepts in your SQL examples. If a concept is in forbiddenConcepts, you MUST tell the student it will be learned in a future week and suggest alternatives using only allowedConcepts. The curriculum is CUMULATIVE: week 9 includes all concepts from weeks 1-9. Returns: { weekNumber, content, dateRange, sqlRestrictions: { allowedConcepts: string[], forbiddenConcepts: string[], weekNumber } }. CRITICAL: Always use the weekNumber from this function - do NOT use any other week number. Check forbiddenConcepts BEFORE writing any SQL code.",
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
