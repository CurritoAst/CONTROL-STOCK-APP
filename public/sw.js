// Service Worker - Proyecto Macario
// Maneja notificaciones push Y limpia la caché en cada deploy nuevo
// para evitar el bucle de pantalla negra en móvil.

const SW_VERSION = 'v' + Date.now(); // Cambia en cada deploy

// --- INSTALACIÓN: tomar control inmediatamente ---
self.addEventListener('install', function (event) {
    self.skipWaiting();
});

// --- ACTIVACIÓN: borrar TODA la caché vieja ---
self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (cacheNames) {
            return Promise.all(
                cacheNames.map(function (cacheName) {
                    return caches.delete(cacheName);
                })
            );
        }).then(function () {
            return self.clients.claim();
        })
    );
});

// --- FETCH: red primero, si falla por chunk obsoleto → recarga la página ---
self.addEventListener('fetch', function (event) {
    // Solo interceptar peticiones del mismo origen
    if (!event.request.url.startsWith(self.location.origin)) return;

    event.respondWith(
        fetch(event.request).catch(function (error) {
            // Si el chunk de JS no se puede cargar (deploy nuevo), recargar la página
            if (event.request.destination === 'script' || event.request.url.includes('/assets/')) {
                return self.clients.matchAll().then(function (clients) {
                    clients.forEach(function (client) {
                        client.postMessage({ type: 'RELOAD_PAGE' });
                    });
                    return new Response('', { status: 503 });
                });
            }
            throw error;
        })
    );
});

// --- NOTIFICACIONES PUSH ---
self.addEventListener('push', function (event) {
    const data = event.data ? event.data.json() : {};
    const title = data.title || '📦 Notificación';
    const options = {
        body: data.body || 'Tienes nuevas actualizaciones.',
        icon: '/logo-duke.jpg',
        badge: '/logo-duke.jpg',
        vibrate: [200, 100, 200],
        requireInteraction: true,
        data: { url: data.url || '/' }
    };
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});
