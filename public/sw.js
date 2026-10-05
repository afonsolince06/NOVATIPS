// Service Worker — Nova TIPS Push Notifications
// Handles incoming push events and notification clicks

self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  const title = data.title ?? '🎯 Nova TIPS';
  const options = {
    body: data.body ?? 'Nova aposta disponível — vai apostar!',
    icon: '/logo.jpg.jpeg',
    badge: '/logo.jpg.jpeg',
    vibrate: [200, 100, 200],
    tag: data.tag ?? 'nova-bet',
    requireInteraction: false,
    data: { url: data.url ?? '/' },
    actions: [
      { action: 'open', title: '🎯 Ver aposta' },
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// Cache basic assets for offline support
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});
