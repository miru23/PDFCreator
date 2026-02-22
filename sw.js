const CACHE_NAME = 'docscan-v1';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Install: pre-cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache local files reliably; CDN script cached with fallback
      return cache.addAll(['/index.html', '/manifest.json']).then(() => {
        return cache.add(
          new Request('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', { mode: 'cors' })
        ).catch(() => {
          // CDN may fail offline during install; that's okay
          console.warn('SW: Could not pre-cache jsPDF CDN (likely offline)');
        });
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for local assets, network-first for external APIs
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept Google API requests (OAuth, Drive, GIS)
  if (url.hostname.includes('googleapis.com') ||
      url.hostname.includes('google.com') ||
      url.hostname.includes('gstatic.com')) {
    return;
  }

  // Cache-first strategy for everything else
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        // Only cache successful, non-opaque responses
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
