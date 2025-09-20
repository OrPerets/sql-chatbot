/**
 * Voice Rate Limiter
 * Advanced rate limiting for voice API calls and features
 */

export interface RateLimitConfig {
  enableRateLimiting: boolean;
  enableUserBasedLimiting: boolean;
  enableIPBasedLimiting: boolean;
  enableFeatureBasedLimiting: boolean;
  defaultLimits: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
    burstLimit: number;
  };
  featureLimits: Record<string, {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
    priority: 'high' | 'medium' | 'low';
  }>;
  userTiers: Record<string, {
    multiplier: number;
    description: string;
  }>;
  enableAdaptiveLimiting: boolean;
  enableGracefulDegradation: boolean;
}

export interface RateLimitEntry {
  userId?: string;
  ipAddress?: string;
  feature: string;
  requests: Array<{
    timestamp: number;
    size: number;
    priority: 'high' | 'medium' | 'low';
  }>;
  lastReset: number;
  violations: number;
  gracePeriod: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  reason?: string;
  tier?: string;
  degradation?: {
    enabled: boolean;
    level: 'none' | 'reduced' | 'limited' | 'blocked';
    features: string[];
  };
}

export interface RateLimitMetrics {
  totalRequests: number;
  blockedRequests: number;
  allowedRequests: number;
  averageResponseTime: number;
  topViolators: Array<{
    identifier: string;
    violations: number;
    lastViolation: number;
  }>;
  featureUsage: Record<string, {
    requests: number;
    blocked: number;
    averageSize: number;
  }>;
}

