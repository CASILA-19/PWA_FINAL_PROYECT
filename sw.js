// Service Worker para notificaciones push y Offline Support

// 1. CAMBIAMOS LA VERSIÓN PARA FORZAR LA ACTUALIZACIÓN
const VERSION = 'v4';
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

    // 2. HACEMOS EL CACHÉ RESISTENTE A ERRORES
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
    // 1. Peticiones a la API: Siempre van directamente a internet
    if (e.request.url.includes('/api/')) {
        return e.respondWith(fetch(e.request)); 
    }

    // 2. NETWORK FIRST para archivos HTML (Vistas como index.html, mapa.html, etc.)
    if (e.request.mode === 'navigate' || (e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html'))) {
        e.respondWith(
            fetch(e.request)
                .then(networkResponse => {
                    // Si hay internet, servimos la página nueva y actualizamos el caché dinámico
                    return caches.open(CACHE_DYNAMIC).then(cache => {
                        cache.put(e.request, networkResponse.clone());
                        return networkResponse;
                    });
                })
                .catch(() => {
                    // Si falla la red (offline), buscamos la página en cualquier caché
                    return caches.match(e.request).then(cachedResponse => {
                        // Si no la encuentra (ej. intentó entrar directo a una página no cacheada), 
                        // lo mandamos al index.html para que la app no se rompa
                        return cachedResponse || caches.match('/index.html');
                    });
                })
        );
        return; 
    }

    // 3. CACHE FIRST para el resto (CSS, JS, Imágenes)
    e.respondWith(
        caches.match(e.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse; // Devuelve desde caché si existe
            
            // Si no está en caché, va a la red y lo guarda dinámicamente
            return fetch(e.request).then((networkResponse) => {
                if ((e.request.url.startsWith('http://') || e.request.url.startsWith('https://')) && e.request.method === 'GET') {
                    caches.open(CACHE_DYNAMIC).then((cache) => {
                        cache.put(e.request, networkResponse.clone());
                        limpiarCache(CACHE_DYNAMIC, 50);
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
    const baseUrl = data.url || '/mapa.html';
    const targetUrl = data.idCenso
        ? `${baseUrl}?idCenso=${encodeURIComponent(data.idCenso)}`
        : baseUrl;

    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) {
                    return client.focus().then(() => client.navigate(targetUrl));
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
            return null;
        })
    );
});