import { openai } from "@/app/openai";

export const runtime = "nodejs";
export const maxDuration = 300;

const TARGET_MODEL = "gpt-5.4-pro-2026-03-05";

function writeEvent(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
  payload: Record<string, unknown>
) {
  return writer.write(encoder.encode(`${JSON.stringify(payload)}\n`));
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const question = String(formData.get("question") || "").trim();
  const pdfFile = formData.get("pdf");

  if (!question) {
    return Response.json({ error: "question is required." }, { status: 400 });
  }

  if (!(pdfFile instanceof File)) {
    return Response.json({ error: "pdf file is required." }, { status: 400 });
  }

  const name = pdfFile.name.toLowerCase();
  const isPdf = pdfFile.type === "application/pdf" || name.endsWith(".pdf");
  if (!isPdf) {
    return Response.json({ error: "Only PDF files are supported." }, { status: 400 });
  }

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
        await writeEvent(writer, encoder, {
          type: "status",
          message: "Uploading PDF to OpenAI...",
        });

        const uploaded = await openai.files.create({
          file: pdfFile,
          purpose: "user_data",
        });

        await writeEvent(writer, encoder, {
          type: "status",
          message: "Starting streamed response...",
          model: TARGET_MODEL,
          reasoningEffort: "xhigh",
        });

        const responseStream = await (openai as any).responses.create({
          model: TARGET_MODEL,
          stream: true,
          reasoning: {
            effort: "high",
            summary: "detailed",
          },
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: question,
                },
                {
                  type: "input_file",
                  file_id: uploaded.id,
                },
              ],
            },
          ],
        });

        for await (const event of responseStream) {
          if (
            event?.type === "response.reasoning_summary_text.delta" &&
            typeof event.delta === "string"
          ) {
            await writeEvent(writer, encoder, {
              type: "thinking",
              delta: event.delta,
            });
          }

          if (event?.type === "response.output_text.delta" && typeof event.delta === "string") {
            await writeEvent(writer, encoder, {
              type: "answer",
              delta: event.delta,
            });
          }

          if (event?.type === "response.completed") {
            await writeEvent(writer, encoder, {
              type: "done",
            });
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        await writeEvent(writer, encoder, {
          type: "error",
          message,
        });
      } finally {
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
