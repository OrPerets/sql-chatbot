/**
 * SQL Query Analyzer for Avatar Gesture Mapping
 * Analyzes SQL queries and user messages to determine appropriate avatar gestures
 */

export interface SQLAnalysisResult {
  keywords: string[];
  complexity: 'simple' | 'intermediate' | 'complex';
  gesture: string;
  confidence: number;
  context: 'query' | 'question' | 'error' | 'success' | 'general';
}

export interface UserMessageAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative' | 'confused';
  containsQuestion: boolean;
  containsSQL: boolean;
  gesture: string;
  confidence: number;
}

// SQL keyword to gesture mapping
const SQL_KEYWORD_GESTURES: Record<string, string> = {
  'SELECT': 'index',        // Pointing gesture for selection
  'FROM': 'index',          // Pointing gesture for data source
  'WHERE': 'thinking',      // Thinking gesture for filtering
  'JOIN': 'handup',         // Complex concept gesture
  'INNER JOIN': 'handup',
  'LEFT JOIN': 'handup',
  'RIGHT JOIN': 'handup',
  'OUTER JOIN': 'handup',
  'ORDER BY': 'ok',         // Organization gesture
  'GROUP BY': 'ok',         // Organization gesture
  'HAVING': 'thinking',     // Thinking for conditional grouping
  'INSERT': 'thumbup',      // Positive gesture for adding data
  'UPDATE': 'side',         // Side gesture for modification
  'DELETE': 'thumbdown',    // Negative gesture for removal
  'CREATE': 'namaste',      // Respectful gesture for creation
  'DROP': 'shrug',          // Shrug for destructive operations
  'ALTER': 'side',          // Side gesture for modification
  'TRUNCATE': 'shrug',      // Shrug for destructive operations
  'INDEX': 'index',         // Pointing gesture for indexing
  'VIEW': 'ok',             // OK gesture for views
  'PROCEDURE': 'handup',    // Complex concept gesture
  'FUNCTION': 'handup',     // Complex concept gesture
  'TRIGGER': 'handup',      // Complex concept gesture
  'TRANSACTION': 'thinking', // Thinking for transactions
  'COMMIT': 'ok',           // OK for commit
  'ROLLBACK': 'shrug',      // Shrug for rollback
  'EXPLAIN': 'thinking',    // Thinking for analysis
  'DESCRIBE': 'index',      // Pointing for description
  'SHOW': 'index',          // Pointing for showing
  'LIMIT': 'ok',            // OK for limiting results
  'OFFSET': 'ok',           // OK for offsetting
  'DISTINCT': 'thinking',   // Thinking for uniqueness
  'COUNT': 'ok',            // OK for counting
  'SUM': 'ok',              // OK for summing
  'AVG': 'ok',              // OK for averaging
  'MAX': 'thumbup',         // Positive for maximum
  'MIN': 'thumbup',         // Positive for minimum
  'UNION': 'handup',        // Complex concept gesture
  'INTERSECT': 'handup',    // Complex concept gesture
  'EXCEPT': 'handup',       // Complex concept gesture
  'EXISTS': 'thinking',     // Thinking for existence
  'IN': 'thinking',         // Thinking for membership
  'BETWEEN': 'thinking',    // Thinking for ranges
  'LIKE': 'thinking',       // Thinking for pattern matching
  'IS NULL': 'shrug',       // Shrug for null checks
  'IS NOT NULL': 'ok',      // OK for not null checks
};

// User message patterns for gesture mapping
const MESSAGE_PATTERNS: Record<string, string> = {
  // Positive patterns
  'thank': 'namaste',
  'thanks': 'namaste',
  'great': 'thumbup',
  'good': 'thumbup',
  'perfect': 'thumbup',
  'excellent': 'thumbup',
  'awesome': 'thumbup',
  'yes': 'thumbup',
  'correct': 'thumbup',
  'right': 'thumbup',
  'solved': 'thumbup',
  'working': 'thumbup',
  'success': 'thumbup',
  
  // Negative patterns
  'error': 'thumbdown',
  'wrong': 'thumbdown',
  'no': 'thumbdown',
  'not working': 'thumbdown',
  'failed': 'thumbdown',
  'broken': 'thumbdown',
  'incorrect': 'thumbdown',
  
  // Question patterns
  'how': 'handup',
  'what': 'handup',
  'why': 'handup',
  'when': 'handup',
  'where': 'handup',
  'which': 'handup',
  'can you': 'handup',
  'could you': 'handup',
  'would you': 'handup',
  'help': 'handup',
  'explain': 'handup',
  'show me': 'handup',
  
  // Confusion patterns
  'confused': 'shrug',
  'confusing': 'shrug',
  'unclear': 'shrug',
  'don\'t understand': 'shrug',
  'not sure': 'shrug',
  'maybe': 'shrug',
  
  // Thinking patterns
  'think': 'thinking',
  'consider': 'thinking',
  'analyze': 'thinking',
  'compare': 'thinking',
  'evaluate': 'thinking',
};

