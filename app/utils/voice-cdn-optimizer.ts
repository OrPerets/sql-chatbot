/**
 * Voice CDN Optimizer
 * Optimizes voice assets delivery through CDN and caching strategies
 */

export interface CDNOptimizationConfig {
  enableCDN: boolean;
  cdnUrl: string;
  enableCompression: boolean;
  enableCaching: boolean;
  cacheHeaders: Record<string, string>;
  enableEdgeCaching: boolean;
  enableImageOptimization: boolean;
  enableAudioOptimization: boolean;
}

export interface CDNAsset {
  path: string;
  type: 'audio' | 'image' | 'javascript' | 'css' | 'font';
  size: number;
  compressedSize: number;
  priority: 'high' | 'medium' | 'low';
  cacheStrategy: 'immutable' | 'stale-while-revalidate' | 'cache-first';
  lastModified: number;
  etag: string;
}

export interface CDNMetrics {
  totalAssets: number;
  totalSize: number;
  compressedSize: number;
  cacheHitRate: number;
  averageLoadTime: number;
  bandwidthSavings: number;
  compressionRatio: number;
}

export class VoiceCDNOptimizer {
  private config: CDNOptimizationConfig;
  private assets: Map<string, CDNAsset> = new Map();
  private metrics: CDNMetrics;
  private cache: Map<string, { asset: CDNAsset; timestamp: number }> = new Map();

  constructor(config: CDNOptimizationConfig) {
    this.config = config;
    this.metrics = {
      totalAssets: 0,
      totalSize: 0,
      compressedSize: 0,
      cacheHitRate: 0,
      averageLoadTime: 0,
      bandwidthSavings: 0,
      compressionRatio: 0
    };

    this.initializeVoiceAssets();
  }

