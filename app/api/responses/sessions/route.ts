import { randomUUID } from "crypto";

import { createResponse } from "@/lib/openai/responses-client";
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
    const body = await request.json().catch(() => ({}));
    const metadata = body?.metadata ?? {};
    const sessionId = `sess_${randomUUID()}`;

    // Warmup call provides a deterministic response_id anchor for this session.
    const warmup = await createResponse({
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: "Start a new session." }],
        },
      ],
      metadata: {
        ...metadata,
        session_id: sessionId,
        bootstrap: "true",
      },
    });

    return Response.json({
      mode,
      sessionId,
      responseId: warmup.id,
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
