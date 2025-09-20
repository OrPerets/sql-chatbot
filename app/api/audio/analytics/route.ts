import { NextRequest, NextResponse } from 'next/server';
import { ttsAnalytics } from '../../../utils/tts-analytics';

export async function GET(request: NextRequest) {
  try {
    const featureVoiceEnabled = process.env.FEATURE_VOICE === '1';
    
    if (!featureVoiceEnabled) {
      return NextResponse.json({ 
        status: 'disabled',
        message: 'Voice feature is disabled',
        timestamp: new Date().toISOString()
      }, { status: 200 });
    }

    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'summary';

    let response: any;

    switch (type) {
      case 'summary':
        response = ttsAnalytics.getUsageMetrics();
        break;
      case 'errors':
        response = ttsAnalytics.getErrorAnalysis();
        break;
      case 'performance':
        response = ttsAnalytics.getPerformanceInsights();
        break;
      case 'realtime':
        response = ttsAnalytics.getRealTimeMetrics();
        break;
      case 'full':
        response = ttsAnalytics.generateReport();
        break;
      default:
        return NextResponse.json({
          status: 'error',
          message: 'Invalid analytics type',
          availableTypes: ['summary', 'errors', 'performance', 'realtime', 'full']
        }, { status: 400 });
    }

    return NextResponse.json({
      status: 'success',
      data: response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Analytics API error:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Failed to retrieve analytics',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body || {};

    switch (action) {
      case 'clear':
        ttsAnalytics.clearMetrics();
        return NextResponse.json({
          status: 'success',
          message: 'Analytics data cleared successfully',
          timestamp: new Date().toISOString()
        });

      case 'export':
        const metrics = ttsAnalytics.exportMetrics();
        return NextResponse.json({
          status: 'success',
          data: JSON.parse(metrics),
          timestamp: new Date().toISOString()
        });

      case 'toggle':
        const enabled = body.enabled !== undefined ? body.enabled : true;
        ttsAnalytics.setEnabled(enabled);
        return NextResponse.json({
          status: 'success',
          message: `Analytics ${enabled ? 'enabled' : 'disabled'}`,
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json({
          status: 'error',
          message: 'Unknown action',
          availableActions: ['clear', 'export', 'toggle']
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Analytics action error:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Action failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
