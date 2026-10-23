/* Service worker: caché offline + notificaciones push */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

self.skipWaiting();
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() }; }
  const scope = self.registration.scope;
  event.waitUntil(
    self.registration.showNotification(data.title || 'BotanIQ', {
      body: data.body || 'Tienes plantas que regar',
      icon: scope + 'icon-192-tulipan.png',
      badge: scope + 'icon-192-tulipan.png',
      tag: data.tag || 'riego',
      renotify: true,
      data: { url: data.url || scope },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow(url);
    })
  );
});
