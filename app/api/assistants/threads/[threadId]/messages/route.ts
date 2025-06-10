import { assistantId } from "@/app/assistant-config";
import { openai } from "@/app/openai";

export const runtime = "nodejs";

export const maxDuration = 50;

// Send a new message to a thread
export async function POST(request, { params: { threadId } }) {
  const { content, fileIds } = await request.json();

  if (fileIds && fileIds.length > 0) {
    const messageContent = [
      ...fileIds.map((id) => ({ type: "image_file", image_file: { file_id: id, detail: "auto" } })),
      { type: "text", text: content },
    ];
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: messageContent,
    });
  } else {
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: content,
    });
  }

  const stream = openai.beta.threads.runs.stream(threadId, {
    assistant_id: assistantId,
  });

  return new Response(stream.toReadableStream());
}
