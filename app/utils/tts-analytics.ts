// TTS Analytics and Monitoring Service
export interface TTSUsageMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  cacheHitRate: number;
  averageAudioSize: number;
  errorRate: number;
  mostUsedVoices: Record<string, number>;
  mostUsedEmotions: Record<string, number>;
  mostUsedContentTypes: Record<string, number>;
  peakUsageHour: number;
  dailyActiveUsers: number;
  sessionDuration: number;
}

export interface TTSErrorMetrics {
  errorType: string;
  errorMessage: string;
  timestamp: number;
  voice: string;
  textLength: number;
  userAgent: string;
  frequency: number;
}

export interface TTSPerformanceMetrics {
  timestamp: number;
  responseTime: number;
  cacheHit: boolean;
  audioSize: number;
  voice: string;
  emotion: string;
  contentType: string;
  errorType?: string;
  userId?: string;
}

export class TTSAnalyticsService {
  private metrics: TTSPerformanceMetrics[] = [];
  private errors: TTSErrorMetrics[] = [];
  private sessionStartTime: number = Date.now();
  private isEnabled: boolean = true;

  constructor() {
    this.startPeriodicReporting();
    this.cleanupOldMetrics();
  }

  // Record a TTS request
  recordRequest(metrics: Omit<TTSPerformanceMetrics, 'timestamp'>): void {
    if (!this.isEnabled) return;

    const fullMetrics: TTSPerformanceMetrics = {
      ...metrics,
      timestamp: Date.now()
    };

    this.metrics.push(fullMetrics);

    // Keep only last 1000 metrics to prevent memory issues
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  // Record an error
  recordError(error: Error, context: {
    voice: string;
    textLength: number;
    userAgent: string;
  }): void {
    if (!this.isEnabled) return;

    const errorMetrics: TTSErrorMetrics = {
      errorType: error.constructor.name,
      errorMessage: error.message,
      timestamp: Date.now(),
      voice: context.voice,
      textLength: context.textLength,
      userAgent: context.userAgent,
      frequency: 1
    };

    // Check if similar error already exists
    const existingError = this.errors.find(e => 
      e.errorType === errorMetrics.errorType && 
      e.errorMessage === errorMetrics.errorMessage
    );

    if (existingError) {
      existingError.frequency++;
      existingError.timestamp = Date.now();
    } else {
      this.errors.push(errorMetrics);
    }

    // Keep only last 100 errors
    if (this.errors.length > 100) {
      this.errors = this.errors.slice(-100);
    }
  }

  // Get comprehensive usage metrics
  getUsageMetrics(): TTSUsageMetrics {
    const now = Date.now();
    const last24Hours = this.metrics.filter(m => now - m.timestamp < 24 * 60 * 60 * 1000);
    
    const successfulRequests = last24Hours.filter(m => !m.errorType).length;
    const failedRequests = last24Hours.filter(m => m.errorType).length;
    const totalRequests = last24Hours.length;

    const averageResponseTime = totalRequests > 0 
      ? last24Hours.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests 
      : 0;

    const cacheHitRate = totalRequests > 0
      ? last24Hours.filter(m => m.cacheHit).length / totalRequests * 100
      : 0;

    const averageAudioSize = totalRequests > 0
      ? last24Hours.reduce((sum, m) => sum + m.audioSize, 0) / totalRequests
      : 0;

    const errorRate = totalRequests > 0 ? failedRequests / totalRequests * 100 : 0;

    // Voice usage statistics
    const voiceUsage: Record<string, number> = {};
    last24Hours.forEach(m => {
      voiceUsage[m.voice] = (voiceUsage[m.voice] || 0) + 1;
    });

    // Emotion usage statistics
    const emotionUsage: Record<string, number> = {};
    last24Hours.forEach(m => {
      emotionUsage[m.emotion] = (emotionUsage[m.emotion] || 0) + 1;
    });

    // Content type usage statistics
    const contentTypeUsage: Record<string, number> = {};
    last24Hours.forEach(m => {
      contentTypeUsage[m.contentType] = (contentTypeUsage[m.contentType] || 0) + 1;
    });

    // Find peak usage hour
    const hourlyUsage: Record<number, number> = {};
    last24Hours.forEach(m => {
      const hour = new Date(m.timestamp).getHours();
      hourlyUsage[hour] = (hourlyUsage[hour] || 0) + 1;
    });

    const peakUsageHour = Object.entries(hourlyUsage)
      .reduce((max, [hour, count]) => count > max.count ? { hour: parseInt(hour), count } : max, { hour: 0, count: 0 })
      .hour;

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      cacheHitRate,
      averageAudioSize,
      errorRate,
      mostUsedVoices: voiceUsage,
      mostUsedEmotions: emotionUsage,
      mostUsedContentTypes: contentTypeUsage,
      peakUsageHour,
      dailyActiveUsers: new Set(last24Hours.map(m => m.userId).filter(Boolean)).size,
      sessionDuration: now - this.sessionStartTime
    };
  }

