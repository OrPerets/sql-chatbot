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
    
    Always be encouraging and focus on learning outcomes. If an image doesn't contain SQL/database content, politely explain what you can see and ask how you can help with their SQL learning.`,
    name: "Michael - SQL Teaching Assistant",
    model: "gpt-5-nano", // Latest model with enhanced capabilities
    tools: [
      { type: "code_interpreter" },
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
