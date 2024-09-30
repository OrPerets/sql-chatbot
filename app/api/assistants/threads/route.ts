import { openai } from "@/app/openai";

export const runtime = "nodejs";

export const maxDuration = 50;

// Create a new thread
export async function POST() {
  const thread = await openai.beta.threads.create();
  return Response.json({ threadId: thread.id });
}
