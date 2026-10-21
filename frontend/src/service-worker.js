const CACHE_NAME = 'benchmaster-shell-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('benchmaster-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put('/', response.clone()));
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match('/'))));
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')
    || ['script', 'style', 'image', 'font'].includes(request.destination)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
      return response;
    })));
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let message;
  try {
    message = event.data.json();
  } catch {
    message = { title: 'BenchMaster', body: event.data.text(), url: '/' };
  }
  event.waitUntil(self.registration.showNotification(message.title || 'BenchMaster', {
    body: message.body || 'Une nouvelle proposition de match est disponible.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: message.url || '/' },
    tag: message.tag || 'benchmaster-friendly-proposal'
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) return existing.navigate(target).then(() => existing.focus());
    return self.clients.openWindow(target);
  }));
});
