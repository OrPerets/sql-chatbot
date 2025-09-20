import { NextRequest } from "next/server";
import { openai } from "@/app/openai";

export const runtime = "nodejs";

// SQL function handlers for enhanced assistant capabilities
export async function POST(req: NextRequest) {
  try {
    const { functionName, parameters } = await req.json();

    switch (functionName) {
      case "execute_sql_query":
        return await handleExecuteSQLQuery(parameters);
      case "get_database_schema":
        return await handleGetDatabaseSchema(parameters);
      case "analyze_query_performance":
        return await handleAnalyzeQueryPerformance(parameters);
      default:
        return Response.json({ 
          error: `Unknown function: ${functionName}` 
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error("SQL function handler error:", error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

async function handleExecuteSQLQuery(parameters: {
  query: string;
  database: string;
  explain_plan?: boolean;
  educational_context?: string;
}) {
  const { query, database, explain_plan = false, educational_context } = parameters;

  // Validate database parameter
  const allowedDatabases = ["practice", "examples", "homework"];
  if (!allowedDatabases.includes(database)) {
    return Response.json({
      success: false,
      error: `Invalid database. Allowed databases: ${allowedDatabases.join(", ")}`,
      educational_note: "This safety check prevents access to production databases."
    });
  }

  // Basic SQL injection protection (for educational purposes)
  const dangerousKeywords = [
    "DROP", "DELETE", "TRUNCATE", "ALTER", "CREATE", "INSERT", "UPDATE"
  ];
  
  const upperQuery = query.toUpperCase();
  const containsDangerous = dangerousKeywords.some(keyword => 
    upperQuery.includes(keyword)
  );

  if (containsDangerous) {
    return Response.json({
      success: false,
      error: "Query contains potentially dangerous operations",
      educational_note: "In practice environments, we limit queries to SELECT statements for safety. This teaches students about SQL security and safe query practices.",
      suggestion: "Try using SELECT statements to explore the data structure and relationships."
    });
  }

  // Simulate query execution (replace with actual database connection)
  const mockResult: any = {
    success: true,
    query: query,
    database: database,
    results: [
      { id: 1, name: "Sample Data", created_at: "2024-01-01" },
      { id: 2, name: "Example Record", created_at: "2024-01-02" }
    ],
    row_count: 2,
    execution_time: "0.045s",
    educational_context: educational_context || "Query execution completed successfully",
    learning_points: [
      "Query syntax is correct",
      "Results show proper data structure",
      "Consider using LIMIT for large datasets"
    ]
  };

  if (explain_plan) {
    mockResult.execution_plan = {
      operation: "Table Scan",
      cost: "0.1",
      rows_examined: 100,
      optimization_suggestions: [
        "Consider adding an index on frequently queried columns",
        "Use WHERE clauses to limit result sets",
        "JOIN operations can be optimized with proper indexing"
      ]
    };
  }

  return Response.json(mockResult);
}

async function handleGetDatabaseSchema(parameters: {
  database: string;
  table_pattern?: string;
  include_relationships?: boolean;
}) {
  const { database, table_pattern, include_relationships = true } = parameters;

  // Mock schema data (replace with actual database introspection)
  const mockSchema: any = {
    database: database,
    tables: [
      {
        name: "students",
        columns: [
          { name: "id", type: "INT", primary_key: true, nullable: false },
          { name: "name", type: "VARCHAR(255)", primary_key: false, nullable: false },
          { name: "email", type: "VARCHAR(255)", primary_key: false, nullable: true },
          { name: "created_at", type: "TIMESTAMP", primary_key: false, nullable: false }
        ]
      },
      {
        name: "courses",
        columns: [
          { name: "id", type: "INT", primary_key: true, nullable: false },
          { name: "title", type: "VARCHAR(255)", primary_key: false, nullable: false },
          { name: "credits", type: "INT", primary_key: false, nullable: false }
        ]
      },
      {
        name: "enrollments",
        columns: [
          { name: "id", type: "INT", primary_key: true, nullable: false },
          { name: "student_id", type: "INT", primary_key: false, nullable: false },
          { name: "course_id", type: "INT", primary_key: false, nullable: false },
          { name: "grade", type: "DECIMAL(3,2)", primary_key: false, nullable: true }
        ]
      }
    ],
    educational_notes: [
      "This schema demonstrates a typical many-to-many relationship through the enrollments table",
      "Primary keys are essential for data integrity and performance",
      "Foreign key relationships help maintain referential integrity"
    ]
  };

  if (include_relationships) {
    mockSchema.relationships = [
      {
        table: "enrollments",
        column: "student_id",
        references: { table: "students", column: "id" },
        type: "FOREIGN KEY"
      },
      {
        table: "enrollments",
        column: "course_id", 
        references: { table: "courses", column: "id" },
        type: "FOREIGN KEY"
      }
    ];
  }

  // Filter tables by pattern if provided
  if (table_pattern) {
    const regex = new RegExp(table_pattern, 'i');
    mockSchema.tables = mockSchema.tables.filter(table => 
      regex.test(table.name)
    );
  }

  return Response.json(mockSchema);
}

async function handleAnalyzeQueryPerformance(parameters: {
  query: string;
  database_context?: any;
  learning_level?: string;
}) {
  const { query, database_context, learning_level = "intermediate" } = parameters;

  // Mock performance analysis (replace with actual query analysis)
  const analysis = {
    query: query,
    performance_score: 75,
    complexity_level: learning_level,
    analysis: {
      estimated_execution_time: "0.12s",
      rows_examined: 1500,
      index_usage: "Partial",
      memory_usage: "Low"
    },
    optimization_suggestions: [
      {
        issue: "Missing index on WHERE clause column",
        suggestion: "CREATE INDEX idx_student_name ON students(name)",
        impact: "High",
        explanation: "Adding an index will significantly reduce query time for name-based searches"
      },
      {
        issue: "SELECT * usage",
        suggestion: "Specify only needed columns: SELECT id, name FROM students",
        impact: "Medium", 
        explanation: "Selecting specific columns reduces network traffic and memory usage"
      }
    ],
    learning_points: getLearningPointsByLevel(learning_level),
    best_practices: [
      "Always use EXPLAIN to understand query execution plans",
      "Index frequently queried columns",
      "Use appropriate WHERE clauses to limit result sets",
      "Consider query caching for repeated operations"
    ]
  };

  return Response.json(analysis);
}

function getLearningPointsByLevel(level: string): string[] {
  switch (level) {
    case "beginner":
      return [
        "Focus on correct SQL syntax first",
        "Understand basic SELECT, WHERE, and JOIN operations",
        "Learn about primary and foreign keys"
      ];
    case "intermediate":
      return [
        "Understand query execution plans",
        "Learn about index usage and optimization",
        "Practice with subqueries and complex JOINs"
      ];
    case "advanced":
      return [
        "Master query optimization techniques",
        "Understand database engine internals",
        "Learn about partitioning and advanced indexing strategies"
      ];
    default:
      return ["Continue practicing and exploring SQL concepts"];
  }
}
