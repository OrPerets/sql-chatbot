import { getAssistantId } from "@/app/assistant-config";
import { openai } from "@/app/openai";

export const runtime = "nodejs";

export const maxDuration = 50;

// Helper function to convert base64 to buffer
function base64ToBuffer(base64Data: string): { buffer: Buffer; mimeType: string } {
  const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid base64 data URL format');
  }
  
  const mimeType = matches[1];
  const base64 = matches[2];
  const buffer = Buffer.from(base64, 'base64');
  
  return { buffer, mimeType };
}

// Send a new message to a thread
export async function POST(request, { params: { threadId } }) {
  try {
    const { content, imageData } = await request.json();

    // Get current week's content for context injection
    let weeklyContext = '';
    try {
      const weeklyResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/mcp-michael/current-week`);
      if (weeklyResponse.ok) {
        const weeklyData = await weeklyResponse.json();
        if (weeklyData.content && weeklyData.content.trim()) {
          weeklyContext = `\n\n[הקשר שבועי נוכחי - שבוע ${weeklyData.currentWeek}: ${weeklyData.content}]`;
        }
      }
    } catch (weeklyError) {
      console.log('Could not fetch weekly context:', weeklyError);
      // Continue without weekly context if fetch fails
    }

    // Prepare message content
    let messageContent;

    if (imageData) {
      console.log("Processing message with image...");
      
      try {
        // Convert base64 to buffer
        const { buffer, mimeType } = base64ToBuffer(imageData);
        
        // Determine file extension from MIME type
        const extension = mimeType.split('/')[1] || 'png';
        const fileName = `upload_${Date.now()}.${extension}`;
        
        console.log(`Uploading image: ${fileName}, size: ${buffer.length} bytes`);
        
        // Upload image to OpenAI file storage
        const file = await openai.files.create({
          file: new File([buffer], fileName, { type: mimeType }),
          purpose: 'assistants',
        });
        
        console.log(`Image uploaded successfully. File ID: ${file.id}`);
        
        // Send message with file ID reference
        const baseText = content || "Please analyze this image for SQL or database-related content and help me understand it.";
        messageContent = [
          {
            type: "text",
            text: baseText + weeklyContext
          },
          {
            type: "image_file",
            image_file: {
              file_id: file.id,
              detail: "high"
            }
          }
        ];
        
      } catch (uploadError) {
        console.error("Error uploading image:", uploadError);
        // Fallback to text-only message
        messageContent = (content || "I encountered an error processing your image. Please try uploading it again or describe what you need help with.") + weeklyContext;
      }
    } else {
      // Text-only message
      messageContent = content + weeklyContext;
    }

    console.log("Creating message in thread:", threadId);
    
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: messageContent,
    });

    console.log("Starting assistant run...");
    
    const stream = openai.beta.threads.runs.stream(threadId, {
      assistant_id: getAssistantId(),
    });

    return new Response(stream.toReadableStream());
    
  } catch (error) {
    console.error("Error in messages route:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process message" }), 
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
