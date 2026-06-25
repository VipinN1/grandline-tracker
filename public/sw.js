// Minimal service worker — enables "install" on Android/Chrome and a basic
// offline fallback. Uses a network-first strategy so users always get fresh
// content when online (important for a Supabase-backed app), falling back to
// cache only when the network is unavailable.

const CACHE = 'piratetracker-v1'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/favicon.svg']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {}))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only handle same-origin GET requests. Let everything else (Supabase,
  // card-image proxy, fonts, POSTs, etc.) hit the network untouched.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return
  }

  // Network-first, fall back to cache. For navigations, fall back to the
  // cached app shell so the SPA still boots offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone()
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {})
        return response
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match('/index.html'))
      )
  )
})
