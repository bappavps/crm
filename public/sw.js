self.addEventListener('install', (event) => {
  console.log('Shree ERP Service Worker: Installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Shree ERP Service Worker: Activated');
});

self.addEventListener('fetch', (event) => {
  // Standard pass-through for network requests
  // Necessary for PWA installability criteria
});
