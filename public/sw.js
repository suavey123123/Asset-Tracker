const CACHE_NAME = 'asset-tracker-v2'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
]

// Install - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Activate - clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch strategy:
// - HTML: network first, fall back to cache (always fresh app shell)
// - JS/CSS: cache first with network update (fast loads)
// - Supabase API: network only (always fresh data)
// - Everything else: network first with cache fallback
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Skip non-GET and chrome-extension requests
  if (event.request.method !== 'GET') return
  if (url.protocol === 'chrome-extension:') return

  // Supabase API - always network
  if (url.hostname.includes('supabase.co')) return

  // HTML pages - network first
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

  // JS/CSS/fonts - cache first
  if (url.pathname.match(/\.(js|css|woff2?|ttf|svg|png|ico)$/)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const network = fetch(event.request).then(res => {
          caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()))
          return res
        })
        return cached || network
      })
    )
    return
  }

  // Default - network first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone))
        }
        return res
      })
      .catch(() => caches.match(event.request))
  )
})

// Listen for skip waiting message
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})
