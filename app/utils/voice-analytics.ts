// Voice Analytics & Learning Service
// Tracks voice usage patterns, satisfaction scoring, and provides optimization insights

export interface VoiceUsageEvent {
  id: string;
  timestamp: number;
  type: 'tts_request' | 'voice_command' | 'conversation' | 'interruption' | 'error';
  duration?: number;
  success: boolean;
  metadata: {
    voice?: string;
    textLength?: number;
    contentType?: string;
    complexity?: string;
    language?: string;
    userAgent?: string;
    deviceType?: string;
    networkType?: string;
    errorType?: string;
    satisfaction?: number;
    [key: string]: any;
  };
}

export interface VoiceAnalyticsSummary {
  totalEvents: number;
  successRate: number;
  averageSatisfaction: number;
  mostUsedVoice: string;
  mostUsedContentType: string;
  averageResponseTime: number;
  errorRate: number;
  userEngagement: {
    totalSessions: number;
    averageSessionDuration: number;
    peakUsageHours: number[];
    preferredVoices: string[];
    preferredContentTypes: string[];
  };
  performanceMetrics: {
    cacheHitRate: number;
    averageAudioSize: number;
    networkLatency: number;
    errorPatterns: Array<{error: string, count: number}>;
  };
  recommendations: string[];
}

export interface VoiceLearningInsights {
  userPreferences: {
    preferredVoice: string;
    preferredSpeed: number;
    preferredPitch: number;
    preferredContentType: string;
    optimalSessionDuration: number;
  };
  usagePatterns: {
    peakHours: number[];
    averageSessionLength: number;
    commonCommands: string[];
    errorProneActions: string[];
  };
  optimizationSuggestions: {
    voiceSettings: Array<{setting: string, current: any, suggested: any, reason: string}>;
    performanceImprovements: string[];
    userExperienceEnhancements: string[];
  };
}

class VoiceAnalyticsService {
  private events: VoiceUsageEvent[] = [];
  private sessionStartTime: number = Date.now();
  private currentSessionId: string = this.generateSessionId();
  private userPreferences: Map<string, any> = new Map();
  private learningModel: any = null;

  constructor() {
    this.initializeAnalytics();
    this.loadHistoricalData();
    this.startPeriodicAnalysis();
  }

  /**
   * Initialize analytics service
   */
  private initializeAnalytics(): void {
    // Load user preferences from localStorage
    if (typeof window !== 'undefined') {
      const savedPreferences = localStorage.getItem('voiceAnalytics_preferences');
      if (savedPreferences) {
        try {
          this.userPreferences = new Map(JSON.parse(savedPreferences));
        } catch (error) {
          console.warn('Failed to load voice preferences:', error);
        }
      }
    }
  }

  /**
   * Load historical analytics data
   */
  private loadHistoricalData(): void {
    if (typeof window !== 'undefined') {
      const savedEvents = localStorage.getItem('voiceAnalytics_events');
      if (savedEvents) {
        try {
          const parsedEvents = JSON.parse(savedEvents);
          this.events = parsedEvents.filter((event: VoiceUsageEvent) => {
            // Keep only events from last 30 days
            return Date.now() - event.timestamp < (30 * 24 * 60 * 60 * 1000);
          });
        } catch (error) {
          console.warn('Failed to load historical analytics data:', error);
        }
      }
    }
  }

  /**
   * Start periodic analysis and cleanup
   */
  private startPeriodicAnalysis(): void {
    // Clean up old events every hour
    setInterval(() => {
      this.cleanupOldEvents();
    }, 60 * 60 * 1000);

    // Save data every 5 minutes
    setInterval(() => {
      this.saveAnalyticsData();
    }, 5 * 60 * 1000);

    // Perform learning analysis every 10 minutes
    setInterval(() => {
      this.performLearningAnalysis();
    }, 10 * 60 * 1000);
  }

  /**
   * Record a voice usage event
   */
  recordEvent(type: VoiceUsageEvent['type'], metadata: VoiceUsageEvent['metadata'], success: boolean = true, duration?: number): void {
    const event: VoiceUsageEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type,
      duration,
      success,
      metadata: {
        ...metadata,
        sessionId: this.currentSessionId,
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
        deviceType: this.detectDeviceType(),
        networkType: this.detectNetworkType(),
      }
    };

