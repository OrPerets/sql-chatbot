import { NextRequest, NextResponse } from 'next/server';
import { enhancedTTS } from '../../utils/enhanced-tts';

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

    // Get health status from the enhanced TTS service
    const healthStatus = await enhancedTTS.healthCheck();
    const performanceMetrics = enhancedTTS.getPerformanceMetrics();

    const response = {
      status: healthStatus.status,
      message: `TTS service is ${healthStatus.status}`,
      details: healthStatus.details,
      performance: performanceMetrics.summary,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };

    // Set appropriate HTTP status code based on health
    const httpStatus = healthStatus.status === 'unhealthy' ? 503 : 
                      healthStatus.status === 'degraded' ? 200 : 200;

    return NextResponse.json(response, { status: httpStatus });
  } catch (error) {
    console.error('Health check error:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body || {};

    switch (action) {
      case 'clear_cache':
        await enhancedTTS.clearCache();
        return NextResponse.json({
          status: 'success',
          message: 'Cache cleared successfully',
          timestamp: new Date().toISOString()
        });

      case 'get_metrics':
        const metrics = enhancedTTS.getPerformanceMetrics();
        return NextResponse.json({
          status: 'success',
          metrics: metrics,
          timestamp: new Date().toISOString()
        });

      case 'force_unlock':
        enhancedTTS.forceUnlock();
        return NextResponse.json({
          status: 'success',
          message: 'TTS service unlocked successfully',
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json({
          status: 'error',
          message: 'Unknown action',
          availableActions: ['clear_cache', 'get_metrics', 'force_unlock']
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Health check action error:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Action failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
