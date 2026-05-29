
// Service Worker para notificaciones push
// Versión simplificada sin cacheo para evitar problemas de activación

const CACHE_NAME = 'mascotas-cache-v1';

self.addEventListener('install', (e) => {
    console.log('[SW] Instalando Service Worker...');
    // Activar inmediatamente sin esperar
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    console.log('[SW] Service Worker activado');
    // Tomar control de todas las páginas inmediatamente
    e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
    // Network only - sin cacheo para evitar problemas
    e.respondWith(fetch(e.request));
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
    
    console.log('[SW] Mostrando notificación:', title, options);
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

    console.log('[SW] Abriendo URL:', targetUrl);

    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Buscar si ya hay una ventana abierta y navegar a ella
            for (const client of clientList) {
                if ('focus' in client) {
                    return client.focus().then(() => client.navigate(targetUrl));
                }
            }
            // Si no hay ventana abierta, abrir una nueva
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
            return null;
        })
    );
});