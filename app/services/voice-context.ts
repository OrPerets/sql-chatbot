'use client';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sqlContext?: string;
  queryResults?: any;
}

export class VoiceContextManager {
  private conversationHistory: ConversationMessage[] = [];
  private currentSQLContext: string | null = null;
  private sessionStartTime: Date = new Date();
  private maxHistoryLength = 20; // Keep last 20 messages
  private maxContextAge = 30 * 60 * 1000; // 30 minutes in milliseconds

  constructor() {
    console.log('🧠 VoiceContextManager initialized');
  }

  /**
   * Update the current SQL context with query and results
   */
  updateSQLContext(query: string, results?: any): void {
    const timestamp = new Date().toISOString();
    const resultsPreview = results 
      ? `Results: ${JSON.stringify(results).slice(0, 200)}...` 
      : 'No results';
    
    this.currentSQLContext = `[${timestamp}] Query: ${query} | ${resultsPreview}`;
    
    console.log('📊 SQL context updated:', {
      query: query.slice(0, 100) + '...',
      hasResults: !!results,
      contextLength: this.currentSQLContext.length
    });
  }

  /**
   * Add a message to the conversation history
   */
  addToHistory(role: 'user' | 'assistant', content: string, sqlContext?: string, queryResults?: any): void {
    const message: ConversationMessage = {
      role,
      content,
      timestamp: new Date(),
      sqlContext,
      queryResults
    };

    this.conversationHistory.push(message);
    
    // Clean old messages
    this.cleanupHistory();
    
    console.log('💬 Message added to history:', {
      role,
      contentLength: content.length,
      totalMessages: this.conversationHistory.length,
      hasSqlContext: !!sqlContext
    });
  }

  /**
   * Get contextual prompt for AI assistant
   */
  getContextualPrompt(): string {
    const recentHistory = this.getRecentHistory();
    const sqlContextStr = this.currentSQLContext || 'None';
    
    const historyStr = recentHistory
      .map(msg => `${msg.role}: ${msg.content}${msg.sqlContext ? ` [SQL: ${msg.sqlContext}]` : ''}`)
      .join('\n');

    const contextPrompt = `
You are Michael, an expert SQL tutor helping students learn SQL concepts.

Session Context:
- Session started: ${this.sessionStartTime.toISOString()}
- Current SQL context: ${sqlContextStr}
- Messages in conversation: ${this.conversationHistory.length}

Recent conversation history:
${historyStr || 'No recent conversation'}

Instructions:
- Respond naturally and conversationally as Michael
- Keep responses concise but helpful (aim for 1-2 sentences for simple queries)
- When explaining SQL concepts, be practical and give examples
- Support both Hebrew and English languages
- If asked about SQL queries, reference the current SQL context when relevant
- Encourage learning through questions and exploration
- Be patient and encouraging with beginners
`.trim();

    return contextPrompt;
  }

  /**
   * Get conversation summary for analytics
   */
  getConversationSummary(): {
    totalMessages: number;
    userMessages: number;
    assistantMessages: number;
    sqlQueriesDiscussed: number;
    sessionDuration: number;
    averageResponseLength: number;
  } {
    const userMessages = this.conversationHistory.filter(m => m.role === 'user').length;
    const assistantMessages = this.conversationHistory.filter(m => m.role === 'assistant').length;
    const sqlQueriesDiscussed = this.conversationHistory.filter(m => m.sqlContext).length;
    const sessionDuration = Date.now() - this.sessionStartTime.getTime();
    
    const totalContentLength = this.conversationHistory.reduce((sum, msg) => sum + msg.content.length, 0);
    const averageResponseLength = this.conversationHistory.length > 0 
      ? Math.round(totalContentLength / this.conversationHistory.length) 
      : 0;

    return {
      totalMessages: this.conversationHistory.length,
      userMessages,
      assistantMessages,
      sqlQueriesDiscussed,
      sessionDuration,
      averageResponseLength
    };
  }

  /**
   * Get relevant context for a specific query
   */
  getRelevantContext(query: string): {
    relatedMessages: ConversationMessage[];
    sqlContext: string | null;
    suggestions: string[];
  } {
    const queryLower = query.toLowerCase();
    const sqlKeywords = ['select', 'insert', 'update', 'delete', 'join', 'where', 'group by', 'order by'];
    const hasSqlKeywords = sqlKeywords.some(keyword => queryLower.includes(keyword));

    // Find related messages
    const relatedMessages = this.conversationHistory
      .filter(msg => {
        const contentLower = msg.content.toLowerCase();
        return queryLower.split(' ').some(word => 
          word.length > 3 && contentLower.includes(word)
        );
      })
      .slice(-5); // Last 5 related messages

    // Generate suggestions based on context
    const suggestions: string[] = [];
    
    if (hasSqlKeywords && this.currentSQLContext) {
      suggestions.push('Would you like me to explain this SQL query?');
      suggestions.push('Do you want to see examples of similar queries?');
    }
    
    if (queryLower.includes('error') || queryLower.includes('problem')) {
      suggestions.push('Let me help you debug this SQL issue');
      suggestions.push('Can you share the exact error message?');
    }

    if (queryLower.includes('learn') || queryLower.includes('tutorial')) {
      suggestions.push('I can guide you through SQL basics step by step');
      suggestions.push('Would you like to practice with some exercises?');
    }

    return {
      relatedMessages,
      sqlContext: this.currentSQLContext,
      suggestions
    };
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
    this.currentSQLContext = null;
    this.sessionStartTime = new Date();
    console.log('🧹 Conversation history cleared');
  }

  /**
   * Export conversation data
   */
  exportConversation(): {
    sessionInfo: {
      startTime: Date;
      duration: number;
      messageCount: number;
    };
    messages: ConversationMessage[];
    summary: ReturnType<typeof this.getConversationSummary>;
  } {
    return {
      sessionInfo: {
        startTime: this.sessionStartTime,
        duration: Date.now() - this.sessionStartTime.getTime(),
        messageCount: this.conversationHistory.length
      },
      messages: [...this.conversationHistory],
      summary: this.getConversationSummary()
    };
  }

  /**
   * Get recent conversation history (last 6 messages or 10 minutes)
   */
  private getRecentHistory(): ConversationMessage[] {
    const now = Date.now();
    const cutoffTime = now - this.maxContextAge;
    
    return this.conversationHistory
      .filter(msg => msg.timestamp.getTime() > cutoffTime)
      .slice(-6); // Last 6 messages within time limit
  }

  /**
   * Clean up old messages to prevent memory bloat
   */
  private cleanupHistory(): void {
    // Remove messages older than maxContextAge
    const cutoffTime = Date.now() - this.maxContextAge;
    this.conversationHistory = this.conversationHistory.filter(
      msg => msg.timestamp.getTime() > cutoffTime
    );

    // Limit total message count
    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
    }
  }

  /**
   * Get current context state
   */
  getCurrentState(): {
    hasActiveContext: boolean;
    messageCount: number;
    sqlContextActive: boolean;
    sessionAge: number;
  } {
    return {
      hasActiveContext: this.conversationHistory.length > 0,
      messageCount: this.conversationHistory.length,
      sqlContextActive: !!this.currentSQLContext,
      sessionAge: Date.now() - this.sessionStartTime.getTime()
    };
  }
}
