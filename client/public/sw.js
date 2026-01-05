// MeetPune Service Worker - Provides offline caching and background sync
const CACHE_NAME = 'meetpune-cache-v3';
const STATIC_ASSETS = [
    '/',
    '/manifest.json',
    '/favicon.png',
    '/logo192.png',
    '/logo512.png',
];

// Install: Cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting()) // Activate immediately
    );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim()) // Take control immediately
    );
});

// Fetch: Network-first strategy for API, Cache-first for static assets
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip Socket.IO and API requests (always network)
    if (url.pathname.includes('/socket.io') ||
        url.pathname.startsWith('/api/')) {
        return;
    }

    // For navigation requests, try network first, fallback to cache
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Cache successful navigation responses
                    if (response.ok) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Offline: Return cached page or fallback
                    return caches.match(request)
                        .then((cached) => cached || caches.match('/'));
                })
        );
        return;
    }

    // For static assets, cache-first
    event.respondWith(
        caches.match(request)
            .then((cached) => {
                if (cached) {
                    // Return cached and update in background
                    fetch(request).then((response) => {
                        if (response.ok) {
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, response);
                            });
                        }
                    }).catch(() => { });
                    return cached;
                }

                // Not cached, fetch from network
                return fetch(request).then((response) => {
                    // Cache successful responses
                    if (response.ok &&
                        (url.pathname.endsWith('.js') ||
                            url.pathname.endsWith('.css') ||
                            url.pathname.endsWith('.png') ||
                            url.pathname.endsWith('.jpg') ||
                            url.pathname.endsWith('.webp'))) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                });
            })
    );
});

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
    const data = event.data?.json() || {};
    const title = data.title || 'MeetPune';
    const options = {
        body: data.body || 'New message',
        icon: '/logo192.png',
        badge: '/favicon.png',
        vibrate: [100, 50, 100],
        data: data,
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
});