  // Get error analysis
  getErrorAnalysis(): {
    totalErrors: number;
    errorBreakdown: Record<string, number>;
    recentErrors: TTSErrorMetrics[];
    errorTrend: 'increasing' | 'decreasing' | 'stable';
  } {
    const now = Date.now();
    const lastHour = this.errors.filter(e => now - e.timestamp < 60 * 60 * 1000);
    const previousHour = this.errors.filter(e => {
      const timeDiff = now - e.timestamp;
      return timeDiff >= 60 * 60 * 1000 && timeDiff < 2 * 60 * 60 * 1000;
    });

    const errorBreakdown: Record<string, number> = {};
    this.errors.forEach(e => {
      errorBreakdown[e.errorType] = (errorBreakdown[e.errorType] || 0) + e.frequency;
    });

    const lastHourCount = lastHour.reduce((sum, e) => sum + e.frequency, 0);
    const previousHourCount = previousHour.reduce((sum, e) => sum + e.frequency, 0);

    let errorTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (lastHourCount > previousHourCount * 1.2) {
      errorTrend = 'increasing';
    } else if (lastHourCount < previousHourCount * 0.8) {
      errorTrend = 'decreasing';
    }

    return {
      totalErrors: this.errors.length,
      errorBreakdown,
      recentErrors: lastHour.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10),
      errorTrend
    };
  }

  // Get performance insights
  getPerformanceInsights(): {
    performanceScore: number; // 1-100
    recommendations: string[];
    bottlenecks: string[];
    optimizations: string[];
  } {
    const metrics = this.getUsageMetrics();
    const errorAnalysis = this.getErrorAnalysis();

    let performanceScore = 100;

    // Deduct points for various issues
    if (metrics.errorRate > 5) performanceScore -= 20;
    if (metrics.averageResponseTime > 2000) performanceScore -= 15;
    if (metrics.cacheHitRate < 50) performanceScore -= 10;
    if (errorAnalysis.errorTrend === 'increasing') performanceScore -= 15;
    if (metrics.averageAudioSize > 500000) performanceScore -= 10; // 500KB

    const recommendations: string[] = [];
    const bottlenecks: string[] = [];
    const optimizations: string[] = [];

    if (metrics.errorRate > 5) {
      bottlenecks.push('High error rate');
      recommendations.push('Investigate and fix common error patterns');
      optimizations.push('Implement better error handling and retry logic');
    }

    if (metrics.averageResponseTime > 2000) {
      bottlenecks.push('Slow response times');
      recommendations.push('Optimize TTS generation and caching');
      optimizations.push('Implement background pre-generation');
    }

    if (metrics.cacheHitRate < 50) {
      bottlenecks.push('Low cache hit rate');
      recommendations.push('Improve cache warming and strategy');
      optimizations.push('Add intelligent cache preloading');
    }

    if (metrics.averageAudioSize > 500000) {
      bottlenecks.push('Large audio files');
      recommendations.push('Optimize audio compression');
      optimizations.push('Implement dynamic bitrate adjustment');
    }

    return {
      performanceScore: Math.max(0, performanceScore),
      recommendations,
      bottlenecks,
      optimizations
    };
  }

  // Generate analytics report
  generateReport(): {
    summary: TTSUsageMetrics;
    errors: ReturnType<typeof this.getErrorAnalysis>;
    performance: ReturnType<typeof this.getPerformanceInsights>;
    timestamp: string;
  } {
    return {
      summary: this.getUsageMetrics(),
      errors: this.getErrorAnalysis(),
      performance: this.getPerformanceInsights(),
      timestamp: new Date().toISOString()
    };
  }

  // Export metrics for external analysis
  exportMetrics(): string {
    const report = this.generateReport();
    return JSON.stringify(report, null, 2);
  }

  // Clean up old metrics to prevent memory issues
  private cleanupOldMetrics(): void {
    setInterval(() => {
      const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
      this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
      this.errors = this.errors.filter(e => e.timestamp > cutoff);
    }, 60 * 60 * 1000); // Run every hour
  }

  // Periodic reporting (could send to external analytics service)
  private startPeriodicReporting(): void {
    setInterval(() => {
      if (this.isEnabled) {
        const report = this.generateReport();
        // In production, you might send this to an analytics service
        console.log('TTS Analytics Report:', {
          performanceScore: report.performance.performanceScore,
          totalRequests: report.summary.totalRequests,
          errorRate: report.summary.errorRate,
          cacheHitRate: report.summary.cacheHitRate
        });
      }
    }, 5 * 60 * 1000); // Report every 5 minutes
  }

  // Enable/disable analytics
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  // Clear all metrics
  clearMetrics(): void {
    this.metrics = [];
    this.errors = [];
    this.sessionStartTime = Date.now();
  }

  // Get real-time metrics
  getRealTimeMetrics(): {
    requestsPerMinute: number;
    currentErrorRate: number;
    averageResponseTime: number;
    activeRequests: number;
  } {
    const now = Date.now();
    const lastMinute = this.metrics.filter(m => now - m.timestamp < 60 * 1000);
    
    const requestsPerMinute = lastMinute.length;
    const errorsLastMinute = lastMinute.filter(m => m.errorType).length;
    const currentErrorRate = requestsPerMinute > 0 ? errorsLastMinute / requestsPerMinute * 100 : 0;
    const averageResponseTime = requestsPerMinute > 0 
      ? lastMinute.reduce((sum, m) => sum + m.responseTime, 0) / requestsPerMinute 
      : 0;

    return {
      requestsPerMinute,
      currentErrorRate,
      averageResponseTime,
      activeRequests: 0 // This would need to be tracked separately
    };
  }
}

// Export singleton instance
export const ttsAnalytics = new TTSAnalyticsService();
