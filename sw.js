const CACHE_NAME = 'aquasafe-v1';
const ASSETS_TO_CACHE = [
    './index.html',
    './assets/css/styles.css',
    './assets/js/main.js',
    './assets/js/auth.js',
    './assets/js/charts.js',
    './assets/js/admin.js',
    './assets/js/supabaseClient.js',
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://unpkg.com/lucide@latest',
    'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&display=swap'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching static assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Clearing old cache');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Network first, fall back to cache strategy (good for realtime apps)
    // Or Cache First, fallback to network (good for static)
    // Since we rely on realtime data, we'll try network first for APIs, but cache first for static assets.

    // Simple Stale-While-Revalidate for non-API requests
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                caches.open(CACHE_NAME).then((cache) => {
                    // Check if valid url schema (http/https only)
                    if (event.request.url.startsWith('http')) {
                        cache.put(event.request, networkResponse.clone());
                    }
                });
                return networkResponse;
            });
            return cachedResponse || fetchPromise;
        })
    );
});