    this.events.push(event);
    this.updateUserPreferences(event);
    this.triggerRealTimeAnalysis(event);
  }

  /**
   * Record TTS request
   */
  recordTTSRequest(voice: string, textLength: number, contentType: string, responseTime: number, success: boolean, errorType?: string): void {
    this.recordEvent('tts_request', {
      voice,
      textLength,
      contentType,
      responseTime,
      errorType
    }, success, responseTime);
  }

  /**
   * Record voice command
   */
  recordVoiceCommand(command: string, success: boolean, executionTime?: number): void {
    this.recordEvent('voice_command', {
      command,
      executionTime
    }, success, executionTime);
  }

  /**
   * Record conversation interaction
   */
  recordConversation(interactionType: 'start' | 'end' | 'interruption', duration?: number, satisfaction?: number): void {
    this.recordEvent('conversation', {
      interactionType,
      satisfaction
    }, true, duration);
  }

  /**
   * Record interruption
   */
  recordInterruption(reason: string, context: string): void {
    this.recordEvent('interruption', {
      reason,
      context
    }, false);
  }

  /**
   * Record error
   */
  recordError(errorType: string, errorMessage: string, context: any): void {
    this.recordEvent('error', {
      errorType,
      errorMessage,
      context: JSON.stringify(context)
    }, false);
  }

  /**
   * Record user satisfaction
   */
  recordSatisfaction(rating: number, context: string): void {
    this.recordEvent('conversation', {
      satisfaction: rating,
      context
    }, true);
  }

  /**
   * Get analytics summary
   */
  getAnalyticsSummary(): VoiceAnalyticsSummary {
    const now = Date.now();
    const last24Hours = this.events.filter(e => now - e.timestamp < 24 * 60 * 60 * 1000);
    const last7Days = this.events.filter(e => now - e.timestamp < 7 * 24 * 60 * 60 * 1000);

    // Calculate success rate
    const successfulEvents = this.events.filter(e => e.success);
    const successRate = this.events.length > 0 ? (successfulEvents.length / this.events.length) * 100 : 0;

    // Calculate average satisfaction
    const satisfactionEvents = this.events.filter(e => e.metadata.satisfaction !== undefined);
    const averageSatisfaction = satisfactionEvents.length > 0 
      ? satisfactionEvents.reduce((sum, e) => sum + (e.metadata.satisfaction || 0), 0) / satisfactionEvents.length 
      : 0;

    // Find most used voice
    const voiceUsage = new Map<string, number>();
    this.events.forEach(e => {
      if (e.metadata.voice) {
        voiceUsage.set(e.metadata.voice, (voiceUsage.get(e.metadata.voice) || 0) + 1);
      }
    });
    const mostUsedVoice = voiceUsage.size > 0 
      ? Array.from(voiceUsage.entries()).sort((a, b) => b[1] - a[1])[0][0] 
      : 'unknown';

    // Find most used content type
    const contentTypeUsage = new Map<string, number>();
    this.events.forEach(e => {
      if (e.metadata.contentType) {
        contentTypeUsage.set(e.metadata.contentType, (contentTypeUsage.get(e.metadata.contentType) || 0) + 1);
      }
    });
    const mostUsedContentType = contentTypeUsage.size > 0 
      ? Array.from(contentTypeUsage.entries()).sort((a, b) => b[1] - a[1])[0][0] 
      : 'unknown';

    // Calculate average response time
    const responseTimeEvents = this.events.filter(e => e.duration !== undefined);
    const averageResponseTime = responseTimeEvents.length > 0 
      ? responseTimeEvents.reduce((sum, e) => sum + (e.duration || 0), 0) / responseTimeEvents.length 
      : 0;

    // Calculate error rate
    const errorEvents = this.events.filter(e => !e.success);
    const errorRate = this.events.length > 0 ? (errorEvents.length / this.events.length) * 100 : 0;

    // User engagement metrics
    const sessions = new Set(this.events.map(e => e.metadata.sessionId));
    const sessionDurations = this.calculateSessionDurations();
    const averageSessionDuration = sessionDurations.length > 0 
      ? sessionDurations.reduce((sum, d) => sum + d, 0) / sessionDurations.length 
      : 0;

    // Peak usage hours
    const hourlyUsage = new Array(24).fill(0);
    this.events.forEach(e => {
      const hour = new Date(e.timestamp).getHours();
      hourlyUsage[hour]++;
    });
    const peakUsageHours = hourlyUsage
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(item => item.hour);

    // Preferred voices
    const preferredVoices = Array.from(voiceUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(item => item[0]);

    // Preferred content types
    const preferredContentTypes = Array.from(contentTypeUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(item => item[0]);

    // Performance metrics
    const cacheHitRate = this.calculateCacheHitRate();
    const averageAudioSize = this.calculateAverageAudioSize();
    const networkLatency = this.calculateNetworkLatency();
    const errorPatterns = this.analyzeErrorPatterns();

    // Generate recommendations
    const recommendations = this.generateRecommendations();

    return {
      totalEvents: this.events.length,
      successRate: Math.round(successRate * 100) / 100,
      averageSatisfaction: Math.round(averageSatisfaction * 100) / 100,
      mostUsedVoice,
      mostUsedContentType,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      userEngagement: {
        totalSessions: sessions.size,
        averageSessionDuration: Math.round(averageSessionDuration / 1000), // Convert to seconds
        peakUsageHours,
        preferredVoices,
        preferredContentTypes
      },
      performanceMetrics: {
        cacheHitRate: Math.round(cacheHitRate * 100) / 100,
        averageAudioSize: Math.round(averageAudioSize),
        networkLatency: Math.round(networkLatency),
        errorPatterns
      },
      recommendations
    };
  }

  /**
   * Get voice learning insights
   */
  getVoiceLearningInsights(): VoiceLearningInsights {
    const summary = this.getAnalyticsSummary();
    
    // Analyze user preferences
    const userPreferences = this.analyzeUserPreferences();
    
    // Analyze usage patterns
    const usagePatterns = this.analyzeUsagePatterns();
    
    // Generate optimization suggestions
    const optimizationSuggestions = this.generateOptimizationSuggestions();

    return {
      userPreferences,
      usagePatterns,
      optimizationSuggestions
    };
  }

  /**
   * Update user preferences based on usage patterns
   */
  private updateUserPreferences(event: VoiceUsageEvent): void {
    if (event.metadata.voice) {
      this.userPreferences.set('preferredVoice', event.metadata.voice);
    }
    
    if (event.metadata.contentType) {
      this.userPreferences.set('preferredContentType', event.metadata.contentType);
    }
    
    if (event.metadata.satisfaction !== undefined) {
      const currentSatisfaction = this.userPreferences.get('averageSatisfaction') || 0;
      const satisfactionCount = this.userPreferences.get('satisfactionCount') || 0;
      const newSatisfaction = (currentSatisfaction * satisfactionCount + event.metadata.satisfaction) / (satisfactionCount + 1);
      this.userPreferences.set('averageSatisfaction', newSatisfaction);
      this.userPreferences.set('satisfactionCount', satisfactionCount + 1);
    }

    // Save preferences
    this.saveUserPreferences();
  }

  /**
   * Analyze user preferences
   */
  private analyzeUserPreferences(): VoiceLearningInsights['userPreferences'] {
    const voiceUsage = new Map<string, number>();
    const contentTypeUsage = new Map<string, number>();
    const speedPreferences = new Map<number, number>();
    const pitchPreferences = new Map<number, number>();

    this.events.forEach(event => {
      if (event.metadata.voice) {
        voiceUsage.set(event.metadata.voice, (voiceUsage.get(event.metadata.voice) || 0) + 1);
      }
      if (event.metadata.contentType) {
        contentTypeUsage.set(event.metadata.contentType, (contentTypeUsage.get(event.metadata.contentType) || 0) + 1);
      }
      if (event.metadata.speed) {
        speedPreferences.set(event.metadata.speed, (speedPreferences.get(event.metadata.speed) || 0) + 1);
      }
      if (event.metadata.pitch) {
        pitchPreferences.set(event.metadata.pitch, (pitchPreferences.get(event.metadata.pitch) || 0) + 1);
      }
    });

    const preferredVoice = voiceUsage.size > 0 
      ? Array.from(voiceUsage.entries()).sort((a, b) => b[1] - a[1])[0][0] 
      : 'onyx';
    
    const preferredContentType = contentTypeUsage.size > 0 
      ? Array.from(contentTypeUsage.entries()).sort((a, b) => b[1] - a[1])[0][0] 
      : 'general';

    const preferredSpeed = speedPreferences.size > 0 
      ? Array.from(speedPreferences.entries()).sort((a, b) => b[1] - a[1])[0][0] 
      : 0.95;

    const preferredPitch = pitchPreferences.size > 0 
      ? Array.from(pitchPreferences.entries()).sort((a, b) => b[1] - a[1])[0][0] 
      : 1.0;

    const sessionDurations = this.calculateSessionDurations();
    const optimalSessionDuration = sessionDurations.length > 0 
      ? sessionDurations.reduce((sum, d) => sum + d, 0) / sessionDurations.length 
      : 300000; // 5 minutes default

    return {
      preferredVoice,
      preferredSpeed,
      preferredPitch,
      preferredContentType,
      optimalSessionDuration
    };
  }

  /**
   * Analyze usage patterns
   */
  private analyzeUsagePatterns(): VoiceLearningInsights['usagePatterns'] {
    const hourlyUsage = new Array(24).fill(0);
    const commandUsage = new Map<string, number>();
    const errorProneActions = new Map<string, number>();

    this.events.forEach(event => {
      const hour = new Date(event.timestamp).getHours();
      hourlyUsage[hour]++;
      
      if (event.type === 'voice_command' && event.metadata.command) {
        commandUsage.set(event.metadata.command, (commandUsage.get(event.metadata.command) || 0) + 1);
      }
      
      if (!event.success && event.metadata.context) {
        errorProneActions.set(event.metadata.context, (errorProneActions.get(event.metadata.context) || 0) + 1);
      }
    });

    const peakHours = hourlyUsage
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(item => item.hour);

    const commonCommands = Array.from(commandUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(item => item[0]);

    const errorProneActionsList = Array.from(errorProneActions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(item => item[0]);

    const sessionDurations = this.calculateSessionDurations();
    const averageSessionLength = sessionDurations.length > 0 
      ? sessionDurations.reduce((sum, d) => sum + d, 0) / sessionDurations.length 
      : 0;

    return {
      peakHours,
      averageSessionLength,
      commonCommands,
      errorProneActions: errorProneActionsList
    };
  }

  /**
   * Generate optimization suggestions
   */
  private generateOptimizationSuggestions(): VoiceLearningInsights['optimizationSuggestions'] {
    const insights = this.getVoiceLearningInsights();
    const summary = this.getAnalyticsSummary();
    
    const voiceSettings: Array<{setting: string, current: any, suggested: any, reason: string}> = [];
    const performanceImprovements: string[] = [];
    const userExperienceEnhancements: string[] = [];

    // Voice settings suggestions
    if (summary.mostUsedVoice !== 'onyx') {
      voiceSettings.push({
        setting: 'defaultVoice',
        current: 'onyx',
        suggested: summary.mostUsedVoice,
        reason: `User prefers ${summary.mostUsedVoice} voice (used ${summary.userEngagement.preferredVoices.length > 0 ? summary.userEngagement.preferredVoices.indexOf(summary.mostUsedVoice) + 1 : 1} times)`
      });
    }

    // Performance improvements
    if (summary.performanceMetrics.cacheHitRate < 70) {
      performanceImprovements.push('Consider enabling more aggressive caching to improve response times');
    }
    
    if (summary.averageResponseTime > 2000) {
      performanceImprovements.push('Response time is high - consider optimizing TTS generation');
    }
    
    if (summary.errorRate > 5) {
      performanceImprovements.push('Error rate is high - investigate common error patterns');
    }

    // User experience enhancements
    if (summary.userEngagement.averageSessionDuration < 60) {
      userExperienceEnhancements.push('Short session duration - consider adding more engaging features');
    }
    
    if (insights.userPreferences.preferredContentType !== 'general') {
      userExperienceEnhancements.push(`Optimize for ${insights.userPreferences.preferredContentType} content type`);
    }

    return {
      voiceSettings,
      performanceImprovements,
      userExperienceEnhancements
    };
  }

  /**
   * Calculate session durations
   */
  private calculateSessionDurations(): number[] {
    const sessionDurations = new Map<string, {start: number, end: number}>();
    
    this.events.forEach(event => {
      const sessionId = event.metadata.sessionId;
      if (!sessionDurations.has(sessionId)) {
        sessionDurations.set(sessionId, { start: event.timestamp, end: event.timestamp });
      } else {
        const session = sessionDurations.get(sessionId)!;
        session.end = Math.max(session.end, event.timestamp);
      }
    });

    return Array.from(sessionDurations.values()).map(session => session.end - session.start);
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    const cacheEvents = this.events.filter(e => e.metadata.cacheHit !== undefined);
    if (cacheEvents.length === 0) return 0;
    
    const cacheHits = cacheEvents.filter(e => e.metadata.cacheHit).length;
    return (cacheHits / cacheEvents.length) * 100;
  }

  /**
   * Calculate average audio size
   */
  private calculateAverageAudioSize(): number {
    const audioEvents = this.events.filter(e => e.metadata.audioSize !== undefined);
    if (audioEvents.length === 0) return 0;
    
    const totalSize = audioEvents.reduce((sum, e) => sum + (e.metadata.audioSize || 0), 0);
    return totalSize / audioEvents.length;
  }

  /**
   * Calculate network latency
   */
  private calculateNetworkLatency(): number {
    const latencyEvents = this.events.filter(e => e.metadata.networkLatency !== undefined);
    if (latencyEvents.length === 0) return 0;
    
    const totalLatency = latencyEvents.reduce((sum, e) => sum + (e.metadata.networkLatency || 0), 0);
    return totalLatency / latencyEvents.length;
  }

  /**
   * Analyze error patterns
   */
  private analyzeErrorPatterns(): Array<{error: string, count: number}> {
    const errorCounts = new Map<string, number>();
    
    this.events.filter(e => !e.success).forEach(event => {
      const errorType = event.metadata.errorType || 'unknown';
      errorCounts.set(errorType, (errorCounts.get(errorType) || 0) + 1);
    });

    return Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([error, count]) => ({ error, count }));
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(): string[] {
    const summary = this.getAnalyticsSummary();
    const recommendations: string[] = [];

    if (summary.successRate < 95) {
      recommendations.push('Consider improving error handling to increase success rate');
    }

    if (summary.averageSatisfaction < 4.0) {
      recommendations.push('User satisfaction is low - consider voice quality improvements');
    }

    if (summary.errorRate > 3) {
      recommendations.push('High error rate detected - investigate and fix common issues');
    }

    if (summary.performanceMetrics.cacheHitRate < 60) {
      recommendations.push('Low cache hit rate - consider implementing more aggressive caching');
    }

    if (summary.userEngagement.totalSessions < 5) {
      recommendations.push('Low user engagement - consider adding more voice features');
    }

    return recommendations;
  }

  /**
   * Perform learning analysis
   */
  private performLearningAnalysis(): void {
    const insights = this.getVoiceLearningInsights();
    
    // Update learning model with new insights
    this.updateLearningModel(insights);
    
    // Generate personalized recommendations
    const personalizedRecommendations = this.generatePersonalizedRecommendations(insights);
    
    // Store insights for future reference
    this.storeLearningInsights(insights, personalizedRecommendations);
  }

  /**
   * Update learning model
   */
  private updateLearningModel(insights: VoiceLearningInsights): void {
    // This would integrate with a machine learning model
    // For now, we'll store the insights for pattern recognition
    console.log('Learning model updated with insights:', insights);
  }

  /**
   * Generate personalized recommendations
   */
  private generatePersonalizedRecommendations(insights: VoiceLearningInsights): string[] {
    const recommendations: string[] = [];
    
    // Based on user preferences
    if (insights.userPreferences.preferredVoice !== 'onyx') {
      recommendations.push(`Consider setting ${insights.userPreferences.preferredVoice} as your default voice`);
    }
    
    // Based on usage patterns
    if (insights.usagePatterns.commonCommands.length > 0) {
      recommendations.push(`You frequently use: ${insights.usagePatterns.commonCommands.slice(0, 3).join(', ')}`);
    }
    
    return recommendations;
  }

  /**
   * Store learning insights
   */
  private storeLearningInsights(insights: VoiceLearningInsights, recommendations: string[]): void {
    if (typeof window !== 'undefined') {
      const learningData = {
        insights,
        recommendations,
        timestamp: Date.now()
      };
      localStorage.setItem('voiceAnalytics_learning', JSON.stringify(learningData));
    }
  }

  /**
   * Trigger real-time analysis
   */
  private triggerRealTimeAnalysis(event: VoiceUsageEvent): void {
    // Perform immediate analysis for critical events
    if (event.type === 'error' || !event.success) {
      this.analyzeErrorEvent(event);
    }
    
    if (event.metadata.satisfaction !== undefined && event.metadata.satisfaction < 3) {
      this.analyzeLowSatisfactionEvent(event);
    }
  }

  /**
   * Analyze error events
   */
  private analyzeErrorEvent(event: VoiceUsageEvent): void {
    console.warn('Voice error detected:', event);
    
    // Could trigger immediate alerts or fallback mechanisms
    if (event.metadata.errorType === 'network_error') {
      console.warn('Network error detected - consider offline fallback');
    }
  }

  /**
   * Analyze low satisfaction events
   */
  private analyzeLowSatisfactionEvent(event: VoiceUsageEvent): void {
    console.warn('Low satisfaction detected:', event);
    
    // Could trigger immediate improvements or alternative approaches
  }

  /**
   * Detect device type
   */
  private detectDeviceType(): string {
    if (typeof window === 'undefined') return 'server';
    
    const userAgent = window.navigator.userAgent;
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      return 'mobile';
    } else if (/Tablet|iPad/.test(userAgent)) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  /**
   * Detect network type
   */
  private detectNetworkType(): string {
    if (typeof window === 'undefined' || !('connection' in navigator)) return 'unknown';
    
    const connection = (navigator as any).connection;
    return connection?.effectiveType || 'unknown';
  }

  /**
   * Clean up old events
   */
  private cleanupOldEvents(): void {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    this.events = this.events.filter(event => event.timestamp > thirtyDaysAgo);
  }

  /**
   * Save analytics data
   */
  private saveAnalyticsData(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('voiceAnalytics_events', JSON.stringify(this.events));
      } catch (error) {
        console.warn('Failed to save analytics data:', error);
      }
    }
  }

  /**
   * Save user preferences
   */
  private saveUserPreferences(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('voiceAnalytics_preferences', JSON.stringify(Array.from(this.userPreferences.entries())));
      } catch (error) {
        console.warn('Failed to save user preferences:', error);
      }
    }
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate event ID
   */
  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Reset analytics data
   */
  resetAnalytics(): void {
    this.events = [];
    this.userPreferences.clear();
    this.currentSessionId = this.generateSessionId();
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('voiceAnalytics_events');
      localStorage.removeItem('voiceAnalytics_preferences');
      localStorage.removeItem('voiceAnalytics_learning');
    }
  }

  /**
   * Export analytics data
   */
  exportAnalyticsData(): string {
    return JSON.stringify({
      events: this.events,
      preferences: Array.from(this.userPreferences.entries()),
      summary: this.getAnalyticsSummary(),
      insights: this.getVoiceLearningInsights(),
      exportTimestamp: Date.now()
    }, null, 2);
  }
}

// Export singleton instance
export const voiceAnalytics = new VoiceAnalyticsService();

// Utility functions for easy usage
export function recordTTSRequest(voice: string, textLength: number, contentType: string, responseTime: number, success: boolean, errorType?: string): void {
  voiceAnalytics.recordTTSRequest(voice, textLength, contentType, responseTime, success, errorType);
}

export function recordVoiceCommand(command: string, success: boolean, executionTime?: number): void {
  voiceAnalytics.recordVoiceCommand(command, success, executionTime);
}

export function recordConversation(interactionType: 'start' | 'end' | 'interruption', duration?: number, satisfaction?: number): void {
  voiceAnalytics.recordConversation(interactionType, duration, satisfaction);
}

export function recordInterruption(reason: string, context: string): void {
  voiceAnalytics.recordInterruption(reason, context);
}

export function recordError(errorType: string, errorMessage: string, context: any): void {
  voiceAnalytics.recordError(errorType, errorMessage, context);
}

export function recordSatisfaction(rating: number, context: string): void {
  voiceAnalytics.recordSatisfaction(rating, context);
}
