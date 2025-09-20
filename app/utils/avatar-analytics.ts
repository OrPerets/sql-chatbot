/**
 * Avatar Interaction Analytics Service
 * Tracks user interactions with the avatar for learning and optimization
 */

export interface InteractionEvent {
  id: string;
  type: 'click' | 'touch' | 'hover' | 'gesture' | 'sql_query' | 'voice_command';
  timestamp: number;
  gesture?: string;
  sqlKeywords?: string[];
  userMessage?: string;
  context?: string;
  duration?: number;
  position?: { x: number; y: number };
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  sessionId?: string;
  userId?: string;
}

export interface UserInteractionProfile {
  userId: string;
  totalInteractions: number;
  interactionFrequency: number; // interactions per minute
  preferredGestures: Record<string, number>;
  interactionPatterns: {
    clickRatio: number;
    touchRatio: number;
    hoverRatio: number;
    gestureRatio: number;
  };
  learningProgress: {
    sqlComplexity: 'beginner' | 'intermediate' | 'advanced';
    commonKeywords: string[];
    errorRate: number;
    successRate: number;
  };
  preferences: {
    interactionStyle: 'high_interaction' | 'medium_interaction' | 'low_interaction';
    gestureIntensity: 'subtle' | 'normal' | 'expressive';
    responseSpeed: 'fast' | 'normal' | 'deliberate';
  };
  lastUpdated: number;
}

export interface AnalyticsSummary {
  totalEvents: number;
  uniqueUsers: number;
  averageSessionDuration: number;
  mostPopularGestures: Array<{ gesture: string; count: number; percentage: number }>;
  interactionTrends: {
    daily: Record<string, number>;
    weekly: Record<string, number>;
  };
  performanceMetrics: {
    averageGestureResponseTime: number;
    gestureSuccessRate: number;
    userSatisfactionScore: number;
  };
}

class AvatarAnalytics {
  private events: InteractionEvent[] = [];
  private userProfiles: Map<string, UserInteractionProfile> = new Map();
  private sessionStartTime: number = Date.now();
  private currentSessionId: string;

  constructor() {
    this.currentSessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Track an interaction event
   */
  trackEvent(event: Omit<InteractionEvent, 'id' | 'timestamp' | 'sessionId'>): void {
    const fullEvent: InteractionEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      sessionId: this.currentSessionId,
      ...event,
    };

    this.events.push(fullEvent);
    this.updateUserProfile(fullEvent);

    // Keep only last 1000 events to prevent memory issues
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }

