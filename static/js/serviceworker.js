// sw.js — не перехватывать API и не-GET: иначе POST (например /api/ai_help) ломается и даёт NetworkError.
const CACHE_NAME = 'python-interpreter-v2';

self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        ).then(() => clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') {
        return;
    }
    let path = '';
    try {
        path = new URL(req.url).pathname;
    } catch (e) {
        return;
    }
    if (path.startsWith('/api/')) {
        return;
    }

    event.respondWith(
        caches.match(req).then((response) => {
            if (response) {
                return response;
            }
            return fetch(req)
                .then((response) => {
                    if (response && response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(req, responseClone);
                        });
                    }
                    return response;
                })
                .catch((error) => {
                    console.error('Fetch failed:', error);
                    return new Response('Network error', { status: 503 });
                });
        })
    );
});