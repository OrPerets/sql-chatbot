import { NextRequest } from "next/server";

export const runtime = "nodejs";

// In-memory storage for demo (replace with database in production)
let usageData: ModelUsageRecord[] = [];

interface ModelUsageRecord {
  id: string;
  userId?: string;
  model: string;
  tokens: number;
  cost: number;
  timestamp: string;
  assistantId: string;
  operation: string;
  sessionId?: string;
}

interface UsageAnalytics {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  averageTokensPerRequest: number;
  averageCostPerRequest: number;
  modelBreakdown: Record<string, {
    requests: number;
    tokens: number;
    cost: number;
  }>;
  dailyUsage: Record<string, {
    requests: number;
    tokens: number;
    cost: number;
  }>;
  topOperations: Array<{
    operation: string;
    count: number;
    totalTokens: number;
    avgTokens: number;
  }>;
}

// Log model usage
export async function POST(req: NextRequest) {
  try {
    const usageRecord: Omit<ModelUsageRecord, 'id'> = await req.json();
    
    const record: ModelUsageRecord = {
      id: generateId(),
      ...usageRecord,
      timestamp: usageRecord.timestamp || new Date().toISOString()
    };

    // Validate required fields
    if (!record.model || !record.assistantId || !record.operation) {
      return Response.json({ 
        error: "Missing required fields: model, assistantId, operation" 
      }, { status: 400 });
    }

    // Store usage record
    usageData.push(record);
    
    // Keep only last 10000 records to prevent memory issues
    if (usageData.length > 10000) {
      usageData = usageData.slice(-10000);
    }

    // Check for anomalous usage patterns
    const anomaly = await detectAnomalousUsage(record);
    
    return Response.json({ 
      success: true,
      recordId: record.id,
      anomalyDetected: anomaly.detected,
      anomalyReason: anomaly.reason,
      totalRecords: usageData.length
    });
  } catch (error: any) {
    console.error("Model usage logging error:", error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

// Get usage analytics
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const timeRange = url.searchParams.get('timeRange') || '24h';
    const userId = url.searchParams.get('userId');
    const model = url.searchParams.get('model');

    // Filter data based on parameters
    let filteredData = usageData;
    
    // Time range filter
    const now = new Date();
    const timeRangeMs = getTimeRangeMs(timeRange);
    const startTime = new Date(now.getTime() - timeRangeMs);
    
    filteredData = filteredData.filter(record => 
      new Date(record.timestamp) >= startTime
    );

    // User filter
    if (userId) {
      filteredData = filteredData.filter(record => record.userId === userId);
    }

    // Model filter
    if (model) {
      filteredData = filteredData.filter(record => record.model === model);
    }

    const analytics = generateAnalytics(filteredData);
    
    return Response.json({
      timeRange,
      filters: { userId, model },
      analytics,
      recordCount: filteredData.length,
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Analytics generation error:", error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

// Delete old usage data
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const olderThan = url.searchParams.get('olderThan') || '30d';
    
    const cutoffTime = new Date();
    cutoffTime.setTime(cutoffTime.getTime() - getTimeRangeMs(olderThan));
    
    const initialCount = usageData.length;
    usageData = usageData.filter(record => 
      new Date(record.timestamp) >= cutoffTime
    );
    
    const deletedCount = initialCount - usageData.length;
    
    return Response.json({
      success: true,
      deletedRecords: deletedCount,
      remainingRecords: usageData.length,
      cutoffTime: cutoffTime.toISOString()
    });
  } catch (error: any) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

function generateId(): string {
  return `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getTimeRangeMs(timeRange: string): number {
  const ranges: Record<string, number> = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000
  };
  return ranges[timeRange] || ranges['24h'];
}

function generateAnalytics(data: ModelUsageRecord[]): UsageAnalytics {
  if (data.length === 0) {
    return {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      averageTokensPerRequest: 0,
      averageCostPerRequest: 0,
      modelBreakdown: {},
      dailyUsage: {},
      topOperations: []
    };
  }

  const totalRequests = data.length;
  const totalTokens = data.reduce((sum, record) => sum + record.tokens, 0);
  const totalCost = data.reduce((sum, record) => sum + record.cost, 0);

  // Model breakdown
  const modelBreakdown: Record<string, any> = {};
  data.forEach(record => {
    if (!modelBreakdown[record.model]) {
      modelBreakdown[record.model] = { requests: 0, tokens: 0, cost: 0 };
    }
    modelBreakdown[record.model].requests++;
    modelBreakdown[record.model].tokens += record.tokens;
    modelBreakdown[record.model].cost += record.cost;
  });

  // Daily usage
  const dailyUsage: Record<string, any> = {};
  data.forEach(record => {
    const date = new Date(record.timestamp).toISOString().split('T')[0];
    if (!dailyUsage[date]) {
      dailyUsage[date] = { requests: 0, tokens: 0, cost: 0 };
    }
    dailyUsage[date].requests++;
    dailyUsage[date].tokens += record.tokens;
    dailyUsage[date].cost += record.cost;
  });

  // Top operations
  const operationStats: Record<string, any> = {};
  data.forEach(record => {
    if (!operationStats[record.operation]) {
      operationStats[record.operation] = { count: 0, totalTokens: 0 };
    }
    operationStats[record.operation].count++;
    operationStats[record.operation].totalTokens += record.tokens;
  });

  const topOperations = Object.entries(operationStats)
    .map(([operation, stats]: [string, any]) => ({
      operation,
      count: stats.count,
      totalTokens: stats.totalTokens,
      avgTokens: Math.round(stats.totalTokens / stats.count)
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalRequests,
    totalTokens,
    totalCost: Math.round(totalCost * 100) / 100,
    averageTokensPerRequest: Math.round(totalTokens / totalRequests),
    averageCostPerRequest: Math.round((totalCost / totalRequests) * 10000) / 10000,
    modelBreakdown,
    dailyUsage,
    topOperations
  };
}

async function detectAnomalousUsage(record: ModelUsageRecord): Promise<{
  detected: boolean;
  reason?: string;
}> {
  // Simple anomaly detection rules
  const recentRecords = usageData
    .filter(r => r.userId === record.userId)
    .filter(r => {
      const recordTime = new Date(r.timestamp);
      const cutoff = new Date(Date.now() - 60 * 60 * 1000); // Last hour
      return recordTime >= cutoff;
    });

  // Check for unusual token usage
  if (record.tokens > 50000) {
    return {
      detected: true,
      reason: "Unusually high token usage in single request"
    };
  }

  // Check for high frequency usage
  if (recentRecords.length > 100) {
    return {
      detected: true,
      reason: "High frequency usage detected (>100 requests/hour)"
    };
  }

  // Check for cost spikes
  if (record.cost > 5.0) {
    return {
      detected: true,
      reason: "High cost per request detected"
    };
  }

  return { detected: false };
}
