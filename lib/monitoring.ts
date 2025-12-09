import { connectToDatabase, executeWithRetry, COLLECTIONS } from './database'
import { ObjectId } from 'mongodb'

export interface MonitoringMetrics {
  timestamp: Date
  passwordResetRequests: number
  passwordResetSuccesses: number
  passwordResetFailures: number
  emailDeliverySuccesses: number
  emailDeliveryFailures: number
  rateLimitViolations: number
  suspiciousActivities: number
  averageResponseTime: number
  errorRate: number
}

export interface AlertConfig {
  metric: string
  threshold: number
  operator: 'gt' | 'lt' | 'eq'
  severity: 'low' | 'medium' | 'high' | 'critical'
  enabled: boolean
}

export interface Alert {
  _id?: any
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  metric: string
  value: number
  threshold: number
  timestamp: Date
  acknowledged: boolean
  resolved: boolean
}

export class MonitoringService {
  private db: any
  private alertConfigs: AlertConfig[] = []

  constructor(db: any) {
    this.db = db
    this.initializeDefaultAlerts()
  }

  private initializeDefaultAlerts(): void {
    this.alertConfigs = [
      {
        metric: 'errorRate',
        threshold: 0.05, // 5%
        operator: 'gt',
        severity: 'high',
        enabled: true
      },
      {
        metric: 'averageResponseTime',
        threshold: 5000, // 5 seconds
        operator: 'gt',
        severity: 'medium',
        enabled: true
      },
      {
        metric: 'rateLimitViolations',
        threshold: 50, // 50 violations per hour
        operator: 'gt',
        severity: 'medium',
        enabled: true
      },
      {
        metric: 'suspiciousActivities',
        threshold: 10, // 10 suspicious activities per hour
        operator: 'gt',
        severity: 'high',
        enabled: true
      },
      {
        metric: 'emailDeliveryFailures',
        threshold: 10, // 10 failures per hour
        operator: 'gt',
        severity: 'high',
        enabled: true
      }
    ]
  }

  async collectMetrics(timeWindow: number = 60 * 60 * 1000): Promise<MonitoringMetrics> {
    return executeWithRetry(async (db) => {
      const now = new Date()
      const startTime = new Date(now.getTime() - timeWindow)

      // Password reset metrics
      const passwordResetRequests = await db.collection(COLLECTIONS.SECURITY_EVENTS).countDocuments({
        type: 'password_reset',
        timestamp: { $gte: startTime }
      })

      const passwordResetSuccesses = await db.collection(COLLECTIONS.SECURITY_EVENTS).countDocuments({
        type: 'password_reset',
        'details.success': true,
        timestamp: { $gte: startTime }
      })

      const passwordResetFailures = await db.collection(COLLECTIONS.SECURITY_EVENTS).countDocuments({
        type: 'password_reset',
        'details.success': false,
        timestamp: { $gte: startTime }
      })

      // Email delivery metrics
      const emailDeliverySuccesses = await db.collection(COLLECTIONS.SECURITY_EVENTS).countDocuments({
        type: 'password_reset',
        'details.action': 'email_sent',
        'details.success': true,
        timestamp: { $gte: startTime }
      })

      const emailDeliveryFailures = await db.collection(COLLECTIONS.SECURITY_EVENTS).countDocuments({
        type: 'password_reset',
        'details.action': 'email_sent',
        'details.success': false,
        timestamp: { $gte: startTime }
      })

      // Rate limit violations
      const rateLimitViolations = await db.collection(COLLECTIONS.SECURITY_EVENTS).countDocuments({
        type: 'rate_limit_exceeded',
        timestamp: { $gte: startTime }
      })

      // Suspicious activities
      const suspiciousActivities = await db.collection(COLLECTIONS.SECURITY_EVENTS).countDocuments({
        type: 'suspicious_activity',
        timestamp: { $gte: startTime }
      })

      // Calculate average response time (simplified)
      const responseTimeEvents = await db.collection(COLLECTIONS.SECURITY_EVENTS).find({
        'details.responseTime': { $exists: true },
        timestamp: { $gte: startTime }
      }).toArray()

      const averageResponseTime = responseTimeEvents.length > 0
        ? responseTimeEvents.reduce((sum, event) => sum + (event.details.responseTime || 0), 0) / responseTimeEvents.length
        : 0

      // Calculate error rate
      const totalRequests = passwordResetRequests
      const errorRate = totalRequests > 0 ? passwordResetFailures / totalRequests : 0

      return {
        timestamp: now,
        passwordResetRequests,
        passwordResetSuccesses,
        passwordResetFailures,
        emailDeliverySuccesses,
        emailDeliveryFailures,
        rateLimitViolations,
        suspiciousActivities,
        averageResponseTime,
        errorRate
      }
    })
  }

  async storeMetrics(metrics: MonitoringMetrics): Promise<void> {
    return executeWithRetry(async (db) => {
      await db.collection('monitoring_metrics').insertOne(metrics)
    })
  }

