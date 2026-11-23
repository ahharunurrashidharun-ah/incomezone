// IncomeZone Service Worker for Mobile & Desktop System Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'IncomeZone নোটিফিকেশন',
    message: 'আপনার একটি নতুন আপডেট এসেছে।',
    url: '/notifications',
    tag: `iz_push_${Date.now()}`,
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = {
        ...payload,
        ...parsed,
        message: parsed.message || parsed.body || payload.message,
      };
    } catch {
      const text = event.data.text();
      if (text) payload.message = text;
    }
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(payload.title, {
        body: payload.message,
        icon: '/assets/aistudio/1795356168824_9e1cf2d3.jpg',
        badge: '/assets/aistudio/1795356168824_9e1cf2d3.jpg',
        tag: payload.tag,
        renotify: false,
        silent: Boolean(payload.silent),
        data: { url: payload.url || '/notifications' },
      }),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          try {
            client.postMessage({ type: 'PUSH_DELIVERED', tag: payload.tag });
          } catch {}
        }
      }),
    ])
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'SHOW_NOTIFICATION') return;

  const title = data.title || 'IncomeZone';
  const body = data.body || '';
  const tag = data.tag || `iz_msg_${Date.now()}`;
  const url = data.url || '/notifications';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/assets/aistudio/1795356168824_9e1cf2d3.jpg',
      badge: '/assets/aistudio/1795356168824_9e1cf2d3.jpg',
      tag,
      renotify: false,
      silent: Boolean(data.silent),
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetPath = (event.notification && event.notification.data && event.notification.data.url) || '/notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && targetPath) {
            try {
              const targetUrl = new URL(targetPath, self.location.origin).href;
              return client.navigate(targetUrl).catch(() => undefined);
            } catch {
              return undefined;
            }
          }
          return undefined;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetPath);
      }
      return undefined;
    })
  );
});
