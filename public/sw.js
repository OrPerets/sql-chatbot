// Service Worker for Michael - SQL Assistant PWA
const CACHE_NAME = 'michael-sql-assistant-v4';
const urlsToCache = [
  '/',
  '/icon-72.png',
  '/icon-144.png',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        console.log('Michael PWA: Cache opened');
        // Cache files individually to handle failures gracefully
        const cachePromises = urlsToCache.map(url => {
          return cache.add(url).catch(error => {
            // Log but don't fail the entire cache installation
            console.warn(`Michael PWA: Failed to cache ${url}:`, error.message);
            return null; // Return null instead of throwing
          });
        });
        
        await Promise.all(cachePromises);
        console.log('Michael PWA: Cache installation completed');
      })
      .catch((error) => {
        console.error('Michael PWA: Cache installation failed:', error);
        // Don't throw - allow service worker to install even if caching fails
      })
  );
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Michael PWA: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
}); 