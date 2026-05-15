import {
  handleRuntimeConfigGet,
  handleRuntimeConfigPost,
} from "@/lib/openai/runtime-management";

export const runtime = "nodejs";

export async function GET() {
  return handleRuntimeConfigGet("canonical");
}

export async function POST(request: Request) {
  return handleRuntimeConfigPost(request, "canonical");
}
