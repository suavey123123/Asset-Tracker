const CACHE_NAME = 'asset-tracker-v4'

self.addEventListener('install', event => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Skip non-GET, chrome-extension, and Supabase API calls entirely
  if (event.request.method !== 'GET') return
  if (url.protocol === 'chrome-extension:') return
  if (url.hostname.includes('supabase.co')) return
  if (url.hostname.includes('qrserver.com')) return

  // Network first for HTML
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    )
    return
  }

  // Cache first for static assets (JS, CSS, fonts, images)
  if (url.pathname.match(/\.(js|css|woff2?|ttf|svg|png|ico|webp|jpg|jpeg)$/)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached
          return fetch(event.request).then(res => {
            if (res.ok) cache.put(event.request, res.clone())
            return res
          })
        })
      )
    )
    return
  }

  // Default: network only, no caching
  // This avoids the clone() error on non-cacheable responses
})

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})
