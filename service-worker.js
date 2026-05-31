// ============================================
// SERVICE WORKER DESABILITADO
// Para evitar problemas de cache infinito
// ============================================

// Desregistrar automaticamente ao carregar
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      // Deletar TODOS os caches
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('🗑️ Removendo cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      // Desregistrar o service worker
      return self.registration.unregister();
    })
  );
  self.clients.claim();
});

// Não interceptar nenhuma requisição
self.addEventListener('fetch', (event) => {
  // Deixar passar direto sem cache
  return;
});
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response
        const responseToCache = response.clone();
        
        // Cache the fetched response for future use (only GET requests)
        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });
        
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request)
          .then((response) => {
            if (response) {
              return response;
            }
            
            // If not in cache and it's a navigation request, return index.html
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
            
            return new Response('Offline - conteúdo não disponível', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// Background Sync (optional - for future enhancements)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncTransactions());
  }
});

async function syncTransactions() {
  // This will be implemented when we add offline transaction support
  console.log('🔄 Sincronizando transações...');
}

// Push Notifications (optional - for future enhancements)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Nova notificação',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification('Gestão de Orçamento', options)
  );
});

// Notification Click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
