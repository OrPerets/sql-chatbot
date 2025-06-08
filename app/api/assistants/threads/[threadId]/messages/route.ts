import { assistantId } from "@/app/assistant-config";
import { openai } from "@/app/openai";

export const runtime = "nodejs";

export const maxDuration = 50;

// Send a new message to a thread
export async function POST(request, { params: { threadId } }) {
  const contentType = request.headers.get("content-type") || "";

  let messageContent: any = [];

  if (contentType.startsWith("multipart/form-data")) {
    const formData = await request.formData();
    const text = formData.get("content") as string | null;
    const file = formData.get("file") as File | null;

    if (text) {
      messageContent.push({ type: "text", text });
    }

    if (file && typeof file !== "string") {
      const buffer = Buffer.from(await file.arrayBuffer());
      const uploaded = await openai.files.create({
        file: buffer,
        purpose: "vision",
        filename: file.name,
      });
      messageContent.push({
        type: "image_file",
        image_file: { file_id: uploaded.id },
      });
    }
  } else {
    const { content } = await request.json();
    messageContent = content;
  }

  if (messageContent.length === 0) {
    return new Response("No content", { status: 400 });
  }

  await openai.beta.threads.messages.create(threadId, {
    role: "user",
    content: messageContent,
  });

  const stream = openai.beta.threads.runs.stream(threadId, {
    assistant_id: assistantId,
  });

  return new Response(stream.toReadableStream());
}
