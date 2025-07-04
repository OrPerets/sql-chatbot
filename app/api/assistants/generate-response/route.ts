import { assistantId } from "@/app/assistant-config";
import { openai } from "@/app/openai";

export const runtime = "nodejs";
export const maxDuration = 50;

// Generate a complete response (non-streaming) for admin functions
export async function POST(request) {
  try {
    const { content } = await request.json();

    if (!content) {
      return new Response(
        JSON.stringify({ error: "Content is required" }), 
        { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    console.log("Creating thread for admin request...");
    
    // Create a new thread
    const thread = await openai.beta.threads.create();
    
    console.log("Adding message to thread:", thread.id);
    
    // Add message to thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: content,
    });

    console.log("Running assistant...");
    
    // Run the assistant and wait for completion
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId,
    });

    // Wait for the run to complete
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    
    // Poll for completion (with timeout)
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds timeout
    
    while (runStatus.status === 'in_progress' || runStatus.status === 'queued') {
      if (attempts >= maxAttempts) {
        throw new Error('Assistant response timeout');
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      attempts++;
    }

    if (runStatus.status !== 'completed') {
      throw new Error(`Assistant run failed with status: ${runStatus.status}`);
    }

    console.log("Retrieving assistant response...");
    
    // Get the messages from the thread
    const messages = await openai.beta.threads.messages.list(thread.id);
    
    // Find the assistant's response (should be the first message)
    const assistantMessage = messages.data.find(message => message.role === 'assistant');
    
    if (!assistantMessage) {
      throw new Error('No assistant response found');
    }

    // Extract text content
    let responseContent = '';
    if (assistantMessage.content && assistantMessage.content.length > 0) {
      const textContent = assistantMessage.content.find(content => content.type === 'text');
      if (textContent) {
        responseContent = textContent.text.value;
      }
    }

    console.log("Assistant response retrieved successfully");
    
    return new Response(
      JSON.stringify({ 
        response: responseContent,
        threadId: thread.id 
      }), 
      { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
    
  } catch (error) {
    console.error("Error in generate-response route:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate response" }), 
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
} 