  /**
   * Initialize voice assets configuration
   */
  private initializeVoiceAssets(): void {
    const voiceAssets: CDNAsset[] = [
      // Audio assets
      {
        path: '/audio/voice-samples/nova.mp3',
        type: 'audio',
        size: 245000,
        compressedSize: 98000,
        priority: 'high',
        cacheStrategy: 'immutable',
        lastModified: Date.now(),
        etag: 'nova-voice-v1'
      },
      {
        path: '/audio/voice-samples/echo.mp3',
        type: 'audio',
        size: 238000,
        compressedSize: 95000,
        priority: 'high',
        cacheStrategy: 'immutable',
        lastModified: Date.now(),
        etag: 'echo-voice-v1'
      },
      {
        path: '/audio/voice-samples/onyx.mp3',
        type: 'audio',
        size: 251000,
        compressedSize: 100000,
        priority: 'high',
        cacheStrategy: 'immutable',
        lastModified: Date.now(),
        etag: 'onyx-voice-v1'
      },
      {
        path: '/audio/voice-samples/alloy.mp3',
        type: 'audio',
        size: 242000,
        compressedSize: 97000,
        priority: 'high',
        cacheStrategy: 'immutable',
        lastModified: Date.now(),
        etag: 'alloy-voice-v1'
      },
      {
        path: '/audio/voice-samples/shimmer.mp3',
        type: 'audio',
        size: 248000,
        compressedSize: 99000,
        priority: 'high',
        cacheStrategy: 'immutable',
        lastModified: Date.now(),
        etag: 'shimmer-voice-v1'
      },
      {
        path: '/audio/voice-samples/fable.mp3',
        type: 'audio',
        size: 239000,
        compressedSize: 96000,
        priority: 'high',
        cacheStrategy: 'immutable',
        lastModified: Date.now(),
        etag: 'fable-voice-v1'
      },

      // Image assets
      {
        path: '/images/voice-icons/voice-mode-circle.svg',
        type: 'image',
        size: 8500,
        compressedSize: 3400,
        priority: 'high',
        cacheStrategy: 'immutable',
        lastModified: Date.now(),
        etag: 'voice-circle-v1'
      },
      {
        path: '/images/voice-icons/voice-settings.svg',
        type: 'image',
        size: 7200,
        compressedSize: 2900,
        priority: 'medium',
        cacheStrategy: 'immutable',
        lastModified: Date.now(),
        etag: 'voice-settings-v1'
      },
      {
        path: '/images/voice-icons/audio-waveform.svg',
        type: 'image',
        size: 9200,
        compressedSize: 3700,
        priority: 'medium',
        cacheStrategy: 'immutable',
        lastModified: Date.now(),
        etag: 'audio-waveform-v1'
      },
      {
        path: '/images/voice-icons/microphone.svg',
        type: 'image',
        size: 6800,
        compressedSize: 2700,
        priority: 'high',
        cacheStrategy: 'immutable',
        lastModified: Date.now(),
        etag: 'microphone-v1'
      },

      // JavaScript assets
      {
        path: '/js/voice-core.js',
        type: 'javascript',
        size: 125000,
        compressedSize: 38000,
        priority: 'high',
        cacheStrategy: 'stale-while-revalidate',
        lastModified: Date.now(),
        etag: 'voice-core-v1'
      },
      {
        path: '/js/voice-ui.js',
        type: 'javascript',
        size: 98000,
        compressedSize: 29000,
        priority: 'high',
        cacheStrategy: 'stale-while-revalidate',
        lastModified: Date.now(),
        etag: 'voice-ui-v1'
      },
      {
        path: '/js/voice-analytics.js',
        type: 'javascript',
        size: 45000,
        compressedSize: 14000,
        priority: 'medium',
        cacheStrategy: 'stale-while-revalidate',
        lastModified: Date.now(),
        etag: 'voice-analytics-v1'
      },

      // CSS assets
      {
        path: '/css/voice-components.css',
        type: 'css',
        size: 32000,
        compressedSize: 8500,
        priority: 'high',
        cacheStrategy: 'stale-while-revalidate',
        lastModified: Date.now(),
        etag: 'voice-components-v1'
      },
      {
        path: '/css/voice-animations.css',
        type: 'css',
        size: 18000,
        compressedSize: 4800,
        priority: 'medium',
        cacheStrategy: 'stale-while-revalidate',
        lastModified: Date.now(),
        etag: 'voice-animations-v1'
      },

      // Font assets
      {
        path: '/fonts/voice-icons.woff2',
        type: 'font',
        size: 15000,
        compressedSize: 12000,
        priority: 'low',
        cacheStrategy: 'immutable',
        lastModified: Date.now(),
        etag: 'voice-icons-font-v1'
      }
    ];

    voiceAssets.forEach(asset => {
      this.assets.set(asset.path, asset);
    });

    this.updateMetrics();
  }

  /**
   * Update CDN metrics
   */
  private updateMetrics(): void {
    const totalAssets = this.assets.size;
    const totalSize = Array.from(this.assets.values()).reduce((sum, asset) => sum + asset.size, 0);
    const compressedSize = Array.from(this.assets.values()).reduce((sum, asset) => sum + asset.compressedSize, 0);
    const bandwidthSavings = totalSize - compressedSize;
    const compressionRatio = compressedSize / totalSize;

    this.metrics = {
      totalAssets,
      totalSize,
      compressedSize,
      cacheHitRate: this.calculateCacheHitRate(),
      averageLoadTime: this.calculateAverageLoadTime(),
      bandwidthSavings,
      compressionRatio
    };
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    const cacheEntries = this.cache.size;
    const totalRequests = cacheEntries + (this.assets.size - cacheEntries);
    return totalRequests > 0 ? (cacheEntries / totalRequests) * 100 : 0;
  }

  /**
   * Calculate average load time
   */
  private calculateAverageLoadTime(): number {
    // Simulate average load time based on asset type and size
    const loadTimes: number[] = [];
    
    this.assets.forEach(asset => {
      let baseTime = 50; // Base 50ms
      
      switch (asset.type) {
        case 'audio':
          baseTime += asset.size / 1000; // 1ms per KB for audio
          break;
        case 'image':
          baseTime += asset.size / 2000; // 0.5ms per KB for images
          break;
        case 'javascript':
          baseTime += asset.size / 5000; // 0.2ms per KB for JS
          break;
        case 'css':
          baseTime += asset.size / 8000; // 0.125ms per KB for CSS
          break;
        case 'font':
          baseTime += asset.size / 3000; // 0.33ms per KB for fonts
          break;
      }
      
      loadTimes.push(baseTime);
    });

    return loadTimes.length > 0 ? loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length : 0;
  }