  async checkAlerts(metrics: MonitoringMetrics): Promise<Alert[]> {
    const alerts: Alert[] = []

    for (const config of this.alertConfigs) {
      if (!config.enabled) continue

      const value = metrics[config.metric as keyof MonitoringMetrics] as number
      let shouldAlert = false

      switch (config.operator) {
        case 'gt':
          shouldAlert = value > config.threshold
          break
        case 'lt':
          shouldAlert = value < config.threshold
          break
        case 'eq':
          shouldAlert = value === config.threshold
          break
      }

      if (shouldAlert) {
        const alert: Alert = {
          type: 'metric_threshold',
          severity: config.severity,
          message: `${config.metric} is ${value} (threshold: ${config.threshold})`,
          metric: config.metric,
          value,
          threshold: config.threshold,
          timestamp: new Date(),
          acknowledged: false,
          resolved: false
        }

        alerts.push(alert)
      }
    }

    return alerts
  }

  async createAlert(alert: Omit<Alert, '_id' | 'timestamp'>): Promise<void> {
    return executeWithRetry(async (db) => {
      await db.collection('alerts').insertOne({
        ...alert,
        timestamp: new Date()
      })
    })
  }

  async getActiveAlerts(): Promise<Alert[]> {
    return executeWithRetry(async (db) => {
      return await db.collection('alerts').find({
        resolved: false
      }).sort({ timestamp: -1 }).toArray() as unknown as Alert[]
    })
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    return executeWithRetry(async (db) => {
      await db.collection('alerts').updateOne(
        { _id: new ObjectId(alertId) },
        { $set: { acknowledged: true } }
      )
    })
  }

  async resolveAlert(alertId: string): Promise<void> {
    return executeWithRetry(async (db) => {
      await db.collection('alerts').updateOne(
        { _id: new ObjectId(alertId) },
        { $set: { resolved: true, resolvedAt: new Date() } }
      )
    })
  }

  async getMetricsHistory(hours: number = 24): Promise<MonitoringMetrics[]> {
    return executeWithRetry(async (db) => {
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000)
      return await db.collection('monitoring_metrics').find({
        timestamp: { $gte: startTime }
      }).sort({ timestamp: 1 }).toArray() as unknown as MonitoringMetrics[]
    })
  }

  async generateReport(): Promise<{
    summary: any
    metrics: MonitoringMetrics[]
    alerts: Alert[]
    recommendations: string[]
  }> {
    const metrics = await this.getMetricsHistory(24)
    const alerts = await this.getActiveAlerts()
    const latestMetrics = metrics[metrics.length - 1] || await this.collectMetrics()

    const summary = {
      totalPasswordResets: latestMetrics.passwordResetRequests,
      successRate: latestMetrics.passwordResetRequests > 0 
        ? (latestMetrics.passwordResetSuccesses / latestMetrics.passwordResetRequests) * 100 
        : 0,
      emailDeliveryRate: (latestMetrics.emailDeliverySuccesses + latestMetrics.emailDeliveryFailures) > 0
        ? (latestMetrics.emailDeliverySuccesses / (latestMetrics.emailDeliverySuccesses + latestMetrics.emailDeliveryFailures)) * 100
        : 0,
      averageResponseTime: latestMetrics.averageResponseTime,
      errorRate: latestMetrics.errorRate * 100,
      activeAlerts: alerts.length,
      criticalAlerts: alerts.filter(a => a.severity === 'critical').length
    }

    const recommendations: string[] = []

    if (summary.errorRate > 5) {
      recommendations.push('High error rate detected. Review error logs and check system health.')
    }

    if (summary.averageResponseTime > 3000) {
      recommendations.push('High response times detected. Consider optimizing database queries or scaling resources.')
    }

    if (summary.emailDeliveryRate < 95) {
      recommendations.push('Low email delivery rate. Check SMTP configuration and email service health.')
    }

    if (summary.activeAlerts > 5) {
      recommendations.push('Multiple active alerts. Review and address critical issues.')
    }

    if (latestMetrics.rateLimitViolations > 20) {
      recommendations.push('High rate limit violations. Consider adjusting rate limits or investigating abuse.')
    }

    return {
      summary,
      metrics,
      alerts,
      recommendations
    }
  }

  async cleanupOldData(): Promise<void> {
    return executeWithRetry(async (db) => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

      // Clean up old metrics (keep 30 days)
      await db.collection('monitoring_metrics').deleteMany({
        timestamp: { $lt: thirtyDaysAgo }
      })

      // Clean up resolved alerts (keep 7 days)
      await db.collection('alerts').deleteMany({
        resolved: true,
        timestamp: { $lt: sevenDaysAgo }
      })
    })
  }
}

let monitoringService: MonitoringService | null = null

export async function getMonitoringService(): Promise<MonitoringService> {
  if (!monitoringService) {
    const { db } = await connectToDatabase()
    monitoringService = new MonitoringService(db)
  }
  return monitoringService
}

// Utility function to log performance metrics
export async function logPerformanceMetric(
  operation: string,
  duration: number,
  success: boolean,
  details?: any
): Promise<void> {
  const monitoringService = await getMonitoringService()
  
  await monitoringService.createAlert({
    type: 'performance_metric',
    severity: duration > 5000 ? 'medium' : 'low',
    message: `${operation} took ${duration}ms`,
    metric: 'responseTime',
    value: duration,
    threshold: 5000,
    acknowledged: false,
    resolved: false
  })
}
