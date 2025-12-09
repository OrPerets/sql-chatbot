import { NextRequest, NextResponse } from 'next/server'
import { getMonitoringService } from '@/lib/monitoring'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const hours = parseInt(searchParams.get('hours') || '24')
    const reportType = searchParams.get('type') || 'summary'

    const monitoringService = await getMonitoringService()

    switch (reportType) {
      case 'summary':
        const report = await monitoringService.generateReport()
        return NextResponse.json(report)

      case 'metrics':
        const metrics = await monitoringService.getMetricsHistory(hours)
        return NextResponse.json({ metrics })

      case 'alerts':
        const alerts = await monitoringService.getActiveAlerts()
        return NextResponse.json({ alerts })

      case 'current':
        const currentMetrics = await monitoringService.collectMetrics()
        return NextResponse.json({ metrics: currentMetrics })

      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error generating monitoring report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, alertId } = await request.json()
    const monitoringService = await getMonitoringService()

    switch (action) {
      case 'acknowledge':
        if (!alertId) {
          return NextResponse.json({ error: 'Alert ID is required' }, { status: 400 })
        }
        await monitoringService.acknowledgeAlert(alertId)
        return NextResponse.json({ success: true })

      case 'resolve':
        if (!alertId) {
          return NextResponse.json({ error: 'Alert ID is required' }, { status: 400 })
        }
        await monitoringService.resolveAlert(alertId)
        return NextResponse.json({ success: true })

      case 'cleanup':
        await monitoringService.cleanupOldData()
        return NextResponse.json({ success: true })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error processing monitoring action:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