export class VoiceRateLimiter {
  private config: RateLimitConfig;
  private rateLimitStore: Map<string, RateLimitEntry> = new Map();
  private metrics: RateLimitMetrics;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private adaptiveLimits: Map<string, number> = new Map();

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      allowedRequests: 0,
      averageResponseTime: 0,
      topViolators: [],
      featureUsage: {}
    };

    this.startCleanupInterval();
  }

  /**
   * Check if request is allowed
   */
  async checkRateLimit(
    identifier: string,
    feature: string,
    options: {
      userId?: string;
      ipAddress?: string;
      requestSize?: number;
      priority?: 'high' | 'medium' | 'low';
      userTier?: string;
    } = {}
  ): Promise<RateLimitResult> {
    const startTime = performance.now();
    
    try {
      const key = this.generateRateLimitKey(identifier, feature, options);
      const entry = this.getOrCreateEntry(key, feature, options);
      
      // Check if in grace period
      if (entry.gracePeriod > Date.now()) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: entry.gracePeriod,
          retryAfter: Math.ceil((entry.gracePeriod - Date.now()) / 1000),
          reason: 'Grace period active',
          tier: options.userTier
        };
      }

      // Get limits for this feature and user
      const limits = this.getLimits(feature, options.userTier);
      
      // Clean old requests
      this.cleanOldRequests(entry, limits);
      
      // Check if request would exceed limits
      const wouldExceed = this.wouldExceedLimits(entry, limits, options.requestSize || 0);
      
      if (wouldExceed) {
        // Record violation
        entry.violations++;
        
        // Implement progressive penalties
        if (entry.violations > 5) {
          entry.gracePeriod = Date.now() + (entry.violations * 60000); // 1 minute per violation
        }
        
        // Update metrics
        this.updateMetrics(false, feature, options.requestSize || 0, performance.now() - startTime);
        
        // Determine degradation level
        const degradation = this.getDegradationLevel(entry.violations);
        
        return {
          allowed: false,
          remaining: 0,
          resetTime: Date.now() + limits.windowMs,
          retryAfter: Math.ceil(limits.windowMs / 1000),
          reason: 'Rate limit exceeded',
          tier: options.userTier,
          degradation
        };
      }

      // Allow request
      entry.requests.push({
        timestamp: Date.now(),
        size: options.requestSize || 0,
        priority: options.priority || 'medium'
      });

      // Update metrics
      this.updateMetrics(true, feature, options.requestSize || 0, performance.now() - startTime);
      
      // Apply adaptive limiting if enabled
      if (this.config.enableAdaptiveLimiting) {
        this.updateAdaptiveLimits(feature, entry);
      }

      return {
        allowed: true,
        remaining: this.calculateRemaining(entry, limits),
        resetTime: Date.now() + limits.windowMs,
        tier: options.userTier
      };

    } catch (error) {
      console.error('Rate limit check error:', error);
      
      // Fail open - allow request if rate limiting fails
      return {
        allowed: true,
        remaining: 1000,
        resetTime: Date.now() + 60000,
        reason: 'Rate limiter error - failing open'
      };
    }
  }

  /**
   * Generate rate limit key
   */
  private generateRateLimitKey(
    identifier: string,
    feature: string,
    options: { userId?: string; ipAddress?: string }
  ): string {
    const parts = [feature];
    
    if (this.config.enableUserBasedLimiting && options.userId) {
      parts.push(`user:${options.userId}`);
    }
    
    if (this.config.enableIPBasedLimiting && options.ipAddress) {
      parts.push(`ip:${options.ipAddress}`);
    }
    
    parts.push(identifier);
    
    return parts.join(':');
  }

  /**
   * Get or create rate limit entry
   */
  private getOrCreateEntry(
    key: string,
    feature: string,
    options: { userId?: string; ipAddress?: string }
  ): RateLimitEntry {
    if (this.rateLimitStore.has(key)) {
      return this.rateLimitStore.get(key)!;
    }

    const entry: RateLimitEntry = {
      userId: options.userId,
      ipAddress: options.ipAddress,
      feature,
      requests: [],
      lastReset: Date.now(),
      violations: 0,
      gracePeriod: 0
    };

    this.rateLimitStore.set(key, entry);
    return entry;
  }

  /**
   * Get limits for feature and user tier
   */
  private getLimits(feature: string, userTier?: string): {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
    windowMs: number;
  } {
    const featureLimit = this.config.featureLimits[feature] || {
      requestsPerMinute: this.config.defaultLimits.requestsPerMinute,
      requestsPerHour: this.config.defaultLimits.requestsPerHour,
      requestsPerDay: this.config.defaultLimits.requestsPerDay,
      priority: 'medium' as const
    };

    let multiplier = 1;
    if (userTier && this.config.userTiers[userTier]) {
      multiplier = this.config.userTiers[userTier].multiplier;
    }

    // Apply adaptive limits if available
    const adaptiveMultiplier = this.adaptiveLimits.get(feature) || 1;
    multiplier *= adaptiveMultiplier;

    return {
      requestsPerMinute: Math.floor(featureLimit.requestsPerMinute * multiplier),
      requestsPerHour: Math.floor(featureLimit.requestsPerHour * multiplier),
      requestsPerDay: Math.floor(featureLimit.requestsPerDay * multiplier),
      windowMs: 60000 // 1 minute window for rate calculation
    };
  }

  /**
   * Clean old requests from entry
   */
  private cleanOldRequests(entry: RateLimitEntry, limits: any): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;

    entry.requests = entry.requests.filter(request => {
      return request.timestamp > oneDayAgo;
    });
  }

  /**
   * Check if request would exceed limits
   */
  private wouldExceedLimits(
    entry: RateLimitEntry,
    limits: any,
    requestSize: number
  ): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;

    const requestsLastMinute = entry.requests.filter(r => r.timestamp > oneMinuteAgo);
    const requestsLastHour = entry.requests.filter(r => r.timestamp > oneHourAgo);
    const requestsLastDay = entry.requests.filter(r => r.timestamp > oneDayAgo);

    // Check burst limit
    if (requestsLastMinute.length >= limits.requestsPerMinute) {
      return true;
    }

    // Check hourly limit
    if (requestsLastHour.length >= limits.requestsPerHour) {
      return true;
    }

    // Check daily limit
    if (requestsLastDay.length >= limits.requestsPerDay) {
      return true;
    }

    // Check size-based limits (if request is large)
    if (requestSize > 1024 * 1024) { // 1MB
      const largeRequestsLastHour = requestsLastHour.filter(r => r.size > 1024 * 1024);
      if (largeRequestsLastHour.length >= 10) { // Max 10 large requests per hour
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate remaining requests
   */
  private calculateRemaining(entry: RateLimitEntry, limits: any): number {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const requestsLastMinute = entry.requests.filter(r => r.timestamp > oneMinuteAgo);
    
    return Math.max(0, limits.requestsPerMinute - requestsLastMinute.length);
  }

  /**
   * Get degradation level
   */
  private getDegradationLevel(violations: number): {
    enabled: boolean;
    level: 'none' | 'reduced' | 'limited' | 'blocked';
    features: string[];
  } {
    if (!this.config.enableGracefulDegradation) {
      return {
        enabled: false,
        level: 'none',
        features: []
      };
    }

    let level: 'none' | 'reduced' | 'limited' | 'blocked' = 'none';
    let features: string[] = [];

    if (violations >= 10) {
      level = 'blocked';
      features = ['tts', 'voice-commands', 'audio-processing'];
    } else if (violations >= 5) {
      level = 'limited';
      features = ['tts', 'voice-commands'];
    } else if (violations >= 3) {
      level = 'reduced';
      features = ['audio-processing'];
    }

    return {
      enabled: level !== 'none',
      level,
      features
    };
  }

  /**
   * Update adaptive limits
   */
  private updateAdaptiveLimits(feature: string, entry: RateLimitEntry): void {
    // Analyze usage patterns
    const recentRequests = entry.requests.filter(
      r => r.timestamp > Date.now() - 3600000 // Last hour
    );

    const averageRequestSize = recentRequests.length > 0
      ? recentRequests.reduce((sum, r) => sum + r.size, 0) / recentRequests.length
      : 0;

    // Adjust limits based on usage patterns
    let adaptiveMultiplier = 1;

    if (averageRequestSize > 512 * 1024) { // Large requests
      adaptiveMultiplier = 0.8; // Reduce limits for large requests
    } else if (averageRequestSize < 1024) { // Small requests
      adaptiveMultiplier = 1.2; // Increase limits for small requests
    }

    // Apply smoothing to prevent rapid changes
    const currentMultiplier = this.adaptiveLimits.get(feature) || 1;
    const smoothedMultiplier = (currentMultiplier * 0.8) + (adaptiveMultiplier * 0.2);
    
    this.adaptiveLimits.set(feature, smoothedMultiplier);
  }

  /**
   * Update metrics
   */
  private updateMetrics(
    allowed: boolean,
    feature: string,
    requestSize: number,
    responseTime: number
  ): void {
    this.metrics.totalRequests++;
    
    if (allowed) {
      this.metrics.allowedRequests++;
    } else {
      this.metrics.blockedRequests++;
    }

    // Update average response time
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * 0.9) + (responseTime * 0.1);

    // Update feature usage
    if (!this.metrics.featureUsage[feature]) {
      this.metrics.featureUsage[feature] = {
        requests: 0,
        blocked: 0,
        averageSize: 0
      };
    }

    const featureUsage = this.metrics.featureUsage[feature];
    featureUsage.requests++;
    
    if (!allowed) {
      featureUsage.blocked++;
    }

    // Update average size
    featureUsage.averageSize = 
      (featureUsage.averageSize * 0.9) + (requestSize * 0.1);
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Cleanup every minute
  }

  /**
   * Cleanup old entries
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [key, entry] of this.rateLimitStore) {
      // Remove entries older than maxAge
      if (now - entry.lastReset > maxAge) {
        this.rateLimitStore.delete(key);
        continue;
      }

      // Clean old requests
      entry.requests = entry.requests.filter(
        request => now - request.timestamp < maxAge
      );

      // Reset grace period if expired
      if (entry.gracePeriod > 0 && now > entry.gracePeriod) {
        entry.gracePeriod = 0;
      }
    }

    // Update top violators
    this.updateTopViolators();
  }

  /**
   * Update top violators list
   */
  private updateTopViolators(): void {
    const violators = Array.from(this.rateLimitStore.values())
      .filter(entry => entry.violations > 0)
      .sort((a, b) => b.violations - a.violations)
      .slice(0, 10)
      .map(entry => ({
        identifier: entry.userId || entry.ipAddress || 'unknown',
        violations: entry.violations,
        lastViolation: Math.max(...entry.requests.map(r => r.timestamp))
      }));

    this.metrics.topViolators = violators;
  }

  /**
   * Get rate limit metrics
   */
  getMetrics(): RateLimitMetrics {
    return { ...this.metrics };
  }

  /**
   * Get rate limit statistics
   */
  getStatistics(): {
    summary: {
      totalRequests: number;
      allowedRequests: number;
      blockedRequests: number;
      blockRate: number;
      averageResponseTime: number;
    };
    features: Record<string, {
      requests: number;
      blocked: number;
      blockRate: number;
      averageSize: number;
    }>;
    violators: Array<{
      identifier: string;
      violations: number;
      lastViolation: number;
    }>;
    adaptiveLimits: Record<string, number>;
  } {
    const blockRate = this.metrics.totalRequests > 0
      ? (this.metrics.blockedRequests / this.metrics.totalRequests) * 100
      : 0;

    const featureStats: Record<string, any> = {};
    Object.entries(this.metrics.featureUsage).forEach(([feature, usage]) => {
      featureStats[feature] = {
        requests: usage.requests,
        blocked: usage.blocked,
        blockRate: usage.requests > 0 ? (usage.blocked / usage.requests) * 100 : 0,
        averageSize: usage.averageSize
      };
    });

    const adaptiveLimits: Record<string, number> = {};
    this.adaptiveLimits.forEach((limit, feature) => {
      adaptiveLimits[feature] = limit;
    });

    return {
      summary: {
        totalRequests: this.metrics.totalRequests,
        allowedRequests: this.metrics.allowedRequests,
        blockedRequests: this.metrics.blockedRequests,
        blockRate,
        averageResponseTime: this.metrics.averageResponseTime
      },
      features: featureStats,
      violators: this.metrics.topViolators,
      adaptiveLimits
    };
  }

  /**
   * Reset rate limits for specific identifier
   */
  resetRateLimit(identifier: string, feature: string, userId?: string, ipAddress?: string): void {
    const key = this.generateRateLimitKey(identifier, feature, { userId, ipAddress });
    this.rateLimitStore.delete(key);
  }

  /**
   * Update user tier
   */
  updateUserTier(userId: string, tier: string): void {
    // This would typically update a user database
    // For now, we'll just log the update
    console.log(`Updated user ${userId} to tier ${tier}`);
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(): Array<{
    type: string;
    description: string;
    potentialImprovement: string;
    priority: 'high' | 'medium' | 'low';
  }> {
    const recommendations = [];

    const blockRate = this.metrics.totalRequests > 0
      ? (this.metrics.blockedRequests / this.metrics.totalRequests) * 100
      : 0;

    if (blockRate > 10) {
      recommendations.push({
        type: 'rate-limits',
        description: 'Consider increasing rate limits - high block rate detected',
        potentialImprovement: 'Reduce block rate to <5%',
        priority: 'high' as const
      });
    }

    if (this.metrics.averageResponseTime > 100) {
      recommendations.push({
        type: 'performance',
        description: 'Optimize rate limiter performance',
        potentialImprovement: 'Reduce response time by 50%',
        priority: 'high' as const
      });
    }

    if (this.metrics.topViolators.length > 5) {
      recommendations.push({
        type: 'violations',
        description: 'Implement stricter penalties for repeat violators',
        potentialImprovement: 'Reduce violation rate',
        priority: 'medium' as const
      });
    }

    if (!this.config.enableAdaptiveLimiting) {
      recommendations.push({
        type: 'adaptive-limiting',
        description: 'Enable adaptive rate limiting',
        potentialImprovement: 'Improve user experience',
        priority: 'medium' as const
      });
    }

    if (!this.config.enableGracefulDegradation) {
      recommendations.push({
        type: 'graceful-degradation',
        description: 'Enable graceful degradation for rate-limited users',
        potentialImprovement: 'Improve user experience',
        priority: 'low' as const
      });
    }

    return recommendations;
  }

  /**
   * Destroy rate limiter
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.rateLimitStore.clear();
    this.adaptiveLimits.clear();
  }
}

export default VoiceRateLimiter;
