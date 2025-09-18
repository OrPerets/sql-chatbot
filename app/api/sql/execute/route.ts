import { NextResponse } from "next/server";
import { executeSqlForSubmission } from "../../_mock/homeworkStore";
import type { SqlExecutionRequest } from "@/app/homework/types";

export async function POST(request: Request) {
  const payload = (await request.json()) as SqlExecutionRequest;
  const result = executeSqlForSubmission(payload);
  if (!result) {
    return NextResponse.json({ message: "Execution failed" }, { status: 400 });
  }
  return NextResponse.json(result);
}
