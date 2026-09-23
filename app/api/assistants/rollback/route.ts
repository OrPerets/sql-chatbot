import {
  handleRuntimeRollbackGet,
  handleRuntimeRollbackHealth,
  handleRuntimeRollbackPost,
} from "@/lib/openai/runtime-management";

export const runtime = "nodejs";

export async function GET() {
  return handleRuntimeRollbackGet("assistants_alias");
}

export async function POST(request: Request) {
  return handleRuntimeRollbackPost(request, "assistants_alias");
}

export async function PATCH() {
  return handleRuntimeRollbackHealth("assistants_alias");
}