  /**
   * Get optimized asset URL
   */
  getOptimizedAssetUrl(assetPath: string): string {
    const asset = this.assets.get(assetPath);
    if (!asset) {
      throw new Error(`Asset '${assetPath}' not found`);
    }

    if (!this.config.enableCDN) {
      return assetPath;
    }

    // Add CDN URL prefix
    const cdnUrl = this.config.cdnUrl.endsWith('/') 
      ? this.config.cdnUrl.slice(0, -1) 
      : this.config.cdnUrl;
    
    return `${cdnUrl}${assetPath}`;
  }

  /**
   * Get asset cache headers
   */
  getAssetCacheHeaders(assetPath: string): Record<string, string> {
    const asset = this.assets.get(assetPath);
    if (!asset) {
      return this.config.cacheHeaders;
    }

    const headers = { ...this.config.cacheHeaders };

    switch (asset.cacheStrategy) {
      case 'immutable':
        headers['Cache-Control'] = 'public, max-age=31536000, immutable';
        headers['ETag'] = asset.etag;
        break;
      case 'stale-while-revalidate':
        headers['Cache-Control'] = 'public, max-age=86400, stale-while-revalidate=604800';
        headers['ETag'] = asset.etag;
        break;
      case 'cache-first':
        headers['Cache-Control'] = 'public, max-age=3600';
        headers['ETag'] = asset.etag;
        break;
    }

    if (this.config.enableCompression) {
      headers['Content-Encoding'] = 'gzip';
      headers['Vary'] = 'Accept-Encoding';
    }

    headers['Last-Modified'] = new Date(asset.lastModified).toUTCString();

    return headers;
  }

  /**
   * Preload critical assets
   */
  async preloadCriticalAssets(): Promise<void> {
    const criticalAssets = Array.from(this.assets.values())
      .filter(asset => asset.priority === 'high')
      .sort((a, b) => a.size - b.size); // Preload smaller assets first

    const preloadPromises = criticalAssets.map(asset => 
      this.preloadAsset(asset.path)
    );

    await Promise.all(preloadPromises);
  }

  /**
   * Preload individual asset
   */
  private async preloadAsset(assetPath: string): Promise<void> {
    const asset = this.assets.get(assetPath);
    if (!asset) return;

    try {
      // Create preload link element
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = this.getOptimizedAssetUrl(assetPath);
      
      switch (asset.type) {
        case 'audio':
          link.as = 'audio';
          break;
        case 'image':
          link.as = 'image';
          break;
        case 'javascript':
          link.as = 'script';
          break;
        case 'css':
          link.as = 'style';
          break;
        case 'font':
          link.as = 'font';
          link.crossOrigin = 'anonymous';
          break;
      }

      document.head.appendChild(link);

      // Cache the asset
      if (this.config.enableCaching) {
        this.cache.set(assetPath, {
          asset,
          timestamp: Date.now()
        });
      }

    } catch (error) {
      console.warn(`Failed to preload asset '${assetPath}':`, error);
    }
  }

  /**
   * Optimize asset delivery based on network conditions
   */
  optimizeForNetworkConditions(networkType: string): {
    compressionLevel: string;
    qualityLevel: string;
    preloadStrategy: string;
  } {
    switch (networkType) {
      case 'slow-2g':
      case '2g':
        return {
          compressionLevel: 'maximum',
          qualityLevel: 'low',
          preloadStrategy: 'none'
        };
      case 'slow-3g':
      case '3g':
        return {
          compressionLevel: 'high',
          qualityLevel: 'medium',
          preloadStrategy: 'critical-only'
        };
      case '4g':
        return {
          compressionLevel: 'medium',
          qualityLevel: 'high',
          preloadStrategy: 'high-priority'
        };
      case 'wifi':
      case 'ethernet':
        return {
          compressionLevel: 'low',
          qualityLevel: 'maximum',
          preloadStrategy: 'aggressive'
        };
      default:
        return {
          compressionLevel: 'medium',
          qualityLevel: 'high',
          preloadStrategy: 'high-priority'
        };
    }
  }

