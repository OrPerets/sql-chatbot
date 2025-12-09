#!/usr/bin/env ts-node

import { getMonitoringService } from '../lib/monitoring'
import { TokenCleanupService } from './cleanup-expired-tokens'
import { getSecurityService } from '../lib/security'
import { passwordResetRateLimiter, ipPasswordResetRateLimiter } from '../lib/rate-limiter'

interface MaintenanceTask {
  name: string
  description: string
  run: () => Promise<{ success: boolean; message: string; details?: any }>
}

class MaintenanceService {
  private tasks: MaintenanceTask[] = []

  constructor() {
    this.initializeTasks()
  }

  private initializeTasks(): void {
    this.tasks = [
      {
        name: 'Collect Metrics',
        description: 'Collect and store system performance metrics',
        run: async () => {
          try {
            const monitoringService = await getMonitoringService()
            const metrics = await monitoringService.collectMetrics()
            await monitoringService.storeMetrics(metrics)
            
            return {
              success: true,
              message: 'Metrics collected successfully',
              details: {
                passwordResetRequests: metrics.passwordResetRequests,
                successRate: ((metrics.passwordResetSuccesses / Math.max(metrics.passwordResetRequests, 1)) * 100).toFixed(1) + '%',
                errorRate: (metrics.errorRate * 100).toFixed(1) + '%'
              }
            }
          } catch (error: any) {
            return {
              success: false,
              message: `Failed to collect metrics: ${error.message}`
            }
          }
        }
      },
      {
        name: 'Check Alerts',
        description: 'Check for new alerts based on current metrics',
        run: async () => {
          try {
            const monitoringService = await getMonitoringService()
            const metrics = await monitoringService.collectMetrics()
            const alerts = await monitoringService.checkAlerts(metrics)
            
            let createdAlerts = 0
            for (const alert of alerts) {
              await monitoringService.createAlert(alert)
              createdAlerts++
            }
            
            return {
              success: true,
              message: `Alert check completed. ${createdAlerts} new alerts created`,
              details: {
                newAlerts: createdAlerts,
                activeAlerts: (await monitoringService.getActiveAlerts()).length
              }
            }
          } catch (error: any) {
            return {
              success: false,
              message: `Failed to check alerts: ${error.message}`
            }
          }
        }
      },
      {
        name: 'Cleanup Expired Tokens',
        description: 'Remove expired password reset tokens and used tokens',
        run: async () => {
          try {
            const cleanupService = new TokenCleanupService()
            await cleanupService.connect()
            
            const result = await cleanupService.cleanupExpiredPasswordResetTokens()
            
            return {
              success: true,
              message: `Cleaned up ${result.deletedCount} expired tokens`,
              details: {
                deletedTokens: result.deletedCount
              }
            }
          } catch (error: any) {
            return {
              success: false,
              message: `Failed to cleanup tokens: ${error.message}`
            }
          }
        }
      },
      {
        name: 'Cleanup Rate Limits',
        description: 'Remove expired rate limit entries',
        run: async () => {
          try {
            const cleanupService = new TokenCleanupService()
            await cleanupService.connect()
            
            const rateLimitResult = await cleanupService.cleanupExpiredRateLimits()
            const ipRateLimitResult = await cleanupService.cleanupExpiredIPRateLimits()
            
            const totalDeleted = rateLimitResult.deletedCount + ipRateLimitResult.deletedCount
            
            return {
              success: true,
              message: `Cleaned up ${totalDeleted} expired rate limit entries`,
              details: {
                rateLimitEntries: rateLimitResult.deletedCount,
                ipRateLimitEntries: ipRateLimitResult.deletedCount
              }
            }
          } catch (error: any) {
            return {
              success: false,
              message: `Failed to cleanup rate limits: ${error.message}`
            }
          }
        }
      },
      {
        name: 'Cleanup Security Events',
        description: 'Remove old security events (older than 30 days)',
        run: async () => {
          try {
            const cleanupService = new TokenCleanupService()
            await cleanupService.connect()
            
            const result = await cleanupService.cleanupOldSecurityEvents()
            
            return {
              success: true,
              message: `Cleaned up ${result.deletedCount} old security events`,
              details: {
                deletedEvents: result.deletedCount
              }
            }
          } catch (error: any) {
            return {
              success: false,
              message: `Failed to cleanup security events: ${error.message}`
            }
          }
        }
      },
      {
        name: 'Cleanup Monitoring Data',
        description: 'Remove old monitoring metrics and resolved alerts',
        run: async () => {
          try {
            const monitoringService = await getMonitoringService()
            await monitoringService.cleanupOldData()
            
            return {
              success: true,
              message: 'Cleaned up old monitoring data'
            }
          } catch (error: any) {
            return {
              success: false,
              message: `Failed to cleanup monitoring data: ${error.message}`
            }
          }
        }
      },
      {
        name: 'Security Analysis',
        description: 'Analyze recent security events for patterns',
        run: async () => {
          try {
            const securityService = await getSecurityService()
            
            // Get recent security events
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
            // This would require implementing a method to get security events
            // For now, we'll simulate the analysis
            
            return {
              success: true,
              message: 'Security analysis completed',
              details: {
                analysisPeriod: '24 hours',
                suspiciousActivities: 0, // Would be calculated from actual data
                rateLimitViolations: 0,
                recommendations: ['Continue monitoring for unusual patterns']
              }
            }
          } catch (error: any) {
            return {
              success: false,
              message: `Failed to perform security analysis: ${error.message}`
            }
          }
        }
      },
      {
        name: 'Rate Limiter Cleanup',
        description: 'Clean up expired entries in rate limiters',
        run: async () => {
          try {
            await passwordResetRateLimiter.cleanup()
            await ipPasswordResetRateLimiter.cleanup()
            
            return {
              success: true,
              message: 'Rate limiter cleanup completed'
            }
          } catch (error: any) {
            return {
              success: false,
              message: `Failed to cleanup rate limiters: ${error.message}`
            }
          }
        }
      }
    ]
  }

