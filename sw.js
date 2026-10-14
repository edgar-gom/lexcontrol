const CACHE_NAME = 'lexcontrol-v3';
// Solo colocamos los archivos propios de la app para evitar bloqueos CORS en la instalación
const ASSETS = [
    './',
    './index.html',
    './app.js',
    './manifest.json'
];

// 1. Instalación ligera solo con recursos locales
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// 2. Activación y limpieza de cachés antiguas
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            );
        })
    );
    self.clients.claim();
});

// 3. Intercepción y almacenamiento dinámico (Guarda Firebase y todo automáticamente al navegar con red)
self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request)
            .then((networkResponse) => {
                // Si la petición a Firebase o archivos es exitosa, la guardamos en caché al vuelo
                if (networkResponse && networkResponse.status === 200) {
                    let responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(e.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // Si estás sin conexión, servimos los archivos y datos almacenados
                return caches.match(e.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // Si intenta navegar a una ruta y no hay red, devuelve el index principal
                    if (e.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});
