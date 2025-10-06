import { NextResponse } from "next/server";
import type { SqlExecutionRequest, SqlExecutionResponse } from "@/app/homework/types";

// Simple SQL executor for demo/testing
// TODO: Replace with real SQL.js client-side execution or server-side SQLite
function executeSimpleSQL(sql: string): { columns: string[], rows: any[] } {
  const sqlLower = sql.toLowerCase().trim();
  
  // Sample Employees data
  if (sqlLower.includes('employees')) {
    const employees = [
      { id: 1, name: 'Alice Johnson', department: 'Engineering', salary: 95000, hire_date: '2020-01-15' },
      { id: 2, name: 'Bob Smith', department: 'Marketing', salary: 75000, hire_date: '2019-03-22' },
      { id: 3, name: 'Carol White', department: 'Engineering', salary: 98000, hire_date: '2018-07-10' },
      { id: 4, name: 'David Brown', department: 'Sales', salary: 68000, hire_date: '2021-05-30' },
      { id: 5, name: 'Eve Davis', department: 'HR', salary: 72000, hire_date: '2020-11-12' },
    ];
    
    // Simple WHERE filtering
    let filteredData = [...employees];
    if (sqlLower.includes('where')) {
      if (sqlLower.includes('engineering')) {
        filteredData = employees.filter(e => e.department === 'Engineering');
      } else if (sqlLower.includes('salary > 80000') || sqlLower.includes('salary>80000')) {
        filteredData = employees.filter(e => e.salary > 80000);
      }
    }
    
    // Get columns from SELECT
    const selectMatch = sqlLower.match(/select\s+(.+?)\s+from/);
    if (selectMatch && selectMatch[1].trim() !== '*') {
      const selectedCols = selectMatch[1].split(',').map(c => c.trim());
      const columns = selectedCols;
      const rows = filteredData.map(row => {
        const obj: any = {};
        selectedCols.forEach(col => {
          if (col in row) obj[col] = (row as any)[col];
        });
        return obj;
      });
      return { columns, rows };
    }
    
    return {
      columns: ['id', 'name', 'department', 'salary', 'hire_date'],
      rows: filteredData
    };
  }
  
  // Default empty result
  return { columns: [], rows: [] };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SqlExecutionRequest;
    console.log('🟦 SQL Execute API called');
    console.log('   SQL:', payload.sql);
    
    const startTime = Date.now();
    
    // Execute the SQL
    const { columns, rows } = executeSimpleSQL(payload.sql);
    const executionMs = Date.now() - startTime;
    
    // Simple scoring
    const score = rows.length > 0 ? 8 : 5;
    
    const result: SqlExecutionResponse = {
      columns,
      rows: rows.slice(0, 50), // Limit to 50 rows
      executionMs,
      truncated: rows.length > 50,
      feedback: {
        questionId: payload.questionId,
        score,
        autoNotes: rows.length > 0 
          ? `Query executed successfully. Returned ${rows.length} row(s).`
          : 'Query executed but returned no results.',
        rubricBreakdown: [],
      },
    };
    
    console.log(`✅ SQL execution successful - ${rows.length} rows, Score: ${score}`);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('❌ Error executing SQL:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to execute SQL' },
      { status: 500 }
    );
  }
}