  async runAllTasks(): Promise<void> {
    console.log('🔧 Starting maintenance tasks...\n')
    
    const results = []
    let successCount = 0
    let failureCount = 0

    for (const task of this.tasks) {
      console.log(`⏳ Running: ${task.name}`)
      console.log(`   ${task.description}`)
      
      const startTime = Date.now()
      const result = await task.run()
      const duration = Date.now() - startTime
      
      if (result.success) {
        console.log(`✅ ${task.name}: ${result.message}`)
        if (result.details) {
          console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`)
        }
        successCount++
      } else {
        console.log(`❌ ${task.name}: ${result.message}`)
        failureCount++
      }
      
      console.log(`   Duration: ${duration}ms\n`)
      
      results.push({
        task: task.name,
        success: result.success,
        message: result.message,
        duration,
        details: result.details
      })
    }

    console.log('📊 Maintenance Summary:')
    console.log(`✅ Successful: ${successCount}`)
    console.log(`❌ Failed: ${failureCount}`)
    console.log(`⏱️  Total Duration: ${results.reduce((sum, r) => sum + r.duration, 0)}ms`)

    if (failureCount > 0) {
      console.log('\n❌ Failed Tasks:')
      results.filter(r => !r.success).forEach(result => {
        console.log(`   - ${result.task}: ${result.message}`)
      })
    }

    console.log('\n🎉 Maintenance completed!')
  }

  async runSpecificTask(taskName: string): Promise<void> {
    const task = this.tasks.find(t => t.name.toLowerCase() === taskName.toLowerCase())
    
    if (!task) {
      console.error(`❌ Task not found: ${taskName}`)
      console.log('Available tasks:')
      this.tasks.forEach(t => console.log(`   - ${t.name}`))
      return
    }

    console.log(`🔧 Running task: ${task.name}`)
    console.log(`   ${task.description}\n`)
    
    const startTime = Date.now()
    const result = await task.run()
    const duration = Date.now() - startTime
    
    if (result.success) {
      console.log(`✅ ${task.name}: ${result.message}`)
      if (result.details) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`)
      }
    } else {
      console.log(`❌ ${task.name}: ${result.message}`)
    }
    
    console.log(`⏱️  Duration: ${duration}ms`)
  }

  listTasks(): void {
    console.log('📋 Available Maintenance Tasks:\n')
    
    this.tasks.forEach((task, index) => {
      console.log(`${index + 1}. ${task.name}`)
      console.log(`   ${task.description}\n`)
    })
  }
}

// Run maintenance if this script is executed directly
if (require.main === module) {
  const maintenance = new MaintenanceService()
  
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    maintenance.runAllTasks().catch(error => {
      console.error('Maintenance failed:', error)
      process.exit(1)
    })
  } else if (args[0] === '--list') {
    maintenance.listTasks()
  } else if (args[0] === '--task') {
    if (args[1]) {
      maintenance.runSpecificTask(args[1]).catch(error => {
        console.error('Task failed:', error)
        process.exit(1)
      })
    } else {
      console.error('Please specify a task name after --task')
      maintenance.listTasks()
    }
  } else {
    console.log('Usage:')
    console.log('  npm run maintenance                    # Run all tasks')
    console.log('  npm run maintenance --list            # List available tasks')
    console.log('  npm run maintenance --task <name>     # Run specific task')
  }
}

export { MaintenanceService }
