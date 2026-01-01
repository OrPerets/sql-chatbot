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

    // CRITICAL: Inject current week context directly into message to ensure assistant knows the week
    // Use getCurrentWeekContextNormalized directly instead of API call to avoid inconsistencies
    let weeklyContext = '';
    let currentWeekNumber: number | null = null;
    try {
<<<<<<< HEAD
      // Use the same function that get_course_week_context uses to ensure consistency
      const { getCurrentWeekContextNormalized } = await import('@/lib/content');
      const weekContext = await getCurrentWeekContextNormalized(null);
      currentWeekNumber = weekContext.weekNumber;
      
      if (currentWeekNumber) {
        console.log(`[messages-route] Injected week context: Week ${currentWeekNumber} (from getCurrentWeekContextNormalized)`);
        
        // Get SQL restrictions for this week
        const { getAllowedConceptsForWeek, getForbiddenConceptsForWeek } = await import('@/lib/sql-curriculum');
        const allowedConcepts = getAllowedConceptsForWeek(currentWeekNumber);
        const forbiddenConcepts = getForbiddenConceptsForWeek(currentWeekNumber);
        
        // Create explicit context with week number and key restrictions
        const hasJOIN = allowedConcepts.some(c => c.toLowerCase().includes('join'));
        const hasALTER = forbiddenConcepts.some(c => c.toLowerCase().includes('alter'));
        
        weeklyContext = `\n\n[CRITICAL WEEK CONTEXT - DO NOT IGNORE]
השבוע הנוכחי הוא שבוע ${currentWeekNumber} (לא שבוע 6 ולא שבוע אחר).
השבוע הנוכחי הוא שבוע ${currentWeekNumber}.
Week ${currentWeekNumber} includes ALL concepts from weeks 1-${currentWeekNumber}.
${hasJOIN ? 'JOIN is ALLOWED (learned in week 7).' : 'JOIN is NOT yet learned.'}
${hasALTER ? 'ALTER is FORBIDDEN (will be learned in week 11). Do NOT use ALTER TABLE.' : 'ALTER is allowed.'}
You MUST call get_course_week_context() to get the complete list of allowed/forbidden concepts.
The weekNumber from that function is the SOURCE OF TRUTH. Use it, not any other number.]`;
      } else {
        console.warn('[messages-route] Could not determine current week - weekNumber is null');
=======
      const weeklyUrl = new URL('/api/mcp-michael/current-week', request.url).toString();
      const weeklyResponse = await fetch(weeklyUrl);
      if (weeklyResponse.ok) {
        const weeklyData = await weeklyResponse.json();
        const weekNum = weeklyData.weekNumber ?? weeklyData.currentWeek; // support both shapes during rollout
        if (weeklyData.content && weeklyData.content.trim()) {
          weeklyContext = `\n\n[Current Week Context - Week ${weekNum}: ${weeklyData.content}. IMPORTANT: Only use SQL concepts taught up to week ${weekNum}. Do NOT use JOINs before week 7, or sub-queries before week 9.]`;
        }
>>>>>>> origin/main
      }
    } catch (weeklyError) {
      console.error('[messages-route] Could not fetch weekly context:', weeklyError);
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
        // Convert Buffer to Uint8Array for File constructor compatibility
        const uint8Array = new Uint8Array(buffer);
        const file = await openai.files.create({
          file: new File([uint8Array], fileName, { type: mimeType }),
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
    if (currentWeekNumber) {
      console.log(`[messages-route] Current week injected: ${currentWeekNumber}`);
    }
    
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: messageContent,
    });

    console.log("Starting assistant run...");
    console.log(`[messages-route] Waiting for assistant to call get_course_week_context() - should return week ${currentWeekNumber || 'unknown'}`);
    
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
