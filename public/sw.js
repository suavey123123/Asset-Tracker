// This file intentionally returns nothing.
// Previously a service worker that caused page reload loops on Vercel.
// The SW registration was removed in main.jsx. The browser may still have
// cached SW registrations from older deployments — those will expire and
// be garbage-collected by the browser automatically over time.
//
// DO NOT restore this file. If someone needs offline support, use a
// proper approach: workbox, cache-busting, and no clients.claim().
