import { NextResponse } from "next/server";
import type { SqlExecutionRequest, SqlExecutionResponse } from "@/app/homework/types";
import { executeSqlForSubmission } from "@/lib/submissions";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SqlExecutionRequest;
    console.log('🟦 SQL Execute API called');
    console.log('   SQL:', payload.sql);
    console.log('   Submission ID:', payload.submissionId);
    console.log('   Question ID:', payload.questionId);
    console.log('   Set ID:', payload.setId);
    console.log('   Student ID:', payload.studentId);
    
    // Use the real SQL executor that handles datasets and Exercise 3 data
    const result = await executeSqlForSubmission(payload);
    
    if (!result) {
      console.error('❌ SQL execution returned null');
      return NextResponse.json(
        { 
          error: 'Failed to execute SQL',
          details: 'Execution returned null result'
        },
        { status: 500 }
      );
    }
    
    console.log(`✅ SQL execution successful - ${result.rows.length} rows, ${result.columns.length} columns`);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('❌ Error executing SQL:', error);
    return NextResponse.json(
      { 
        error: error?.message || 'Failed to execute SQL',
        details: error instanceof Error ? error.stack : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
