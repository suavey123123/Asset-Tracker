// DEPRECATED — was causing page reload loops on Vercel.
// This SW must NOT be registered. If the browser finds this file,
// it should be killed by the kill script in index.html.
//
// Accept SHUTDOWN/KILL messages and terminate.
self.addEventListener('message', function(e) {
  if (e.data && (e.data.type === 'SHUTDOWN' || e.data.type === 'KILL')) {
    // Force self-termination — this tells the browser to abandon this SW
    try { self.skipWaiting() } catch(e) {}
    // We cannot truly kill ourselves, but we can stop responding to fetch
    self.addEventListener('fetch', function() {}, { once: true })
  }
})
