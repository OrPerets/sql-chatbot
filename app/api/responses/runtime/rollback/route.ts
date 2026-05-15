import {
  handleRuntimeRollbackGet,
  handleRuntimeRollbackHealth,
  handleRuntimeRollbackPost,
} from "@/lib/openai/runtime-management";

export const runtime = "nodejs";

export async function GET() {
  return handleRuntimeRollbackGet("canonical");
}

export async function POST(request: Request) {
  return handleRuntimeRollbackPost(request, "canonical");
}

export async function PATCH() {
  return handleRuntimeRollbackHealth("canonical");
}
