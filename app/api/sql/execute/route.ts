import { NextResponse } from "next/server";
import { executeSqlForSubmission } from "@/lib/submissions";
import type { SqlExecutionRequest } from "@/app/homework/types";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SqlExecutionRequest;
    const result = await executeSqlForSubmission(payload);
    if (!result) {
      return NextResponse.json({ message: "Execution failed" }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error executing SQL:', error);
    return NextResponse.json(
      { error: 'Failed to execute SQL' },
      { status: 500 }
    );
  }
}
