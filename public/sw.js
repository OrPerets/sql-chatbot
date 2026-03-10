// Service Worker for Michael - SQL Assistant PWA
const CACHE_NAME = 'michael-sql-assistant-v5';
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

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response && response.ok && request.method === 'GET') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

// Fetch event - prefer network for documents to avoid stale HTML/bundle mismatches
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isDocumentRequest =
    event.request.mode === 'navigate' ||
    event.request.destination === 'document' ||
    (event.request.headers.get('accept') || '').includes('text/html');
  
  // Bypass service worker completely for:
  // 1. ALL API routes (they should always go to network)
  // 2. ALL non-GET requests (mutations should not be cached)
  // 3. Long-running endpoints like AI grading
  // 4. Requests with cache-busting query params
  if (
    url.pathname.startsWith('/api/') ||
    event.request.method !== 'GET' ||
    url.pathname.includes('/api/grading/') ||
    url.searchParams.has('t') // Cache-busting timestamp parameter
  ) {
    // Let the request go directly to the network, bypassing service worker entirely
    // Don't call event.respondWith() - this allows the request to bypass the SW
    return;
  }

  if (isDocumentRequest) {
    event.respondWith(
      networkFirst(event.request).catch(() => new Response('Offline', { status: 503 }))
    );
    return;
  }
  
  // For other GET requests, try cache first, then network
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
      .catch(() => {
        // If both cache and network fail, return a basic offline response
        return new Response('Offline', { status: 503 });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Michael PWA: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        })
      )
    ).then(() => self.clients.claim())
  );
}); 
