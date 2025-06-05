// Helper functions for creating multimodal messages

export interface MessageContent {
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
}

export interface OpenAIMessageContentPart {
  type: "text" | "image_url" | "audio_url";
  text?: string;
  image_url?: { url: string };
  audio_url?: { url: string };
}

// Create a properly formatted message content for OpenAI Assistant API
export function createMessageContent(content: MessageContent): OpenAIMessageContentPart[] | string {
  const { text, imageUrl, audioUrl } = content;

  // If only text, return simple string format
  if (!imageUrl && !audioUrl) {
    return text || "";
  }

  // Build content array for multimodal message
  const parts: OpenAIMessageContentPart[] = [];

  // Add text content
  if (text) {
    parts.push({
      type: "text",
      text: text
    });
  }

  // Add image content
  if (imageUrl) {
    parts.push({
      type: "image_url",
      image_url: { url: imageUrl }
    });
  }

  // Add audio content
  if (audioUrl) {
    parts.push({
      type: "audio_url",
      audio_url: { url: audioUrl }
    });
  }

  return parts;
}

// Upload file and get URL for use in messages
export async function uploadFile(
  file: File, 
  type: 'image' | 'audio',
  authToken: string
): Promise<string> {
  const formData = new FormData();
  formData.append(type, file);

  const endpoint = type === 'image' ? '/api/upload/image' : '/api/upload/audio';
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`
    },
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Failed to upload ${type}`);
  }

  const result = await response.json();
  return result.url;
}

// Send a multimodal message to the assistant
export async function sendMultimodalMessage(
  threadId: string,
  content: MessageContent,
  authToken?: string
): Promise<Response> {
  const messageData = {
    content: content.text || "",
    imageUrl: content.imageUrl,
    audioUrl: content.audioUrl
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  return fetch(`/api/assistants/threads/${threadId}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify(messageData)
  });
} 