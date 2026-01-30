/**
 * PARKOREEN - Service Worker
 * Handles offline caching and PWA functionality
 */

const CACHE_NAME = 'parkoreen-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/dashboard/',
    '/dashboard/index.html',
    '/join.html',
    '/host.html',
    '/settings/',
    '/settings/index.html',
    '/login/',
    '/login/index.html',
    '/signup/',
    '/signup/index.html',
    '/assets/css/style.css',
    '/assets/js/game.js',
    '/assets/js/editor.js',
    '/assets/js/style.js',
    '/assets/js/exportImport.js',
    '/runtime.js',
    '/assets/mp3/jump.mp3',
    '/assets/png/bg_sky.png',
    '/assets/png/bg_galaxy.png',
    '/assets/ttf/jersey10.ttf',
    '/manifest.json'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching assets...');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Cache installation failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip API requests (should always go to network)
    if (url.hostname.includes('workers.dev') || url.pathname.startsWith('/api')) {
        return;
    }

    // Skip WebSocket requests
    if (url.protocol === 'ws:' || url.protocol === 'wss:') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Return cached response if found
                if (cachedResponse) {
                    // Fetch in background to update cache
                    event.waitUntil(
                        fetch(event.request)
                            .then((networkResponse) => {
                                if (networkResponse.ok) {
                                    caches.open(CACHE_NAME)
                                        .then((cache) => {
                                            cache.put(event.request, networkResponse.clone());
                                        });
                                }
                            })
                            .catch(() => {
                                // Network failed, but we have cache
                            })
                    );
                    return cachedResponse;
                }

                // No cache, fetch from network
                return fetch(event.request)
                    .then((networkResponse) => {
                        // Cache the response for future
                        if (networkResponse.ok) {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseToCache);
                                });
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // Network failed and no cache
                        // Return offline page for navigation requests
                        if (event.request.mode === 'navigate') {
                            return caches.match('/dashboard/');
                        }
                        return new Response('Offline', { status: 503 });
                    });
            })
    );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Background sync for saving maps
self.addEventListener('sync', (event) => {
    if (event.tag === 'save-map') {
        event.waitUntil(
            // Attempt to sync pending map saves
            syncPendingMaps()
        );
    }
});

async function syncPendingMaps() {
    // Get pending saves from IndexedDB
    // This would be implemented with IndexedDB in a full implementation
    console.log('Syncing pending map saves...');
}

// Push notification handling (for future features)
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();
    
    const options = {
        body: data.body || 'New notification from Parkoreen',
        icon: '/assets/png/icon-192.png',
        badge: '/assets/png/icon-192.png',
        data: data.url || '/'
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Parkoreen', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow(event.notification.data)
    );
});
