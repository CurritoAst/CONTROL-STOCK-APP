// Service Worker for Web Push Notifications - Proyecto Macario
// This file must be at the root of public/ to have correct scope

self.addEventListener('push', function (event) {
    const data = event.data ? event.data.json() : {};
    const title = data.title || '📦 Notificación';
    const options = {
        body: data.body || 'Tienes nuevas actualizaciones.',
        icon: '/logo-duke.jpg',
        badge: '/logo-duke.jpg',
        vibrate: [200, 100, 200],
        requireInteraction: true, // Crucial para iOS Lock Screen
        data: {
            url: data.url || '/'
        }
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
