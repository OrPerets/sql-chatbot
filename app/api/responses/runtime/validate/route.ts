import {
  handleRuntimeValidateGet,
  handleRuntimeValidatePost,
} from "@/lib/openai/runtime-management";

export const runtime = "nodejs";

export async function GET() {
  return handleRuntimeValidateGet("canonical");
}

export async function POST(request: Request) {
  return handleRuntimeValidatePost(request, "canonical");
}
