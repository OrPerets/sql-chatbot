import {
  handleRuntimeValidateGet,
  handleRuntimeValidatePost,
} from "@/lib/openai/runtime-management";

export const runtime = "nodejs";

export async function GET() {
  return handleRuntimeValidateGet("assistants_alias");
}

export async function POST(request: Request) {
  return handleRuntimeValidatePost(request, "assistants_alias");
}
