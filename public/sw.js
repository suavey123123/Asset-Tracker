const CACHE_NAME = 'asset-tracker-v3'
const ASSET_CACHE = 'asset-data-v1'

const STATIC_ASSETS = ['/', '/index.html', '/manifest.json']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_NAME && k !== ASSET_CACHE)
        .map(k => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  if (event.request.method !== 'GET') return
  if (url.protocol === 'chrome-extension:') return

  // Supabase API - network first, cache for offline fallback
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request.clone())
        .then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(ASSET_CACHE).then(c => c.put(event.request, clone))
          }
          return res
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // HTML - network first
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone))
          return res
        })
        .catch(() => caches.match(event.request).then(r => r || caches.match('/')))
    )
    return
  }

  // JS/CSS/assets - cache first with background update
  if (url.pathname.match(/\.(js|css|woff2?|ttf|svg|png|ico|webp)$/)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(res => {
          caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()))
          return res
        })
        return cached || fetchPromise
      })
    )
    return
  }

  // Default - network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res.ok) caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()))
        return res
      })
      .catch(() => caches.match(event.request))
  )
})

// Handle messages from app
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
  if (event.data === 'CACHE_ASSETS') {
    // App will post asset data to cache manually
    event.ports?.[0]?.postMessage({ status: 'ok' })
  }
})
