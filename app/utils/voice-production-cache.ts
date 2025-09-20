/**
 * Voice Production Cache
 * Advanced caching strategies for production voice features
 */

export interface ProductionCacheConfig {
  enableMemoryCache: boolean;
  enableIndexedDBCache: boolean;
  enableServiceWorkerCache: boolean;
  enableEdgeCache: boolean;
  memoryCacheSize: number;
  indexedDBCacheSize: number;
  cacheExpirationTime: number;
  enableCacheWarming: boolean;
  enableCacheInvalidation: boolean;
  enableCacheCompression: boolean;
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  expirationTime: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  compressed: boolean;
  metadata: {
    source: 'api' | 'computed' | 'user-generated';
    version: string;
    tags: string[];
  };
}

export interface CacheMetrics {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  compressionRatio: number;
  averageAccessTime: number;
  cacheEfficiency: number;
}

export class VoiceProductionCache {
  private config: ProductionCacheConfig;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private indexedDBCache: IDBDatabase | null = null;
  private serviceWorkerCache: Cache | null = null;
  private metrics: CacheMetrics;
  private accessLog: Array<{ key: string; timestamp: number; hit: boolean }> = [];
  private compressionWorker: Worker | null = null;

  constructor(config: ProductionCacheConfig) {
    this.config = config;
    this.metrics = {
      totalEntries: 0,
      totalSize: 0,
      hitRate: 0,
      missRate: 0,
      evictionCount: 0,
      compressionRatio: 0,
      averageAccessTime: 0,
      cacheEfficiency: 0
    };

    this.initializeCaches();
  }

  /**
   * Initialize all cache layers
   */
  private async initializeCaches(): Promise<void> {
    if (this.config.enableIndexedDBCache) {
      await this.initializeIndexedDB();
    }

    if (this.config.enableServiceWorkerCache) {
      await this.initializeServiceWorker();
    }

    if (this.config.enableCacheCompression) {
      await this.initializeCompressionWorker();
    }

    if (this.config.enableCacheWarming) {
      await this.warmupCache();
    }
  }

