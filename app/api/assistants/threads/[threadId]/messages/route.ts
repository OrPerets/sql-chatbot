import { assistantId } from "@/app/assistant-config";
import { openai } from "@/app/openai";
import fs from 'fs';
import path from 'path';

export const runtime = "nodejs";

export const maxDuration = 50;

// Send a new message to a thread
export async function POST(request, { params: { threadId } }) {
  try {
    // Validate environment setup first
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY environment variable is not set');
      return new Response(
        JSON.stringify({ 
          error: 'OpenAI API key not configured', 
          details: 'Please set OPENAI_API_KEY in your environment variables' 
        }), 
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!assistantId) {
      console.error('❌ OPENAI_ASSISTANT_ID environment variable is not set');
      return new Response(
        JSON.stringify({ 
          error: 'Assistant ID not configured', 
          details: 'Please set OPENAI_ASSISTANT_ID in your environment variables or in assistant-config.ts' 
        }), 
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    const { content, imageUrl, audioUrl } = await request.json();
    
    console.log('Processing message:', { 
      threadId, 
      hasContent: !!content, 
      hasImage: !!imageUrl, 
      hasAudio: !!audioUrl,
      assistantId: assistantId.substring(0, 10) + '...' // Log partial ID for verification
    });

    // Construct message content with multimodal support
    let messageContent: any = content;

    // If we have media URLs, construct content as an array
    if (imageUrl || audioUrl) {
      messageContent = [
        { type: "text", text: content || "" }
      ];

      // Handle image URLs - convert localhost images to base64 for OpenAI
      if (imageUrl) {
        console.log('🖼️ Processing image URL:', imageUrl);
        
        if (imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1')) {
          // For localhost URLs, we'll skip the base64 conversion to avoid OpenAI format issues
          // and just inform the assistant that an image was uploaded
          console.log('⚠️ Localhost image detected - adding text description instead of base64 to avoid OpenAI format issues');
          messageContent[0].text += "\n\n[המשתמש העלה תמונה - התמונה מוצגת בממשק המשתמש אך לא נשלחה ל-AI עקב הגבלות טכניות]";
        } else {
          // Only add image URL if it's publicly accessible
          try {
            // Validate that it's a proper URL
            new URL(imageUrl);
            
            messageContent.push({
              type: "image_url",
              image_url: { url: imageUrl }
            });
            
            console.log('✅ Added external image URL to message');
          } catch (urlError) {
            console.error('❌ Invalid external image URL format:', imageUrl, urlError);
            messageContent[0].text += "\n\n[המשתמש העלה תמונה - שגיאה בכתובת התמונה]";
          }
        }
      }

      if (audioUrl) {
        if (audioUrl.includes('localhost') || audioUrl.includes('127.0.0.1')) {
          // For localhost URLs, just mention that audio was uploaded
          messageContent[0].text += "\n\n[המשתמש העלה קובץ אודיו - האודיו מתנגן בממשק המשתמש]";
          console.log('Skipping localhost audio URL for OpenAI:', audioUrl);
        } else {
          // Only add audio URL if it's publicly accessible
          messageContent.push({
            type: "audio_url", 
            audio_url: { url: audioUrl }
          });
        }
      }
    }

    // Create the message
    console.log('Creating message in thread:', threadId);
    console.log('📝 Message content being sent to OpenAI:', JSON.stringify(messageContent, null, 2));
    
    const message = await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: messageContent,
    });
    
    console.log('Message created successfully:', message.id);

    // Start the assistant run
    console.log('Starting assistant run with ID:', assistantId);
    const stream = openai.beta.threads.runs.stream(threadId, {
      assistant_id: assistantId,
    });

    console.log('Stream created successfully');
    return new Response(stream.toReadableStream());
  } catch (error) {
    console.error('❌ Error in messages API:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Provide more specific error messages based on error type
    let errorMessage = 'Failed to process message';
    let errorDetails = error.message;
    
    if (error.message?.includes('Invalid assistant_id')) {
      errorMessage = 'Invalid assistant ID';
      errorDetails = 'The provided assistant ID is not valid. Please check your OPENAI_ASSISTANT_ID environment variable.';
    } else if (error.message?.includes('No such thread')) {
      errorMessage = 'Invalid thread ID';
      errorDetails = 'The thread ID is invalid or has expired. Please start a new conversation.';
    } else if (error.message?.includes('API key')) {
      errorMessage = 'OpenAI API authentication failed';
      errorDetails = 'Please check your OPENAI_API_KEY environment variable.';
    } else if (error.message?.includes('image_url.url') || error.message?.includes('invalid format')) {
      errorMessage = 'Invalid image format';
      errorDetails = 'The image format is not supported or the image data is corrupted. Please try a different image.';
      console.error('🖼️ Image URL error details - check the logs above for the actual messageContent that was sent');
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage, 
        details: errorDetails,
        timestamp: new Date().toISOString()
      }), 
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}