// SQL complexity indicators
const COMPLEXITY_INDICATORS = {
  simple: ['SELECT', 'FROM', 'WHERE', 'LIMIT'],
  intermediate: ['JOIN', 'GROUP BY', 'ORDER BY', 'HAVING', 'SUBQUERY'],
  complex: ['UNION', 'INTERSECT', 'EXCEPT', 'WINDOW', 'CTE', 'RECURSIVE', 'TRIGGER', 'PROCEDURE']
};

/**
 * Analyze SQL query and determine appropriate gesture
 */
export function analyzeSQLQuery(query: string): SQLAnalysisResult {
  if (!query || typeof query !== 'string') {
    return {
      keywords: [],
      complexity: 'simple',
      gesture: 'ok',
      confidence: 0,
      context: 'general'
    };
  }

  const upperQuery = query.toUpperCase().trim();
  const keywords: string[] = [];
  let complexity: 'simple' | 'intermediate' | 'complex' = 'simple';
  let gesture = 'ok';
  let confidence = 0.5;
  let context: 'query' | 'question' | 'error' | 'success' | 'general' = 'query';

  // Extract SQL keywords
  Object.keys(SQL_KEYWORD_GESTURES).forEach(keyword => {
    if (upperQuery.includes(keyword)) {
      keywords.push(keyword);
    }
  });

  // Determine complexity
  if (COMPLEXITY_INDICATORS.complex.some(indicator => upperQuery.includes(indicator))) {
    complexity = 'complex';
  } else if (COMPLEXITY_INDICATORS.intermediate.some(indicator => upperQuery.includes(indicator))) {
    complexity = 'intermediate';
  }

  // Determine gesture based on keywords
  if (keywords.length > 0) {
    // Use the first matching keyword's gesture
    const primaryKeyword = keywords[0];
    gesture = SQL_KEYWORD_GESTURES[primaryKeyword] || 'ok';
    
    // Adjust confidence based on keyword relevance
    confidence = Math.min(0.9, 0.5 + (keywords.length * 0.1));
    
    // Adjust gesture intensity based on complexity
    if (complexity === 'complex' && gesture === 'handup') {
      gesture = 'handup'; // Keep handup for complex concepts
    } else if (complexity === 'intermediate' && gesture === 'ok') {
      gesture = 'thinking'; // Upgrade simple gestures for intermediate complexity
    }
  } else {
    // No SQL keywords found
    gesture = 'shrug';
    confidence = 0.3;
    context = 'general';
  }

  // Check for error indicators
  if (upperQuery.includes('ERROR') || upperQuery.includes('FAILED') || upperQuery.includes('SYNTAX')) {
    gesture = 'thumbdown';
    context = 'error';
    confidence = 0.8;
  }

  return {
    keywords,
    complexity,
    gesture,
    confidence,
    context
  };
}

/**
 * Analyze user message for sentiment and appropriate gesture
 */