  /**
   * Initialize IndexedDB cache
   */
  private async initializeIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('voice-cache', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.indexedDBCache = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('cache')) {
          const store = db.createObjectStore('cache', { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('size', 'size', { unique: false });
          store.createIndex('tags', 'metadata.tags', { unique: false, multiEntry: true });
        }
      };
    });
  }

  /**
   * Initialize Service Worker cache
   */
  private async initializeServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator && 'caches' in window) {
      try {
        this.serviceWorkerCache = await caches.open('voice-cache-v1');
      } catch (error) {
        console.warn('Failed to initialize Service Worker cache:', error);
      }
    }
  }

  /**
   * Initialize compression worker
   */
  private async initializeCompressionWorker(): Promise<void> {
    if ('Worker' in window) {
      try {
        // Create a simple compression worker
        const workerCode = `
          self.onmessage = function(e) {
            const { data, operation } = e.data;
            
            if (operation === 'compress') {
              try {
                const compressed = pako.gzip(data);
                self.postMessage({ success: true, data: compressed });
              } catch (error) {
                self.postMessage({ success: false, error: error.message });
              }
            } else if (operation === 'decompress') {
              try {
                const decompressed = pako.ungzip(data);
                self.postMessage({ success: true, data: decompressed });
              } catch (error) {
                self.postMessage({ success: false, error: error.message });
              }
            }
          };
        `;
        
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        this.compressionWorker = new Worker(URL.createObjectURL(blob));
      } catch (error) {
        console.warn('Failed to initialize compression worker:', error);
      }
    }
  }

  /**
   * Warmup cache with frequently used data
   */
  private async warmupCache(): Promise<void> {
    const warmupData = [
      {
        key: 'voice-config',
        value: {
          defaultVoice: 'nova',
          defaultSpeed: 1.0,
          defaultEmotion: 'friendly',
          availableVoices: ['nova', 'echo', 'onyx', 'alloy', 'shimmer', 'fable']
        },
        tags: ['config', 'voice']
      },
      {
        key: 'audio-formats',
        value: {
          supported: ['mp3', 'wav', 'ogg'],
          preferred: 'mp3',
          fallback: 'wav'
        },
        tags: ['audio', 'formats']
      },
      {
        key: 'voice-commands',
        value: {
          play: 'Play audio',
          pause: 'Pause audio',
          stop: 'Stop audio',
          settings: 'Open settings'
        },
        tags: ['commands', 'voice']
      }
    ];

    for (const item of warmupData) {
      await this.set(item.key, item.value, {
        tags: item.tags,
        expirationTime: 24 * 60 * 60 * 1000 // 24 hours
      });
    }
  }

  /**
   * Set cache entry
   */
  async set<T>(key: string, value: T, options: {
    expirationTime?: number;
    tags?: string[];
    source?: 'api' | 'computed' | 'user-generated';
    version?: string;
  } = {}): Promise<void> {
    const now = Date.now();
    const expirationTime = options.expirationTime || this.config.cacheExpirationTime;
    
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: now,
      expirationTime: now + expirationTime,
      accessCount: 0,
      lastAccessed: now,
      size: this.calculateSize(value),
      compressed: false,
      metadata: {
        source: options.source || 'computed',
        version: options.version || '1.0',
        tags: options.tags || []
      }
    };

    // Compress if enabled and value is large enough
    if (this.config.enableCacheCompression && entry.size > 1024) {
      try {
        const compressed = await this.compress(JSON.stringify(value));
        entry.value = compressed as T;
        entry.compressed = true;
        entry.size = compressed.byteLength;
      } catch (error) {
        console.warn('Failed to compress cache entry:', error);
      }
    }

    // Store in memory cache
    if (this.config.enableMemoryCache) {
      this.memoryCache.set(key, entry);
      await this.evictIfNeeded();
    }

    // Store in IndexedDB
    if (this.config.enableIndexedDBCache && this.indexedDBCache) {
      await this.storeInIndexedDB(entry);
    }

    // Store in Service Worker cache
    if (this.config.enableServiceWorkerCache && this.serviceWorkerCache) {
      await this.storeInServiceWorker(key, entry);
    }

    this.updateMetrics();
  }

  /**
   * Get cache entry
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = performance.now();

    try {
      // Try memory cache first
      if (this.config.enableMemoryCache && this.memoryCache.has(key)) {
        const entry = this.memoryCache.get(key)!;
        
        if (this.isExpired(entry)) {
          this.memoryCache.delete(key);
          this.logAccess(key, false);
          return null;
        }

        this.updateAccessMetrics(entry);
        this.logAccess(key, true);
        
        const endTime = performance.now();
        this.updateAccessTimeMetrics(endTime - startTime);
        
        return await this.decompressValue(entry.value, entry.compressed) as T;
      }

      // Try IndexedDB cache
      if (this.config.enableIndexedDBCache && this.indexedDBCache) {
        const entry = await this.getFromIndexedDB(key);
        if (entry && !this.isExpired(entry)) {
          this.updateAccessMetrics(entry);
          this.logAccess(key, true);
          
          // Promote to memory cache
          if (this.config.enableMemoryCache) {
            this.memoryCache.set(key, entry);
            await this.evictIfNeeded();
          }
          
          const endTime = performance.now();
          this.updateAccessTimeMetrics(endTime - startTime);
          
          return await this.decompressValue(entry.value, entry.compressed) as T;
        }
      }

      // Try Service Worker cache
      if (this.config.enableServiceWorkerCache && this.serviceWorkerCache) {
        const entry = await this.getFromServiceWorker(key);
        if (entry && !this.isExpired(entry)) {
          this.updateAccessMetrics(entry);
          this.logAccess(key, true);
          
          const endTime = performance.now();
          this.updateAccessTimeMetrics(endTime - startTime);
          
          return await this.decompressValue(entry.value, entry.compressed) as T;
        }
      }

      this.logAccess(key, false);
      return null;

    } catch (error) {
      console.error('Cache get error:', error);
      this.logAccess(key, false);
      return null;
    }
  }

  /**
   * Delete cache entry
   */
  async delete(key: string): Promise<void> {
    // Remove from memory cache
    if (this.config.enableMemoryCache) {
      this.memoryCache.delete(key);
    }

    // Remove from IndexedDB
    if (this.config.enableIndexedDBCache && this.indexedDBCache) {
      await this.deleteFromIndexedDB(key);
    }

    // Remove from Service Worker cache
    if (this.config.enableServiceWorkerCache && this.serviceWorkerCache) {
      await this.deleteFromServiceWorker(key);
    }

    this.updateMetrics();
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    // Clear memory cache
    if (this.config.enableMemoryCache) {
      this.memoryCache.clear();
    }

    // Clear IndexedDB
    if (this.config.enableIndexedDBCache && this.indexedDBCache) {
      await this.clearIndexedDB();
    }

    // Clear Service Worker cache
    if (this.config.enableServiceWorkerCache && this.serviceWorkerCache) {
      await this.serviceWorkerCache.delete('voice-cache-v1');
      await this.initializeServiceWorker();
    }

    this.updateMetrics();
  }

  /**
   * Invalidate cache entries by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    const keysToDelete: string[] = [];

    // Check memory cache
    if (this.config.enableMemoryCache) {
      for (const [key, entry] of Array.from(this.memoryCache)) {
        if (tags.some(tag => entry.metadata.tags.includes(tag))) {
          keysToDelete.push(key);
        }
      }
    }

    // Check IndexedDB
    if (this.config.enableIndexedDBCache && this.indexedDBCache) {
      const dbKeys = await this.getKeysByTagsFromIndexedDB(tags);
      keysToDelete.push(...dbKeys);
    }

    // Delete all matching entries
    for (const key of keysToDelete) {
      await this.delete(key);
    }
  }

  /**
   * Store in IndexedDB
   */
  private async storeInIndexedDB(entry: CacheEntry): Promise<void> {
    if (!this.indexedDBCache) return;

    return new Promise((resolve, reject) => {
      const transaction = this.indexedDBCache!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get from IndexedDB
   */
  private async getFromIndexedDB(key: string): Promise<CacheEntry | null> {
    if (!this.indexedDBCache) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.indexedDBCache!.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete from IndexedDB
   */
  private async deleteFromIndexedDB(key: string): Promise<void> {
    if (!this.indexedDBCache) return;

    return new Promise((resolve, reject) => {
      const transaction = this.indexedDBCache!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear IndexedDB
   */
  private async clearIndexedDB(): Promise<void> {
    if (!this.indexedDBCache) return;

    return new Promise((resolve, reject) => {
      const transaction = this.indexedDBCache!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get keys by tags from IndexedDB
   */
  private async getKeysByTagsFromIndexedDB(tags: string[]): Promise<string[]> {
    if (!this.indexedDBCache) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.indexedDBCache!.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const index = store.index('tags');
      const keys: string[] = [];

      tags.forEach(tag => {
        const request = index.getAll(tag);
        request.onsuccess = () => {
          keys.push(...request.result.map((entry: CacheEntry) => entry.key));
        };
      });

      transaction.oncomplete = () => resolve(Array.from(new Set(keys)));
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Store in Service Worker cache
   */
  private async storeInServiceWorker(key: string, entry: CacheEntry): Promise<void> {
    if (!this.serviceWorkerCache) return;

    try {
      const response = new Response(JSON.stringify(entry), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=86400'
        }
      });

      await this.serviceWorkerCache.put(`voice-cache/${key}`, response);
    } catch (error) {
      console.warn('Failed to store in Service Worker cache:', error);
    }
  }

  /**
   * Get from Service Worker cache
   */
  private async getFromServiceWorker(key: string): Promise<CacheEntry | null> {
    if (!this.serviceWorkerCache) return null;

    try {
      const response = await this.serviceWorkerCache.match(`voice-cache/${key}`);
      if (response) {
        const data = await response.json();
        return data as CacheEntry;
      }
    } catch (error) {
      console.warn('Failed to get from Service Worker cache:', error);
    }

    return null;
  }

  /**
   * Delete from Service Worker cache
   */
  private async deleteFromServiceWorker(key: string): Promise<void> {
    if (!this.serviceWorkerCache) return;

    try {
      await this.serviceWorkerCache.delete(`voice-cache/${key}`);
    } catch (error) {
      console.warn('Failed to delete from Service Worker cache:', error);
    }
  }

  /**
   * Compress data
   */
  private async compress(data: string): Promise<ArrayBuffer> {
    if (!this.compressionWorker) {
      // Fallback to simple compression
      return new TextEncoder().encode(data);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Compression timeout'));
      }, 5000);

      this.compressionWorker!.onmessage = (e) => {
        clearTimeout(timeout);
        if (e.data.success) {
          resolve(e.data.data);
        } else {
          reject(new Error(e.data.error));
        }
      };

      this.compressionWorker!.postMessage({
        data,
        operation: 'compress'
      });
    });
  }

  /**
   * Decompress value if needed
   */
  private async decompressValue<T>(value: T, compressed: boolean): Promise<T> {
    if (!compressed || !this.compressionWorker) {
      return value;
    }

    try {
      const decompressed = await new Promise<ArrayBuffer>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Decompression timeout'));
        }, 5000);

        this.compressionWorker!.onmessage = (e) => {
          clearTimeout(timeout);
          if (e.data.success) {
            resolve(e.data.data);
          } else {
            reject(new Error(e.data.error));
          }
        };

        this.compressionWorker!.postMessage({
          data: value,
          operation: 'decompress'
        });
      });

      return JSON.parse(new TextDecoder().decode(decompressed)) as T;
    } catch (error) {
      console.warn('Failed to decompress value:', error);
      return value;
    }
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.expirationTime;
  }

  /**
   * Update access metrics
   */
  private updateAccessMetrics(entry: CacheEntry): void {
    entry.accessCount++;
    entry.lastAccessed = Date.now();
  }

  /**
   * Log cache access
   */
  private logAccess(key: string, hit: boolean): void {
    this.accessLog.push({
      key,
      timestamp: Date.now(),
      hit
    });

    // Keep only last 1000 entries
    if (this.accessLog.length > 1000) {
      this.accessLog = this.accessLog.slice(-1000);
    }
  }

  /**
   * Update access time metrics
   */
  private updateAccessTimeMetrics(accessTime: number): void {
    // Simple moving average
    this.metrics.averageAccessTime = 
      (this.metrics.averageAccessTime * 0.9) + (accessTime * 0.1);
  }

  /**
   * Calculate size of value
   */
  private calculateSize(value: any): number {
    return new Blob([JSON.stringify(value)]).size;
  }

  /**
   * Evict entries if cache is full
   */
  private async evictIfNeeded(): Promise<void> {
    if (!this.config.enableMemoryCache) return;

    let totalSize = 0;
    for (const entry of Array.from(this.memoryCache.values())) {
      totalSize += entry.size;
    }

    if (totalSize > this.config.memoryCacheSize) {
      // LRU eviction
      const entries = Array.from(this.memoryCache.entries())
        .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

      const toEvict = entries.slice(0, Math.floor(entries.length * 0.2)); // Evict 20%
      
      for (const [key] of toEvict) {
        this.memoryCache.delete(key);
        this.metrics.evictionCount++;
      }
    }
  }

  /**
   * Update cache metrics
   */
  private updateMetrics(): void {
    const totalEntries = this.memoryCache.size;
    const totalSize = Array.from(this.memoryCache.values())
      .reduce((sum, entry) => sum + entry.size, 0);

    const recentAccesses = this.accessLog.slice(-100);
    const hits = recentAccesses.filter(access => access.hit).length;
    const totalAccesses = recentAccesses.length;

    this.metrics = {
      ...this.metrics,
      totalEntries,
      totalSize,
      hitRate: totalAccesses > 0 ? (hits / totalAccesses) * 100 : 0,
      missRate: totalAccesses > 0 ? ((totalAccesses - hits) / totalAccesses) * 100 : 0,
      cacheEfficiency: totalAccesses > 0 ? (hits / totalAccesses) * 100 : 0
    };
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Get cache statistics
   */
  getStatistics(): {
    memory: {
      entries: number;
      size: number;
      maxSize: number;
    };
    indexedDB: {
      enabled: boolean;
      entries: number;
    };
    serviceWorker: {
      enabled: boolean;
      entries: number;
    };
    performance: {
      hitRate: number;
      averageAccessTime: number;
      evictionCount: number;
    };
  } {
    return {
      memory: {
        entries: this.memoryCache.size,
        size: Array.from(this.memoryCache.values()).reduce((sum, entry) => sum + entry.size, 0),
        maxSize: this.config.memoryCacheSize
      },
      indexedDB: {
        enabled: this.config.enableIndexedDBCache,
        entries: this.memoryCache.size // Approximation
      },
      serviceWorker: {
        enabled: this.config.enableServiceWorkerCache,
        entries: this.memoryCache.size // Approximation
      },
      performance: {
        hitRate: this.metrics.hitRate,
        averageAccessTime: this.metrics.averageAccessTime,
        evictionCount: this.metrics.evictionCount
      }
    };
  }

  /**
   * Generate cache optimization recommendations
   */
  getOptimizationRecommendations(): Array<{
    type: string;
    description: string;
    potentialImprovement: string;
    priority: 'high' | 'medium' | 'low';
  }> {
    const recommendations = [];

    if (this.metrics.hitRate < 70) {
      recommendations.push({
        type: 'cache-strategy',
        description: 'Improve cache hit rate by optimizing cache keys and expiration times',
        potentialImprovement: 'Increase hit rate to 80%+',
        priority: 'high' as const
      });
    }

    if (this.metrics.evictionCount > 100) {
      recommendations.push({
        type: 'cache-size',
        description: 'Increase memory cache size to reduce evictions',
        potentialImprovement: 'Reduce eviction rate by 50%',
        priority: 'high' as const
      });
    }

    if (this.metrics.averageAccessTime > 10) {
      recommendations.push({
        type: 'access-time',
        description: 'Optimize cache access patterns and data structures',
        potentialImprovement: 'Reduce access time by 50%',
        priority: 'medium' as const
      });
    }

    if (!this.config.enableCacheCompression) {
      recommendations.push({
        type: 'compression',
        description: 'Enable cache compression to reduce memory usage',
        potentialImprovement: 'Reduce memory usage by 30%',
        priority: 'medium' as const
      });
    }

    if (!this.config.enableCacheWarming) {
      recommendations.push({
        type: 'cache-warming',
        description: 'Enable cache warming for frequently accessed data',
        potentialImprovement: 'Improve initial load performance',
        priority: 'low' as const
      });
    }

    return recommendations;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.compressionWorker) {
      this.compressionWorker.terminate();
      this.compressionWorker = null;
    }

    this.memoryCache.clear();
    this.accessLog = [];
  }
}

export default VoiceProductionCache;
