'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Mail, 
  Shield, 
  TrendingUp,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react'
import styles from './MonitoringDashboard.module.css'

interface MonitoringMetrics {
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

interface Alert {
  _id: string
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

interface MonitoringReport {
  summary: {
    totalPasswordResets: number
    successRate: number
    emailDeliveryRate: number
    averageResponseTime: number
    errorRate: number
    activeAlerts: number
    criticalAlerts: number
  }
  metrics: MonitoringMetrics[]
  alerts: Alert[]
  recommendations: string[]
}

export default function MonitoringDashboard() {
  const [report, setReport] = useState<MonitoringReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [selectedTimeRange, setSelectedTimeRange] = useState('24')

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/monitoring?hours=${selectedTimeRange}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch monitoring data')
      }
      
      const data = await response.json()
      setReport(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [selectedTimeRange])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchReport, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [autoRefresh, fetchReport])

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch('/api/admin/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'acknowledge', alertId })
      })

      if (response.ok) {
        fetchReport() // Refresh data
      }
    } catch (err) {
      console.error('Failed to acknowledge alert:', err)
    }
  }

  const handleResolveAlert = async (alertId: string) => {
    try {
      const response = await fetch('/api/admin/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', alertId })
      })

      if (response.ok) {
        fetchReport() // Refresh data
      }
    } catch (err) {
      console.error('Failed to resolve alert:', err)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#dc3545'
      case 'high': return '#fd7e14'
      case 'medium': return '#ffc107'
      case 'low': return '#28a745'
      default: return '#6c757d'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle size={16} />
      case 'high': return <AlertTriangle size={16} />
      case 'medium': return <AlertTriangle size={16} />
      case 'low': return <CheckCircle size={16} />
      default: return <Activity size={16} />
    }
  }

  if (loading && !report) {
    return (
      <div className={styles.loadingContainer}>
        <RefreshCw className={styles.loadingSpinner} size={48} />
        <p>Loading monitoring data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <AlertTriangle size={48} />
        <h3>Error Loading Monitoring Data</h3>
        <p>{error}</p>
        <button onClick={fetchReport} className={styles.retryButton}>
          Try Again
        </button>
      </div>
    )
  }

  if (!report) return null

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <h2>Monitoring Dashboard</h2>
        <div className={styles.controls}>
          <select 
            value={selectedTimeRange} 
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className={styles.timeRangeSelect}
          >
            <option value="1">Last Hour</option>
            <option value="24">Last 24 Hours</option>
            <option value="168">Last Week</option>
          </select>
          
          <button 
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`${styles.autoRefreshButton} ${autoRefresh ? styles.active : ''}`}
          >
            {autoRefresh ? <Eye size={16} /> : <EyeOff size={16} />}
            Auto Refresh
          </button>
          
          <button onClick={fetchReport} className={styles.refreshButton}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon}>
            <Activity size={24} />
          </div>
          <div className={styles.summaryContent}>
            <h3>Total Requests</h3>
            <p className={styles.summaryValue}>{report.summary.totalPasswordResets}</p>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon}>
            <TrendingUp size={24} />
          </div>
          <div className={styles.summaryContent}>
            <h3>Success Rate</h3>
            <p className={styles.summaryValue}>{report.summary.successRate.toFixed(1)}%</p>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon}>
            <Mail size={24} />
          </div>
          <div className={styles.summaryContent}>
            <h3>Email Delivery</h3>
            <p className={styles.summaryValue}>{report.summary.emailDeliveryRate.toFixed(1)}%</p>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon}>
            <Clock size={24} />
          </div>
          <div className={styles.summaryContent}>
            <h3>Avg Response</h3>
            <p className={styles.summaryValue}>{report.summary.averageResponseTime.toFixed(0)}ms</p>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon}>
            <Shield size={24} />
          </div>
          <div className={styles.summaryContent}>
            <h3>Active Alerts</h3>
            <p className={styles.summaryValue}>{report.summary.activeAlerts}</p>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon}>
            <AlertTriangle size={24} />
          </div>
          <div className={styles.summaryContent}>
            <h3>Critical Alerts</h3>
            <p className={styles.summaryValue}>{report.summary.criticalAlerts}</p>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {report.alerts.length > 0 && (
        <div className={styles.alertsSection}>
          <h3>Active Alerts</h3>
          <div className={styles.alertsList}>
            {report.alerts.map((alert) => (
              <div key={alert._id} className={styles.alertItem}>
                <div className={styles.alertHeader}>
                  <div className={styles.alertSeverity} style={{ color: getSeverityColor(alert.severity) }}>
                    {getSeverityIcon(alert.severity)}
                    <span>{alert.severity.toUpperCase()}</span>
                  </div>
                  <div className={styles.alertTime}>
                    {new Date(alert.timestamp).toLocaleString()}
                  </div>
                </div>
                <div className={styles.alertMessage}>{alert.message}</div>
                <div className={styles.alertActions}>
                  {!alert.acknowledged && (
                    <button 
                      onClick={() => handleAcknowledgeAlert(alert._id)}
                      className={styles.acknowledgeButton}
                    >
                      Acknowledge
                    </button>
                  )}
                  {!alert.resolved && (
                    <button 
                      onClick={() => handleResolveAlert(alert._id)}
                      className={styles.resolveButton}
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations Section */}
      {report.recommendations.length > 0 && (
        <div className={styles.recommendationsSection}>
          <h3>Recommendations</h3>
          <div className={styles.recommendationsList}>
            {report.recommendations.map((recommendation, index) => (
              <div key={index} className={styles.recommendationItem}>
                <AlertTriangle size={16} />
                <span>{recommendation}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics Chart Placeholder */}
      <div className={styles.metricsSection}>
        <h3>Performance Metrics</h3>
        <div className={styles.chartPlaceholder}>
          <p>Chart visualization would go here</p>
          <p>Metrics data points: {report.metrics.length}</p>
        </div>
      </div>
    </div>
  )
}
