import { openai } from "@/app/openai";

export const runtime = "nodejs";

// Create a new assistant
export async function POST() {
  const assistant = await openai.beta.assistants.create({
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

    Weekly course context:
    - For any question about "what we learn this week", syllabus focus, class topics, or weekly material, call the function get_course_week_context before answering.
    - If the user asks about a specific week, pass { week: <number> }.
    - Cite the returned fields (weekNumber, dateRange) explicitly in your response and weave the content naturally in Hebrew.
    - Do not invent content if the function returns null; explain that the weekly context is not configured yet and ask the user to clarify.
    - Do not rely on prior prompt injection. Always prefer the function for up-to-date context.`,
    name: "Michael - SQL Teaching Assistant",
    model: "gpt-4.1-mini", // Supported by Assistants API
    tools: [
      { type: "code_interpreter" },
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
      },
      { type: "file_search" },
    ],
  });
  return Response.json({ assistantId: assistant.id });
}
