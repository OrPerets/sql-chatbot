import { openai } from "../openai";

export interface ImageProcessingResult {
  extractedText: string;
  hasSQL: boolean;
  error?: string;
}

/**
 * Process an uploaded image using OpenAI Vision API to extract SQL-related content
 * This function should only be called on the server side
 * @param imageUrl - Base64 data URL or HTTP URL of the image
 * @param userMessage - Optional user message to provide context
 * @returns Promise with extracted text and metadata
 */
export async function processImageForSQL(
  imageUrl: string,
  userMessage?: string
): Promise<ImageProcessingResult> {
  try {
    const systemPrompt = `You are an expert at analyzing images containing SQL queries, database tables, or related content. 
    Extract any SQL code, table structures, column names, data types, or database-related information from this image.
    
    If you find SQL content:
    - Format SQL queries clearly with proper syntax
    - Identify table names, column names, and data types
    - Note any relationships or constraints visible
    - Explain any database concepts shown
    
    If no SQL/database content is found, simply state that clearly.
    
    Always provide your response in a clear, structured format that can help with SQL learning.`;

    const userContent = userMessage 
      ? `${userMessage}\n\nPlease analyze this image for SQL or database-related content:`
      : "Please analyze this image for SQL or database-related content:";

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using the latest vision model
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userContent
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "high" // Use high detail for better text extraction
              }
            }
          ]
        }
      ],
      max_tokens: 1000
    });

    const extractedText = response.choices[0]?.message?.content || "";
    
    // Simple heuristic to detect if SQL content was found
    const hasSQL = /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TABLE|WHERE|FROM|JOIN)\b/i.test(extractedText);

    return {
      extractedText,
      hasSQL,
    };

  } catch (error) {
    console.error("Error processing image:", error);
    return {
      extractedText: "",
      hasSQL: false,
      error: error instanceof Error ? error.message : "Failed to process image"
    };
  }
} 