
const VERSION = 'v6';
const CACHE_STATIC = `mascotas-static-${VERSION}`;
const CACHE_DYNAMIC = `mascotas-dynamic-${VERSION}`;

function limpiarCache(cacheName, numeroItems) {
    caches.open(cacheName).then(cache => {
        cache.keys().then(keys => {
            if (keys.length > numeroItems) {
                cache.delete(keys[0]).then(() => limpiarCache(cacheName, numeroItems));
            }
        });
    });
}

self.addEventListener('install', (e) => {
    console.log('[SW] Instalando Service Worker...');
    self.skipWaiting();

    const archivosEstaticos = [
        '/',
        '/index.html',
        '/login.html',
        '/censos.html',
        '/mapa.html',
        '/mascota-detalle.html',
        '/manifest.json',
        '/css/styles.css',
        '/js/app.js',
        '/js/auth.js',
        '/js/censos.js',
        '/js/config.js',
        '/js/geo.js',
        '/js/map-censos.js',
        '/js/photo.js',
        '/favicon.ico',
        '/img/logo.jpg',
        '/img/logo2.webp',
        '/img/perrito.jpg'
    ];

    const cacheStatic = caches.open(CACHE_STATIC).then(cache => {
        return Promise.all(
            archivosEstaticos.map(url => {
                return cache.add(url).catch(err => {
                    console.error(`[SW] ❌ Error crítico al cachear: ${url}`, err);
                });
            })
        );
    });

    e.waitUntil(cacheStatic);
});

self.addEventListener('activate', (e) => {
    console.log('[SW] Service Worker activado');
    const cacheWhitelist = [CACHE_STATIC, CACHE_DYNAMIC];

    e.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    if (e.request.url.includes('/api/')) {
        return e.respondWith(fetch(e.request)); 
    }

    if (e.request.mode === 'navigate' || (e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html'))) {
        e.respondWith(
            caches.match(e.request).then(cachedResponse => {
                
                const fetchPromise = fetch(e.request).then(networkResponse => {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_DYNAMIC).then(cache => {
                        cache.put(e.request, clone);
                    });
                    return networkResponse;
                }).catch(() => {
                    return caches.match('/index.html');
                });
                return cachedResponse || fetchPromise;
            })
        );
        return; 
    }

    e.respondWith(
        caches.match(e.request).then(cachedResponse => {
            if (cachedResponse) return cachedResponse;
            
            return fetch(e.request).then(networkResponse => {
                const respuestaParaCache = networkResponse.clone();
                if ((e.request.url.startsWith('http://') || e.request.url.startsWith('https://')) && e.request.method === 'GET') {
                    caches.open(CACHE_DYNAMIC).then(cache => {
                        cache.put(e.request, respuestaParaCache);
                    });
                }
                return networkResponse;
            });
        })
    );
});

self.addEventListener('push', (e) => {
    console.log('[SW] Push recibido:', e.data ? e.data.text() : 'No payload');
    
    let payload = {};
    try {
        payload = e.data ? e.data.json() : {};
    } catch (err) {
        console.error('[SW] Error al parsear payload:', err);
        payload = {};
    }

    const notification = payload.notification || {};
    const title = notification.title || payload.titulo || 'Nueva notificación';
    const options = {
        body: notification.body || payload.cuerpo || 'Tienes una nueva notificación.',
        icon: notification.icon || payload.icon || '/img/logo.jpg',
        badge: notification.badge || payload.badge || '/favicon.ico',
        vibrate: [100, 50, 100, 50, 100],
        data: notification.data || {
            url: payload.url || '/mapa.html',
            idCenso: payload.idCenso || null
        }
    };
    
    e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclose', (e) => {
    console.log('[SW] Notificación cerrada');
});


self.addEventListener('notificationclick', (e) => {
    console.log('[SW] Notificación clicada');
    
    e.notification.close();
    
    const data = e.notification.data || {};
    
    const rutaDestino = data.idCenso
        ? `/mascota-detalle.html?idCenso=${encodeURIComponent(data.idCenso)}`
        : '/'; 

    const urlToOpen = new URL(rutaDestino, self.location.origin).href;

    console.log('[SW] Intentando abrir URL:', urlToOpen);

    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            
            for (const client of clientList) {
                if (client.url === urlToOpen && 'focus' in client) {
                    console.log('[SW] Pestaña encontrada, trayendo al frente...');
                    return client.focus(); 
                }
            }
            
            console.log('[SW] Abriendo nueva pestaña segura...');
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});