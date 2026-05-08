

//APP-SHELL 

const CACHE_INMUTABLE = 'cache-inmutable';
const CACHE_STATIC = 'cache-static';
const CACHE_DYNAMIC = 'cache-dynamic';

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
    const cacheStatic = caches.open(CACHE_STATIC).then(cache => {
        return cache.addAll([
            '/',
            '/index.html',
            '/js/app.js',
            '/favicon.ico',
            '/not-found.html',
            '/img/not-found.png',
            '/img/logo.jpg',
        ]);
    });
    const cacheInmutable = caches.open(CACHE_INMUTABLE).then(cache => {
        return cache.addAll([
            'https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css',
            'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
            'https://unpkg.com/leaflet/dist/leaflet.css',
            'https://unpkg.com/leaflet/dist/leaflet.js',
            'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
            'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
            'https://cdn.jsdelivr.net/npm/pouchdb@9.0.0/dist/pouchdb.min.js',
        ]);
    });
    e.waitUntil(Promise.all([cacheStatic, cacheInmutable]));
});

self.addEventListener('fetch', (e) => {
    const respuesta = caches.match(e.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(e.request).then((networkResponse) => {
            // Solo cachear si el esquema es http o https y el método es GET
            if ((e.request.url.startsWith('http://') || e.request.url.startsWith('https://')) && e.request.method === 'GET') {
                caches.open(CACHE_DYNAMIC).then((cache) => {
                    cache.put(e.request, networkResponse.clone());
                    limpiarCache(CACHE_DYNAMIC, 50);
                });
            }
            return networkResponse.clone();
        });
    }).catch(() => {
        if (e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html')) {
            return caches.match('/not-found.html');
        }
        if (e.request.headers.get('accept') && e.request.headers.get('accept').includes('image')) {
            return caches.match('/img/not-found.png');
        }
    });

    e.respondWith(respuesta);
});

self.addEventListener('push', (e) => {
    console.log('Push recibido:', e.data ? e.data.text() : 'No payload');
    const data = JSON.parse(e.data.text());
    const title = data.titulo || 'Notificación';
    const options = {
        body: data.cuerpo || 'Tienes una nueva notificación.',
        icon: data.icon || '/img/logo.jpg',
        badge: data.badge || '/favicon.ico',
        vibrate: [100, 50, 100 , 50, 100],
        openUrl: data.url || '/',
        data: {
            url: data.url || 'https://google.com',
            id: data.usuario || Date.now()
        }
    };
    // console.log('Notificación recibida:', data,options);
    e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclose', (e) => {
    e.notification.close();
    console.log('Notificación cerrada');
});

self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    const notificacion = e.notification;
    const accion = e.action;
    console.log('Notificación clicada:', notificacion, 'Acción:', accion);
    
    // Abrir URL si está disponible
    const urlToOpen = notificacion.data?.url || notificacion.openUrl || '/';
    e.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            // Buscar si ya hay una ventana abierta
            for (const client of clientList) {
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            // Si no hay ventana abierta, abrir una nueva
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});