    // Log for debugging
    console.log('📊 Avatar Analytics Event:', {
      type: fullEvent.type,
      gesture: fullEvent.gesture,
      userId: fullEvent.userId,
      timestamp: new Date(fullEvent.timestamp).toISOString(),
    });
  }

  /**
   * Track gesture interaction
   */
  trackGesture(gesture: string, context?: string, userId?: string): void {
    this.trackEvent({
      type: 'gesture',
      gesture,
      context,
      userId,
    });
  }

  /**
   * Track SQL query interaction
   */
  trackSQLQuery(sqlKeywords: string[], userMessage?: string, userId?: string): void {
    this.trackEvent({
      type: 'sql_query',
      sqlKeywords,
      userMessage,
      userId,
    });
  }

  /**
   * Track click/touch interaction
   */
  trackClick(position?: { x: number; y: number }, userId?: string): void {
    this.trackEvent({
      type: 'click',
      position,
      userId,
    });
  }

  /**
   * Track touch interaction
   */
  trackTouch(position?: { x: number; y: number }, duration?: number, userId?: string): void {
    this.trackEvent({
      type: 'touch',
      position,
      duration,
      userId,
    });
  }

  /**
   * Track hover interaction
   */
  trackHover(position?: { x: number; y: number }, userId?: string): void {
    this.trackEvent({
      type: 'hover',
      position,
      userId,
    });
  }

  /**
   * Update user interaction profile
   */
  private updateUserProfile(event: InteractionEvent): void {
    if (!event.userId) return;

    const userId = event.userId;
    let profile = this.userProfiles.get(userId);

    if (!profile) {
      profile = {
        userId,
        totalInteractions: 0,
        interactionFrequency: 0,
        preferredGestures: {},
        interactionPatterns: {
          clickRatio: 0,
          touchRatio: 0,
          hoverRatio: 0,
          gestureRatio: 0,
        },
        learningProgress: {
          sqlComplexity: 'beginner',
          commonKeywords: [],
          errorRate: 0,
          successRate: 0,
        },
        preferences: {
          interactionStyle: 'medium_interaction',
          gestureIntensity: 'normal',
          responseSpeed: 'normal',
        },
        lastUpdated: Date.now(),
      };
    }

    // Update interaction counts
    profile.totalInteractions++;
    profile.lastUpdated = Date.now();

    // Update gesture preferences
    if (event.gesture) {
      profile.preferredGestures[event.gesture] = (profile.preferredGestures[event.gesture] || 0) + 1;
    }

    // Update interaction patterns
    const totalInteractions = profile.totalInteractions;
    if (event.type === 'click') {
      profile.interactionPatterns.clickRatio = (profile.interactionPatterns.clickRatio * (totalInteractions - 1) + 1) / totalInteractions;
    } else if (event.type === 'touch') {
      profile.interactionPatterns.touchRatio = (profile.interactionPatterns.touchRatio * (totalInteractions - 1) + 1) / totalInteractions;
    } else if (event.type === 'hover') {
      profile.interactionPatterns.hoverRatio = (profile.interactionPatterns.hoverRatio * (totalInteractions - 1) + 1) / totalInteractions;
    } else if (event.type === 'gesture') {
      profile.interactionPatterns.gestureRatio = (profile.interactionPatterns.gestureRatio * (totalInteractions - 1) + 1) / totalInteractions;
    }

    // Update SQL learning progress
    if (event.sqlKeywords && event.sqlKeywords.length > 0) {
      event.sqlKeywords.forEach(keyword => {
        if (!profile.learningProgress.commonKeywords.includes(keyword)) {
          profile.learningProgress.commonKeywords.push(keyword);
        }
      });

      // Determine complexity based on keywords
      const complexKeywords = ['JOIN', 'UNION', 'SUBQUERY', 'WINDOW', 'CTE', 'RECURSIVE'];
      const intermediateKeywords = ['GROUP BY', 'ORDER BY', 'HAVING', 'EXISTS'];
      
      const hasComplex = event.sqlKeywords.some(k => complexKeywords.includes(k));
      const hasIntermediate = event.sqlKeywords.some(k => intermediateKeywords.includes(k));
      
      if (hasComplex) {
        profile.learningProgress.sqlComplexity = 'advanced';
      } else if (hasIntermediate || profile.learningProgress.sqlComplexity === 'advanced') {
        profile.learningProgress.sqlComplexity = 'intermediate';
      } else if (profile.learningProgress.sqlComplexity === 'beginner') {
        profile.learningProgress.sqlComplexity = 'intermediate';
      }
    }

    // Update interaction style preference
    const sessionDuration = (Date.now() - this.sessionStartTime) / 1000 / 60; // minutes
    const interactionsPerMinute = profile.totalInteractions / Math.max(sessionDuration, 1);
    
    if (interactionsPerMinute > 2) {
      profile.preferences.interactionStyle = 'high_interaction';
    } else if (interactionsPerMinute < 0.5) {
      profile.preferences.interactionStyle = 'low_interaction';
    } else {
      profile.preferences.interactionStyle = 'medium_interaction';
    }

    this.userProfiles.set(userId, profile);
  }

  /**
   * Get user interaction profile
   */
  getUserProfile(userId: string): UserInteractionProfile | null {
    return this.userProfiles.get(userId) || null;
  }

  /**
   * Get analytics summary
   */
  getAnalyticsSummary(): AnalyticsSummary {
    const now = Date.now();
    const sessionDuration = (now - this.sessionStartTime) / 1000 / 60; // minutes

    // Calculate gesture popularity
    const gestureCounts: Record<string, number> = {};
    this.events.forEach(event => {
      if (event.gesture) {
        gestureCounts[event.gesture] = (gestureCounts[event.gesture] || 0) + 1;
      }
    });

    const totalGestures = Object.values(gestureCounts).reduce((sum, count) => sum + count, 0);
    const mostPopularGestures = Object.entries(gestureCounts)
      .map(([gesture, count]) => ({
        gesture,
        count,
        percentage: totalGestures > 0 ? (count / totalGestures) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate interaction trends
    const dailyTrends: Record<string, number> = {};
    this.events.forEach(event => {
      const date = new Date(event.timestamp).toDateString();
      dailyTrends[date] = (dailyTrends[date] || 0) + 1;
    });

    return {
      totalEvents: this.events.length,
      uniqueUsers: this.userProfiles.size,
      averageSessionDuration: sessionDuration,
      mostPopularGestures,
      interactionTrends: {
        daily: dailyTrends,
        weekly: {}, // Could be implemented for longer-term trends
      },
      performanceMetrics: {
        averageGestureResponseTime: 500, // Placeholder - could be calculated from actual data
        gestureSuccessRate: 95, // Placeholder - could be calculated from gesture completion data
        userSatisfactionScore: 4.2, // Placeholder - could be calculated from user feedback
      },
    };
  }

  /**
   * Get events for a specific user
   */
  getUserEvents(userId: string, limit: number = 50): InteractionEvent[] {
    return this.events
      .filter(event => event.userId === userId)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 20): InteractionEvent[] {
    return this.events.slice(-limit).reverse();
  }

  /**
   * Clear analytics data
   */
  clearData(): void {
    this.events = [];
    this.userProfiles.clear();
    this.sessionStartTime = Date.now();
    this.currentSessionId = this.generateSessionId();
  }

  /**
   * Export analytics data
   */
  exportData(): {
    events: InteractionEvent[];
    userProfiles: UserInteractionProfile[];
    summary: AnalyticsSummary;
  } {
    return {
      events: [...this.events],
      userProfiles: Array.from(this.userProfiles.values()),
      summary: this.getAnalyticsSummary(),
    };
  }

  /**
   * Get recommended gesture for user based on their profile
   */
  getRecommendedGesture(userId: string, context?: string): string {
    const profile = this.getUserProfile(userId);
    if (!profile) return 'ok';

    // Get most preferred gesture
    const mostPreferred = Object.entries(profile.preferredGestures)
      .sort(([, a], [, b]) => b - a)[0];

    if (mostPreferred && mostPreferred[1] > 3) {
      return mostPreferred[0];
    }

    // Default based on interaction style
    switch (profile.preferences.interactionStyle) {
      case 'high_interaction':
        return 'handup';
      case 'low_interaction':
        return 'ok';
      default:
        return 'index';
    }
  }
}

// Create singleton instance
export const avatarAnalytics = new AvatarAnalytics();

// Export types and functions
export default avatarAnalytics;