export function analyzeUserMessage(message: string): UserMessageAnalysis {
  if (!message || typeof message !== 'string') {
    return {
      sentiment: 'neutral',
      containsQuestion: false,
      containsSQL: false,
      gesture: 'ok',
      confidence: 0
    };
  }

  const lowerMessage = message.toLowerCase();
  let sentiment: 'positive' | 'neutral' | 'negative' | 'confused' = 'neutral';
  let gesture = 'ok';
  let confidence = 0.5;
  let containsQuestion = false;
  let containsSQL = false;

  // Check for SQL content
  const sqlKeywords = Object.keys(SQL_KEYWORD_GESTURES);
  containsSQL = sqlKeywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()));

  // Check for question patterns
  containsQuestion = /^(what|how|why|when|where|which|can|could|would|do|does|did|is|are|was|were)\b/i.test(message) || 
                     message.includes('?');

  // Analyze sentiment and find matching patterns
  const positiveCount = Object.keys(MESSAGE_PATTERNS).filter(pattern => 
    lowerMessage.includes(pattern) && ['namaste', 'thumbup'].includes(MESSAGE_PATTERNS[pattern])
  ).length;

  const negativeCount = Object.keys(MESSAGE_PATTERNS).filter(pattern => 
    lowerMessage.includes(pattern) && MESSAGE_PATTERNS[pattern] === 'thumbdown'
  ).length;

  const confusedCount = Object.keys(MESSAGE_PATTERNS).filter(pattern => 
    lowerMessage.includes(pattern) && MESSAGE_PATTERNS[pattern] === 'shrug'
  ).length;

  const questionCount = Object.keys(MESSAGE_PATTERNS).filter(pattern => 
    lowerMessage.includes(pattern) && MESSAGE_PATTERNS[pattern] === 'handup'
  ).length;

  // Determine sentiment
  if (confusedCount > 0) {
    sentiment = 'confused';
    gesture = 'shrug';
    confidence = 0.8;
  } else if (negativeCount > positiveCount) {
    sentiment = 'negative';
    gesture = 'thumbdown';
    confidence = 0.7;
  } else if (positiveCount > 0) {
    sentiment = 'positive';
    gesture = 'thumbup';
    confidence = 0.7;
  } else if (containsQuestion || questionCount > 0) {
    sentiment = 'neutral';
    gesture = 'handup';
    confidence = 0.6;
  } else if (containsSQL) {
    // If contains SQL but no clear sentiment, analyze the SQL
    const sqlAnalysis = analyzeSQLQuery(message);
    gesture = sqlAnalysis.gesture;
    confidence = sqlAnalysis.confidence;
  }

  return {
    sentiment,
    containsQuestion,
    containsSQL,
    gesture,
    confidence
  };
}

/**
 * Combined analysis for both SQL queries and user messages
 */
export function analyzeMessage(message: string): {
  sqlAnalysis: SQLAnalysisResult;
  messageAnalysis: UserMessageAnalysis;
  recommendedGesture: string;
  confidence: number;
} {
  const sqlAnalysis = analyzeSQLQuery(message);
  const messageAnalysis = analyzeUserMessage(message);

  // Determine the best gesture based on both analyses
  let recommendedGesture = 'ok';
  let confidence = 0.5;

  // Prioritize SQL analysis if SQL content is detected
  if (messageAnalysis.containsSQL && sqlAnalysis.confidence > 0.5) {
    recommendedGesture = sqlAnalysis.gesture;
    confidence = sqlAnalysis.confidence;
  } else if (messageAnalysis.confidence > 0.5) {
    recommendedGesture = messageAnalysis.gesture;
    confidence = messageAnalysis.confidence;
  } else if (sqlAnalysis.confidence > 0.5) {
    recommendedGesture = sqlAnalysis.gesture;
    confidence = sqlAnalysis.confidence;
  }

  // Special case: if user seems confused and there's SQL, use shrug
  if (messageAnalysis.sentiment === 'confused' && messageAnalysis.containsSQL) {
    recommendedGesture = 'shrug';
    confidence = Math.max(confidence, 0.8);
  }

  return {
    sqlAnalysis,
    messageAnalysis,
    recommendedGesture,
    confidence
  };
}

/**
 * Extract SQL keywords from text for gesture mapping
 */
export function extractSQLKeywords(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const upperText = text.toUpperCase();
  const keywords: string[] = [];

  Object.keys(SQL_KEYWORD_GESTURES).forEach(keyword => {
    if (upperText.includes(keyword)) {
      keywords.push(keyword);
    }
  });

  return keywords;
}

/**
 * Get gesture for specific SQL keyword
 */
export function getGestureForSQLKeyword(keyword: string): string {
  return SQL_KEYWORD_GESTURES[keyword.toUpperCase()] || 'ok';
}

/**
 * Get all available gestures
 */
export function getAvailableGestures(): string[] {
  return ['handup', 'index', 'ok', 'thumbup', 'thumbdown', 'side', 'shrug', 'namaste'];
}
