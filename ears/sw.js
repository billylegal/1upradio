// Magic Ears: a tiny service worker so the browser offers "Install app". It caches nothing (the listening happens on Billy's PC).
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () {});
