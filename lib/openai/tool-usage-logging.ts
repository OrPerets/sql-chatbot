import { COLLECTIONS, executeWithRetry } from "@/lib/database";
import type { MichaelToolContext, MichaelToolRole } from "@/lib/openai/tools";

export type ToolUsageAuditEvent = {
  route: string;
  toolContext: MichaelToolContext;
  userRole: MichaelToolRole;
  userEmail?: string | null;
  responseId?: string | null;
  toolName: string;
  queries?: string[];
  sourceCount?: number;
  latencyMs?: number | null;
  status: "completed" | "fallback" | "failed";
  details?: Record<string, unknown>;
};

export async function logToolUsageAuditEvent(event: ToolUsageAuditEvent) {
  const payload = {
    source: "openai-tool-usage",
    timestamp: new Date().toISOString(),
    ...event,
  };

  if (process.env.NODE_ENV === "test") {
    return;
  }

  console.log(JSON.stringify(payload));

  try {
    await executeWithRetry(async (db) => {
      await db.collection(COLLECTIONS.AUDIT_LOGS).insertOne({
        kind: "openai_tool_usage",
        createdAt: new Date(),
        ...payload,
      });
    });
  } catch (error: any) {
    console.warn(
      "[tool-usage-logging] failed to persist audit event:",
      error?.message || error
    );
  }
}
