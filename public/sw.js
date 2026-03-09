// Service Worker for Web Push Notifications
self.addEventListener('push', function(event) {
  let data = { title: 'Nueva notificación', body: 'Tenés una nueva alerta.', icon: '/favicon.ico' };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    // fallback
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [200, 100, 200],
      tag: 'barbershop-notification',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes('/admin') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow('/admin');
    })
  );
});
