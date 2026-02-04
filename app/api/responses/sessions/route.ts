import { randomUUID } from "crypto";

import { getOpenAIApiMode } from "@/lib/openai/api-mode";

export const runtime = "nodejs";
export const maxDuration = 50;

export async function GET() {
  const mode = getOpenAIApiMode();

  return Response.json({
    mode,
    routes: {
      sessions: "/api/responses/sessions",
      messages: "/api/responses/messages",
      files: "/api/responses/files",
    },
    status:
      mode === "responses"
        ? "foundation_ready"
        : "assistants_compatibility_mode",
  });
}

export async function POST(request: Request) {
  const mode = getOpenAIApiMode();

  try {
    await request.json().catch(() => ({}));
    const sessionId = `sess_${randomUUID()}`;

    return Response.json({
      mode,
      sessionId,
      responseId: null,
      compatibility: "responses_session",
    });
  } catch (error: any) {
    return Response.json(
      {
        mode,
        error: error?.message || "Failed to create session.",
      },
      { status: 500 }
    );
  }
}
