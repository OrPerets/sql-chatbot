import { randomUUID } from "crypto";

function jsonLinesReadableStream(items: unknown[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const item of items) {
        controller.enqueue(encoder.encode(`${JSON.stringify(item)}\n`));
      }
      controller.close();
    },
  });
}

function chunkText(input: string, chunkSize = 80): string[] {
  if (!input) {
    return [];
  }

  const chunks: string[] = [];
  for (let index = 0; index < input.length; index += chunkSize) {
    chunks.push(input.slice(index, index + chunkSize));
  }
  return chunks;
}

export function createAssistantCompatibleTextStream(params: {
  threadId: string;
  text: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  const runId = `run_${randomUUID().replace(/-/g, "")}`;
  const messageId = `msg_${randomUUID().replace(/-/g, "")}`;
  const textChunks = chunkText(params.text || "");

  const messageBase = {
    id: messageId,
    object: "thread.message",
    created_at: now,
    thread_id: params.threadId,
    role: "assistant",
    assistant_id: null,
    run_id: runId,
    attachments: [],
    metadata: {},
  };

  const runBase = {
    id: runId,
    object: "thread.run",
    created_at: now,
    thread_id: params.threadId,
    assistant_id: null,
    status: "in_progress",
    required_action: null,
    last_error: null,
    metadata: {},
  };

  const events: unknown[] = [
    { event: "thread.run.created", data: runBase },
    {
      event: "thread.message.created",
      data: {
        ...messageBase,
        status: "in_progress",
        content: [],
      },
    },
  ];

  for (const chunk of textChunks) {
    events.push({
      event: "thread.message.delta",
      data: {
        id: messageId,
        object: "thread.message.delta",
        delta: {
          content: [
            {
              index: 0,
              type: "text",
              text: {
                value: chunk,
                annotations: [],
              },
            },
          ],
        },
      },
    });
  }

  events.push(
    {
      event: "thread.message.completed",
      data: {
        ...messageBase,
        status: "completed",
        completed_at: now,
        content: [
          {
            type: "text",
            text: {
              value: params.text || "",
              annotations: [],
            },
          },
        ],
      },
    },
    {
      event: "thread.run.completed",
      data: {
        ...runBase,
        status: "completed",
        completed_at: now,
      },
    }
  );

  return jsonLinesReadableStream(events);
}

export function createAssistantCompletedRunStream(threadId: string) {
  const now = Math.floor(Date.now() / 1000);
  const runId = `run_${randomUUID().replace(/-/g, "")}`;

  return jsonLinesReadableStream([
    {
      event: "thread.run.completed",
      data: {
        id: runId,
        object: "thread.run",
        created_at: now,
        thread_id: threadId,
        status: "completed",
        required_action: null,
        last_error: null,
        metadata: {},
      },
    },
  ]);
}
