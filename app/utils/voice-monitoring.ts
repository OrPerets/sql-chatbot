/**
 * Voice Monitoring System
 * Comprehensive monitoring and alerting for voice features
 */

export interface MonitoringConfig {
  enablePerformanceMonitoring: boolean;
  enableErrorMonitoring: boolean;
  enableUsageMonitoring: boolean;
  enableHealthChecks: boolean;
  enableAlerting: boolean;
  alertThresholds: {
    errorRate: number;
    responseTime: number;
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
  };
  alertChannels: {
    email: boolean;
    webhook: boolean;
    slack: boolean;
    dashboard: boolean;
  };
  retentionPeriod: number;
  enableRealTimeMonitoring: boolean;
}

export interface MonitoringMetrics {
  performance: {
    responseTime: number;
    throughput: number;
    errorRate: number;
    availability: number;
  };
  resources: {
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
    networkUsage: number;
  };
  errors: {
    totalErrors: number;
    errorRate: number;
    topErrors: Array<{
      type: string;
      count: number;
      lastOccurrence: number;
    }>;
  };
  usage: {
    activeUsers: number;
    totalRequests: number;
    featureUsage: Record<string, number>;
  };
}

export interface Alert {
  id: string;
  type: 'error' | 'performance' | 'resource' | 'usage';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
  metadata: Record<string, any>;
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastCheck: number;
  error?: string;
  metadata: Record<string, any>;
}

export class VoiceMonitoring {
  private config: MonitoringConfig;
  private metrics: MonitoringMetrics;
  private alerts: Map<string, Alert> = new Map();
  private healthChecks: Map<string, HealthCheck> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertWebhooks: Array<{ url: string; enabled: boolean }> = [];

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.metrics = {
      performance: {
        responseTime: 0,
        throughput: 0,
        errorRate: 0,
        availability: 100
      },
      resources: {
        memoryUsage: 0,
        cpuUsage: 0,
        diskUsage: 0,
        networkUsage: 0
      },
      errors: {
        totalErrors: 0,
        errorRate: 0,
        topErrors: []
      },
      usage: {
        activeUsers: 0,
        totalRequests: 0,
        featureUsage: {}
      }
    };