  /**
   * Generate asset optimization recommendations
   */
  getOptimizationRecommendations(): Array<{
    type: string;
    description: string;
    potentialSavings: number;
    priority: 'high' | 'medium' | 'low';
  }> {
    const recommendations = [
      {
        type: 'compression',
        description: 'Enable Brotli compression for better compression ratios',
        potentialSavings: 25000,
        priority: 'high' as const
      },
      {
        type: 'image-optimization',
        description: 'Convert images to WebP format for better compression',
        potentialSavings: 15000,
        priority: 'high' as const
      },
      {
        type: 'audio-optimization',
        description: 'Use optimized audio codecs and bitrates',
        potentialSavings: 75000,
        priority: 'high' as const
      },
      {
        type: 'caching',
        description: 'Implement aggressive caching strategies',
        potentialSavings: 50000,
        priority: 'medium' as const
      },
      {
        type: 'preloading',
        description: 'Preload critical voice assets',
        potentialSavings: 30000,
        priority: 'medium' as const
      },
      {
        type: 'edge-caching',
        description: 'Enable edge caching for global performance',
        potentialSavings: 40000,
        priority: 'low' as const
      }
    ];

    return recommendations;
  }

  /**
   * Get CDN performance metrics
   */
  getPerformanceMetrics(): {
    totalAssets: number;
    totalSize: number;
    compressedSize: number;
    bandwidthSavings: number;
    compressionRatio: number;
    cacheHitRate: number;
    averageLoadTime: number;
    byType: Record<string, {
      count: number;
      totalSize: number;
      compressedSize: number;
      averageSize: number;
    }>;
  } {
    const byType: Record<string, any> = {};

    this.assets.forEach(asset => {
      if (!byType[asset.type]) {
        byType[asset.type] = {
          count: 0,
          totalSize: 0,
          compressedSize: 0,
          averageSize: 0
        };
      }

      byType[asset.type].count++;
      byType[asset.type].totalSize += asset.size;
      byType[asset.type].compressedSize += asset.compressedSize;
    });

    // Calculate averages
    Object.keys(byType).forEach(type => {
      byType[type].averageSize = byType[type].totalSize / byType[type].count;
    });

    return {
      totalAssets: this.metrics.totalAssets,
      totalSize: this.metrics.totalSize,
      compressedSize: this.metrics.compressedSize,
      bandwidthSavings: this.metrics.bandwidthSavings,
      compressionRatio: this.metrics.compressionRatio,
      cacheHitRate: this.metrics.cacheHitRate,
      averageLoadTime: this.metrics.averageLoadTime,
      byType
    };
  }

  /**
   * Generate CDN optimization report
   */
  generateReport(): {
    summary: {
      totalAssets: number;
      totalSize: number;
      compressedSize: number;
      bandwidthSavings: number;
      compressionRatio: number;
    };
    assets: Array<{
      path: string;
      type: string;
      size: number;
      compressedSize: number;
      compressionRatio: number;
      priority: string;
      cacheStrategy: string;
    }>;
    recommendations: Array<{
      type: string;
      description: string;
      potentialSavings: number;
      priority: string;
    }>;
  } {
    const assetDetails = Array.from(this.assets.values()).map(asset => ({
      path: asset.path,
      type: asset.type,
      size: asset.size,
      compressedSize: asset.compressedSize,
      compressionRatio: asset.compressedSize / asset.size,
      priority: asset.priority,
      cacheStrategy: asset.cacheStrategy
    }));

    return {
      summary: {
        totalAssets: this.metrics.totalAssets,
        totalSize: this.metrics.totalSize,
        compressedSize: this.metrics.compressedSize,
        bandwidthSavings: this.metrics.bandwidthSavings,
        compressionRatio: this.metrics.compressionRatio
      },
      assets: assetDetails,
      recommendations: this.getOptimizationRecommendations()
    };
  }

  /**
   * Clear asset cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Update asset cache
   */
  updateAssetCache(assetPath: string, asset: CDNAsset): void {
    this.assets.set(assetPath, asset);
    this.updateMetrics();
  }
}

export default VoiceCDNOptimizer;
