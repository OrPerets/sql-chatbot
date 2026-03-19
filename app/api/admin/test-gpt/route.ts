import { openai } from "@/app/openai";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

type TestGptRequestBody = {
  prompt?: string;
  fileIds?: string[];
  reasoningEffort?: "medium" | "high" | "xhigh";
  includeReasoningSummary?: boolean;
};

function buildEventStreamResponse(
  handler: (writer: WritableStreamDefaultWriter<Uint8Array>, encoder: TextEncoder) => Promise<void>
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const writer = new WritableStream<Uint8Array>({
        write(chunk) {
          controller.enqueue(chunk);
        },
        close() {
          controller.close();
        },
        abort(error) {
          controller.error(error);
        },
      }).getWriter();

      try {
        await handler(writer, encoder);
        await writer.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown stream error";
        await writer.write(
          encoder.encode(`${JSON.stringify({ type: "response.error", message })}\n`)
        );
        await writer.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function extractOutputText(response: any): string {
  if (!response) {
    return "";
  }

  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  const chunks: string[] = [];
  const output = Array.isArray(response.output) ? response.output : [];

  for (const item of output) {
    if (item?.type !== "message" || !Array.isArray(item?.content)) {
      continue;
    }

    for (const contentItem of item.content) {
      if (typeof contentItem?.text === "string") {
        chunks.push(contentItem.text);
      } else if (typeof contentItem?.text?.value === "string") {
        chunks.push(contentItem.text.value);
      }
    }
  }

  return chunks.join("");
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const body = (await request.json()) as TestGptRequestBody;

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const fileIds = Array.isArray(body.fileIds)
      ? body.fileIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];
    const reasoningEffort = body.reasoningEffort ?? "medium";
    const includeReasoningSummary = body.includeReasoningSummary !== false;

    if (!prompt && fileIds.length === 0) {
      return Response.json(
        { error: "A prompt or at least one PDF is required." },
        { status: 400 }
      );
    }

    const inputContent: Array<Record<string, unknown>> = [];

    if (prompt) {
      inputContent.push({
        type: "input_text",
        text: prompt,
      });
    }

    for (const fileId of fileIds) {
      inputContent.push({
        type: "input_file",
        file_id: fileId,
      });
    }

    return buildEventStreamResponse(async (writer, encoder) => {
      let stream: any;
      let includeSummary = includeReasoningSummary;

      const basePayload = {
        model: "gpt-5.4-pro",
        input: [
          {
            role: "user",
            content: inputContent,
          },
        ],
        stream: true,
        metadata: {
          route: "/api/admin/test-gpt",
          admin_email: admin.email,
        },
        reasoning: {
          effort: reasoningEffort,
          ...(includeSummary ? { summary: "detailed" } : {}),
        },
      } as const;

      try {
        stream = await (openai as any).responses.create(basePayload);
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        const canRetryWithoutSummary =
          includeSummary && (message.includes("reasoning") || message.includes("summary"));

        if (!canRetryWithoutSummary) {
          throw error;
        }

        includeSummary = false;
        stream = await (openai as any).responses.create({
          ...basePayload,
          reasoning: {
            effort: reasoningEffort,
          },
        });
      }

      let responseId = "";
      let outputText = "";

      for await (const event of stream as any) {
        if (event?.type === "response.created") {
          responseId = String(event.response?.id || "");
          await writer.write(
            encoder.encode(
              `${JSON.stringify({
                type: "response.created",
                responseId,
                reasoningSummaryEnabled: includeSummary,
              })}\n`
            )
          );
          continue;
        }

        if (event?.type === "response.output_text.delta" && typeof event.delta === "string") {
          outputText += event.delta;
          await writer.write(
            encoder.encode(
              `${JSON.stringify({ type: "response.output_text.delta", delta: event.delta })}\n`
            )
          );
          continue;
        }

        if (
          event?.type === "response.reasoning_summary_text.delta" &&
          typeof event.delta === "string"
        ) {
          await writer.write(
            encoder.encode(
              `${JSON.stringify({
                type: "response.reasoning_summary_text.delta",
                delta: event.delta,
              })}\n`
            )
          );
          continue;
        }

        if (
          event?.type === "response.reasoning_summary_text.done" &&
          typeof event.text === "string"
        ) {
          await writer.write(
            encoder.encode(
              `${JSON.stringify({
                type: "response.reasoning_summary_text.done",
                text: event.text,
              })}\n`
            )
          );
          continue;
        }

        if (event?.type === "response.output_text.done" && typeof event.text === "string") {
          outputText = event.text;
          continue;
        }

        if (event?.type === "response.completed") {
          const completedResponseId = String(event.response?.id || responseId || "");
          const completedText = extractOutputText(event.response) || outputText;
          await writer.write(
            encoder.encode(
              `${JSON.stringify({
                type: "response.completed",
                responseId: completedResponseId,
                outputText: completedText,
              })}\n`
            )
          );
        }
      }
    });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return Response.json(
      {
        error: error?.message || "Failed to run GPT test.",
      },
      { status }
    );
  }
}