    this.initializeMonitoring();
  }

  /**
   * Initialize monitoring system
   */
  private async initializeMonitoring(): Promise<void> {
    // Initialize health checks
    await this.initializeHealthChecks();

    // Start monitoring interval
    if (this.config.enableRealTimeMonitoring) {
      this.startMonitoring();
    }

    // Set up error tracking
    if (this.config.enableErrorMonitoring) {
      this.setupErrorTracking();
    }

    // Set up performance tracking
    if (this.config.enablePerformanceMonitoring) {
      this.setupPerformanceTracking();
    }
  }

  /**
   * Initialize health checks
   */
  private async initializeHealthChecks(): Promise<void> {
    const healthChecks = [
      {
        name: 'tts-service',
        check: () => this.checkTTSService(),
        interval: 30000 // 30 seconds
      },
      {
        name: 'audio-processing',
        check: () => this.checkAudioProcessing(),
        interval: 60000 // 1 minute
      },
      {
        name: 'voice-analytics',
        check: () => this.checkVoiceAnalytics(),
        interval: 120000 // 2 minutes
      },
      {
        name: 'database-connection',
        check: () => this.checkDatabaseConnection(),
        interval: 30000 // 30 seconds
      },
      {
        name: 'cache-system',
        check: () => this.checkCacheSystem(),
        interval: 60000 // 1 minute
      }
    ];

    for (const healthCheck of healthChecks) {
      this.healthChecks.set(healthCheck.name, {
        name: healthCheck.name,
        status: 'healthy',
        responseTime: 0,
        lastCheck: 0,
        metadata: {}
      });

      // Start health check interval
      setInterval(async () => {
        await this.runHealthCheck(healthCheck.name, healthCheck.check);
      }, healthCheck.interval);
    }
  }

  /**
   * Start monitoring interval
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics();
      await this.checkAlerts();
      await this.updateHealthStatus();
    }, 5000); // Every 5 seconds
  }

  /**
   * Set up error tracking
   */
  private setupErrorTracking(): void {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.trackError({
        type: 'javascript-error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        timestamp: Date.now()
      });
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError({
        type: 'unhandled-promise-rejection',
        message: event.reason?.message || 'Unknown error',
        stack: event.reason?.stack,
        timestamp: Date.now()
      });
    });
  }

  /**
   * Set up performance tracking
   */
  private setupPerformanceTracking(): void {
    // Track page load performance
    if (window.performance) {
      window.addEventListener('load', () => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        this.trackPerformance({
          type: 'page-load',
          loadTime: navigation.loadEventEnd - navigation.loadEventStart,
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          firstPaint: this.getFirstPaintTime(),
          timestamp: Date.now()
        });
      });
    }

    // Track memory usage
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        this.trackResourceUsage({
          memoryUsed: memory.usedJSHeapSize,
          memoryTotal: memory.totalJSHeapSize,
          memoryLimit: memory.jsHeapSizeLimit,
          timestamp: Date.now()
        });
      }, 10000); // Every 10 seconds
    }
  }

  /**
   * Collect metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      // Collect performance metrics
      if (this.config.enablePerformanceMonitoring) {
        await this.collectPerformanceMetrics();
      }

      // Collect resource metrics
      await this.collectResourceMetrics();

      // Collect usage metrics
      if (this.config.enableUsageMonitoring) {
        await this.collectUsageMetrics();
      }

      // Collect error metrics
      if (this.config.enableErrorMonitoring) {
        await this.collectErrorMetrics();
      }

    } catch (error) {
      console.error('Error collecting metrics:', error);
    }
  }

  /**
   * Collect performance metrics
   */
  private async collectPerformanceMetrics(): Promise<void> {
    // Measure TTS response time
    const ttsResponseTime = await this.measureTTSResponseTime();
    
    // Calculate throughput
    const throughput = await this.calculateThroughput();
    
    // Calculate error rate
    const errorRate = await this.calculateErrorRate();
    
    // Calculate availability
    const availability = await this.calculateAvailability();

    this.metrics.performance = {
      responseTime: ttsResponseTime,
      throughput,
      errorRate,
      availability
    };
  }

  /**
   * Collect resource metrics
   */
  private async collectResourceMetrics(): Promise<void> {
    // Memory usage
    const memoryUsage = await this.getMemoryUsage();
    
    // CPU usage (approximation)
    const cpuUsage = await this.getCPUUsage();
    
    // Disk usage (approximation)
    const diskUsage = await this.getDiskUsage();
    
    // Network usage (approximation)
    const networkUsage = await this.getNetworkUsage();

    this.metrics.resources = {
      memoryUsage,
      cpuUsage,
      diskUsage,
      networkUsage
    };
  }

  /**
   * Collect usage metrics
   */
  private async collectUsageMetrics(): Promise<void> {
    // Active users (approximation)
    const activeUsers = await this.getActiveUsers();
    
    // Total requests
    const totalRequests = await this.getTotalRequests();
    
    // Feature usage
    const featureUsage = await this.getFeatureUsage();

    this.metrics.usage = {
      activeUsers,
      totalRequests,
      featureUsage
    };
  }

  /**
   * Collect error metrics
   */
  private async collectErrorMetrics(): Promise<void> {
    const errorStats = await this.getErrorStats();
    
    this.metrics.errors = {
      totalErrors: errorStats.totalErrors,
      errorRate: errorStats.errorRate,
      topErrors: errorStats.topErrors
    };
  }

  /**
   * Track error
   */
  trackError(error: {
    type: string;
    message: string;
    stack?: string;
    timestamp: number;
    metadata?: Record<string, any>;
  }): void {
    // Log error
    console.error('Voice error:', error);

    // Update metrics
    this.metrics.errors.totalErrors++;

    // Create alert if threshold exceeded
    if (this.metrics.errors.errorRate > this.config.alertThresholds.errorRate) {
      this.createAlert({
        type: 'error',
        severity: 'critical',
        title: 'High Error Rate',
        description: `Error rate is ${this.metrics.errors.errorRate}%, exceeding threshold of ${this.config.alertThresholds.errorRate}%`,
        metadata: { errorRate: this.metrics.errors.errorRate }
      });
    }
  }

  /**
   * Track performance
   */
  trackPerformance(performance: {
    type: string;
    loadTime?: number;
    domContentLoaded?: number;
    firstPaint?: number;
    responseTime?: number;
    timestamp: number;
  }): void {
    // Update performance metrics
    if (performance.responseTime) {
      this.metrics.performance.responseTime = performance.responseTime;
    }

    // Create alert if threshold exceeded
    if (performance.responseTime && performance.responseTime > this.config.alertThresholds.responseTime) {
      this.createAlert({
        type: 'performance',
        severity: 'warning',
        title: 'Slow Response Time',
        description: `Response time is ${performance.responseTime}ms, exceeding threshold of ${this.config.alertThresholds.responseTime}ms`,
        metadata: { responseTime: performance.responseTime }
      });
    }
  }

  /**
   * Track resource usage
   */
  trackResourceUsage(resource: {
    memoryUsed: number;
    memoryTotal: number;
    memoryLimit: number;
    timestamp: number;
  }): void {
    const memoryUsagePercent = (resource.memoryUsed / resource.memoryLimit) * 100;
    
    this.metrics.resources.memoryUsage = memoryUsagePercent;

    // Create alert if memory usage is high
    if (memoryUsagePercent > this.config.alertThresholds.memoryUsage) {
      this.createAlert({
        type: 'resource',
        severity: 'warning',
        title: 'High Memory Usage',
        description: `Memory usage is ${memoryUsagePercent.toFixed(2)}%, exceeding threshold of ${this.config.alertThresholds.memoryUsage}%`,
        metadata: { memoryUsage: memoryUsagePercent }
      });
    }
  }

  /**
   * Create alert
   */
  createAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'resolved'>): void {
    const alertId = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newAlert: Alert = {
      id: alertId,
      timestamp: Date.now(),
      resolved: false,
      ...alert
    };

    this.alerts.set(alertId, newAlert);

    // Send alert notifications
    this.sendAlertNotifications(newAlert);
  }

  /**
   * Send alert notifications
   */
  private async sendAlertNotifications(alert: Alert): Promise<void> {
    if (this.config.alertChannels.dashboard) {
      // Send to dashboard (would integrate with dashboard API)
      console.log('Dashboard alert:', alert);
    }

    if (this.config.alertChannels.webhook) {
      // Send webhook notifications
      for (const webhook of this.alertWebhooks) {
        if (webhook.enabled) {
          try {
            await fetch(webhook.url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(alert)
            });
          } catch (error) {
            console.error('Failed to send webhook alert:', error);
          }
        }
      }
    }

    if (this.config.alertChannels.email && alert.severity === 'critical') {
      // Send email alert (would integrate with email service)
      console.log('Email alert:', alert);
    }

    if (this.config.alertChannels.slack && alert.severity === 'critical') {
      // Send Slack alert (would integrate with Slack API)
      console.log('Slack alert:', alert);
    }
  }

  /**
   * Check alerts
   */
  private async checkAlerts(): Promise<void> {
    // Check performance thresholds
    if (this.metrics.performance.responseTime > this.config.alertThresholds.responseTime) {
      this.createAlert({
        type: 'performance',
        severity: 'warning',
        title: 'Slow Response Time',
        description: `Average response time is ${this.metrics.performance.responseTime}ms`,
        metadata: { responseTime: this.metrics.performance.responseTime }
      });
    }

    // Check resource thresholds
    if (this.metrics.resources.memoryUsage > this.config.alertThresholds.memoryUsage) {
      this.createAlert({
        type: 'resource',
        severity: 'warning',
        title: 'High Memory Usage',
        description: `Memory usage is ${this.metrics.resources.memoryUsage.toFixed(2)}%`,
        metadata: { memoryUsage: this.metrics.resources.memoryUsage }
      });
    }

    // Check error rate
    if (this.metrics.errors.errorRate > this.config.alertThresholds.errorRate) {
      this.createAlert({
        type: 'error',
        severity: 'critical',
        title: 'High Error Rate',
        description: `Error rate is ${this.metrics.errors.errorRate.toFixed(2)}%`,
        metadata: { errorRate: this.metrics.errors.errorRate }
      });
    }
  }

  /**
   * Update health status
   */
  private async updateHealthStatus(): Promise<void> {
    const unhealthyChecks = Array.from(this.healthChecks.values())
      .filter(check => check.status === 'unhealthy');

    if (unhealthyChecks.length > 0) {
      this.createAlert({
        type: 'performance',
        severity: 'critical',
        title: 'Service Health Issues',
        description: `${unhealthyChecks.length} health checks are failing`,
        metadata: { 
          failingChecks: unhealthyChecks.map(check => check.name),
          totalChecks: this.healthChecks.size
        }
      });
    }
  }

  /**
   * Run health check
   */
  private async runHealthCheck(name: string, checkFunction: () => Promise<any>): Promise<void> {
    const startTime = Date.now();
    
    try {
      await checkFunction();
      
      const responseTime = Date.now() - startTime;
      
      this.healthChecks.set(name, {
        name,
        status: 'healthy',
        responseTime,
        lastCheck: Date.now(),
        metadata: {}
      });
      
    } catch (error) {
      this.healthChecks.set(name, {
        name,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {}
      });
    }
  }

  /**
   * Health check implementations
   */
  private async checkTTSService(): Promise<void> {
    // Simulate TTS service health check
    const response = await fetch('/api/audio/health');
    if (!response.ok) {
      throw new Error(`TTS service health check failed: ${response.status}`);
    }
  }

  private async checkAudioProcessing(): Promise<void> {
    // Simulate audio processing health check
    // In a real implementation, this would check audio processing service
    return Promise.resolve();
  }

  private async checkVoiceAnalytics(): Promise<void> {
    // Simulate voice analytics health check
    // In a real implementation, this would check analytics service
    return Promise.resolve();
  }

  private async checkDatabaseConnection(): Promise<void> {
    // Simulate database connection health check
    // In a real implementation, this would check database connectivity
    return Promise.resolve();
  }

  private async checkCacheSystem(): Promise<void> {
    // Simulate cache system health check
    // In a real implementation, this would check cache connectivity
    return Promise.resolve();
  }

  /**
   * Metric collection helper methods
   */
  private async measureTTSResponseTime(): Promise<number> {
    // Simulate TTS response time measurement
    return Math.random() * 1000 + 100; // 100-1100ms
  }

  private async calculateThroughput(): Promise<number> {
    // Simulate throughput calculation
    return Math.random() * 100 + 50; // 50-150 requests/minute
  }

  private async calculateErrorRate(): Promise<number> {
    // Simulate error rate calculation
    return Math.random() * 5; // 0-5%
  }

  private async calculateAvailability(): Promise<number> {
    // Simulate availability calculation
    return 99.5 + Math.random() * 0.5; // 99.5-100%
  }

  private async getMemoryUsage(): Promise<number> {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
    }
    return 0;
  }

  private async getCPUUsage(): Promise<number> {
    // Simulate CPU usage calculation
    return Math.random() * 100; // 0-100%
  }

  private async getDiskUsage(): Promise<number> {
    // Simulate disk usage calculation
    return Math.random() * 100; // 0-100%
  }

  private async getNetworkUsage(): Promise<number> {
    // Simulate network usage calculation
    return Math.random() * 100; // 0-100%
  }

  private async getActiveUsers(): Promise<number> {
    // Simulate active users calculation
    return Math.floor(Math.random() * 1000) + 100; // 100-1100 users
  }

  private async getTotalRequests(): Promise<number> {
    // Simulate total requests calculation
    return Math.floor(Math.random() * 10000) + 1000; // 1000-11000 requests
  }

  private async getFeatureUsage(): Promise<Record<string, number>> {
    // Simulate feature usage calculation
    return {
      'tts': Math.floor(Math.random() * 1000) + 500,
      'voice-commands': Math.floor(Math.random() * 500) + 200,
      'audio-processing': Math.floor(Math.random() * 300) + 100,
      'voice-analytics': Math.floor(Math.random() * 200) + 50
    };
  }

  private async getErrorStats(): Promise<{
    totalErrors: number;
    errorRate: number;
    topErrors: Array<{ type: string; count: number; lastOccurrence: number }>;
  }> {
    // Simulate error statistics
    return {
      totalErrors: Math.floor(Math.random() * 100) + 10,
      errorRate: Math.random() * 5,
      topErrors: [
        { type: 'network-error', count: 5, lastOccurrence: Date.now() - 60000 },
        { type: 'tts-error', count: 3, lastOccurrence: Date.now() - 120000 },
        { type: 'audio-error', count: 2, lastOccurrence: Date.now() - 180000 }
      ]
    };
  }

  private getFirstPaintTime(): number {
    const paintEntries = performance.getEntriesByType('paint');
    const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
    return firstPaint ? firstPaint.startTime : 0;
  }

  /**
   * Get monitoring metrics
   */
  getMetrics(): MonitoringMetrics {
    return { ...this.metrics };
  }

  /**
   * Get alerts
   */
  getAlerts(): Alert[] {
    return Array.from(this.alerts.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get health checks
   */
  getHealthChecks(): HealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
    }
  }

  /**
   * Add alert webhook
   */
  addAlertWebhook(url: string): void {
    this.alertWebhooks.push({ url, enabled: true });
  }

  /**
   * Get monitoring dashboard data
   */
  getDashboardData(): {
    metrics: MonitoringMetrics;
    alerts: Alert[];
    healthChecks: HealthCheck[];
    trends: {
      performance: Array<{ timestamp: number; value: number }>;
      errors: Array<{ timestamp: number; value: number }>;
      usage: Array<{ timestamp: number; value: number }>;
    };
  } {
    return {
      metrics: this.metrics,
      alerts: this.getAlerts(),
      healthChecks: this.getHealthChecks(),
      trends: {
        performance: this.generateTrendData('performance'),
        errors: this.generateTrendData('errors'),
        usage: this.generateTrendData('usage')
      }
    };
  }

  /**
   * Generate trend data
   */
  private generateTrendData(type: string): Array<{ timestamp: number; value: number }> {
    const data = [];
    const now = Date.now();
    
    for (let i = 24; i >= 0; i--) {
      const timestamp = now - (i * 60 * 60 * 1000); // Hourly data
      let value = 0;
      
      switch (type) {
        case 'performance':
          value = Math.random() * 1000 + 100; // Response time
          break;
        case 'errors':
          value = Math.random() * 10; // Error count
          break;
        case 'usage':
          value = Math.random() * 1000 + 500; // Request count
          break;
      }
      
      data.push({ timestamp, value });
    }
    
    return data;
  }

  /**
   * Destroy monitoring
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.alerts.clear();
    this.healthChecks.clear();
    this.alertWebhooks = [];
  }
}

export default VoiceMonitoring;
