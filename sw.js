// ===== DINÁMITA POS v4.8 BODEGA – Service Worker =====
const CACHE_NAME = "dinamita-pos-v48-cache-v1";
const FILES_TO_CACHE = [
  "./","./index.html","./styles.css","./app.js","./manifest.json","./icon-192.png","./icon-512.png"
];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(FILES_TO_CACHE))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k!==CACHE_NAME && caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => { e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))); });
