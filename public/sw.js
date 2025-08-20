// Service Worker for Michael - SQL Assistant PWA
const CACHE_NAME = 'michael-sql-assistant-v3';
const urlsToCache = [
  '/',
  '/bot.png',
  '/logo.png',
  '/icon-72.png',
  '/icon-144.png',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
  '/static/css/',
  '/static/js/',
  // Add other critical assets
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Michael PWA: Cache opened');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Michael PWA: Cache installation failed:', error);
      })
  );
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